import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import BCNPDFDocument from '@/components/BCNPDFDocument';
import { sendFax } from '@/lib/telnyx';
import { sendSubmissionConfirmation } from '@/lib/email';
import type { FormData } from '@/types/form';

const MAX_FAX_ATTEMPTS = 3;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase();

  try {
    const body: FormData = await req.json();
    const {
      email,
      enrolleeId,
      enrolleeName,
      patientName,
      patientDob,
      address,
      city,
      stateZip,
      claimDescription,
      signatureData,
      signatureDate,
    } = body;

    // 1. Save submission to Supabase
    const { data: submission, error: submissionError } = await supabase
      .from('reimbursement_submissions')
      .insert([{
        email: email ?? '',
        enrollee_id: enrolleeId ?? '',
        enrollee_name: enrolleeName ?? '',
        patient_name: patientName ?? '',
        patient_dob: patientDob || null,
        address: address ?? '',
        city: city ?? '',
        state_zip: stateZip ?? '',
        claim_description: claimDescription ?? '',
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

    // 2. Generate PDF server-side
    // renderToBuffer expects DocumentProps but our wrapper component is valid — cast to silence TS
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(
      createElement(BCNPDFDocument, { data: body }) as any
    );

    // 3. Upload PDF to Supabase Storage
    const pdfPath = `${submissionId}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('reimbursement-pdfs')
      .upload(pdfPath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      console.error('PDF upload error:', uploadError);
      // Don't block submission — log and continue without fax
      return NextResponse.json({
        success: true,
        id: submissionId,
        warning: 'Form saved but PDF upload failed. Fax not sent.',
      }, { status: 201 });
    }

    // 4. Get public URL for Telnyx
    const { data: urlData } = supabase.storage
      .from('reimbursement-pdfs')
      .getPublicUrl(pdfPath);

    const pdfPublicUrl = urlData.publicUrl;

    // 5. Create fax job record
    const { data: faxJob, error: faxJobError } = await supabase
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

    if (faxJobError || !faxJob) {
      console.error('Fax job create error:', faxJobError);
    }

    // 6. Send fax via Telnyx
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/fax/webhook`;

    try {
      const faxResult = await sendFax({ mediaUrl: pdfPublicUrl, webhookUrl });

      // Update fax job with Telnyx fax ID
      await supabase
        .from('fax_jobs')
        .update({
          telnyx_fax_id: faxResult.id,
          status: 'sending',
          attempts: 1,
        })
        .eq('id', faxJob?.id);

    } catch (faxError) {
      console.error('Fax send error:', faxError);
      await supabase
        .from('fax_jobs')
        .update({ status: 'failed', error_message: String(faxError) })
        .eq('id', faxJob?.id);
    }

    // 7. Send confirmation email (non-blocking — don't fail submission if email fails)
    if (email) {
      sendSubmissionConfirmation({
        to: email,
        enrolleeName: enrolleeName || 'Member',
        patientName: patientName || 'Patient',
        submissionId,
      }).catch((err) => console.error('Confirmation email error:', err));
    }

    return NextResponse.json({ success: true, id: submissionId }, { status: 201 });

  } catch (err) {
    console.error('Unexpected error in /api/submit:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
