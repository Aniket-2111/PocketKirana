'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';

export default function DeliveryRootPage() {
  const router = useRouter();
  const { authenticatedPartnerId } = useAppStore();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedPartnerId = localStorage.getItem('pk_delivery_authenticated_partner');
    const isAuthenticated = !!(authenticatedPartnerId || storedPartnerId);

    if (isAuthenticated) {
      router.replace('/home');
    } else {
      router.replace('/login');
    }
  }, [authenticatedPartnerId, router]);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-16 h-16 rounded-3xl bg-[#0F532B] text-white flex items-center justify-center shadow-xl animate-pulse">
        <span className="text-2xl">🚴</span>
      </div>
      <span className="text-sm font-black text-slate-900 mt-4 tracking-tight">PocketKirana Delivery</span>
      <span className="text-xs text-slate-400 mt-1">Starting app…</span>
    </div>
  );
}
