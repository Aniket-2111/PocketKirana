'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log sanitized error details without leaking sensitive client state
    console.error('[PocketKirana Application Error]', {
      message: error?.message || 'Unknown runtime error',
      digest: error?.digest,
    });
  }, [error]);

  return (
    <div className="min-h-[70vh] bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-6 shadow-xl">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-sm">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-black text-slate-900">Something went wrong</h2>
          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
            We encountered an unexpected issue while loading this page. Please try again or return to the homepage.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <button
            onClick={() => reset()}
            className="flex items-center justify-center gap-2 bg-[#0F532B] hover:bg-[#0B3E20] text-white text-xs font-black px-6 py-3 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Try Again</span>
          </button>

          <Link
            href="/"
            className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-6 py-3 rounded-xl transition-all"
          >
            <Home className="w-4 h-4" />
            <span>Go Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
