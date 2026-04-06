import { Resend } from 'resend';

// Lazily instantiated so build doesn't fail without env vars
function getResend() {
  return new Resend(process.env.RESEND_API_KEY!);
}

const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev';
const APP_NAME = 'BCN Reimbursement Helper';

export async function sendSubmissionConfirmation({
  to,
  enrolleeName,
  patientName,
  submissionId,
}: {
  to: string;
  enrolleeName: string;
  patientName: string;
  submissionId: string;
}) {
  const resend = getResend();
  await resend.emails.send({
    from: `${APP_NAME} <${FROM_ADDRESS}>`,
    to,
    subject: 'Your BCN Reimbursement Form Has Been Submitted',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
        <div style="background: #003087; padding: 20px 24px; border-radius: 6px 6px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">BCN Reimbursement Form Submitted</h1>
        </div>
        <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 6px 6px;">
          <p>Hi <strong>${enrolleeName}</strong>,</p>
          <p>Your Blue Care Network Member Reimbursement Form for <strong>${patientName}</strong> has been received and is being faxed to BCN now.</p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0 0 8px; font-size: 13px; color: #64748b;">Submission details</p>
            <p style="margin: 0; font-size: 13px;"><strong>Reference ID:</strong> ${submissionId}</p>
            <p style="margin: 4px 0 0; font-size: 13px;"><strong>Faxing to:</strong> BCN Member Reimbursements — 1-866-637-4972</p>
          </div>
          <p>You'll receive another email once we confirm BCN's fax machine received the document. BCN allows <strong>30 days for processing</strong> after receipt.</p>
          <p>If you have questions, call BCN Customer Service at <strong>1-800-662-6667</strong> (Mon–Fri, 8am–5:30pm).</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="font-size: 12px; color: #94a3b8; margin: 0;">This is an automated message. Please keep a copy of all documents you submitted.</p>
        </div>
      </div>
    `,
  });
}

export async function sendFaxDeliveredEmail({
  to,
  enrolleeName,
  submissionId,
}: {
  to: string;
  enrolleeName: string;
  submissionId: string;
}) {
  const resend = getResend();
  await resend.emails.send({
    from: `${APP_NAME} <${FROM_ADDRESS}>`,
    to,
    subject: '✓ BCN Confirmed Receipt of Your Reimbursement Form',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
        <div style="background: #16a34a; padding: 20px 24px; border-radius: 6px 6px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">✓ Fax Delivered Successfully</h1>
        </div>
        <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 6px 6px;">
          <p>Hi <strong>${enrolleeName}</strong>,</p>
          <p>BCN's fax machine confirmed receipt of your reimbursement form. Your claim is now in their hands.</p>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0 0 4px; font-size: 13px;"><strong>Reference ID:</strong> ${submissionId}</p>
            <p style="margin: 0; font-size: 13px;"><strong>Status:</strong> Delivered to BCN</p>
          </div>
          <p>Allow <strong>30 days</strong> for BCN to process your claim. If you haven't heard back after 30 days, call <strong>1-800-662-6667</strong>.</p>
        </div>
      </div>
    `,
  });
}

export async function sendFaxFailedEmail({
  to,
  enrolleeName,
  submissionId,
  attempt,
  maxAttempts,
}: {
  to: string;
  enrolleeName: string;
  submissionId: string;
  attempt: number;
  maxAttempts: number;
}) {
  const resend = getResend();
  const isFinal = attempt >= maxAttempts;

  await resend.emails.send({
    from: `${APP_NAME} <${FROM_ADDRESS}>`,
    to,
    subject: isFinal
      ? '⚠️ Unable to fax your BCN form — manual action needed'
      : `Fax attempt ${attempt}/${maxAttempts} failed — retrying`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
        <div style="background: ${isFinal ? '#dc2626' : '#d97706'}; padding: 20px 24px; border-radius: 6px 6px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">${isFinal ? '⚠️ Fax Failed — Action Needed' : `Fax Attempt ${attempt}/${maxAttempts} Failed`}</h1>
        </div>
        <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 6px 6px;">
          <p>Hi <strong>${enrolleeName}</strong>,</p>
          ${isFinal
            ? `<p>We were unable to deliver your reimbursement form to BCN after ${maxAttempts} attempts. You will need to submit it manually.</p>
               <p><strong>Fax it manually to:</strong> 1-866-637-4972<br/>
               <strong>Or mail to:</strong> Member Reimbursements - G802, Blue Care Network, P.O. Box 68767, Grand Rapids, MI 49516-8767</p>`
            : `<p>Fax attempt ${attempt} failed. We'll automatically retry shortly.</p>`
          }
          <p style="font-size: 13px; color: #64748b;">Reference ID: ${submissionId}</p>
        </div>
      </div>
    `,
  });
}
