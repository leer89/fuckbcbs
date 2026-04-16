'use client';

import { usePDF } from '@react-pdf/renderer';
import { useEffect, useState, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import BCNPDFDocument from './BCNPDFDocument';
import type { FormData } from '@/types/form';

interface Props {
  data: FormData;
}

export default function PDFViewerWrapper({ data }: Props) {
  const [instance, updateInstance] = usePDF({ document: <BCNPDFDocument data={data} /> });
  const [merging, setMerging] = useState(false);

  // Re-render the PDF whenever form data changes
  useEffect(() => {
    updateInstance(<BCNPDFDocument data={data} />);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const handleDownload = useCallback(async () => {
    if (!instance.url) return;

    const pdfReceipts = (data.receipts ?? []).filter((r) =>
      r.name.toLowerCase().endsWith('.pdf')
    );

    // No PDF attachments — download form PDF directly
    if (pdfReceipts.length === 0) {
      const a = document.createElement('a');
      a.href = instance.url;
      a.download = 'bcn-member-reimbursement.pdf';
      a.click();
      return;
    }

    // Merge actual PDF attachments in after the form pages (same as server-side fax)
    setMerging(true);
    try {
      const formBytes = await fetch(instance.url).then((r) => r.arrayBuffer());
      const merged = await PDFDocument.load(formBytes);

      for (const receipt of pdfReceipts) {
        try {
          const receiptBytes = await fetch(receipt.url).then((r) => r.arrayBuffer());
          const receiptDoc = await PDFDocument.load(receiptBytes);
          const copied = await merged.copyPages(receiptDoc, receiptDoc.getPageIndices());
          for (const page of copied) merged.addPage(page);
        } catch (err) {
          console.error(`Failed to merge receipt ${receipt.name}:`, err);
        }
      }

      const pdfBytes = await merged.save();
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bcn-member-reimbursement.pdf';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } finally {
      setMerging(false);
    }
  }, [instance.url, data.receipts]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 text-white text-sm shrink-0">
        <span className="font-medium">Live PDF Preview</span>
        {instance.loading ? (
          <span className="px-3 py-1 text-xs text-gray-300">Generating...</span>
        ) : instance.error ? (
          <span className="px-3 py-1 text-xs text-red-400">PDF error</span>
        ) : (
          <button
            onClick={handleDownload}
            disabled={merging}
            className="px-3 py-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded text-xs transition-colors"
          >
            {merging ? 'Merging…' : 'Download PDF'}
          </button>
        )}
      </div>
      {instance.error ? (
        <div className="flex-1 flex items-center justify-center bg-gray-100 p-6">
          <div className="text-center text-red-600 text-sm max-w-sm">
            <p className="font-bold mb-1">PDF render error</p>
            <p className="text-xs text-gray-500 font-mono break-all">{String(instance.error)}</p>
          </div>
        </div>
      ) : instance.url ? (
        <iframe
          src={instance.url}
          style={{ flex: 1, width: '100%', border: 'none' }}
          title="PDF Preview"
        />
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-100">
          <div className="text-center text-gray-400 text-sm">Generating PDF…</div>
        </div>
      )}
    </div>
  );
}
