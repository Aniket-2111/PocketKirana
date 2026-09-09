'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 px-6 text-center">
      <div className="w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center mb-6 text-4xl">
        🛒
      </div>
      <h1 className="text-2xl font-black text-slate-900 dark:text-white">Page Not Found</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 mb-6">
        Oops! This page doesn&apos;t exist.
      </p>
      <button
        onClick={() => router.push('/home')}
        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl shadow-md shadow-emerald-600/30 cursor-pointer"
      >
        Go to Home
      </button>
    </div>
  );
}
