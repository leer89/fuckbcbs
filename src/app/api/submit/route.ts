import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { z } from 'zod';
import { PDFDocument } from 'pdf-lib';
import BCNPDFDocument from '@/components/BCNPDFDocument';
import { getLocationNpi } from '@/data/locations';
import { sendFax } from '@/lib/telnyx';
import { sendSubmissionConfirmation } from '@/lib/email';
import { ratelimit } from '@/lib/ratelimit';
import { verifyTurnstile } from '@/lib/turnstile';

// ── Zod schema ────────────────────────────────────────────────────────────────
const submitSchema = z.object({
  // Security fields (stripped before DB insert)
  turnstileToken: z.string().optional().default(''),
  honeypot: z.string().max(0, 'Bot detected').optional().default(''),

  // Medical form fields
  email: z.string().email('Invalid email address').max(254),
  enrolleeId: z.string().max(50).default(''),
  enrolleeName: z.string().max(100).default(''),
  patientName: z.string().max(100).default(''),
  patientDob: z.string().optional().default(''),
  address: z.string().max(200).default(''),
  city: z.string().max(100).default(''),
  stateZip: z.string().max(20).default(''),
  claimDescription: z.string().max(5000).default(''),
  urgentCareLocation: z.string().max(200).optional().default(''),
  selectedMedicalCodes: z.array(z.string().max(200)).max(100).optional().default([]),
  signatureData: z.string().optional().default(''),
  signatureDate: z.string().optional().default(''),
  receipts: z.array(z.object({
    url: z.string().max(500),
    label: z.string().max(200).default(''),
    name: z.string().max(200).default(''),
  })).max(20).optional().default([]),
});

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}

