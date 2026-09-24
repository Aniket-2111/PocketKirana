'use client';

import React, { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function TrackDeepLinkPage({ params }: { params: Promise<{ orderId: string }> }) {
  const resolvedParams = use(params);
  const orderId = resolvedParams.orderId;
  const router = useRouter();

  useEffect(() => {
    if (orderId) {
      router.replace(`/orders/${orderId}/track`);
    } else {
      router.replace('/profile?tab=my_orders');
    }
  }, [orderId, router]);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
      <Loader2 className="w-10 h-10 animate-spin text-emerald-400 mb-4" />
      <h2 className="text-xl font-bold">Opening Order Tracking...</h2>
      <p className="text-slate-400 text-sm mt-1">Connecting to live delivery status for order #{orderId}</p>
    </div>
  );
}
