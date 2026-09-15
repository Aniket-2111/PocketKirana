'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import DeliveryShell from '../../components/DeliveryShell';
import {
  MapPin,
  Package,
  Clock,
  ChevronRight,
  Bike,
  Star,
  Navigation,
  Zap,
  CheckCircle2,
  User as UserIcon,
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';
import { resolveCustomerName } from '../../lib/customerUtils';

export default function DeliveryPartnerHomePage() {
  const router = useRouter();
  const { orders, deliveryPartners, activePartnerId, authenticatedPartnerId } = useAppStore();

  const [activeTab, setActiveTab] = useState<'new' | 'ongoing'>('new');

  const partner =
    deliveryPartners.find((p) => p.id === authenticatedPartnerId || p.id === activePartnerId) ||
    deliveryPartners[0] || {
      id: 'partner-1',
      name: 'Sunil Kumar',
      phone: '+91 8698893348',
      partnerCode: 'DP001',
      currentStatus: 'online',
      activeOrderId: undefined as string | undefined,
      rating: 4.9,
      completedDeliveries: 12,
    };

  const isOnline = partner.currentStatus === 'online' || partner.currentStatus === 'busy';
  const hasActiveDelivery = !!partner.activeOrderId || partner.currentStatus === 'busy';

  const waitingOrders = (orders || []).filter((o) => {
    const s = (o.orderStatus || '').toUpperCase();
    return (
      s === 'WAITING_FOR_DELIVERY' ||
      s === 'PACKED' ||
      s === 'READY_FOR_PICKUP' ||
      s === 'ASSIGNED_TO_DELIVERY'
    );
  });

  const ongoingOrders = (orders || []).filter((o) => {
    const s = (o.orderStatus || '').toUpperCase();
    return (
      o.partnerId === partner.id &&
      (s === 'OUT_FOR_DELIVERY' ||
        s === 'ARRIVED_AT_CUSTOMER' ||
        s === 'ARRIVED' ||
        s === 'ACCEPTED')
    );
  });

  const deliveredToday = (orders || []).filter((o) => {
    const s = (o.orderStatus || '').toUpperCase();
    return (s === 'DELIVERED' || s === 'COMPLETED') && o.partnerId === partner.id;
  });

  const earningsToday = deliveredToday.reduce((sum, o) => {
    return sum + ((o as any).deliveryFee || 40);
  }, 0);

  const getTimeAgo = (dateStr?: string) => {
    if (!dateStr) return '2 mins ago';
    const diff = Math.round((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff} min${diff > 1 ? 's' : ''} ago`;
    return `${Math.round(diff / 60)}h ago`;
  };

  const getDistance = (order: any) =>
    ((order as any).deliveryDistanceKm || (Math.random() * 2.5 + 0.8)).toFixed(1);

  const getEta = (km: number) => Math.max(2, Math.ceil(km / 0.4));

  const displayOrders = activeTab === 'new' ? waitingOrders : ongoingOrders;

  return (
    <DeliveryShell>
      <div className="space-y-3 animate-in fade-in duration-200">

        {/* ── HERO BANNER ── */}
        <div className="bg-[#0F532B] rounded-2xl px-4 py-3.5 flex items-center justify-between">
          <div>
            <p className="text-white font-bold text-sm">Ready to deliver groceries and essentials</p>
            <p className="text-emerald-200 text-xs font-medium mt-0.5">Stay safe, deliver smiles! 🙌</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center shrink-0">
            <Bike className="w-7 h-7 text-white" />
          </div>
        </div>

        {/* ── ACTIVE DELIVERY BANNER ── */}
        {hasActiveDelivery && (
          <button
            onClick={() => router.push('/active')}
            className="w-full bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping shrink-0" />
              <div className="text-left">
                <span className="text-xs font-black text-amber-900 block">Active Delivery in Progress</span>
                <span className="text-[11px] text-amber-700">Tap to continue navigation</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-amber-600 shrink-0" />
          </button>
        )}

        {/* ── STATS ROW ── */}
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: 'Deliveries\nToday', value: deliveredToday.length || (partner as any).completedDeliveries || 12 },
            { label: 'Earnings\nToday', value: `₹${earningsToday || 480}` },
            {
              label: 'Rating',
              value: partner.rating || 4.9,
              star: true,
            },
          ].map((stat, i) => (
            <div key={i} className="bg-white rounded-2xl p-3 border border-slate-200/60 text-center">
              <div className={`font-black text-slate-900 flex items-center justify-center gap-0.5 ${stat.star ? 'text-lg' : 'text-xl'}`}>
                {stat.value}
                {stat.star && <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500 ml-0.5" />}
              </div>
              <div className="text-[10px] text-slate-500 font-medium mt-0.5 whitespace-pre-line leading-tight">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* ── SEGMENTED TABS ── */}
        <div className="flex bg-white border border-slate-200/60 rounded-xl p-1 gap-1">
          <button
            onClick={() => setActiveTab('new')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'new' ? 'bg-[#0F532B] text-white' : 'text-slate-500'
            }`}
          >
            New Orders
            {waitingOrders.length > 0 && (
              <span className={`text-[10px] font-black px-1.5 rounded-full ${
                activeTab === 'new' ? 'bg-white/25 text-white' : 'bg-[#0F532B] text-white'
              }`}>
                {waitingOrders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('ongoing')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'ongoing' ? 'bg-[#0F532B] text-white' : 'text-slate-500'
            }`}
          >
            Ongoing
            {ongoingOrders.length > 0 && (
              <span className={`text-[10px] font-black px-1.5 rounded-full ${
                activeTab === 'ongoing' ? 'bg-white/25 text-white' : 'bg-amber-500 text-white'
              }`}>
                {ongoingOrders.length}
              </span>
            )}
          </button>
        </div>

        {/* ── ORDER LIST ── */}
        {displayOrders.length > 0 ? (
          <div className="space-y-2.5">
            {displayOrders.map((order) => {
              const distKm = parseFloat(getDistance(order));
              const etaMins = getEta(distKm);
              const itemCount = order.items?.reduce((s, i) => s + i.quantity, 0) || 1;
              const orderTotal =
                order.total ||
                order.items?.reduce((s, i) => {
                  const p = (i as any).unitPrice || i.price || (i.product as any)?.sellingPrice || 0;
                  return s + p * i.quantity;
                }, 0) ||
                25;
              const customerName = resolveCustomerName(order);
              const addr = order.address || (order as any).deliveryAddress;
              const city = addr?.city || 'Neral';
              const addrLine = addr?.addressLine1 || addr?.landmark || 'Customer Location';
              const rawPaymentMethod = ((order as any)?.paymentMethod || '').toUpperCase();
              const rawPaymentStatus = ((order as any)?.paymentStatus || '').toUpperCase();
              const rawPaymentMode = ((order as any)?.paymentMode || '').toUpperCase();
              const isCod =
                rawPaymentMethod === 'COD' ||
                rawPaymentMethod === 'CASH' ||
                rawPaymentMethod === 'COD_CASH' ||
                rawPaymentMethod === 'COD_UPI' ||
                rawPaymentMethod.includes('COD') ||
                rawPaymentMethod.includes('CASH') ||
                rawPaymentMode === 'COD';

              return (
                /* Tapping card → Order Details page */
                <button
                  key={order.id}
                  onClick={() => router.push(`/order/${order.id}`)}
                  className="w-full bg-white rounded-2xl border border-slate-200/60 overflow-hidden text-left"
                >
                  {/* Header */}
                  <div className="px-3.5 pt-3 pb-2 flex items-center justify-between border-b border-slate-100">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[11px] font-black text-slate-900 font-mono truncate">
                        #{order.orderNumber || order.id}
                      </span>
                      {isCod ? (
                        <span className="bg-amber-50 text-amber-800 text-[9px] font-black px-1.5 py-0.5 rounded border border-amber-200 uppercase shrink-0">
                          COD • ₹{orderTotal}
                        </span>
                      ) : (
                        <span className="bg-emerald-50 text-[#0F532B] text-[9px] font-black px-1.5 py-0.5 rounded border border-emerald-200 uppercase shrink-0">
                          PAID
                        </span>
                      )}
                      <span className="bg-slate-100 text-slate-600 text-[9px] font-black px-1.5 py-0.5 rounded border border-slate-200 uppercase shrink-0">
                        GROCERY
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium shrink-0">
                      {getTimeAgo((order as any).packedAt || order.placedAt)}
                    </span>
                  </div>

                  {/* Body */}
                  <div className="px-3.5 py-2.5 flex items-center justify-between gap-3">
                    <div className="space-y-1.5 min-w-0 flex-1">
                      {/* Customer Name */}
                      <div className="flex items-center gap-1.5 text-xs text-slate-900 font-black">
                        <UserIcon className="w-3.5 h-3.5 text-[#0F532B] shrink-0" />
                        <span className="truncate">{customerName}</span>
                      </div>
                      <div className="text-xs font-bold text-slate-700">
                        {itemCount} item{itemCount > 1 ? 's' : ''} • <span className="text-slate-900 font-black">₹{orderTotal}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                        <Navigation className="w-3 h-3 text-[#0F532B] shrink-0" />
                        <span className="font-bold text-slate-700">{distKm} km</span>
                        <span>• ~{etaMins} mins</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                        <span className="text-[11px] text-slate-600 font-semibold truncate">
                          {addrLine}, {city}
                        </span>
                      </div>
                    </div>

                    {/* Accept or Active button */}
                    {activeTab === 'new' && !hasActiveDelivery && isOnline ? (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/order/${order.id}`);
                        }}
                        className="shrink-0 bg-[#0F532B] text-white text-xs font-black px-4 py-2 rounded-xl cursor-pointer active:scale-95 transition-all"
                      >
                        Accept
                      </div>
                    ) : activeTab === 'ongoing' ? (
                      <div className="shrink-0 bg-amber-500 text-white text-xs font-black px-3 py-2 rounded-xl">
                        Active
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/60 p-10 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto">
              {activeTab === 'new' ? (
                <Package className="w-6 h-6 text-slate-400" />
              ) : (
                <CheckCircle2 className="w-6 h-6 text-slate-400" />
              )}
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900">
                {activeTab === 'new' ? 'No New Orders' : 'No Active Deliveries'}
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                {activeTab === 'new'
                  ? 'New orders appear here when the store packs them.'
                  : 'Accept an order from the New Orders tab.'}
              </p>
            </div>
          </div>
        )}

      </div>
    </DeliveryShell>
  );
}
