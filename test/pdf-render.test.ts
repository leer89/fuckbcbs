/**
 * Diagnostic test: renders BCNPDFDocument via renderToBuffer to detect
 * silent react-pdf failures that don't surface in the browser console.
 */
import { describe, it, expect } from 'vitest';
import React, { createElement } from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import BCNPDFDocument from '@/components/BCNPDFDocument';
import { initialFormData } from '@/types/form';

describe('BCNPDFDocument renderToBuffer', () => {
  it('renders a valid PDF buffer with initialFormData (no receipts)', async () => {
    const buf = await renderToBuffer(
      createElement(BCNPDFDocument, { data: initialFormData }) as any
    );
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(100);
    // Valid PDFs start with %PDF-
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
  });

  it('renders with location and codes selected', async () => {
    const data = {
      ...initialFormData,
      urgentCareLocation: 'UM Health-Sparrow Lansing',
      selectedMedicalCodes: ['99213 — OFFICE OUTPATIENT VISIT 25 MINUTES'],
      claimDescription: 'Saw a doctor',
    };
    const buf = await renderToBuffer(
      createElement(BCNPDFDocument, { data }) as any
    );
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
  });

  it('renders with image receipts (url, label, name)', async () => {
    const data = {
      ...initialFormData,
      receipts: [
        { url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', label: 'My Receipt', name: 'receipt.png' },
      ],
    };
    const buf = await renderToBuffer(
      createElement(BCNPDFDocument, { data }) as any
    );
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
  });
});
