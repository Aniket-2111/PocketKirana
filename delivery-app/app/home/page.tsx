'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import DeliveryShell from '../../components/DeliveryShell';
import { 
  Bike, 
  Package, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  ChevronRight, 
  Bell, 
  ShieldCheck, 
  Play,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

export default function DeliveryPartnerHomePage() {
  const router = useRouter();
  const { 
    orders, 
    deliveryPartners, 
    activePartnerId, 
    authenticatedPartnerId, 
    acceptDeliveryAssignment 
  } = useAppStore();

  const partner = deliveryPartners.find((p) => p.id === authenticatedPartnerId || p.id === activePartnerId) || deliveryPartners[0] || {
    id: 'partner-1',
    name: 'Rahul Sharma',
    phone: '+91 8698893348',
    partnerCode: 'DP001',
    currentStatus: 'online',
    activeOrderId: undefined,
  };

  const isOnline = partner.currentStatus === 'online' || partner.currentStatus === 'busy';
  const hasActiveDelivery = !!partner.activeOrderId || partner.currentStatus === 'busy';

  // Central Delivery Queue: Find all orders in WAITING_FOR_DELIVERY or PACKED state that are not assigned to other partners
  const waitingOrders = (orders || []).filter((o) => {
    const s = (o.orderStatus || '').toUpperCase();
    const isReady = s === 'WAITING_FOR_DELIVERY' || s === 'PACKED' || s === 'READY_FOR_PICKUP';
    const isAssignedToOther = o.partnerId && o.partnerId !== partner.id && s === 'OUT_FOR_DELIVERY';
    return isReady && !isAssignedToOther;
  });

  // Next recommended delivery
  const nextAvailableOrder = waitingOrders[0];

  const handleAcceptOrder = (orderId: string) => {
    if (!isOnline) {
      showToast('Please toggle ON DUTY before accepting deliveries', 'error');
      return;
    }

    if (hasActiveDelivery) {
      showToast('You already have an active delivery in progress', 'error');
      router.push('/active');
      return;
    }

    const res = acceptDeliveryAssignment(orderId, partner.id);
    if (res.success) {
      showToast(res.message, 'success');
      router.push('/active');
    } else {
      showToast(res.message, 'error');
    }
  };

  return (
    <DeliveryShell>
      <div className="space-y-4 animate-in fade-in duration-200">
        
        {/* ── ACTIVE DELIVERY BANNER (IF DRIVER IS ALREADY ON A TRIP) ── */}
        {hasActiveDelivery && (
          <div 
            onClick={() => router.push('/active')}
            className="bg-purple-600 text-white p-4 rounded-3xl space-y-2 shadow-md cursor-pointer hover:bg-purple-700 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full">
                Active Delivery in Progress
              </span>
              <span className="text-xs font-black flex items-center gap-1">
                <span>View Trip</span>
                <ChevronRight className="w-4 h-4" />
              </span>
            </div>
            <strong className="block text-sm font-black">
              You have an active delivery ({partner.activeOrderId}). Tap to open navigation &amp; delivery actions.
            </strong>
          </div>
        )}

        {/* ── NEXT DELIVERY AVAILABLE ALERT CARD ── */}
        {nextAvailableOrder && !hasActiveDelivery && isOnline && (
          <div className="bg-gradient-to-b from-emerald-50 to-white border-2 border-emerald-500 rounded-3xl p-5 space-y-4 shadow-lg animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-emerald-200/80 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-xs font-black text-emerald-900 uppercase tracking-widest">
                  NEXT DELIVERY AVAILABLE
                </span>
              </div>
              <span className="text-xs font-mono font-black text-slate-900 bg-white border border-emerald-300 px-2.5 py-0.5 rounded-full">
                Order #{nextAvailableOrder.orderNumber}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <strong className="block text-slate-900">
                    {nextAvailableOrder.address?.addressLine1 || nextAvailableOrder.deliveryAddress?.addressLine1 || 'Customer Delivery Address'}
                  </strong>
                  <span className="text-[11px] text-slate-500 font-bold block">
                    {nextAvailableOrder.address?.city || 'Neral'} - {nextAvailableOrder.address?.postalCode || '410101'}
                  </span>
                </div>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-slate-200 flex items-center justify-between font-bold">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Items to Deliver</span>
                  <span className="text-slate-900 font-mono block mt-0.5">
                    {nextAvailableOrder.items?.length || 1} Products ({nextAvailableOrder.items?.reduce((s, i) => s + i.quantity, 0) || 1} Units)
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px] uppercase">Packed At Hub</span>
                  <span className="text-emerald-800 font-mono block mt-0.5">
                    {new Date(nextAvailableOrder.placedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>

            {/* Accept Delivery Trigger */}
            <button
              onClick={() => handleAcceptOrder(nextAvailableOrder.id)}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-transform cursor-pointer uppercase tracking-wider"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>ACCEPT DELIVERY</span>
            </button>
          </div>
        )}

        {/* ── CENTRALIZED DELIVERY QUEUE ── */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                <Package className="w-4 h-4 text-emerald-600" />
                <span>Central Delivery Queue</span>
              </h3>
              <span className="text-[10px] text-slate-500 font-bold block">
                Orders packed &amp; waiting for pickup
              </span>
            </div>
            <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono font-bold px-3 py-1 rounded-xl">
              {waitingOrders.length} Waiting
            </span>
          </div>

          {waitingOrders.length > 0 ? (
            <div className="space-y-3">
              {waitingOrders.map((order) => {
                const totalItems = order.items?.reduce((s, i) => s + i.quantity, 0) || order.items?.length || 1;

                return (
                  <div
                    key={order.id}
                    className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/50 space-y-3 hover:border-emerald-300 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block">
                          WAITING FOR DELIVERY
                        </span>
                        <strong className="text-sm font-black text-slate-900 block mt-0.5">
                          Order #{order.orderNumber}
                        </strong>
                      </div>
                      <span className="text-[11px] font-mono text-slate-500 font-bold">
                        {totalItems} Items
                      </span>
                    </div>

                    <div className="flex items-start gap-2 text-xs text-slate-600 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <p className="truncate">
                        {order.address?.addressLine1 || order.deliveryAddress?.addressLine1 || 'Pocket Kirana Customer Area'}
                      </p>
                    </div>

                    {!hasActiveDelivery && isOnline && (
                      <button
                        onClick={() => handleAcceptOrder(order.id)}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider transition-colors"
                      >
                        <span>ACCEPT THIS ORDER</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
                <Package className="w-6 h-6" />
              </div>
              <h4 className="text-xs font-black text-slate-900">No Orders in Waiting Queue</h4>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto font-medium">
                When warehouse pickers finish packing and rechecking an order, it will automatically appear here.
              </p>
            </div>
          )}
        </div>

      </div>
    </DeliveryShell>
  );
}
