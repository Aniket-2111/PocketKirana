'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { Bike, Navigation, CheckCircle2, Volume2, VolumeX, MapPin, Clock, ArrowRight } from 'lucide-react';
import { soundAlerts } from '@/lib/audioAlerts';
import { apiFetch } from '@/lib/apiClient';

export const NewDeliveryTaskAlertModal: React.FC = () => {
  const { orders, activePartnerId, authenticatedPartnerId, updateOrderStatus } = useAppStore();
  const [incomingTask, setIncomingTask] = useState<any | null>(null);
  const [isSilenced, setIsSilenced] = useState(false);
  const soundIntervalRef = useRef<any>(null);

  const currentPartnerId = authenticatedPartnerId || activePartnerId || 'partner-1';

  useEffect(() => {
    // Find unaccepted delivery task assigned to this partner or broadcasted
    const unaccepted = (orders || []).find((o) => {
      const status = (o.orderStatus || '').toUpperCase();
      const isAssignedToMe = o.partnerId === currentPartnerId || (o as any).assignedPartnerId === currentPartnerId;
      return (
        (status === 'DELIVERY_PARTNER_NOTIFIED' || status === 'ORDER_PACKED' || status === 'ASSIGNED') &&
        (isAssignedToMe || (!o.partnerId && !(o as any).assignedPartnerId))
      );
    });

    if (unaccepted && (!incomingTask || incomingTask.id !== unaccepted.id)) {
      setIncomingTask(unaccepted);
      setIsSilenced(false);

      // Play energetic delivery dispatch chime
      soundAlerts.playPartnerDispatch();
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate([400, 200, 400, 200, 500]); } catch {}
      }

      if (soundIntervalRef.current) clearInterval(soundIntervalRef.current);
      soundIntervalRef.current = setInterval(() => {
        soundAlerts.playPartnerDispatch();
      }, 3500);
    }

    if (!unaccepted && incomingTask) {
      setIncomingTask(null);
      if (soundIntervalRef.current) clearInterval(soundIntervalRef.current);
    }

    return () => {
      if (soundIntervalRef.current) clearInterval(soundIntervalRef.current);
    };
  }, [orders, currentPartnerId, incomingTask]);

  const handleAcknowledge = async () => {
    setIsSilenced(true);
    if (soundIntervalRef.current) {
      clearInterval(soundIntervalRef.current);
      soundIntervalRef.current = null;
    }
    if (incomingTask?.id) {
      apiFetch(`/api/orders/${incomingTask.id}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: currentPartnerId, role: 'delivery_partner' }),
      }).catch(() => {});
    }
  };

  const handleAccept = async () => {
    handleAcknowledge();
    if (incomingTask?.id) {
      try {
        await apiFetch(`/api/delivery/orders/${incomingTask.id}/accept`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ partnerId: currentPartnerId }),
        });
      } catch {}
      if (updateOrderStatus) {
        updateOrderStatus(incomingTask.id, 'ACCEPTED' as any);
      }
    }
    setIncomingTask(null);
  };

  if (!incomingTask) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-slate-900 border-2 border-emerald-500 rounded-3xl p-6 shadow-2xl text-white flex flex-col items-center text-center relative overflow-hidden animate-in zoom-in-95">
        {/* Pulsing delivery bike icon */}
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 mb-4 animate-bounce">
          <Bike className="w-8 h-8 animate-pulse" />
        </div>

        <span className="px-3 py-1 bg-emerald-500 text-slate-950 font-black text-xs rounded-full uppercase tracking-wider mb-2">
          New Delivery Task
        </span>

        <h3 className="text-xl font-extrabold text-white mb-1">
          Order #{incomingTask.orderNumber || incomingTask.id.slice(0, 8)}
        </h3>

        <div className="w-full bg-slate-800/80 rounded-2xl p-3 my-3 text-left space-y-2 text-xs border border-slate-700/50">
          <div className="flex items-center gap-2 text-slate-300">
            <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate"><strong>Pickup:</strong> PocketKirana Hub (Neral)</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <Navigation className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate"><strong>Deliver to:</strong> {incomingTask.address?.addressLine1 || 'Neral Customer'}</span>
          </div>
          <div className="flex items-center gap-2 text-amber-400 font-bold">
            <Clock className="w-4 h-4 shrink-0" />
            <span>Target SLA: Under 30 Minutes</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-2.5">
          <button
            onClick={handleAccept}
            className="w-full py-3.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl flex items-center justify-center gap-2 text-base transition-all shadow-lg active:scale-95"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>Accept Delivery</span>
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
