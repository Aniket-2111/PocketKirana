'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { Bell, ShoppingBag, ArrowRight, CheckCircle2, Volume2, VolumeX, ShieldAlert } from 'lucide-react';
import { soundAlerts } from '@/lib/audioAlerts';

export const NewOrderAlertModal: React.FC = () => {
  const { orders, activePickerId, acceptOrderTask } = useAppStore();
  const [incomingOrder, setIncomingOrder] = useState<any | null>(null);
  const [isSilenced, setIsSilenced] = useState(false);
  const soundIntervalRef = useRef<any>(null);

  // Detect newly placed / confirmed orders that need picking
  useEffect(() => {
    const unpicked = (orders || []).find((o) => {
      const status = (o.orderStatus || '').toUpperCase();
      return (
        (status === 'CONFIRMED' || status === 'PICKER_NOTIFIED' || status === 'PLACED') &&
        (!o.pickerId || o.pickerId === activePickerId)
      );
    });

    if (unpicked && (!incomingOrder || incomingOrder.id !== unpicked.id)) {
      setIncomingOrder(unpicked);
      setIsSilenced(false);

      // Play audio chime loop every 3.5 seconds until acknowledged
      soundAlerts.playOrderChime();
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate([300, 200, 300, 200, 400]); } catch {}
      }

      if (soundIntervalRef.current) clearInterval(soundIntervalRef.current);
      soundIntervalRef.current = setInterval(() => {
        soundAlerts.playOrderChime();
      }, 3500);
    }

    if (!unpicked && incomingOrder) {
      setIncomingOrder(null);
      if (soundIntervalRef.current) clearInterval(soundIntervalRef.current);
    }

    return () => {
      if (soundIntervalRef.current) clearInterval(soundIntervalRef.current);
    };
  }, [orders, activePickerId, incomingOrder]);

  const handleAcknowledge = async () => {
    setIsSilenced(true);
    if (soundIntervalRef.current) {
      clearInterval(soundIntervalRef.current);
      soundIntervalRef.current = null;
    }
    // Call server acknowledge API
    if (incomingOrder?.id) {
      fetch(`/api/orders/${incomingOrder.id}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: activePickerId, role: 'picker' }),
      }).catch(() => {});
    }
  };

  const handleAccept = async () => {
    handleAcknowledge();
    if (incomingOrder?.id) {
      try {
        await fetch(`/api/picker/orders/${incomingOrder.id}/accept`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pickerId: activePickerId }),
        });
      } catch {}
      if (acceptOrderTask) {
        acceptOrderTask(incomingOrder.id, activePickerId);
      }
    }
    setIncomingOrder(null);
  };

  if (!incomingOrder) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-slate-900 border-2 border-emerald-500 rounded-3xl p-6 shadow-2xl text-white flex flex-col items-center text-center relative overflow-hidden animate-in zoom-in-95">
        {/* Pulsing alert badge */}
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 mb-4 animate-bounce">
          <Bell className="w-8 h-8 animate-pulse" />
        </div>

        <span className="px-3 py-1 bg-emerald-500 text-slate-950 font-black text-xs rounded-full uppercase tracking-wider mb-2">
          New Order Alert
        </span>

        <h3 className="text-xl font-extrabold text-white mb-1">
          Order #{incomingOrder.orderNumber || incomingOrder.id.slice(0, 8)}
        </h3>

        <p className="text-sm text-slate-400 mb-4">
          {(incomingOrder.items || []).length} Items • ₹{incomingOrder.totalAmount || 0}
        </p>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-2.5">
          <button
            onClick={handleAccept}
            className="w-full py-3.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl flex items-center justify-center gap-2 text-base transition-all shadow-lg active:scale-95"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>Accept & Start Picking</span>
          </button>

          <button
            onClick={handleAcknowledge}
            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl flex items-center justify-center gap-2 text-xs transition-colors"
          >
            {isSilenced ? <VolumeX className="w-4 h-4 text-slate-500" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            <span>{isSilenced ? 'Alert Silenced' : 'Acknowledge (Silence Sound)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
