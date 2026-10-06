'use client';

import React from 'react';
import { Gauge, RotateCcw, XCircle, AlertCircle } from 'lucide-react';

export interface SlowNetworkStateProps {
  message?: string;
  onRetry?: () => void;
  onCancel?: () => void;
  inline?: boolean;
  className?: string;
}

export const SlowNetworkState: React.FC<SlowNetworkStateProps> = ({
  message = "It's taking longer than usual. You may be on a slow connection...",
  onRetry,
  onCancel,
  inline = false,
  className = '',
}) => {
  if (inline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-700 dark:text-amber-300 animate-fadeSlideUp ${className}`}
      >
        <Gauge className="w-4 h-4 flex-shrink-0 animate-pulse text-amber-600 dark:text-amber-400" />
        <span className="flex-1">{message}</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="font-bold underline hover:no-underline ml-2"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl max-w-md mx-auto my-4 text-center space-y-3 animate-fadeSlideUp shadow-sm ${className}`}
    >
      <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
        <Gauge className="w-5 h-5 animate-pulse" />
      </div>

      <div className="space-y-1">
        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Slow Connection Detected</h4>
        <p className="text-xs text-slate-500 dark:text-slate-400">{message}</p>
      </div>

      <div className="flex items-center justify-center gap-2 pt-1">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 bg-[#006E2F] hover:bg-[#004B1E] text-white font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry Request</span>
          </button>
        )}

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Cancel</span>
          </button>
        )}
      </div>
    </div>
  );
};
