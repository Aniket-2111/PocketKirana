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
        <div className="w-14 h-14 rounded-2xl bg-[#0B8F5A] text-white flex items-center justify-center font-black text-xl shadow-md animate-pulse">
          PK
        </div>
        <span className="text-xs text-slate-500 font-bold tracking-wider uppercase">Loading…</span>
      </div>
    </div>
  );
}
