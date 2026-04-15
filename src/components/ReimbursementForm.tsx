'use client';

import React, { useCallback, useState } from 'react';
import SignaturePad from './SignaturePad';
import TurnstileWidget from './TurnstileWidget';
import type { FormData, ReceiptItem } from '@/types/form';
import { ALL_LOCATIONS, getLocationCodes } from '@/data/locations';
import { getSupabaseClient } from '@/lib/supabase';

export interface SecurityTokens {
  turnstileToken: string;
  honeypot: string;
}

interface ReimbursementFormProps {
  data: FormData;
  onChange: (field: keyof FormData, value: string | string[]) => void;
  onReceiptsChange: (receipts: ReceiptItem[]) => void;
  onSubmit: (e: React.FormEvent, security: SecurityTokens, receipts: ReceiptItem[]) => void;
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

const IMAGE_EXTS = /\.(jpg|jpeg|png|gif|webp|heic|bmp)$/i;

/** Convert an image File to a grayscale JPEG Blob (max 1200px wide). Fax-safe. */
function toGrayscaleBlob(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const blobUrl = URL.createObjectURL(file);
    img.onload = () => {
      const maxW = 1500; // ~200 dpi at 7.5" fax page width — matches fax native resolution
      const scale = img.width > maxW ? maxW / img.width : 1;
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        const gray = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
        d[i] = d[i + 1] = d[i + 2] = gray;
      }
      ctx.putImageData(imageData, 0, 0);
      URL.revokeObjectURL(blobUrl);
      canvas.toBlob(
        (blob) => { blob ? resolve(blob) : reject(new Error('Canvas conversion failed')); },
        'image/jpeg',
        0.85,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(blobUrl); reject(new Error(`Failed to load: ${file.name}`)); };
    img.src = blobUrl;
  });
}


