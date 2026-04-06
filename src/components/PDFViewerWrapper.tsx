'use client';

import { PDFViewer, BlobProvider } from '@react-pdf/renderer';
import BCNPDFDocument from './BCNPDFDocument';
import type { FormData } from '@/types/form';

interface Props {
  data: FormData;
}

export default function PDFViewerWrapper({ data }: Props) {
  const doc = <BCNPDFDocument data={data} />;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 text-white text-sm shrink-0">
        <span className="font-medium">Live PDF Preview</span>
        <BlobProvider document={doc}>
          {({ url, loading }) => (
            <a
              href={url ?? '#'}
              download="bcn-member-reimbursement.pdf"
              className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs transition-colors"
              aria-disabled={loading}
            >
              {loading ? 'Generating...' : 'Download PDF'}
            </a>
          )}
        </BlobProvider>
      </div>
      <PDFViewer style={{ flex: 1, width: '100%', border: 'none' }}>
        {doc}
      </PDFViewer>
    </div>
  );
}
