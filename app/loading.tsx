'use client';

import React from 'react';

export default function GlobalLoading() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
      <div className="flex flex-col items-center space-y-4 max-w-sm text-center">
        {/* Brand Pulse Loader */}
        <div className="relative w-16 h-16 rounded-2xl bg-emerald-600 flex items-center justify-center text-white font-black text-3xl shadow-lg animate-pulse">
          P
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 border-2 border-white animate-ping" />
        </div>

        <div className="space-y-1">
          <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
            Pocket<span className="text-emerald-600">Kirana</span>
          </h3>
          <p className="text-xs font-semibold text-slate-500">
            Delivering your daily essentials in minutes...
          </p>
        </div>

        {/* Skeleton pulse bar */}
        <div className="w-48 h-1.5 bg-slate-200 rounded-full overflow-hidden relative">
          <div className="w-1/2 h-full bg-emerald-500 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  );
}
