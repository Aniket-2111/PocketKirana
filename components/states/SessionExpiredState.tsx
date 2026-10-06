'use client';

import React from 'react';
import Link from 'next/link';
import { Lock, LogIn, Home, ShieldCheck } from 'lucide-react';

export interface SessionExpiredStateProps {
  onLoginAgain?: () => void;
  redirectUrl?: string;
  isModal?: boolean;
  className?: string;
}

export const SessionExpiredState: React.FC<SessionExpiredStateProps> = ({
  onLoginAgain,
  redirectUrl,
  isModal = false,
  className = '',
}) => {
  const handleLoginClick = () => {
    if (onLoginAgain) {
      onLoginAgain();
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pk_open_auth'));
      if (redirectUrl) {
        window.location.href = redirectUrl;
      }
    }
  };

  const content = (
    <div
      role="dialog"
      aria-labelledby="session-expired-title"
      className={`max-w-md mx-auto text-center space-y-6 ${
        isModal ? 'p-6 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800' : 'py-14 px-4'
      } ${className}`}
    >
      {/* Icon */}
      <div className="w-16 h-16 rounded-3xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-sm">
        <Lock className="w-8 h-8" aria-hidden="true" />
      </div>

      {/* Heading */}
      <div className="space-y-2">
        <h3 id="session-expired-title" className="text-xl font-black text-slate-900 dark:text-slate-100">
          Session Expired
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
          Your secure login session has expired. Please log in again to continue managing your cart, orders, or partner dashboard.
        </p>
      </div>

      {/* Security note badge */}
      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-full text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>Your saved cart and address items remain safe</span>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center gap-3 justify-center pt-2">
        <button
          type="button"
          onClick={handleLoginClick}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#006E2F] hover:bg-[#004B1E] text-white font-bold px-7 py-3 rounded-xl text-sm transition-all shadow-md active:scale-95 cursor-pointer"
        >
          <LogIn className="w-4 h-4" />
          <span>Log In Again</span>
        </button>

        <Link
          href="/"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold px-6 py-3 rounded-xl text-sm transition-all border border-slate-200 dark:border-slate-700"
        >
          <Home className="w-4 h-4" />
          <span>Go Home</span>
        </Link>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeSlideUp">
        {content}
      </div>
    );
  }

  return content;
};
