'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import CustomerShell from '../../components/CustomerShell';
import { Package, Clock, ChevronRight, CheckCircle2, Truck, ShoppingCart } from 'lucide-react';

export default function CustomerOrdersPage() {
  const router = useRouter();
  const { orders } = useAppStore();

  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'DELIVERED' || s === 'COMPLETED') {
      return { label: 'Delivered', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
    }
    if (s === 'OUT_FOR_DELIVERY' || s === 'ARRIVED_AT_CUSTOMER') {
      return { label: 'Out for Delivery 🚴', bg: 'bg-purple-50 text-purple-800 border-purple-200 animate-pulse' };
    }
    if (s === 'PACKED' || s === 'WAITING_FOR_DELIVERY' || s === 'READY_FOR_PICKUP') {
      return { label: 'Order Packed', bg: 'bg-blue-50 text-blue-800 border-blue-200' };
    }
    if (s === 'PICKING' || s === 'PACKING') {
      return { label: 'Being Packed', bg: 'bg-amber-50 text-amber-800 border-amber-200' };
    }
    return { label: 'Order Confirmed', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
  };

  if (orders.length === 0) {
    return (
      <CustomerShell title="My Orders">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-4 shadow-xs mt-6">
          <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
            <Package className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900">No orders yet</h3>
            <p className="text-xs text-slate-500 mt-1">Your past and active grocery orders will appear here.</p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-2xl shadow-md shadow-emerald-600/30 cursor-pointer uppercase tracking-wider"
          >
            Shop Now
          </button>
        </div>
      </CustomerShell>
    );
  }

  return (
    <CustomerShell title="My Orders">
      <div className="space-y-4 animate-in fade-in duration-200 pb-16">
        
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-900 tracking-tight">Order History ({orders.length})</h2>
          <span className="text-[11px] font-bold text-emerald-700">Real-Time Sync</span>
        </div>

        <div className="space-y-3">
          {orders.map((order) => {
            const badge = getStatusBadge(order.orderStatus);
            const itemsCount = order.items?.reduce((sum, i) => sum + i.quantity, 0) || order.items?.length || 1;

            return (
              <div
                key={order.id}
                onClick={() => router.push(`/orders/track?id=${order.id}`)}
                className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-xs hover:border-emerald-400 transition-all cursor-pointer group"
              >
                {/* Header Strip */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">
                      Order #{order.orderNumber}
                    </span>
                    <strong className="text-xs font-black text-slate-900 block mt-0.5">
                      {new Date(order.placedAt || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(order.placedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </strong>
                  </div>

                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase border ${badge.bg}`}>
                    {badge.label}
                  </span>
                </div>

                {/* Items preview */}
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-500 font-bold block">{itemsCount} Items in Order</span>
                    <span className="font-mono font-black text-slate-900 text-sm mt-0.5 block">
                      ₹{order.total}
                    </span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/orders/track?id=${order.id}`);
                    }}
                    className="flex items-center gap-1.5 py-2 px-3.5 bg-emerald-50 text-emerald-800 font-black text-xs rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors cursor-pointer"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>TRACK ORDER</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </CustomerShell>
  );
}
