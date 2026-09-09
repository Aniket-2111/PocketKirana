'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import DeliveryShell from '../../components/DeliveryShell';
import { CheckCircle2, Package, MapPin, Clock } from 'lucide-react';

export default function DeliveryHistoryPage() {
  const router = useRouter();
  const { orders, deliveryPartners, activePartnerId, authenticatedPartnerId } = useAppStore();

  const partner = deliveryPartners.find((p) => p.id === authenticatedPartnerId || p.id === activePartnerId) || deliveryPartners[0];

  const deliveredOrders = (orders || []).filter((o) => {
    const s = (o.orderStatus || '').toUpperCase();
    return s === 'DELIVERED' || s === 'COMPLETED';
  });

  return (
    <DeliveryShell title="Delivered History">
      <div className="space-y-4 animate-in fade-in duration-200 pb-16">
        
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-900 tracking-tight">Completed Deliveries</h2>
          <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
            {deliveredOrders.length} Completed
          </span>
        </div>

        {deliveredOrders.length > 0 ? (
          <div className="space-y-3">
            {deliveredOrders.map((order) => (
              <div
                key={order.id}
                className="bg-white border border-slate-200 rounded-3xl p-5 space-y-3 shadow-xs"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div>
                    <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider block">
                      ✓ DELIVERED
                    </span>
                    <strong className="text-sm font-black text-slate-900 block mt-0.5">
                      Order #{order.orderNumber}
                    </strong>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 font-bold">
                    {new Date(order.placedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="flex items-start gap-2 text-xs text-slate-600 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <p className="truncate">
                    {order.address?.addressLine1 || order.deliveryAddress?.addressLine1 || 'Customer Delivery Address'}
                  </p>
                </div>

                <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200 font-bold">
                  <span>Items Delivered</span>
                  <span className="font-mono text-slate-900">
                    {order.items?.reduce((s, i) => s + i.quantity, 0) || order.items?.length || 1} Units
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-3 shadow-xs">
            <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-xs font-black text-slate-900">No Completed Deliveries Yet</h4>
            <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
              Completed deliveries for this shift will be listed here.
            </p>
          </div>
        )}

      </div>
    </DeliveryShell>
  );
}
