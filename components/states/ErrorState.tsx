'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  RotateCcw,
  Home,
  LifeBuoy,
  ChevronLeft,
  Copy,
  Check,
  ShieldAlert,
  ServerCrash,
} from 'lucide-react';
import { NormalizedApiError } from '@/lib/apiErrorMapper';

export interface ErrorStateProps {
  error?: NormalizedApiError | Error | string | null;
  title?: string;
  message?: string;
  trackingId?: string;
  onRetry?: () => void | Promise<void>;
  onBack?: () => void;
  showHomeButton?: boolean;
  showSupportButton?: boolean;
  compact?: boolean;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  error,
  title,
  message,
  trackingId: propTrackingId,
  onRetry,
  onBack,
  showHomeButton = true,
  showSupportButton = false,
  compact = false,
  className = '',
}) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);

  // Normalize error data
  let displayTitle = title || 'Something went wrong';
  let displayMessage = message || 'We encountered an unexpected issue. Please try again.';
  let trackingId = propTrackingId;

  if (error && typeof error === 'object') {
    if ('title' in error && error.title) displayTitle = error.title;
    if ('message' in error && error.message) displayMessage = error.message;
    if ('trackingId' in error && error.trackingId) trackingId = error.trackingId;
  } else if (typeof error === 'string') {
    displayMessage = error;
  }

  const handleRetry = async () => {
    if (!onRetry) return;
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  const handleCopyCode = () => {
    if (!trackingId) return;
    navigator.clipboard?.writeText(trackingId);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`flex flex-col items-center justify-center text-center mx-auto ${
        compact ? 'py-6 px-4 max-w-sm' : 'py-14 px-4 max-w-md'
      } ${className}`}
    >
      {/* Icon Illustration with alert glow */}
      <div
        className={`relative ${
          compact ? 'w-12 h-12 mb-3' : 'w-20 h-20 mb-5'
        } rounded-3xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-center justify-center shadow-sm text-rose-600 dark:text-rose-400`}
      >
        {displayTitle.toLowerCase().includes('server') ? (
          <ServerCrash className={compact ? 'w-6 h-6' : 'w-9 h-9'} aria-hidden="true" />
        ) : (
          <AlertTriangle className={compact ? 'w-6 h-6' : 'w-9 h-9'} aria-hidden="true" />
        )}
      </div>

      {/* Error Title */}
      <h3
        className={`font-black text-slate-900 dark:text-slate-100 mb-2 leading-tight ${
          compact ? 'text-base' : 'text-xl'
        }`}
      >
        {displayTitle}
      </h3>

      {/* Sanitized Message */}
      <p
        className={`text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed ${
          compact ? 'text-xs mb-4' : 'text-sm mb-6'
        }`}
      >
        {displayMessage}
      </p>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto justify-center">
        {onRetry && (
          <button
            type="button"
            disabled={isRetrying}
            onClick={handleRetry}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#006E2F] hover:bg-[#004B1E] disabled:bg-emerald-700/60 text-white font-bold px-6 py-3 rounded-xl text-sm transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <RotateCcw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>{isRetrying ? 'Retrying...' : 'Try Again'}</span>
          </button>
        )}

        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold px-6 py-3 rounded-xl text-sm transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Go Back</span>
          </button>
        )}

        {showHomeButton && !onBack && (
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold px-6 py-3 rounded-xl text-sm transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Go Home</span>
          </Link>
        )}

        {showSupportButton && (
          <Link
            href="/contact"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-bold px-4 py-3 rounded-xl text-sm transition-all"
          >
            <LifeBuoy className="w-4 h-4" />
            <span>Support</span>
          </Link>
        )}
      </div>

      {/* Diagnostic Ref Identifier (Safe for sharing with support) */}
      {trackingId && (
        <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-[11px] text-slate-400">
          <span>Reference ID:</span>
          <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-slate-600 dark:text-slate-300">
            {trackingId}
          </code>
          <button
            type="button"
            onClick={handleCopyCode}
            aria-label="Copy reference error ID"
            className="p-1 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            {hasCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}
    </div>
  );
};