export default function ReimbursementForm({
  data,
  onChange,
  onReceiptsChange,
  onSubmit,
  isSubmitting,
  submitSuccess,
  submitError,
  isMobile,
}: ReimbursementFormProps) {
  // Files waiting to be uploaded — keyed by their blob URL (the preview URL)
  const pendingFilesRef = React.useRef<Map<string, File>>(new Map());
  const [uploadingReceipts, setUploadingReceipts] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [codeQuery, setCodeQuery] = useState('');
  const [showCodeDropdown, setShowCodeDropdown] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  // Holds the original synthetic event reference so we can fire it after confirm
  const pendingSubmitRef = React.useRef<React.FormEvent | null>(null);

  // Revoke all blob URLs when user leaves the page — nothing is stored in Supabase
  // unless they actually complete the submit flow
  React.useEffect(() => {
    const files = pendingFilesRef.current;
    return () => {
      files.forEach((_, blobUrl) => URL.revokeObjectURL(blobUrl));
      files.clear();
    };
  }, []);

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

  // Store files locally as blob URLs — nothing is uploaded until the user confirms submit.
  // Images are converted to grayscale JPEG first (fax-safe, max 1200px wide).
  const handleAddReceipts = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newItems: ReceiptItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (IMAGE_EXTS.test(f.name)) {
        let blob: Blob;
        try {
          blob = await toGrayscaleBlob(f);
        } catch {
          blob = f; // fall back to original if conversion fails
        }
        const blobUrl = URL.createObjectURL(blob);
        pendingFilesRef.current.set(blobUrl, new File([blob], f.name, { type: 'image/jpeg' }));
        newItems.push({ url: blobUrl, label: f.name.replace(/\.[^.]+$/, ''), name: f.name });
      } else {
        const blobUrl = URL.createObjectURL(f);
        pendingFilesRef.current.set(blobUrl, f);
        newItems.push({ url: blobUrl, label: f.name.replace(/\.[^.]+$/, ''), name: f.name });
      }
    }
    onReceiptsChange([...(data.receipts ?? []), ...newItems]);
  }, [data.receipts, onReceiptsChange]);

  const handleRemoveReceipt = useCallback((index: number) => {
    const receipts = data.receipts ?? [];
    const removed = receipts[index];
    // Revoke the blob URL and drop the pending file if not yet uploaded
    if (removed?.url.startsWith('blob:')) {
      URL.revokeObjectURL(removed.url);
      pendingFilesRef.current.delete(removed.url);
    }
    onReceiptsChange(receipts.filter((_, i) => i !== index));
  }, [data.receipts, onReceiptsChange]);

  const handleLabelChange = useCallback((index: number, label: string) => {
    onReceiptsChange(
      (data.receipts ?? []).map((r, i) => i === index ? { ...r, label } : r)
    );
  }, [data.receipts, onReceiptsChange]);

  const handleLocationChange = useCallback(
    (location: string) => {
      onChange('urgentCareLocation', location);
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

  // First click: show confirmation modal
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setConfirmEmail(data.email);
      pendingSubmitRef.current = e;
      setShowConfirmModal(true);
    },
    [data.email]
  );

  // Second click (inside modal): upload any pending receipt files, then submit
  const handleConfirmSubmit = useCallback(async () => {
    if (confirmEmail !== data.email) {
      onChange('email', confirmEmail);
    }

    // Upload any receipts that are still blob URLs (not yet in Supabase)
    const currentReceipts = data.receipts ?? [];
    const hasPending = currentReceipts.some((r) => pendingFilesRef.current.has(r.url));

    let uploadedReceipts = currentReceipts;
    if (hasPending) {
      setUploadingReceipts(true);
      setUploadError(null);
      const resolved: ReceiptItem[] = [];
      const errors: string[] = [];
      for (const receipt of currentReceipts) {
        const file = pendingFilesRef.current.get(receipt.url);
        if (file) {
          const ext = file.name.split('.').pop() ?? 'bin';
          const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const sb = getSupabaseClient();
          const { error } = await sb.storage
            .from('receipt-uploads')
            .upload(path, file, { contentType: file.type });
          if (error) {
            errors.push(file.name);
            resolved.push(receipt); // keep blob URL as fallback (will fail server-side)
          } else {
            const { data: urlData } = sb.storage
              .from('receipt-uploads')
              .getPublicUrl(path);
            URL.revokeObjectURL(receipt.url);
            pendingFilesRef.current.delete(receipt.url);
            resolved.push({ ...receipt, url: urlData.publicUrl });
          }
        } else {
          resolved.push(receipt); // already a public URL
        }
      }
      setUploadingReceipts(false);
      if (errors.length > 0) {
        setUploadError(`Failed to upload: ${errors.join(', ')}. Please try again.`);
        return; // don't submit if uploads failed
      }
      uploadedReceipts = resolved;
      onReceiptsChange(uploadedReceipts);
    }

    setShowConfirmModal(false);
    onSubmit(pendingSubmitRef.current!, { turnstileToken, honeypot }, uploadedReceipts);
  }, [confirmEmail, data.email, data.receipts, onChange, onReceiptsChange, onSubmit, turnstileToken, honeypot]);

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
                    const locationCodes = getLocationCodes(data.urgentCareLocation!);
                    const q = codeQuery.toLowerCase();
                    const matches = locationCodes
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
              <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-700 text-white text-sm font-medium rounded-md cursor-pointer hover:bg-blue-800">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                Take Photo
                <input type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={(e) => handleAddReceipts(e.target.files)} />
              </label>
              <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md cursor-pointer hover:bg-gray-50">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                Gallery
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

          {/* Receipt cards with label editing */}
          {(data.receipts ?? []).length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              {(data.receipts ?? []).map((r, i) => (
                <div key={i} className="flex gap-2 items-start border border-gray-200 rounded-md p-2 bg-gray-50">
                  {/* Thumbnail */}
                  <div className="flex-shrink-0 w-16 h-16 rounded overflow-hidden border border-gray-200 bg-white flex items-center justify-center">
                    {/\.(jpg|jpeg|png|gif|webp|heic|bmp)$/i.test(r.name) ? (
                      <img src={r.url} alt={r.label} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs text-gray-400 text-center px-1">PDF</span>
                    )}
                  </div>
                  {/* Label input */}
                  <div className="flex-1 flex flex-col gap-1">
                    <p className="text-xs text-gray-400 truncate">{r.name}</p>
                    <input
                      type="text"
                      value={r.label}
                      onChange={(e) => handleLabelChange(i, e.target.value)}
                      placeholder="Label for this receipt…"
                      className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => handleRemoveReceipt(i)}
                    className="flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors text-lg leading-none mt-0.5"
                    aria-label="Remove receipt"
                  >
                    ×
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

      {/* Email confirmation modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-base font-bold text-gray-900 mb-1">Confirm your email address</h2>
            <p className="text-sm text-gray-500 mb-4">
              We'll email you a submission confirmation and notify you once BCN's fax machine confirms receipt.
            </p>

            <label className="text-sm font-medium text-gray-700 block mb-1">Email address</label>
            <input
              type="email"
              className={inputClass}
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              autoFocus
            />

            <div className="mt-4 bg-blue-50 border border-blue-100 rounded-md p-3 text-xs text-blue-800 space-y-1">
              <p><strong>What happens after you submit:</strong></p>
              <p>1. Your form is faxed to BCN at 1-866-637-4972</p>
              <p>2. You'll get a confirmation email immediately</p>
              <p>3. Once BCN's fax machine confirms receipt, you'll get a second email</p>
              <p>4. If the fax fails, we retry up to 3 times and email you the result</p>
            </div>

            {uploadError && (
              <p className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{uploadError}</p>
            )}

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={uploadingReceipts || isSubmitting}
                className="flex-1 py-2 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Go back
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={!confirmEmail || uploadingReceipts || isSubmitting}
                className="flex-1 py-2 rounded-md bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
              >
                {uploadingReceipts ? 'Uploading receipts…' : isSubmitting ? 'Submitting…' : 'Confirm & Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer — web only, never rendered in the PDF */}
      <div className="pt-4 pb-6 border-t border-gray-100 flex flex-col items-center gap-3">
        <p className="text-xs text-gray-400">Built for the community by</p>
        <a
          href="https://makotechs.com"
          target="_blank"
          rel="noopener noreferrer"
          className="opacity-70 hover:opacity-100 transition-opacity"
        >
          <img
            src="https://makotechs.com/assets/fulllogo_nobuffer.png"
            alt="Makotechs"
            className="h-8 w-auto"
          />
        </a>
      </div>
    </form>
  );
}
