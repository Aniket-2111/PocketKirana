'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import DeliveryShell from '../../../components/DeliveryShell';
import SlideButton from '../../../components/SlideButton';
import {
  ArrowLeft,
  HelpCircle,
  Store,
  MapPin,
  Navigation,
  Phone,
  MessageSquare,
  Package,
  StickyNote,
  Banknote,
  CreditCard,
  CheckCircle2,
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';
import { resolveCustomerName, resolveCustomerPhone } from '../../../lib/customerUtils';

export default function OrderDetailsClient() {
  const router = useRouter();
  const params = useParams();
  const orderId = params?.id as string;

  const { orders, deliveryPartners, activePartnerId, authenticatedPartnerId, acceptDeliveryAssignment } =
    useAppStore();

  const [countdown, setCountdown] = useState(45);
  const [accepting, setAccepting] = useState(false);

  const partner =
    deliveryPartners.find((p) => p.id === authenticatedPartnerId || p.id === activePartnerId) ||
    deliveryPartners[0];

  const order = orders.find((o) => o.id === orderId || o.orderNumber === orderId);

  // Countdown timer for auto-accept
  useEffect(() => {
    if (countdown <= 0 || !order) return;
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [countdown, order]);

  if (!order) {
    return (
      <DeliveryShell>
        <div className="flex flex-col items-center justify-center py-20 space-y-4 text-center">
          <Package className="w-12 h-12 text-slate-300" />
          <div>
            <h3 className="font-black text-slate-900">Order Not Found</h3>
            <p className="text-xs text-slate-500 mt-1">This order may have been taken by another partner.</p>
          </div>
          <button
            onClick={() => router.back()}
            className="px-6 py-2.5 bg-[#0F532B] text-white font-black text-xs rounded-xl cursor-pointer"
          >
            Go Back
          </button>
        </div>
      </DeliveryShell>
    );
  }

  const addr = order.address || (order as any).deliveryAddress;
  const customerName = resolveCustomerName(order);
  const customerPhone = resolveCustomerPhone(order);
  const itemCount = order.items?.reduce((s, i) => s + i.quantity, 0) || 1;
  const orderTotal =
    order.total ||
    order.items?.reduce((s, i) => {
      const p = (i as any).unitPrice || i.price || (i.product as any)?.sellingPrice || 0;
      return s + p * i.quantity;
    }, 0) ||
    25;

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

  const isPaidOnline =
    rawPaymentStatus === 'PAID' ||
    rawPaymentMethod === 'ONLINE' ||
    rawPaymentMethod === 'UPI' ||
    rawPaymentMethod === 'RAZORPAY' ||
    rawPaymentMethod === 'CARD' ||
    rawPaymentMethod === 'NETBANKING' ||
    rawPaymentMethod === 'WALLET' ||
    (!isCod && rawPaymentStatus !== 'FAILED');

  const destAddress = `${addr?.addressLine1 || addr?.houseNumber || 'Flat 302'}, ${addr?.landmark ? addr.landmark + ', ' : ''}${addr?.city || 'Neral'}, ${addr?.state || 'Raigad'} - ${addr?.postalCode || '410101'}`;
  const distKm = ((order as any).deliveryDistanceKm || 1.4).toFixed(1);
  const etaMins = Math.max(2, Math.ceil(parseFloat(distKm) / 0.4));

  const handleAccept = () => {
    if (accepting) return;
    setAccepting(true);
    const res = acceptDeliveryAssignment(order.id, partner.id);
    setAccepting(false);
    if (res.success) {
      showToast('Order accepted! Navigating to customer.', 'success');
      router.replace('/active');
    } else {
      showToast(res.message, 'error');
      router.replace('/home');
    }
  };

  const isAlreadyAssigned =
    (order.orderStatus || '').toUpperCase() === 'OUT_FOR_DELIVERY' ||
    (order.partnerId && order.partnerId !== partner?.id);

  return (
    <div className="min-h-screen bg-[#F3F5F7] flex flex-col font-sans pb-4">

      {/* ── CUSTOM HEADER ── */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/70 px-4 py-3 flex items-center justify-between">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full flex items-center justify-center -ml-1 cursor-pointer active:bg-slate-100">
          <ArrowLeft className="w-5 h-5 text-slate-700" />
        </button>
        <span className="font-black text-slate-900 text-sm">Order Details</span>
        <button className="flex items-center gap-1 text-[#0F532B] text-xs font-bold cursor-pointer">
          <HelpCircle className="w-4 h-4" />
          Help
        </button>
      </header>

      <div className="flex-1 px-4 pt-4 space-y-3">

        {/* ── NEW ORDER BADGE + COUNTDOWN ── */}
        <div className="flex items-center justify-between">
          <span className="bg-[#0F532B] text-white text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
            New Order
          </span>
          {countdown > 0 && !isAlreadyAssigned && (
            <span className="text-xs text-slate-500 font-medium">
              Auto-accepts in <span className="font-black text-slate-800">{countdown}s</span>
            </span>
          )}
        </div>

        {/* ── ORDER CARD ── */}
        <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-base font-black text-slate-900 block">
                  #{order.orderNumber || order.id}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {itemCount} item{itemCount > 1 ? 's' : ''} • ₹{orderTotal}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {isCod ? (
                  <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2.5 py-1 rounded-lg border border-amber-300 flex items-center gap-1">
                    <Banknote className="w-3.5 h-3.5 text-amber-700" />
                    COD (₹{orderTotal})
                  </span>
                ) : (
                  <span className="bg-emerald-50 text-[#0F532B] text-[10px] font-black px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#0F532B]" />
                    PAID ONLINE
                  </span>
                )}
                <span className="bg-slate-100 text-slate-700 text-[9px] font-black px-2 py-1 rounded-lg border border-slate-200 uppercase tracking-wider">
                  GROCERY
                </span>
              </div>
            </div>
          </div>

          {/* Pickup */}
          <div className="px-4 py-3.5 border-b border-slate-100">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#0F532B]/10 flex items-center justify-center shrink-0 mt-0.5">
                <Store className="w-4.5 h-4.5 text-[#0F532B]" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Pickup from</span>
                <span className="text-sm font-black text-slate-900 block">PocketKirana Store Hub</span>
                <span className="text-xs text-slate-500 font-medium">Neral</span>
                <div className="flex items-center gap-1 mt-1 text-[11px] text-slate-500">
                  <Navigation className="w-3 h-3 text-[#0F532B]" />
                  <span className="font-bold text-slate-600">0.8 km • ~2 mins</span>
                </div>
              </div>
              <button className="flex items-center gap-1 text-[#0F532B] text-xs font-bold border border-[#0F532B] px-2.5 py-1.5 rounded-xl shrink-0 cursor-pointer">
                <Navigation className="w-3.5 h-3.5" />
                Navigate
              </button>
            </div>
          </div>

          {/* Drop */}
          <div className="px-4 py-3.5 border-b border-slate-100">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center shrink-0 mt-0.5">
                <MapPin className="w-4.5 h-4.5 text-rose-500" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Deliver to</span>
                <span className="text-sm font-black text-slate-900 block">{customerName}</span>
                <span className="text-xs text-slate-500 font-medium leading-snug block">{destAddress}</span>
                <div className="flex items-center gap-1 mt-1 text-[11px] text-slate-500">
                  <Navigation className="w-3 h-3 text-[#0F532B]" />
                  <span className="font-bold text-slate-600">{distKm} km • ~{etaMins} mins</span>
                </div>
              </div>
              <button className="flex items-center gap-1 text-[#0F532B] text-xs font-bold border border-[#0F532B] px-2.5 py-1.5 rounded-xl shrink-0 cursor-pointer">
                <Navigation className="w-3.5 h-3.5" />
                Navigate
              </button>
            </div>
          </div>

          {/* Customer */}
          <div className="px-4 py-3.5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                <span className="text-slate-600 font-black text-sm">
                  {customerName[0]?.toUpperCase() || 'C'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-black text-slate-900 block">{customerName}</span>
                <span className="text-xs text-slate-500 font-medium">{customerPhone}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`tel:${customerPhone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="w-9 h-9 rounded-xl bg-[#0F532B]/10 flex items-center justify-center cursor-pointer"
                >
                  <Phone className="w-4 h-4 text-[#0F532B]" />
                </a>
                <button className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center cursor-pointer">
                  <MessageSquare className="w-4 h-4 text-slate-600" />
                </button>
              </div>
            </div>
          </div>

          {/* Payment Mode & Status */}
          <div className="px-4 py-3.5 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                isCod ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-[#0F532B]'
              }`}>
                {isCod ? <Banknote className="w-4.5 h-4.5" /> : <CreditCard className="w-4.5 h-4.5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Payment Mode</span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    isCod ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'
                  }`}>
                    {isCod ? 'COD' : 'PAID'}
                  </span>
                </div>
                <span className="text-sm font-black text-slate-900 block mt-0.5">
                  {isCod ? 'Cash on Delivery (COD)' : 'Prepaid / Online Payment'}
                </span>
                <p className={`text-xs mt-1 leading-snug font-medium ${
                  isCod ? 'text-amber-800 font-semibold' : 'text-slate-500'
                }`}>
                  {isCod
                    ? `⚠️ Collect ₹${orderTotal} from customer via Cash or UPI QR at delivery.`
                    : `✓ ₹${orderTotal} already paid online. Do not collect cash.`}
                </p>
              </div>
            </div>
          </div>

          {/* Order Items */}
          <div className="px-4 py-3.5 border-b border-slate-100">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2.5">
              Order Items ({itemCount})
            </span>
            <div className="space-y-2.5">
              {(order.items || []).map((item, idx) => {
                const name = item.product?.name || (item as any).productName || 'Grocery Item';
                const qty = item.quantity;
                const price =
                  (item as any).unitPrice || item.price || (item.product as any)?.sellingPrice || 0;
                const img = (item.product as any)?.image || (item.product as any)?.thumbnail || (item as any).imageUrl;
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                      {img ? (
                        <img src={img} alt={name} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-5 h-5 text-slate-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-bold text-slate-900 block truncate">{name}</span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {(item as any).variantLabel || '1 kg'} × {qty}
                      </span>
                    </div>
                    <span className="text-sm font-black text-slate-900 shrink-0">₹{price * qty}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Customer Note */}
          {((order as any).customerNote || (order as any).note) && (
            <div className="px-4 py-3.5">
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
                <StickyNote className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="text-xs text-amber-800 font-medium">
                  {(order as any).customerNote || (order as any).note}
                </span>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ── SLIDE TO ACCEPT ── */}
      <div className="px-4 pt-3">
        {isAlreadyAssigned ? (
          <div className="w-full py-4 bg-slate-100 rounded-2xl text-center text-sm font-black text-slate-400">
            Already Accepted by Another Partner
          </div>
        ) : (
          <SlideButton
            label="Accept Order"
            onSlideComplete={handleAccept}
            disabled={accepting}
          />
        )}
      </div>

    </div>
  );
}
