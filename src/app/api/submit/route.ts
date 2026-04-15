import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { z } from 'zod';
import BCNPDFDocument from '@/components/BCNPDFDocument';
import { getLocationNpi } from '@/data/locations';
import { sendFax } from '@/lib/telnyx';
import { sendSubmissionConfirmation } from '@/lib/email';
import { ratelimit } from '@/lib/ratelimit';
import { verifyTurnstile } from '@/lib/turnstile';

// ── Zod schema ────────────────────────────────────────────────────────────────
const submitSchema = z.object({
  // Security fields (stripped before DB insert)
  turnstileToken: z.string().min(1, 'Security check required'),
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
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
  const ip = getClientIp(req);

  // ── 1. Rate limit ──────────────────────────────────────────────────────────
  const { success: withinLimit } = await ratelimit.limit(ip);
  if (!withinLimit) {
    return NextResponse.json(
      { error: 'Too many submissions. Please wait an hour and try again.' },
      { status: 429 }
    );
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

  // ── 4. Turnstile verification ─────────────────────────────────────────────
  const turnstileOk = await verifyTurnstile(body.turnstileToken, ip);
  if (!turnstileOk) {
    return NextResponse.json(
      { error: 'Security check failed. Please refresh and try again.' },
      { status: 403 }
    );
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
        ? `NPI ${npi} - ${urgentCareLocation}`
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
    }])
    .select('id')
    .single();

  if (submissionError || !submission) {
    console.error('Supabase insert error:', submissionError);
    return NextResponse.json({ error: submissionError?.message ?? 'DB error' }, { status: 500 });
  }

  const submissionId: string = submission.id;

  // ── 6. Generate PDF server-side ───────────────────────────────────────────
  const pdfBuffer = await renderToBuffer(
    // renderToBuffer expects DocumentProps — our wrapper is valid at runtime
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createElement(BCNPDFDocument, { data: body as any }) as any
  );

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
  }

  // ── 9. Send confirmation email (non-blocking) ─────────────────────────────
  if (email) {
    sendSubmissionConfirmation({
      to: email,
      enrolleeName: enrolleeName || 'Member',
      patientName: patientName || 'Patient',
      submissionId,
    }).catch((err) => console.error('Confirmation email error:', err));
  }

  return NextResponse.json({ success: true, id: submissionId }, { status: 201 });
}
