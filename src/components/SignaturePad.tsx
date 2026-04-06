'use client';

import { useRef, useCallback } from 'react';
import SignatureCanvas from 'react-signature-canvas';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  onClear: () => void;
  value?: string;
}

export default function SignaturePad({ onSave, onClear, value }: SignaturePadProps) {
  const sigCanvasRef = useRef<SignatureCanvas>(null);

  const handleSave = useCallback(() => {
    if (sigCanvasRef.current && !sigCanvasRef.current.isEmpty()) {
      const dataUrl = sigCanvasRef.current.toDataURL('image/png');
      onSave(dataUrl);
    }
  }, [onSave]);

  const handleClear = useCallback(() => {
    sigCanvasRef.current?.clear();
    onClear();
  }, [onClear]);

  return (
    <div className="flex flex-col gap-2">
      <label className="block text-sm font-medium text-gray-700">
        Signature <span className="text-gray-400 text-xs">(draw below, then click Save)</span>
      </label>

      <div className="border-2 border-gray-300 rounded-md bg-white overflow-hidden">
        <SignatureCanvas
          ref={sigCanvasRef}
          penColor="#000000"
          backgroundColor="rgba(255,255,255,1)"
          canvasProps={{
            width: 460,
            height: 100,
            className: 'w-full',
            style: { display: 'block' },
          }}
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
        >
          Save Signature
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 transition-colors"
        >
          Clear
        </button>
      </div>

      {value && (
        <div className="mt-1">
          <p className="text-xs text-green-600 font-medium">✓ Signature saved</p>
          <img
            src={value}
            alt="Saved signature preview"
            className="mt-1 h-10 border border-gray-200 rounded bg-white"
          />
        </div>
      )}
    </div>
  );
}