export async function POST(req: NextRequest) {
  try {
    return await handlePost(req);
  } catch (err) {
    console.error('Unhandled submit error:', err);
    return NextResponse.json(
      { error: `Server error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}

async function handlePost(req: NextRequest) {
  const ip = getClientIp(req);

  // ── 1. Rate limit ──────────────────────────────────────────────────────────
  // Fail-open: if Upstash is misconfigured or down, let the request through
  // rather than crashing the route. Honeypot + Turnstile still protect us.
  try {
    const { success: withinLimit } = await ratelimit.limit(ip);
    if (!withinLimit) {
      return NextResponse.json(
        { error: 'Too many submissions. Please wait an hour and try again.' },
        { status: 429 }
      );
    }
  } catch (err) {
    console.error('Rate limit check failed (fail-open):', err);
  }

  // ── 2. Parse + validate body with Zod ─────────────────────────────────────
  let body: z.infer<typeof submitSchema>;
  try {
    const raw = await req.json();
    body = submitSchema.parse(raw);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const messages = err.issues.map((e) => e.message).join(', ');
      return NextResponse.json({ error: messages }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // ── 3. Honeypot check ─────────────────────────────────────────────────────
  if (body.honeypot && body.honeypot.length > 0) {
    // Silently reject bots — return 200 so they think it worked
    return NextResponse.json({ success: true, id: 'bot' }, { status: 200 });
  }

  // ── 4. Turnstile verification (best-effort) ───────────────────────────────
  // Only verify if a token was actually issued — Turnstile's invisible mode
  // fails on some browsers/networks (PAT 401, extensions, etc.).
  // Rate limiting (step 1) + honeypot (step 3) are the real bot protection.
  if (body.turnstileToken) {
    const turnstileOk = await verifyTurnstile(body.turnstileToken, ip);
    if (!turnstileOk) {
      return NextResponse.json(
        { error: 'Security check failed. Please refresh and try again.' },
        { status: 403 }
      );
    }
  }

  // ── 5. Save submission to Supabase ────────────────────────────────────────
  const supabase = getSupabase();
  const {
    email, enrolleeId, enrolleeName, patientName,
    patientDob, address, city, stateZip,
    claimDescription, urgentCareLocation, selectedMedicalCodes,
    signatureData, signatureDate,
  } = body;

  // Compose the full claim description from structured + free-text fields
  const fullClaimDescription = (() => {
    const parts: string[] = [];
    if (urgentCareLocation) {
      const npi = getLocationNpi(urgentCareLocation);
      const locationLine = npi
        ? `${urgentCareLocation}, NPI: ${npi}`
        : urgentCareLocation;
      parts.push(locationLine);
      for (const code of selectedMedicalCodes ?? []) {
        parts.push(`- ${code}`);
      }
    }
    if (claimDescription?.trim()) {
      if (parts.length > 0) parts.push('');
      parts.push(claimDescription.trim());
    }
    return parts.join('\n');
  })();

  const { data: submission, error: submissionError } = await supabase
    .from('reimbursement_submissions')
    .insert([{
      email,
      enrollee_id: enrolleeId,
      enrollee_name: enrolleeName,
      patient_name: patientName,
      patient_dob: patientDob || null,
      address,
      city,
      state_zip: stateZip,
      claim_description: fullClaimDescription,
      signature_data: signatureData || null,
      signature_date: signatureDate || null,
      submitter_ip: ip,
    }])
    .select('id')
    .single();

  if (submissionError || !submission) {
    console.error('Supabase insert error:', submissionError);
    return NextResponse.json({ error: submissionError?.message ?? 'DB error' }, { status: 500 });
  }

  const submissionId: string = submission.id;

  // ── 6. Generate PDF server-side ───────────────────────────────────────────
  const formPdfBuffer = await renderToBuffer(
    // renderToBuffer expects DocumentProps — our wrapper is valid at runtime
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createElement(BCNPDFDocument, { data: body as any }) as any
  );

  // Merge any PDF receipts into the form PDF so the fax is one document.
  // Non-PDF receipts (images) are already embedded as pages by BCNPDFDocument.
  const pdfReceipts = (body.receipts ?? []).filter((r) => r.name.toLowerCase().endsWith('.pdf'));

  let pdfBuffer: Buffer;
  if (pdfReceipts.length === 0) {
    pdfBuffer = formPdfBuffer;
  } else {
    const merged = await PDFDocument.load(formPdfBuffer);
    for (const receipt of pdfReceipts) {
      try {
        const res = await fetch(receipt.url);
        if (!res.ok) { console.error(`Failed to fetch PDF receipt: ${receipt.url}`); continue; }
        const receiptBytes = await res.arrayBuffer();
        const receiptDoc = await PDFDocument.load(receiptBytes);
        const pageIndices = receiptDoc.getPageIndices();
        const copiedPages = await merged.copyPages(receiptDoc, pageIndices);
        for (const page of copiedPages) merged.addPage(page);
      } catch (err) {
        console.error(`Failed to merge PDF receipt ${receipt.name}:`, err);
        // Don't abort the whole submission — just skip this attachment
      }
    }
    pdfBuffer = Buffer.from(await merged.save());
  }

  // ── 7. Upload PDF to Supabase Storage ─────────────────────────────────────
  const pdfPath = `${submissionId}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from('reimbursement-pdfs')
    .upload(pdfPath, pdfBuffer, { contentType: 'application/pdf', upsert: false });

  if (uploadError) {
    console.error('PDF upload error:', uploadError);
    return NextResponse.json(
      { success: true, id: submissionId, warning: 'Saved but fax not sent — PDF upload failed.' },
      { status: 201 }
    );
  }

  // ── 8. Create fax job + send fax ──────────────────────────────────────────
  const { data: urlData } = supabase.storage
    .from('reimbursement-pdfs')
    .getPublicUrl(pdfPath);

  const { data: faxJob } = await supabase
    .from('fax_jobs')
    .insert([{
      submission_id: submissionId,
      status: 'queued',
      attempts: 0,
      pdf_storage_path: pdfPath,
      to_number: '+18666374972',
    }])
    .select('id')
    .single();

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/fax/webhook`;

  let faxWarning: string | undefined;
  try {
    const faxResult = await sendFax({ mediaUrl: urlData.publicUrl, webhookUrl });
    await supabase
      .from('fax_jobs')
      .update({ telnyx_fax_id: faxResult.id, status: 'sending', attempts: 1 })
      .eq('id', faxJob?.id);
  } catch (faxError) {
    console.error('Fax send error:', faxError);
    await supabase
      .from('fax_jobs')
      .update({ status: 'failed', error_message: String(faxError) })
      .eq('id', faxJob?.id);
    faxWarning = `Form submitted but fax failed to send: ${faxError instanceof Error ? faxError.message : String(faxError)}. Please fax manually to 1-866-637-4972 or mail to BCN Member Reimbursements - G802, Grand Rapids, MI 49516-8767.`;
  }

  // ── 9. Send confirmation email ────────────────────────────────────────────
  let emailWarning: string | undefined;
  if (email) {
    try {
      await sendSubmissionConfirmation({
        to: email,
        enrolleeName: enrolleeName || 'Member',
        patientName: patientName || 'Patient',
        submissionId,
        pdfBuffer,
        faxFailed: !!faxWarning,
      });
    } catch (err) {
      console.error('Confirmation email error:', err);
      emailWarning = `Confirmation email failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  const warning = faxWarning ?? emailWarning;
  return NextResponse.json(
    { success: true, id: submissionId, ...(warning ? { warning } : {}) },
    { status: 201 }
  );
}
