'use client';

import { useCallback, useState } from 'react';
import SignaturePad from './SignaturePad';
import TurnstileWidget from './TurnstileWidget';
import type { FormData } from '@/types/form';

export interface SecurityTokens {
  turnstileToken: string;
  honeypot: string;
}

interface ReimbursementFormProps {
  data: FormData;
  onChange: (field: keyof FormData, value: string) => void;
  onSubmit: (e: React.FormEvent, security: SecurityTokens) => void;
  isSubmitting: boolean;
  submitSuccess: boolean;
  submitError: string | null;
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}

const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors';

const textareaClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors resize-y';

export default function ReimbursementForm({
  data,
  onChange,
  onSubmit,
  isSubmitting,
  submitSuccess,
  submitError,
}: ReimbursementFormProps) {
  const [honeypot, setHoneypot] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');

  const handleChange = useCallback(
    (field: keyof FormData) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        onChange(field, e.target.value);
      },
    [onChange]
  );

  const handleSignatureSave = useCallback(
    (dataUrl: string) => onChange('signatureData', dataUrl),
    [onChange]
  );

  const handleSignatureClear = useCallback(
    () => onChange('signatureData', ''),
    [onChange]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => onSubmit(e, { turnstileToken, honeypot }),
    [onSubmit, turnstileToken, honeypot]
  );

  const handleTurnstileVerify = useCallback((token: string) => setTurnstileToken(token), []);
  const handleTurnstileExpire = useCallback(() => setTurnstileToken(''), []);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-6 overflow-y-auto h-full">
      {/* Honeypot — hidden from real users, bots fill it in */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }} aria-hidden="true">
        <input
          type="text"
          name="website"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {/* Header */}
      <div className="pb-4 border-b border-gray-200">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 bg-blue-700 rounded-sm flex items-center justify-center">
            <span className="text-white text-xs font-bold">BCN</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Member Reimbursement Form</h1>
            <p className="text-xs text-gray-500">Blue Care Network of Michigan</p>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2 bg-blue-50 border border-blue-100 rounded p-2">
          I paid out of pocket and am requesting reimbursement for medical services.
        </p>
      </div>

      {/* Email */}
      <section>
        <FieldGroup label="Your email address">
          <input
            type="email"
            className={inputClass}
            placeholder="you@example.com"
            value={data.email}
            onChange={handleChange('email')}
            required
          />
        </FieldGroup>
        <p className="text-xs text-gray-400 mt-1">
          We'll send you a confirmation when the form is submitted and again when BCN confirms receipt of the fax.
        </p>
      </section>

      {/* Section 1 - Member Information */}
      <section>
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3 flex items-center gap-2">
          <span className="w-5 h-5 bg-blue-700 text-white rounded-full flex items-center justify-center text-xs">1</span>
          Member Information
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Enrollee ID (on your member ID card)">
            <input
              type="text"
              className={inputClass}
              placeholder="e.g. XYZ123456789"
              value={data.enrolleeId}
              onChange={handleChange('enrolleeId')}
            />
          </FieldGroup>
          <FieldGroup label="Enrollee Name">
            <input
              type="text"
              className={inputClass}
              placeholder="Full name on ID card"
              value={data.enrolleeName}
              onChange={handleChange('enrolleeName')}
            />
          </FieldGroup>
          <FieldGroup label="Patient Name">
            <input
              type="text"
              className={inputClass}
              placeholder="Patient's full name"
              value={data.patientName}
              onChange={handleChange('patientName')}
            />
          </FieldGroup>
          <FieldGroup label="Patient Date of Birth">
            <input
              type="date"
              className={inputClass}
              value={data.patientDob}
              onChange={handleChange('patientDob')}
            />
          </FieldGroup>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3">
          <FieldGroup label="Address">
            <input
              type="text"
              className={inputClass}
              placeholder="Street address"
              value={data.address}
              onChange={handleChange('address')}
            />
          </FieldGroup>
          <FieldGroup label="City">
            <input
              type="text"
              className={inputClass}
              placeholder="City"
              value={data.city}
              onChange={handleChange('city')}
            />
          </FieldGroup>
          <FieldGroup label="State / ZIP Code">
            <input
              type="text"
              className={inputClass}
              placeholder="MI 49501"
              value={data.stateZip}
              onChange={handleChange('stateZip')}
            />
          </FieldGroup>
        </div>
      </section>

      {/* Section 2 - Comments */}
      <section>
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3 flex items-center gap-2">
          <span className="w-5 h-5 bg-blue-700 text-white rounded-full flex items-center justify-center text-xs">2</span>
          Comments
        </h2>
        <FieldGroup label="Description / explanation of claim">
          <textarea
            className={textareaClass}
            rows={5}
            placeholder="Describe the medical service, why you paid out of pocket, and any relevant details about the claim..."
            value={data.claimDescription}
            onChange={handleChange('claimDescription')}
          />
        </FieldGroup>
        <p className="text-xs text-gray-400 mt-1">
          Include: provider name, phone, tax ID, NPI, diagnosis code, procedure code, date(s) of service, amount charged, and proof of payment.
        </p>
      </section>

      {/* Section 3 - Signature */}
      <section>
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3 flex items-center gap-2">
          <span className="w-5 h-5 bg-blue-700 text-white rounded-full flex items-center justify-center text-xs">3</span>
          Signature
        </h2>
        <p className="text-xs text-gray-500 mb-3">
          The above statements and attachments are true and complete to the best of my knowledge.
        </p>
        <SignaturePad
          onSave={handleSignatureSave}
          onClear={handleSignatureClear}
          value={data.signatureData}
        />
        <div className="mt-3">
          <FieldGroup label="Date">
            <input
              type="date"
              className={`${inputClass} max-w-xs`}
              value={data.signatureDate}
              onChange={handleChange('signatureDate')}
            />
          </FieldGroup>
        </div>
      </section>

      {/* Section 4 - Instructions */}
      <section className="bg-gray-50 rounded-md border border-gray-200 p-4">
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-2 flex items-center gap-2">
          <span className="w-5 h-5 bg-gray-500 text-white rounded-full flex items-center justify-center text-xs">4</span>
          Submission Instructions
        </h2>
        <div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
          <div>
            <p className="font-bold text-gray-800">Fax to: 1-866-637-4972</p>
            <p className="mt-1">Or mail to:</p>
            <p className="font-semibold mt-1">Member Reimbursements - G802</p>
            <p className="font-semibold">Blue Care Network</p>
            <p className="font-semibold">P.O. Box 68767</p>
            <p className="font-semibold">Grand Rapids, MI 49516-8767</p>
          </div>
          <div>
            <p className="font-bold text-gray-800">Questions? Call Customer Service</p>
            <p className="font-semibold mt-1">1-800-662-6667</p>
            <p className="font-semibold">1-800-257-9980 (TTY users)</p>
            <p className="mt-1">8 a.m. to 5:30 p.m. Monday – Friday</p>
          </div>
        </div>
        <p className="text-xs font-bold text-gray-700 mt-3 pt-2 border-t border-gray-300">
          Please keep a copy of all documents you send us. Allow 30 days for processing.
        </p>
      </section>

      {/* Turnstile */}
      <div>
        <TurnstileWidget onVerify={handleTurnstileVerify} onExpire={handleTurnstileExpire} />
        {!turnstileToken && (
          <p className="text-xs text-gray-400 mt-1">Complete the security check above to submit.</p>
        )}
      </div>

      {/* Submit */}
      <div className="flex flex-col gap-2 pb-4">
        {submitSuccess && (
          <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md p-3">
            ✓ Form saved successfully. Download your PDF using the button in the preview panel.
          </div>
        )}
        {submitError && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
            Error: {submitError}
          </div>
        )}
        <button
          type="submit"
          disabled={isSubmitting || !turnstileToken}
          className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-semibold rounded-md text-sm transition-colors"
        >
          {isSubmitting ? 'Saving...' : 'Save & Submit Form'}
        </button>
        <p className="text-xs text-gray-400 text-center">
          This saves your submission to the database. Use "Download PDF" in the preview to get the printable form.
        </p>
      </div>
    </form>
  );
}
