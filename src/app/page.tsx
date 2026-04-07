'use client';

import { useState, useCallback, useEffect } from 'react';
import ReimbursementForm, { type SecurityTokens } from '@/components/ReimbursementForm';
import PDFPreview from '@/components/PDFPreview';
import { initialFormData } from '@/types/form';
import type { FormData } from '@/types/form';

const DEBOUNCE_MS = 350;

export default function Home() {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  // Debounced version fed into the PDF preview so it doesn't thrash on every keystroke
  const [debouncedData, setDebouncedData] = useState<FormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Debounce form -> PDF preview
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedData(formData);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [formData]);

  const handleChange = useCallback((field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Reset submission state when editing
    setSubmitSuccess(false);
    setSubmitError(null);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent, security: SecurityTokens) => {
      e.preventDefault();
      setIsSubmitting(true);
      setSubmitSuccess(false);
      setSubmitError(null);

      try {
        const res = await fetch('/api/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, ...security }),
        });

        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error ?? 'Submission failed');
        }

        setSubmitSuccess(true);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData]
  );

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Left panel — form */}
      <div className="w-1/2 h-full overflow-hidden border-r border-gray-300 bg-white shadow-md">
        <ReimbursementForm
          data={formData}
          onChange={handleChange}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          submitSuccess={submitSuccess}
          submitError={submitError}
        />
      </div>

      {/* Right panel — live PDF preview */}
      <div className="w-1/2 h-full overflow-hidden bg-gray-200">
        <PDFPreview data={debouncedData} />
      </div>
    </div>
  );
}
