'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';

export default function CustomerEntryPage() {
  const router = useRouter();
  const { isLoggedIn, addresses } = useAppStore();

  useEffect(() => {
    // Small delay so hydration is complete and store is ready
    const timer = setTimeout(() => {
      if (!isLoggedIn) {
        router.replace('/login');
      } else if (addresses.length === 0) {
        router.replace('/setup-address');
      } else {
        router.replace('/home');
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [isLoggedIn, addresses, router]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-3">
        <img
          src="/logo-icon.png"
          alt="Pocket Kirana"
          className="w-16 h-16 object-contain rounded-2xl bg-white p-1 border border-emerald-100 shadow-md animate-pulse"
        />
        <span className="text-xs text-slate-500 font-bold tracking-wider uppercase">Loading…</span>
      </div>
    </div>
  );
}
