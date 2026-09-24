'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Package, X, ArrowRight, Sparkles } from 'lucide-react';
import { showToast } from '@/components/ui/Toast';
import { apiFetch } from '@/lib/apiClient';

export function PickerNotificationListener() {
  const router = useRouter();
  const [activeAlert, setActiveAlert] = useState<{
    id: string;
    orderId: string;
    orderNumber: string;
    itemCount: number;
    title: string;
    body: string;
    deepLink?: string;
  } | null>(null);

  useEffect(() => {
    // 1. Request notification permission & register token
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    }

    // 2. Poll / listen for picker alerts
    const checkPickerTasks = async () => {
      try {
        const res = await apiFetch('/api/picker/tasks?status=ready_for_picking');
        if (res.ok) {
          const data = await res.json();
          if (data.newTasks && data.newTasks.length > 0) {
            const task = data.newTasks[0];
            setActiveAlert({
              id: task.id,
              orderId: task.orderId || task.id,
              orderNumber: task.orderNumber || task.id,
              itemCount: task.items?.length || 1,
              title: '🔔 New Order Received',
              body: `Order #${task.orderNumber || task.id} is ready for picking (${task.items?.length || 1} items).`,
              deepLink: `/picking?id=${task.orderId || task.id}`,
            });
          }
        }
      } catch {}
    };

    const interval = setInterval(checkPickerTasks, 15000);
    return () => clearInterval(interval);
  }, []);

  if (!activeAlert) return null;

  return (
    <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 animate-in slide-in-from-top-4 duration-300">
      <div className="bg-emerald-950 border-2 border-emerald-500 text-white p-4 rounded-2xl shadow-2xl space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold">
              <Package className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block">
                Store Fulfilment Alert
              </span>
              <h4 className="font-extrabold text-sm leading-tight text-white">{activeAlert.title}</h4>
            </div>
          </div>

          <button
            onClick={() => setActiveAlert(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-emerald-900/50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-300 font-medium">{activeAlert.body}</p>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => {
              const link = activeAlert.deepLink || `/picking?id=${activeAlert.orderId}`;
              setActiveAlert(null);
              router.push(link);
            }}
            className="flex-1 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs py-2.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>OPEN ORDER</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setActiveAlert(null)}
            className="px-3 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white font-bold text-xs rounded-xl transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
