'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Truck } from 'lucide-react';

export default function AdminDeliveryFleetRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin?tab=delivery-fleet');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#F4F5F7] flex items-center justify-center font-sans">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto animate-pulse">
          <Truck className="w-6 h-6" />
        </div>
        <p className="text-xs font-bold text-slate-500">Loading Staff &amp; Delivery Fleet in Admin Console...</p>
      </div>
    </div>
  );
}
