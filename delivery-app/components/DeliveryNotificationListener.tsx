'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bike, X, ArrowRight, MapPin, Navigation } from 'lucide-react';
import { showToast } from '@/components/ui/Toast';
import { apiFetch } from '@/lib/apiClient';

export function DeliveryNotificationListener() {
  const router = useRouter();
  const [activeAlert, setActiveAlert] = useState<{
    id: string;
    orderId: string;
    orderNumber: string;
    totalAmount: number;
    distance: string;
    pickupLocation: string;
    dropLocation: string;
    title: string;
    body: string;
    deepLink?: string;
  } | null>(null);

  useEffect(() => {
    // 1. Request notification permission on device/browser
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    }

    // 2. Poll / listen for delivery dispatch alerts
    const checkDeliveryAssignments = async () => {
      try {
        const res = await apiFetch('/api/delivery/assignments?status=assigned');
        if (res.ok) {
          const data = await res.json();
          if (data.newAssignments && data.newAssignments.length > 0) {
            const assignment = data.newAssignments[0];
            setActiveAlert({
              id: assignment.id,
              orderId: assignment.orderId || assignment.id,
              orderNumber: assignment.orderNumber || assignment.id,
              totalAmount: assignment.total || 350,
              distance: assignment.distance || '1.8 km',
              pickupLocation: assignment.pickupLocation || 'PocketKirana Hub (Neral)',
              dropLocation: assignment.dropLocation || 'Customer Address',
              title: '🛵 New Delivery Assigned',
              body: `Order #${assignment.orderNumber || assignment.id} is ready for pickup (~${assignment.distance || '1.8 km'}).`,
              deepLink: `/active?orderId=${assignment.orderId || assignment.id}`,
            });

            // Vibrate device if supported
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              navigator.vibrate([100, 50, 100, 50, 150]);
            }
          }
        }
      } catch {}
    };

    const interval = setInterval(checkDeliveryAssignments, 15000);
    return () => clearInterval(interval);
  }, []);

  if (!activeAlert) return null;

  return (
    <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 animate-in slide-in-from-top-4 duration-300">
      <div className="bg-slate-900 border-2 border-emerald-500 text-white p-4 rounded-2xl shadow-2xl space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold">
              <Bike className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block">
                Dispatch Order Alert
              </span>
              <h4 className="font-extrabold text-sm leading-tight text-white">{activeAlert.title}</h4>
            </div>
          </div>

          <button
            onClick={() => setActiveAlert(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-300 font-medium">{activeAlert.body}</p>

        <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-950 p-2 rounded-xl border border-slate-800">
          <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="truncate">{activeAlert.dropLocation}</span>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => {
              const link = activeAlert.deepLink || `/active?orderId=${activeAlert.orderId}`;
              setActiveAlert(null);
              router.push(link);
            }}
            className="flex-1 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs py-2.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>VIEW ORDER</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setActiveAlert(null)}
            className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-bold text-xs rounded-xl transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
