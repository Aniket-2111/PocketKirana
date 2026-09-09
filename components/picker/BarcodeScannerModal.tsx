'use client';

import React, { useState } from 'react';
import {
  Scan,
  Flashlight,
  FlashlightOff,
  X,
  Sparkles,
  Keyboard,
  Barcode as BarcodeIcon,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (scannedValue: string) => void;
  title?: string;
  expectedItemName?: string;
  expectedBarcode?: string;
  quantityRequired?: number;
  quantityPicked?: number;
  unit?: string;
  quickSampleBarcodes?: Array<{ label: string; code: string }>;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  title = 'Scan Product Barcode / UPC',
  expectedItemName,
  expectedBarcode,
  quantityRequired = 1,
  quantityPicked = 0,
  unit,
  quickSampleBarcodes = [
    { label: 'Tata Salt (8901234567890)', code: '8901234567890' },
    { label: 'Amul Milk (8901262010015)', code: '8901262010015' },
    { label: 'Maggi (8901058852445)', code: '8901058852445' },
  ],
}) => {
  const [flashlightOn, setFlashlightOn] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;

    let mediaStream: MediaStream | null = null;
    const startCamera = async () => {
      try {
        if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
            audio: false,
          });
          mediaStream = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play().catch(() => {});
          }
          setCameraActive(true);
          setCameraError(null);
        }
      } catch (err: any) {
        console.warn('Camera access error or restricted:', err?.message);
        setCameraActive(false);
        setCameraError(err?.message || 'Camera permission pending');
      }
    };

    startCamera();

    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      setManualCode('');
    }
  };

  const handleQuickClick = (code: string) => {
    onScan(code);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 text-slate-900 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 w-full max-w-md rounded-t-[32px] sm:rounded-[32px] p-5 space-y-4 shadow-2xl flex flex-col max-h-[92vh] overflow-y-auto">
        
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold">
              <Scan className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-sm text-slate-900">{title}</h3>
              <p className="text-[11px] text-slate-500">UPC / EAN / Location Barcode</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFlashlightOn(!flashlightOn)}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                flashlightOn
                  ? 'bg-amber-400 text-slate-900 border-amber-400'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
              title="Toggle Torch"
            >
              {flashlightOn ? <Flashlight className="w-4 h-4" /> : <FlashlightOff className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-900 border border-slate-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Expected Item Callout with Quantity Required */}
        {expectedItemName && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 space-y-2.5 text-xs text-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block">
                  Target Product
                </span>
                <strong className="text-slate-900 block font-bold text-sm">
                  {expectedItemName} {unit ? `(${unit})` : ''}
                </strong>
              </div>
              {expectedBarcode && (
                <button
                  onClick={() => onScan(expectedBarcode)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] px-3 py-1.5 rounded-xl uppercase shadow-xs transition-transform active:scale-95 cursor-pointer shrink-0 ml-2"
                >
                  {quantityRequired > 1 ? `Scan & Pick All (${quantityRequired} Units) ✓` : 'Scan Match ✓'}
                </button>
              )}
            </div>

            {/* Quantity Required & Progress Stepper Badge */}
            <div className="flex items-center justify-between bg-white border border-emerald-200 rounded-xl px-3 py-2 shadow-xs">
              <span className="text-[11px] font-bold text-slate-600">
                Quantity Required:
              </span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-0.5 rounded-md font-black text-xs">
                  {quantityPicked} / {quantityRequired} Units
                </span>
                {quantityRequired > 1 && (
                  <span className="text-[10px] font-bold text-amber-700">
                    ({quantityRequired} Total)
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Camera Viewfinder View (Live Camera & Laser Scanner Overlay) */}
        <div className="relative w-full h-52 bg-slate-950 rounded-2xl border-2 border-dashed border-emerald-500/60 overflow-hidden flex flex-col items-center justify-center p-0 text-center text-white">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`absolute inset-0 w-full h-full object-cover transition-opacity ${
              cameraActive ? 'opacity-100' : 'opacity-20'
            }`}
          />

          {/* Laser Scanning Animation Bar */}
          <div className="absolute inset-x-4 h-1 bg-gradient-to-r from-emerald-500 via-emerald-300 to-emerald-500 shadow-[0_0_15px_#10B981] animate-bounce z-10" />

          {/* Viewfinder Target Box */}
          <div className="w-48 h-28 border-2 border-emerald-400 rounded-xl relative flex items-center justify-center bg-slate-900/40 z-10">
            <BarcodeIcon className="w-20 h-20 text-emerald-400/40" />
            <span className="absolute bottom-1 text-[9px] font-mono text-emerald-300 font-bold uppercase tracking-widest">
              Align Barcode in Box
            </span>
          </div>

          <p className="text-[11px] text-slate-300 mt-2 font-medium z-10 bg-slate-950/70 px-2 py-0.5 rounded-full">
            {cameraActive ? 'Camera active • Point at product barcode' : 'Point camera at physical product barcode / shelf sticker'}
          </p>
        </div>

        {/* Quick Test Barcode Chips (For Testing Simulator) */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Quick Simulator Barcodes (Tap to Scan):
          </span>
          <div className="flex flex-wrap gap-1.5">
            {quickSampleBarcodes.map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickClick(item.code)}
                className="bg-slate-50 hover:bg-emerald-50 text-slate-700 border border-slate-200 text-[11px] font-mono font-bold px-2.5 py-1.5 rounded-xl transition-transform active:scale-95 cursor-pointer shadow-xs"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Toggle Manual Input */}
        <div className="border-t border-slate-100 pt-3">
          {!showManualInput ? (
            <button
              onClick={() => setShowManualInput(true)}
              className="w-full py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-200 transition-colors cursor-pointer"
            >
              <Keyboard className="w-3.5 h-3.5 text-emerald-600" />
              <span>Enter Barcode Manually</span>
            </button>
          ) : (
            <form onSubmit={handleManualSubmit} className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase block">
                Type UPC / EAN / SKU Code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. 8901234567890"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono text-xs font-bold focus:border-emerald-600 focus:outline-none"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl transition-transform active:scale-95 cursor-pointer"
                >
                  Submit
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
