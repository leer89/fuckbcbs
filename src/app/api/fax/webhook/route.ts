import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendFax } from '@/lib/telnyx';
import { sendFaxDeliveredEmail, sendFaxFailedEmail } from '@/lib/email';

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
    const body = await req.json();

    // Telnyx webhook payload shape
    const eventType: string = body?.data?.event_type ?? '';
    const payload = body?.data?.payload ?? {};
    const telnyxFaxId: string = payload?.fax_id ?? payload?.id ?? '';

    if (!telnyxFaxId) {
      return NextResponse.json({ error: 'Missing fax_id' }, { status: 400 });
    }

    // Look up fax job by Telnyx fax ID
    const { data: faxJob, error: lookupError } = await supabase
      .from('fax_jobs')
      .select('id, submission_id, attempts, pdf_storage_path, status')
      .eq('telnyx_fax_id', telnyxFaxId)
      .single();

    if (lookupError || !faxJob) {
      console.error('Fax job lookup failed:', lookupError, 'telnyx_fax_id:', telnyxFaxId);
      // Return 200 so Telnyx doesn't keep retrying
      return NextResponse.json({ ok: true });
    }

    // Fetch submission for email details
    const { data: submission } = await supabase
      .from('reimbursement_submissions')
      .select('email, enrollee_name, patient_name')
      .eq('id', faxJob.submission_id)
      .single();

    const email: string = submission?.email ?? '';
    const enrolleeName: string = submission?.enrollee_name ?? 'Member';

    if (eventType === 'fax.delivered' || payload?.status === 'delivered') {
      // ── Fax delivered ────────────────────────────────────────────────────────
      await supabase
        .from('fax_jobs')
        .update({ status: 'delivered', updated_at: new Date().toISOString() })
        .eq('id', faxJob.id);

      if (email) {
        sendFaxDeliveredEmail({
          to: email,
          enrolleeName,
          submissionId: faxJob.submission_id,
        }).catch((err) => console.error('Delivered email error:', err));
      }

    } else if (eventType === 'fax.failed' || payload?.status === 'failed') {
      // ── Fax failed — retry up to MAX_FAX_ATTEMPTS ────────────────────────────
      const attempt = (faxJob.attempts ?? 1) + 1;

      if (attempt <= MAX_FAX_ATTEMPTS && faxJob.pdf_storage_path) {
        // Get PDF URL and retry
        const { data: urlData } = supabase.storage
          .from('reimbursement-pdfs')
          .getPublicUrl(faxJob.pdf_storage_path);

        const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/fax/webhook`;

        try {
          const faxResult = await sendFax({
            mediaUrl: urlData.publicUrl,
            webhookUrl,
          });

          await supabase
            .from('fax_jobs')
            .update({
              telnyx_fax_id: faxResult.id,
              status: 'sending',
              attempts: attempt,
              error_message: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', faxJob.id);

        } catch (retryError) {
          await supabase
            .from('fax_jobs')
            .update({
              status: 'failed',
              attempts: attempt,
              error_message: String(retryError),
              updated_at: new Date().toISOString(),
            })
            .eq('id', faxJob.id);
        }
      } else {
        // All retries exhausted
        await supabase
          .from('fax_jobs')
          .update({
            status: 'failed',
            attempts: attempt,
            error_message: payload?.failure_reason ?? 'Max attempts reached',
            updated_at: new Date().toISOString(),
          })
          .eq('id', faxJob.id);
      }

      if (email) {
        sendFaxFailedEmail({
          to: email,
          enrolleeName,
          submissionId: faxJob.submission_id,
          attempt,
          maxAttempts: MAX_FAX_ATTEMPTS,
        }).catch((err) => console.error('Failed email error:', err));
      }
    }

    return NextResponse.json({ ok: true });

  } catch (err) {
    console.error('Webhook handler error:', err);
    // Always return 200 to Telnyx to prevent flood retries
    return NextResponse.json({ ok: true });
  }
}
