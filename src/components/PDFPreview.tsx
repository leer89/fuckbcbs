'use client';

import dynamic from 'next/dynamic';
import type { FormData } from '@/types/form';

const PDFViewerWrapper = dynamic(() => import('./PDFViewerWrapper'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 bg-gray-800 text-white text-sm font-medium shrink-0">
        Live PDF Preview
      </div>
      <div className="flex-1 flex items-center justify-center bg-gray-100">
        <div className="text-center text-gray-500">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm">Loading PDF renderer...</p>
        </div>
      </div>
    </div>
  ),
});

interface PDFPreviewProps {
  data: FormData;
}

export default function PDFPreview({ data }: PDFPreviewProps) {
  return (
    <div className="w-full h-full">
      <PDFViewerWrapper data={data} />
    </div>
  );
}
