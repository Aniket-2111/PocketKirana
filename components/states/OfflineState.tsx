'use client';

import React, { useState } from 'react';
import { WifiOff, RotateCcw, Smartphone, Radio, HelpCircle } from 'lucide-react';

export interface OfflineStateProps {
  onRetry?: () => void | Promise<void>;
  compact?: boolean;
  className?: string;
}

export const OfflineState: React.FC<OfflineStateProps> = ({
  onRetry,
  compact = false,
  className = '',
}) => {
  const [isChecking, setIsChecking] = useState(false);

  const handleRetry = async () => {
    setIsChecking(true);
    try {
      if (onRetry) {
        await onRetry();
      } else if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center text-center mx-auto ${
        compact ? 'py-6 px-4 max-w-sm' : 'py-14 px-4 max-w-md'
      } ${className}`}
    >
      {/* Offline Icon */}
      <div
        className={`relative ${
          compact ? 'w-12 h-12 mb-3' : 'w-20 h-20 mb-5'
        } rounded-3xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center shadow-sm text-amber-600 dark:text-amber-400`}
      >
        <WifiOff className={compact ? 'w-6 h-6' : 'w-9 h-9'} aria-hidden="true" />
      </div>

      {/* Title */}
      <h3
        className={`font-black text-slate-900 dark:text-slate-100 mb-2 leading-tight ${
          compact ? 'text-base' : 'text-xl'
        }`}
      >
        No Internet Connection
      </h3>

      {/* Description */}
      <p
        className={`text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed ${
          compact ? 'text-xs mb-4' : 'text-sm mb-6'
        }`}
      >
        Please check your Wi-Fi or mobile network and try again. Your cart items are safely preserved.
      </p>

      {/* Troubleshooting Tips (shown in non-compact mode) */}
      {!compact && (
        <div className="w-full bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 mb-6 text-left space-y-2.5">
          <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-emerald-600" />
            <span>Quick Connection Checks:</span>
          </div>
          <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1.5 pl-5 list-disc">
            <li>Ensure Airplane Mode is turned off.</li>
            <li>Check if Wi-Fi or Mobile Data has active signal.</li>
            <li>Check if other apps or browser tabs can connect.</li>
          </ul>
        </div>
      )}

      {/* Retry Action */}
      <button
        type="button"
        disabled={isChecking}
        onClick={handleRetry}
        className="inline-flex items-center justify-center gap-2 bg-[#006E2F] hover:bg-[#004B1E] disabled:bg-emerald-700/60 text-white font-bold px-7 py-3 rounded-xl text-sm transition-all shadow-md active:scale-95 cursor-pointer"
      >
        <RotateCcw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
        <span>{isChecking ? 'Checking Connection...' : 'Retry Connection'}</span>
      </button>
    </div>
  );
};
