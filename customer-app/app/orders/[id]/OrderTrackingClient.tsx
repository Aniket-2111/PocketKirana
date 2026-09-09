'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import CustomerShell from '../../../components/CustomerShell';
import { 
  CheckCircle2, 
  Clock, 
  Package, 
  Truck, 
  MapPin, 
  Phone, 
  ShieldCheck, 
  Sparkles,
  ChevronRight,
  ArrowLeft
} from 'lucide-react';
import { subscribeSingleOrderFS } from '@/lib/firebaseServices';
import type { Order } from '@/types';

export default function OrderTrackingClient() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const params = useParams();
  const id = (params?.id as string) || '';

  const { orders } = useAppStore();

  const [liveOrder, setLiveOrder] = useState<Order | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Realtime Firestore stream subscription
  useEffect(() => {
    if (!id) return;
    const unsubscribe = subscribeSingleOrderFS(id, (updated) => {
      if (updated) {
        setLiveOrder(updated);
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [id]);

  // Derive order from Firestore live snapshot or fallback to store orders
  const order = useMemo(() => {
    if (liveOrder) return liveOrder;
    const matched = orders.find((o) => o.id === id || o.orderNumber === id);
    if (matched) return matched;
    return orders.length > 0 ? orders[0] : null;
  }, [liveOrder, orders, id]);

  if (!mounted) {
    return (
      <CustomerShell title="Order Tracking" showBack backUrl="/orders">
        <div className="p-4 space-y-4 animate-pulse">
          <div className="h-24 bg-slate-200 rounded-3xl" />
          <div className="h-48 bg-slate-200 rounded-3xl" />
        </div>
      </CustomerShell>
    );
  }

  if (!order) {
    return (
      <CustomerShell title="Order Tracking" showBack backUrl="/orders">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-3">
          <h3 className="font-bold text-sm">Order #{id} not found</h3>
          <button onClick={() => router.push('/orders')} className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl">
            Return to Orders
          </button>
        </div>
      </CustomerShell>
    );
  }

  const orderNumber = order.orderNumber || id;
  const statusUpper = (order.orderStatus || 'CONFIRMED').toUpperCase();

  // Progress Stepper Status
  const isConfirmed = true; // Always confirmed once placed
  const isPacking = ['PICKING', 'PACKING', 'PACKED', 'WAITING_FOR_DELIVERY', 'ASSIGNED_TO_DELIVERY', 'OUT_FOR_DELIVERY', 'ARRIVED_AT_CUSTOMER', 'ARRIVED', 'DELIVERED', 'COMPLETED'].includes(statusUpper);
  const isPacked = ['PACKED', 'WAITING_FOR_DELIVERY', 'ASSIGNED_TO_DELIVERY', 'OUT_FOR_DELIVERY', 'ARRIVED_AT_CUSTOMER', 'ARRIVED', 'DELIVERED', 'COMPLETED'].includes(statusUpper);
  const isOutForDelivery = ['ASSIGNED_TO_DELIVERY', 'OUT_FOR_DELIVERY', 'ARRIVED_AT_CUSTOMER', 'ARRIVED', 'DELIVERED', 'COMPLETED'].includes(statusUpper);
  const isArrived = ['ARRIVED_AT_CUSTOMER', 'ARRIVED', 'DELIVERED', 'COMPLETED'].includes(statusUpper);
  const isDelivered = ['DELIVERED', 'COMPLETED'].includes(statusUpper);

  // Dynamic Current Banner Label
  const getBannerDetails = () => {
    if (isDelivered) {
      return {
        title: 'Order Delivered!',
        subtitle: 'Your grocery order has been delivered successfully. Thank you for shopping with Pocket Kirana!',
        bg: 'bg-emerald-600 text-white',
        icon: CheckCircle2,
      };
    }
    if (isArrived) {
      return {
        title: 'Delivery Partner Arrived!',
        subtitle: 'Your delivery partner is at your doorstep. Please collect your order bags.',
        bg: 'bg-purple-600 text-white animate-pulse',
        icon: MapPin,
      };
    }
    if (isOutForDelivery) {
      return {
        title: 'Out for Delivery 🚴',
        subtitle: `${order.partnerName || 'Delivery Partner'} is on the way to your location with your packed grocery bags.`,
        bg: 'bg-purple-600 text-white',
        icon: Truck,
      };
    }
    if (isPacked) {
      return {
        title: 'Order Packed & Ready',
        subtitle: 'All items have been packed and rechecked by our store picker. Waiting for delivery partner pickup.',
        bg: 'bg-blue-600 text-white',
        icon: Package,
      };
    }
    if (isPacking) {
      return {
        title: 'Packing Your Order...',
        subtitle: 'Our store picker is carefully packing your items one by one with cold chain and safety rechecks.',
        bg: 'bg-amber-500 text-white',
        icon: Clock,
      };
    }
    return {
      title: 'Order Confirmed',
      subtitle: 'Order received and sent to the dark store warehouse.',
      bg: 'bg-emerald-600 text-white',
      icon: CheckCircle2,
    };
  };

  const banner = getBannerDetails();
  const BannerIcon = banner.icon;

  return (
    <CustomerShell title={`Order #${orderNumber}`} showBack backUrl="/orders">
      <div className="space-y-4 animate-in fade-in duration-200 pb-16">
        
        {/* ── REAL-TIME STATUS HERO BANNER ── */}
        <div className={`p-5 rounded-3xl space-y-2 shadow-md ${banner.bg}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center">
              <BannerIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-white/80 block">
                Live Status
              </span>
              <h2 className="text-base font-black text-white leading-tight">
                {banner.title}
              </h2>
            </div>
          </div>
          <p className="text-xs text-white/90 leading-relaxed font-medium">
            {banner.subtitle}
          </p>
        </div>

        {/* ── STEP-BY-STEP REALTIME TRACKER ── */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-black text-xs uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-emerald-600" />
              <span>Live Order Tracker</span>
            </h3>
            <span className="bg-emerald-50 text-emerald-800 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-emerald-200">
              Live Sync
            </span>
          </div>

          <div className="space-y-4 relative pl-7 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-emerald-500">
            
            {/* Step 1: Order Confirmed */}
            <div className="relative flex items-start gap-3">
              <div className="absolute -left-7 top-0.5 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold ring-4 ring-emerald-50 shadow-xs">
                ✓
              </div>
              <div>
                <strong className="text-xs font-bold text-slate-900 block">Order Confirmed</strong>
                <span className="text-[11px] text-slate-500 font-medium block">Order placed &amp; sent to warehouse</span>
              </div>
            </div>

            {/* Step 2: Packing Your Order */}
            <div className="relative flex items-start gap-3">
              <div className={`absolute -left-7 top-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ring-4 ring-emerald-50 transition-colors ${
                isPacking ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-400'
              }`}>
                {isPacked ? '✓' : isPacking ? '●' : '2'}
              </div>
              <div>
                <strong className={`text-xs font-bold block ${isPacking ? 'text-slate-900' : 'text-slate-400'}`}>
                  Packing Your Order
                </strong>
                <span className="text-[11px] text-slate-500 font-medium block">
                  {isPacked ? 'Items picked & verified ✓' : isPacking ? 'Store picker is packing items one-by-one...' : 'Pending warehouse picking'}
                </span>
              </div>
            </div>

            {/* Step 3: Order Packed */}
            <div className="relative flex items-start gap-3">
              <div className={`absolute -left-7 top-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ring-4 ring-emerald-50 transition-colors ${
                isPacked ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-400'
              }`}>
                {isOutForDelivery ? '✓' : isPacked ? '●' : '3'}
              </div>
              <div>
                <strong className={`text-xs font-bold block ${isPacked ? 'text-slate-900' : 'text-slate-400'}`}>
                  Order Packed &amp; Sealed
                </strong>
                <span className="text-[11px] text-slate-500 font-medium block">
                  {isOutForDelivery ? 'Handed to delivery partner ✓' : isPacked ? 'Packed & waiting in delivery queue' : 'Awaiting packing'}
                </span>
              </div>
            </div>

            {/* Step 4: Out for Delivery */}
            <div className="relative flex items-start gap-3">
              <div className={`absolute -left-7 top-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ring-4 ring-emerald-50 transition-colors ${
                isOutForDelivery ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-400'
              }`}>
                {isArrived ? '✓' : isOutForDelivery ? '●' : '4'}
              </div>
              <div>
                <strong className={`text-xs font-bold block ${isOutForDelivery ? 'text-purple-700' : 'text-slate-400'}`}>
                  Out for Delivery
                </strong>
                <span className="text-[11px] text-slate-500 font-medium block">
                  {isArrived ? 'Delivery partner has arrived ✓' : isOutForDelivery ? `${order.partnerName || 'Partner'} is driving to your location 🚴` : 'Awaiting delivery dispatch'}
                </span>
              </div>
            </div>

            {/* Step 5: Delivered */}
            <div className="relative flex items-start gap-3">
              <div className={`absolute -left-7 top-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                isDelivered ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-400'
              }`}>
                {isDelivered ? '✓' : '5'}
              </div>
              <div>
                <strong className={`text-xs font-bold block ${isDelivered ? 'text-emerald-800 font-black' : 'text-slate-400'}`}>
                  Delivered
                </strong>
                <span className="text-[11px] text-slate-500 font-medium block">
                  {isDelivered ? 'Order completed successfully!' : 'Estimated 10-15 mins from placement'}
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* ── DELIVERY PARTNER INFO CARD (WHEN ASSIGNED / OUT FOR DELIVERY) ── */}
        {isOutForDelivery && (
          <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
                  alt={order.partnerName || 'Delivery Partner'}
                  className="w-12 h-12 rounded-2xl object-cover border-2 border-emerald-600 shrink-0"
                />
                <div>
                  <strong className="block text-xs font-black text-slate-900">
                    {order.partnerName || 'Rahul Sharma (Express Rider)'}
                  </strong>
                  <span className="text-[11px] text-slate-500 font-bold block">
                    Verified Pocket Kirana Partner • ⭐ 4.9
                  </span>
                </div>
              </div>

              <a
                href={`tel:${order.partnerPhone || '+918698893348'}`}
                className="py-2 px-3.5 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-black flex items-center gap-1.5 hover:bg-emerald-600 hover:text-white transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call</span>
              </a>
            </div>
          </div>
        )}

        {/* ── ORDER ITEMS SUMMARY ── */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-3 shadow-xs text-xs font-bold text-slate-600">
          <h4 className="font-black text-slate-900 uppercase tracking-wider pb-1 border-b border-slate-100">
            Order Items ({order.items?.length || 0})
          </h4>

          <div className="divide-y divide-slate-100">
            {(order.items || []).map((item, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between">
                <div>
                  <strong className="block text-slate-900">{item.product?.name || 'Grocery Item'}</strong>
                  <span className="text-[10px] text-slate-400 font-mono">Qty: {item.quantity}</span>
                </div>
                <span className="font-mono font-black text-slate-900">
                  ₹{(item.price || item.unitPrice || 0) * item.quantity}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-sm font-black text-slate-900">
            <span>Total Paid</span>
            <span className="font-mono text-emerald-800">₹{order.total}</span>
          </div>
        </div>

      </div>
    </CustomerShell>
  );
}
