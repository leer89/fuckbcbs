'use client';

import { usePDF } from '@react-pdf/renderer';
import BCNPDFDocument from './BCNPDFDocument';
import type { FormData } from '@/types/form';

interface Props {
  data: FormData;
}

export default function PDFViewerWrapper({ data }: Props) {
  const doc = <BCNPDFDocument data={data} />;
  const [instance] = usePDF({ document: doc });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 text-white text-sm shrink-0">
        <span className="font-medium">Live PDF Preview</span>
        {instance.loading ? (
          <span className="px-3 py-1 text-xs text-gray-300">Generating...</span>
        ) : instance.error ? (
          <span className="px-3 py-1 text-xs text-red-400">PDF error</span>
        ) : (
          <a
            href={instance.url ?? '#'}
            download="bcn-member-reimbursement.pdf"
            className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs transition-colors"
          >
            Download PDF
          </a>
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
