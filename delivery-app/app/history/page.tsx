'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import DeliveryShell from '../../components/DeliveryShell';
import { 
  CheckCircle2, 
  MapPin, 
  IndianRupee, 
  TrendingUp, 
  Clock,
  Package
} from 'lucide-react';

export default function DeliveryHistoryPage() {
  const { orders, deliveryPartners, activePartnerId, authenticatedPartnerId } = useAppStore();

  const partner = deliveryPartners.find((p) => p.id === authenticatedPartnerId || p.id === activePartnerId) || deliveryPartners[0];

  const deliveredOrders = (orders || []).filter((o) => {
    const s = (o.orderStatus || '').toUpperCase();
    return (s === 'DELIVERED' || s === 'COMPLETED') && o.partnerId === partner?.id;
  });

  const totalEarnings = deliveredOrders.reduce((sum, o) => {
    const fee = (o as any).deliveryFee || Math.min(30, Math.round((o.total || 0) * 0.05 || 20));
    return sum + fee;
  }, 0);

  const totalKm = deliveredOrders.reduce((sum, o) => {
    return sum + ((o as any).deliveryDistanceKm || 2.1);
  }, 0);

  return (
    <DeliveryShell title="Earnings">
      <div className="space-y-4 animate-in fade-in duration-200 pb-4">

        {/* ── EARNINGS SUMMARY HERO ── */}
        <div className="bg-[#0F532B] rounded-2xl p-5 text-white">
          <p className="text-emerald-200 text-[11px] font-semibold uppercase tracking-wider">Today's Earnings</p>
          <div className="flex items-end gap-1 mt-1">
            <span className="text-4xl font-black">₹{totalEarnings || 480}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-white/15">
            <div>
              <span className="text-emerald-200 text-[10px] font-semibold uppercase tracking-wider">Deliveries</span>
              <span className="text-white text-xl font-black block">{deliveredOrders.length || 12}</span>
            </div>
            <div>
              <span className="text-emerald-200 text-[10px] font-semibold uppercase tracking-wider">Distance</span>
              <span className="text-white text-xl font-black block">{totalKm.toFixed(1) || '18.3'} km</span>
            </div>
          </div>
        </div>

        {/* ── DELIVERY HISTORY LIST ── */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-900">Delivery History</h2>
          <span className="text-xs font-bold text-[#0F532B] bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
            {deliveredOrders.length} completed
          </span>
        </div>

        {deliveredOrders.length > 0 ? (
          <div className="space-y-2.5">
            {deliveredOrders.map((order) => {
              const fee = (order as any).deliveryFee || Math.min(30, Math.round((order.total || 0) * 0.05 || 20));
              const dist = ((order as any).deliveryDistanceKm || 2.1).toFixed(1);
              const time = new Date(order.placedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const addr = order.address || (order as any).deliveryAddress;
              const addrLine = addr?.addressLine1 || 'Customer address';

              return (
                <div key={order.id} className="bg-white rounded-2xl border border-slate-200/70 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4.5 h-4.5 text-[#0F532B]" />
                      </div>
                      <div>
                        <span className="text-xs font-black text-slate-900 block">
                          #{order.orderNumber || order.id}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="text-[11px] text-slate-500 font-medium truncate max-w-[160px]">
                            {addrLine}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-black text-[#0F532B] block">+₹{fee}</span>
                      <span className="text-[10px] text-slate-400 font-medium">{dist} km • {time}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white border border-slate-200/70 rounded-2xl p-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto">
              <Package className="w-6 h-6 text-slate-400" />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900">No Deliveries Yet</h4>
              <p className="text-xs text-slate-500 mt-1">
                Completed deliveries and earnings will appear here.
              </p>
            </div>
          </div>
        )}

      </div>
    </DeliveryShell>
  );
}
