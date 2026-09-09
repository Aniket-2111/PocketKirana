'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';

export default function DeliveryRootPage() {
  const router = useRouter();
  const { authenticatedPartnerId, deliveryPartners } = useAppStore();

  useEffect(() => {
    // If authenticated partner exists, go to /home, else default partner session is active
    router.replace('/home');
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto font-black animate-pulse">
          PK
        </div>
        <span className="text-xs font-bold text-slate-500">Loading Delivery Partner Workspace...</span>
      </div>
    </div>
  );
}
