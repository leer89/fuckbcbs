'use client';

import { useCallback, useState } from 'react';
import SignaturePad from './SignaturePad';
import TurnstileWidget from './TurnstileWidget';
import type { FormData } from '@/types/form';
import { SPARROW_LOCATIONS, ALL_LOCATIONS } from '@/data/locations';

export interface SecurityTokens {
  turnstileToken: string;
  honeypot: string;
}

interface ReimbursementFormProps {
  data: FormData;
  onChange: (field: keyof FormData, value: string | string[]) => void;
  onSubmit: (e: React.FormEvent, security: SecurityTokens) => void;
  isSubmitting: boolean;
  submitSuccess: boolean;
  submitError: string | null;
  isMobile: boolean;
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

const MEDICAL_CODES: string[] = [
  // Evaluation & Management — Office Visits
  '99202 — Office visit, new patient, low complexity',
  '99203 — Office visit, new patient, moderate complexity',
  '99204 — Office visit, new patient, moderate-high complexity',
  '99205 — Office visit, new patient, high complexity',
  '99211 — Office visit, established, minimal',
  '99212 — Office visit, established, low complexity',
  '99213 — Office visit, established, moderate complexity',
  '99214 — Office visit, established, moderate-high complexity',
  '99215 — Office visit, established, high complexity',
  // Urgent Care / Emergency
  '99051 — Service after hours/weekends/holidays',
  '99058 — Office emergency',
  '99281 — ED visit, minimal severity',
  '99282 — ED visit, low severity',
  '99283 — ED visit, moderate severity',
  '99284 — ED visit, high severity',
  '99285 — ED visit, high severity with threat to life',
  // Wound Care / Skin
  '10060 — Incision & drainage of abscess, simple',
  '10061 — Incision & drainage of abscess, complicated',
  '10120 — Removal of foreign body, subcutaneous, simple',
  '10180 — Incision & drainage, complex postoperative wound',
  '12001 — Simple repair superficial wounds up to 2.5 cm',
  '12002 — Simple repair superficial wounds 2.6–7.5 cm',
  '12011 — Simple repair of face/scalp 2.5 cm or less',
  '12013 — Simple repair of face/scalp 2.6–5.0 cm',
  '12015 — Simple repair of face/scalp 5.1–7.5 cm',
  '17110 — Destruction of benign skin lesions, up to 14',
  '17111 — Destruction of benign skin lesions, 15 or more',
  // Musculoskeletal
  '20600 — Joint aspiration/injection, small joint',
  '20605 — Joint aspiration/injection, intermediate joint',
  '20610 — Joint aspiration/injection, major joint',
  '29125 — Short arm splint, static',
  '29126 — Short arm splint, dynamic',
  '29130 — Finger splint, static',
  '29131 — Finger splint, dynamic',
  '29505 — Long leg splint',
  '29515 — Short leg splint',
  '29540 — Strapping, ankle and/or foot',
  // Imaging / X-ray
  '71045 — Chest X-ray, 1 view',
  '71046 — Chest X-ray, 2 views',
  '73000 — X-ray clavicle',
  '73060 — X-ray humerus, minimum 2 views',
  '73100 — X-ray wrist, 2 views',
  '73110 — X-ray wrist, minimum 3 views',
  '73120 — X-ray hand, 2 views',
  '73130 — X-ray hand, minimum 3 views',
  '73140 — X-ray finger(s)',
  '73500 — X-ray hip, 1 view',
  '73510 — X-ray hip, complete, minimum 2 views',
  '73562 — X-ray knee, 2 views',
  '73564 — X-ray knee, 4 or more views',
  '73600 — X-ray ankle, 2 views',
  '73610 — X-ray ankle, minimum 3 views',
  '73620 — X-ray foot, 2 views',
  '73630 — X-ray foot, minimum 3 views',
  '73660 — X-ray toe(s)',
  // Cardiac
  '93000 — Electrocardiogram (ECG), with interpretation',
  '93005 — ECG tracing only',
  // Lab — Collection
  '36415 — Collection of venous blood by venipuncture',
  '36416 — Capillary blood collection',
  // Lab — Panels
  '80047 — Basic metabolic panel',
  '80053 — Comprehensive metabolic panel',
  '80061 — Lipid panel',
  '85025 — Complete blood count (CBC) with differential',
  '85027 — Complete blood count (CBC) without differential',
  '85610 — Prothrombin time (PT)',
  // Lab — Urinalysis
  '81001 — Urinalysis, automated with microscopy',
  '81002 — Urinalysis, non-automated, without microscopy',
  '81003 — Urinalysis, automated, without microscopy',
  // Lab — Rapid/Microbiology
  '86308 — Monospot/heterophile antibody test',
  '87070 — Culture, bacterial, any source',
  '87081 — Culture, presumptive, pathogenic organisms',
  '87086 — Urine culture, bacterial',
  '87340 — Hepatitis B surface antigen (HBsAg)',
  '87400 — Influenza A & B antigen detection',
  '87420 — RSV antigen',
  '87430 — Streptococcus A antigen',
  '87491 — Chlamydia trachomatis detection by nucleic acid',
  '87502 — COVID-19 detection, multiple targets',
  '87503 — COVID-19 & influenza, multiple targets',
  '87591 — Neisseria gonorrhoeae detection by nucleic acid',
  '87804 — Influenza rapid test',
  '87880 — Strep A rapid test',
  // Injections / IV / Infusion
  '90471 — Immunization administration, first injection',
  '90472 — Immunization administration, each additional',
  '96360 — IV infusion, hydration, 31 min–1 hr',
  '96361 — IV infusion, hydration, each additional hour',
  '96365 — IV infusion, therapeutic, 1st hour',
  '96366 — IV infusion, therapeutic, each additional hour',
  '96372 — Therapeutic/prophylactic/diagnostic injection, subcutaneous/IM',
  '96374 — IV push, single or initial substance',
  '96375 — IV push, each additional substance',
  // Respiratory
  '94640 — Nebulizer treatment, single',
  '94664 — Aerosol or vapor inhalation, initial demonstration',
  '94760 — Pulse oximetry, single determination',
  '94761 — Pulse oximetry, multiple determinations',
  // Other Procedures
  '69210 — Removal of impacted cerumen (ear wax)',
  '92012 — Ophthalmological services, established patient',
  '99070 — Supplies/materials provided',
];

export default function ReimbursementForm({
  data,
  onChange,
  onSubmit,
  isSubmitting,
  submitSuccess,
  submitError,
  isMobile,
}: ReimbursementFormProps) {
  const [localReceipts, setLocalReceipts] = useState<string[]>(data.receipts ?? []);
  const [codeQuery, setCodeQuery] = useState('');
  const [showCodeDropdown, setShowCodeDropdown] = useState(false);
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

  const handleAddReceipts = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const promises: Promise<string>[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      promises.push(new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(String(reader.result));
        reader.onerror = rej;
        reader.readAsDataURL(f);
      }));
    }
    const results = await Promise.all(promises);
    const updated = [...(localReceipts || []), ...results];
    setLocalReceipts(updated);
    onChange('receipts' as keyof FormData, JSON.stringify(updated));
  }, [localReceipts, onChange]);

  const handleRemoveReceipt = useCallback((index: number) => {
    const updated = localReceipts.filter((_, i) => i !== index);
    setLocalReceipts(updated);
    onChange('receipts' as keyof FormData, JSON.stringify(updated));
  }, [localReceipts, onChange]);

  const handleLocationChange = useCallback(
    (location: string) => {
      onChange('urgentCareLocation', location);
      // Clear codes when switching locations
      onChange('selectedMedicalCodes', []);
      setCodeQuery('');
    },
    [onChange]
  );

  const handleCodeToggle = useCallback(
    (code: string) => {
      const current = data.selectedMedicalCodes ?? [];
      const updated = current.includes(code)
        ? current.filter((c) => c !== code)
        : [...current, code];
      onChange('selectedMedicalCodes', updated);
    },
    [data.selectedMedicalCodes, onChange]
  );

  const handleCodeRemove = useCallback(
    (code: string) => {
      const updated = (data.selectedMedicalCodes ?? []).filter((c) => c !== code);
      onChange('selectedMedicalCodes', updated);
    },
    [data.selectedMedicalCodes, onChange]
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

        {/* Step 1 — Location */}
        <FieldGroup label="Where did you receive care?">
          <select
            className={inputClass}
            value={data.urgentCareLocation ?? ''}
            onChange={(e) => handleLocationChange(e.target.value)}
          >
            <option value="">— Select a location —</option>
            {ALL_LOCATIONS.map((loc) => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
        </FieldGroup>

        {/* Step 2 — Procedure code search (only shown after location is selected) */}
        {data.urgentCareLocation && (
          <div className="mt-3 relative">
            <FieldGroup label="Add procedure codes (search by code or description)">
              <input
                type="text"
                className={inputClass}
                placeholder="e.g. 99213 or office visit"
                value={codeQuery}
                onChange={(e) => {
                  setCodeQuery(e.target.value);
                  setShowCodeDropdown(true);
                }}
                onFocus={() => setShowCodeDropdown(true)}
                onBlur={() => setTimeout(() => setShowCodeDropdown(false), 150)}
                disabled={!data.urgentCareLocation}
              />
              {showCodeDropdown && codeQuery.length >= 2 && (
                <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-52 overflow-auto">
                  {(() => {
                    const locationCodes = SPARROW_LOCATIONS[data.urgentCareLocation!] ?? [];
                    const allCodes = [...MEDICAL_CODES, ...locationCodes];
                    const q = codeQuery.toLowerCase();
                    const matches = allCodes
                      .filter((o) => o.toLowerCase().includes(q))
                      .filter((o) => !(data.selectedMedicalCodes ?? []).includes(o))
                      .slice(0, 30);
                    return matches.length > 0 ? matches.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        className="block w-full text-left text-sm px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-0"
                        onMouseDown={() => {
                          handleCodeToggle(opt);
                          setCodeQuery('');
                          setShowCodeDropdown(false);
                        }}
                      >
                        {opt}
                      </button>
                    )) : (
                      <p className="text-sm text-gray-400 px-3 py-2">No matching codes found.</p>
                    );
                  })()}
                </div>
              )}
            </FieldGroup>

            {/* Selected code chips */}
            {(data.selectedMedicalCodes ?? []).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(data.selectedMedicalCodes ?? []).map((code) => (
                  <span
                    key={code}
                    className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-800 text-xs px-2 py-1 rounded-full"
                  >
                    {code}
                    <button
                      type="button"
                      onClick={() => handleCodeRemove(code)}
                      className="text-blue-500 hover:text-red-500 font-bold leading-none"
                      aria-label={`Remove ${code}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3 — Additional comments */}
        <div className="mt-3">
          <FieldGroup label="Additional comments (optional)">
            <textarea
              className={textareaClass}
              rows={4}
              placeholder="Any additional details about the claim, why you paid out of pocket, etc."
              value={data.claimDescription}
              onChange={handleChange('claimDescription')}
            />
          </FieldGroup>
        </div>

        {/* Receipt attachments */}
        <div className="mt-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Attach receipts / supporting documents</p>
          {isMobile ? (
            <div className="flex gap-2">
              {/* Camera button — triggers camera directly on mobile */}
              <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-700 text-white text-sm font-medium rounded-md cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                Take Photo
                <input type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={(e) => handleAddReceipts(e.target.files)} />
              </label>
              {/* Gallery button — opens photo library on mobile */}
              <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                Choose from Gallery
                <input type="file" accept="image/*,application/pdf" multiple className="sr-only" onChange={(e) => handleAddReceipts(e.target.files)} />
              </label>
            </div>
          ) : (
            <label className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 text-sm rounded-md cursor-pointer hover:bg-gray-50 w-full">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Upload receipts or PDFs (multiple files OK)
              <input type="file" accept="image/*,application/pdf" multiple className="sr-only" onChange={(e) => handleAddReceipts(e.target.files)} />
            </label>
          )}

          {/* Receipt thumbnails */}
          {localReceipts.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {localReceipts.map((r, i) => (
                <div key={i} className="relative border rounded overflow-hidden bg-gray-50">
                  {r.startsWith('data:image') ? (
                    <img src={r} alt={`receipt-${i + 1}`} className="w-full h-24 object-cover" />
                  ) : (
                    <div className="w-full h-24 flex items-center justify-center text-xs text-gray-500">PDF {i + 1}</div>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveReceipt(i)}
                    className="absolute top-1 right-1 bg-white border border-gray-300 rounded-full w-5 h-5 flex items-center justify-center text-xs text-gray-600 hover:bg-red-50"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-400 mt-2">
            Include: provider name, phone, tax ID, NPI, diagnosis code, procedure code, date(s) of service, amount charged, and proof of payment.
          </p>
        </div>
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
            ✓ Form submitted successfully. BCN will be faxed your claim and you will receive a confirmation email.
            {!isMobile && ' Use "Download PDF" in the preview panel to save a copy.'}
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
        {!isMobile && (
          <p className="text-xs text-gray-400 text-center">
            Use "Download PDF" in the preview panel to save a printable copy.
          </p>
        )}
      </div>
    </form>
  );
}
