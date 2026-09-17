'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useParams } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import CustomerShell from '../../../components/CustomerShell';
import { subscribeSingleOrderFS } from '@/lib/firebaseServices';
import type { Order } from '@/types';
import {
  ArrowLeft,
  Download,
  Copy,
  Check,
  Star,
  MessageSquare,
  ChevronRight,
  Package,
  ShieldCheck,
  Bike,
  Phone,
  Sparkles,
  Loader2,
  X,
  Clock,
  MapPin,
  Truck,
  Navigation
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

const LiveTrackingMap = dynamic(
  () => import('@/components/customer/LiveTrackingMap').then((m) => m.LiveTrackingMap),
  { ssr: false }
);

export default function OrderTrackingClient() {
  const router = useRouter();
  const params = useParams();
  const [mounted, setMounted] = useState(false);
  const [searchId, setSearchId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'summary' | 'track'>('summary');
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Rating Modal State
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [isRated, setIsRated] = useState(false);

  // Support Chat Modal State
  const [showSupportModal, setShowSupportModal] = useState(false);

  const { orders, products, addToCart, activeOrderTrackingId, downloadInvoicePDF, addReview } = useAppStore();

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const q = sp.get('id') || sp.get('orderId') || '';
      const tab = sp.get('tab');
      if (q) setSearchId(q);
      if (tab === 'track' || window.location.pathname.includes('/track')) {
        setActiveTab('track');
      }
    }
  }, []);

  const routeId = (params?.id as string) || '';
  const id = searchId || routeId || activeOrderTrackingId || (orders.length > 0 ? orders[0]?.id : 'PK102938');

  const [liveOrder, setLiveOrder] = useState<Order | null>(null);

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

  const rawStatus = (order?.orderStatus || (order as any)?.status || (order as any)?.order_status || 'CONFIRMED').toString();
  const statusUpper = rawStatus.toUpperCase();
  const statusLower = rawStatus.toLowerCase();

  const isDelivered = ['DELIVERED', 'COMPLETED'].includes(statusUpper);
  const isOutForDelivery = ['OUT_FOR_DELIVERY', 'ARRIVED_AT_CUSTOMER', 'DELIVERED', 'COMPLETED'].includes(statusUpper);
  const isPickedUp = ['PICKED_UP', 'ORDER_PICKED_UP', 'OUT_FOR_DELIVERY', 'ARRIVED_AT_CUSTOMER', 'DELIVERED', 'COMPLETED'].includes(statusUpper);
  const isPartnerAssigned = ['DELIVERY_PARTNER_NOTIFIED', 'DELIVERY_PARTNER_ACCEPTED', 'ASSIGNED', 'PARTNER_ASSIGNED', 'PARTNER_ARRIVED_STORE', 'PICKED_UP', 'ORDER_PICKED_UP', 'OUT_FOR_DELIVERY', 'ARRIVED_AT_CUSTOMER', 'DELIVERED', 'COMPLETED'].includes(statusUpper);
  const isPacked = ['ORDER_PACKED', 'PACKED', 'WAITING_FOR_DELIVERY', 'READY_FOR_PICKUP', 'READY', 'DELIVERY_PARTNER_NOTIFIED', 'DELIVERY_PARTNER_ACCEPTED', 'ASSIGNED', 'PARTNER_ASSIGNED', 'PARTNER_ARRIVED_STORE', 'PICKED_UP', 'ORDER_PICKED_UP', 'OUT_FOR_DELIVERY', 'ARRIVED_AT_CUSTOMER', 'DELIVERED', 'COMPLETED'].includes(statusUpper);

  // Auto-redirect to bill summary when order is delivered
  const [hasRedirectedToSummary, setHasRedirectedToSummary] = useState(false);
  useEffect(() => {
    if (isDelivered && !hasRedirectedToSummary && activeTab === 'track') {
      setHasRedirectedToSummary(true);
      showToast('🎉 Order Delivered! Redirecting to your bill summary...', 'success');
      const timer = setTimeout(() => {
        setActiveTab('summary');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isDelivered, hasRedirectedToSummary, activeTab]);


  // Delivery OTP code
  const deliveryOtp = useMemo(() => {
    if (order?.deliveryOtp) return String(order.deliveryOtp);
    if ((order as any)?.otp) return String((order as any).otp);
    if (order?.id) {
      const sum = order.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
      return String(1000 + (sum % 9000));
    }
    return '9784';
  }, [order]);

  const showLiveTracking = !isDelivered || activeTab === 'track';

  // Partner info
  const partnerName = order?.partnerName || (order as any)?.assignedPartnerName || 'Sunil Kumar (Express Agent)';
  const partnerPhone = order?.partnerPhone || '+918698893348';

  // Format delivery time for header
  const deliveryHeadline = useMemo(() => {
    if (!order) return '';
    if (isDelivered) {
      try {
        const d = new Date(order.placedAt || Date.now());
        if (!isNaN(d.getTime())) {
          const timeStr = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
          return `Arrived at ${timeStr}`;
        }
        return 'Delivered recently';
      } catch {
        return 'Delivered recently';
      }
    }
    if (statusLower === 'arrived_at_customer') return 'Rider has arrived at your doorstep';
    if (isOutForDelivery) return 'On the way • Expected in 10-15 mins';
    return `Order Placed • ${order.deliverySlot || '30 mins Express'}`;
  }, [order, isDelivered, statusLower, isOutForDelivery]);

  // Format placed date for order details section
  const placedDateFormatted = useMemo(() => {
    if (!order?.placedAt) return 'placed recently';
    try {
      const d = new Date(order.placedAt);
      if (isNaN(d.getTime())) return `placed on ${order.placedAt}`;
      const weekday = d.toLocaleDateString('en-IN', { weekday: 'short' });
      const day = d.getDate();
      const month = d.toLocaleDateString('en-IN', { month: 'short' });
      const year = String(d.getFullYear()).slice(-2);
      const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
      return `placed on ${weekday}, ${day} ${month}'${year}, ${time}`;
    } catch {
      return `placed on ${order.placedAt}`;
    }
  }, [order]);

  // Calculate pricing breakdown
  const billCalc = useMemo(() => {
    if (!order) {
      return { mrpTotal: 0, itemTotal: 0, discount: 0, handlingFee: 5, deliveryCharge: 0, billTotal: 0 };
    }
    let mrpTotal = 0;
    let itemTotal = 0;

    if (order.items && order.items.length > 0) {
      order.items.forEach((item: any) => {
        const unitSelling = item.price || item.product?.sellingPrice || item.unitPrice || 0;
        const unitMrp = item.product?.mrp || item.mrp || (unitSelling > 0 ? Math.round(unitSelling * 1.15) : unitSelling);
        const qty = item.quantity || 1;
        mrpTotal += unitMrp * qty;
        itemTotal += unitSelling * qty;
      });
    } else {
      itemTotal = order.total || order.subtotal || 0;
      mrpTotal = Math.round(itemTotal * 1.12);
    }

    const handlingFee = 5;
    const discount = Math.max(0, mrpTotal - itemTotal);
    const deliveryCharge = order.deliveryCharge !== undefined ? order.deliveryCharge : (itemTotal > 199 ? 0 : 15);
    const billTotal = itemTotal + handlingFee + (deliveryCharge > 0 ? deliveryCharge : 0);

    return {
      mrpTotal,
      itemTotal,
      discount,
      handlingFee,
      deliveryCharge,
      billTotal: order.total || billTotal,
    };
  }, [order]);

  const handleCopyOrderId = () => {
    const idToCopy = order?.orderNumber || order?.id || id;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(idToCopy);
      setCopiedId(true);
      showToast('Order ID copied to clipboard!', 'success');
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleRepeatOrder = () => {
    if (!order || !order.items || order.items.length === 0) {
      showToast('No items to reorder', 'error');
      return;
    }
    let count = 0;
    order.items.forEach((item: any) => {
      const resolvedProduct = item.product || products.find((p) => p.id === item.productId);
      if (resolvedProduct) {
        addToCart(resolvedProduct, item.quantity || 1);
        count += 1;
      }
    });
    showToast(`Added ${count || order.items.length} items to your cart!`, 'success');
    router.push('/cart');
  };

  const handleDownloadInvoice = async () => {
    if (!order) return;
    setIsDownloadingInvoice(true);
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(order.id)}/invoice?format=pdf`, {
        headers: { Accept: 'application/pdf' },
      });
      if (response.ok) {
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `PocketKirana-Invoice-${order.orderNumber || order.id}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
        showToast('Invoice downloaded successfully!', 'success');
      } else {
        const res = await downloadInvoicePDF(order.id);
        if (res.success) {
          showToast('Invoice downloaded successfully!', 'success');
        } else {
          showToast('Unable to download invoice.', 'error');
        }
      }
    } catch {
      try {
        const res = await downloadInvoicePDF(order.id);
        if (res.success) {
          showToast('Invoice downloaded successfully!', 'success');
        } else {
          showToast('Unable to download invoice.', 'error');
        }
      } catch {
        showToast('Unable to download invoice.', 'error');
      }
    } finally {
      setIsDownloadingInvoice(false);
    }
  };

  const handleSubmitRating = () => {
    if (order && order.items && order.items.length > 0) {
      order.items.forEach((item: any) => {
        if (item.productId) {
          addReview(item.productId, order.id, ratingScore, ratingComment || 'Great quality delivery!');
        }
      });
    }
    setIsRated(true);
    setShowRatingModal(false);
    showToast('Thank you for rating your order! ⭐', 'success');
  };

  if (!mounted) {
    return (
      <CustomerShell title="Order Tracking" showBack backUrl="/orders">
        <div className="flex items-center justify-center min-h-[350px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
        </div>
      </CustomerShell>
    );
  }

  if (!order) {
    return (
      <CustomerShell title="Order Tracking" showBack backUrl="/orders">
        <div className="bg-white dark:bg-[#151B23] border border-[#E5E7EB] dark:border-[#263241] rounded-3xl p-8 text-center space-y-4 my-6">
          <Package className="w-12 h-12 text-slate-400 dark:text-[#9CA3AF] mx-auto" />
          <h3 className="font-bold text-sm text-[#111827] dark:text-[#F9FAFB]">Order not found</h3>
          <button
            onClick={() => router.push('/orders')}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer"
          >
            Return to Orders
          </button>
        </div>
      </CustomerShell>
    );
  }

  const itemsCount = order.items?.length || 0;
  const deliveryAddressStr = order.address
    ? `${(order.address as any).name || (order.address as any).fullName || order.customerName || 'Customer'}, ${order.address.addressLine1 || ''}${order.address.addressLine2 ? ', ' + order.address.addressLine2 : ''}, ${order.address.city || 'Neral'}`
    : `${order.customerName || 'Customer'}, Flat 302, Rama Heights, Station Road, Neral`;

  return (
    <div className="min-h-screen bg-white dark:bg-[#0B0F14] text-[#111827] dark:text-[#F9FAFB] flex flex-col font-sans transition-colors duration-200">
      
      {/* ── TOP APP BAR ── */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md border-b border-[#E5E7EB] dark:border-[#263241] px-4 py-3.5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push('/orders')}
          className="w-9 h-9 rounded-full bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#263241] text-slate-700 dark:text-[#D1D5DB] flex items-center justify-center transition-colors cursor-pointer"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <span className="text-xs font-bold text-slate-500 dark:text-[#9CA3AF] uppercase tracking-wider">
          Order #{order.orderNumber || order.id}
        </span>

        <button
          type="button"
          onClick={() => setShowSupportModal(true)}
          className="w-9 h-9 rounded-full bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#263241] text-slate-700 dark:text-[#D1D5DB] flex items-center justify-center transition-colors cursor-pointer"
          title="Support"
        >
          <MessageSquare className="w-4 h-4" />
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          CASE A: LIVE TRACKING EXPERIENCE (TRACK ORDER VIEW)
         ════════════════════════════════════════════════════════════════ */}
      {showLiveTracking ? (
        <div className="flex-1 max-w-lg w-full mx-auto px-4 pt-4 pb-20 space-y-4">
          
          {/* 1. TOP PROMINENT DELIVERY OTP CARD (Centered / Large Size) */}
          {!isDelivered && (
            <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 border border-emerald-500/40 rounded-3xl p-4.5 shadow-lg space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-amber-300" />
                  <span className="text-xs font-black text-white uppercase tracking-wider">
                    Delivery Verification PIN
                  </span>
                </div>
                <span className="text-[10px] font-black uppercase text-amber-300 bg-black/40 px-2 py-0.5 rounded-full border border-amber-300/30">
                  Share at Doorstep
                </span>
              </div>

              {/* Large Centered 4-Digit OTP PIN */}
              <div className="flex items-center justify-center gap-2.5 py-1">
                {deliveryOtp.split('').map((digit, i) => (
                  <span
                    key={i}
                    className="w-12 h-14 rounded-2xl bg-black/50 border border-white/30 flex items-center justify-center text-3xl font-black font-mono text-white shadow-md"
                  >
                    {digit}
                  </span>
                ))}
              </div>

              <p className="text-[11px] text-center text-emerald-100 font-medium">
                Give this 4-digit code to the delivery rider upon arrival
              </p>
            </div>
          )}

          {/* 2. Live Tracking Status Banner */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/90 dark:to-[#111827] border border-emerald-200 dark:border-[#263241] rounded-3xl p-4.5 space-y-1.5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${
                isOutForDelivery 
                  ? 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/60 dark:text-purple-300 dark:border-purple-500/40' 
                  : isPacked
                  ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/60 dark:text-amber-300 dark:border-amber-500/40'
                  : 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/60 dark:text-emerald-300 dark:border-emerald-500/40'
              }`}>
                {isOutForDelivery ? '● Live Rider GPS Active' : isPacked ? '● Packed & Ready for Pickup' : '● Store Hub Fulfilling'}
              </span>
              <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                30 Min Express
              </span>
            </div>
            <h1 className="text-lg font-black text-[#111827] dark:text-[#F9FAFB] flex items-center gap-2 pt-0.5">
              <Truck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 animate-pulse" />
              {isDelivered
                ? 'Order Delivered!'
                : isOutForDelivery
                ? 'Out for Delivery!'
                : isPartnerAssigned
                ? `Assigned to ${partnerName}`
                : isPacked
                ? 'Order Packed • Ready for Express Delivery'
                : 'Order Confirmed • Packing'}
            </h1>
            <p className="text-xs text-slate-600 dark:text-[#D1D5DB] font-medium">
              {isDelivered
                ? 'Your express grocery order has been delivered.'
                : isOutForDelivery
                ? 'Your express delivery partner is on the way.'
                : isPartnerAssigned
                ? `${partnerName} is arriving at Store Hub for parcel pickup.`
                : isPacked
                ? 'Your items have been safely packed and are ready for rider handover.'
                : 'PocketKirana store hub is gathering and packing your items.'}
            </p>

            {isDelivered && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('summary')}
                  className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-500/40 px-3 py-1 rounded-xl cursor-pointer"
                >
                  View Order Summary &rarr;
                </button>
              </div>
            )}
          </div>

          {/* 3. CONDITIONAL: IF OUT FOR DELIVERY OR DELIVERED, SHOW LIVE GPS MAP; OTHERWISE SHOW ORDER FULFILLMENT PROCESS */}
          {isOutForDelivery || isDelivered ? (
            /* Interactive Live Tracking Map */
            <div className="rounded-3xl overflow-hidden border border-[#E5E7EB] dark:border-[#263241] bg-white dark:bg-[#151B23] p-1 shadow-xs">
              <div className="w-full h-64 rounded-2xl overflow-hidden">
                <LiveTrackingMap orderId={order.id} />
              </div>
            </div>
          ) : (
            /* Store Hub Order Fulfillment Process (In Place of Map) */
            <div className="bg-white dark:bg-[#151B23] border border-[#E5E7EB] dark:border-[#263241] rounded-3xl p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#263241] pb-3">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-pulse" />
                  <h3 className="text-xs font-black text-[#111827] dark:text-[#F9FAFB] uppercase tracking-wider">
                    Store Hub Fulfillment
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/20 animate-pulse">
                  In Progress
                </span>
              </div>

              <div className="space-y-3">
                <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    ✓
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#111827] dark:text-[#F9FAFB]">1. Order Verified & Items Reserved</h4>
                    <p className="text-[10px] text-slate-500 dark:text-[#9CA3AF] mt-0.5">Stock reserved from fresh inventory at Store Hub.</p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className={`p-3 rounded-2xl border flex items-start gap-3 transition-all ${
                  isPacked || isDelivered
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-500/30'
                    : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-500/40'
                }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    isPacked || isDelivered
                      ? 'bg-emerald-500 text-white'
                      : 'bg-amber-500 text-white animate-spin'
                  }`}>
                    {isPacked || isDelivered ? '✓' : <Loader2 className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className={`text-xs font-bold ${isPacked || isDelivered ? 'text-[#111827] dark:text-[#F9FAFB]' : 'text-amber-900 dark:text-amber-300'}`}>
                        2. Picking & Fresh Packaging
                      </h4>
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                        isPacked || isDelivered
                          ? 'text-emerald-700 bg-emerald-100 dark:bg-emerald-900/60 dark:text-emerald-300'
                          : 'text-amber-800 bg-amber-200/80 dark:bg-amber-900/60 dark:text-amber-300 animate-pulse'
                      }`}>
                        {isPacked || isDelivered ? 'Completed' : 'Packing Now'}
                      </span>
                    </div>
                    <p className={`text-[10px] mt-0.5 ${isPacked || isDelivered ? 'text-slate-500 dark:text-[#9CA3AF]' : 'text-amber-800/80 dark:text-amber-200/80'}`}>
                      {isPacked || isDelivered
                        ? 'All fresh items picked, expiry dates verified, and packed in sealed tamper-evident bag.'
                        : 'Hand-picking fresh items and sealing into tamper-evident bags.'}
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className={`p-3 rounded-2xl border flex items-start gap-3 transition-all ${
                  isPickedUp || isOutForDelivery || isDelivered
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-500/30'
                    : isPartnerAssigned || isPacked
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-500/40'
                    : 'bg-slate-50 dark:bg-[#111827] border-[#E5E7EB] dark:border-[#263241]'
                }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    isPickedUp || isOutForDelivery || isDelivered
                      ? 'bg-emerald-500 text-white'
                      : isPartnerAssigned || isPacked
                      ? 'bg-amber-500 text-white animate-spin'
                      : 'bg-slate-200 dark:bg-[#1B2430] text-slate-600 dark:text-[#9CA3AF]'
                  }`}>
                    {isPickedUp || isOutForDelivery || isDelivered ? (
                      '✓'
                    ) : isPartnerAssigned || isPacked ? (
                      <Loader2 className="w-3.5 h-3.5" />
                    ) : (
                      '3'
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className={`text-xs font-bold ${
                        isPickedUp || isOutForDelivery || isDelivered
                          ? 'text-[#111827] dark:text-[#F9FAFB]'
                          : isPartnerAssigned || isPacked
                          ? 'text-amber-900 dark:text-amber-300'
                          : 'text-slate-700 dark:text-[#D1D5DB]'
                      }`}>
                        3. Express Rider Handover
                      </h4>
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                        isPickedUp || isOutForDelivery || isDelivered
                          ? 'text-emerald-700 bg-emerald-100 dark:bg-emerald-900/60 dark:text-emerald-300'
                          : isPartnerAssigned
                          ? 'text-amber-800 bg-amber-200/80 dark:bg-amber-900/60 dark:text-amber-300 animate-pulse'
                          : isPacked
                          ? 'text-amber-800 bg-amber-200/80 dark:bg-amber-900/60 dark:text-amber-300 animate-pulse'
                          : 'text-slate-500 bg-slate-200 dark:bg-[#1F2937]'
                      }`}>
                        {isPickedUp || isOutForDelivery || isDelivered
                          ? 'Completed'
                          : isPartnerAssigned
                          ? 'Rider Assigned'
                          : isPacked
                          ? 'Ready for Pickup'
                          : 'Upcoming'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-[#9CA3AF] mt-0.5">
                      {isPickedUp || isOutForDelivery || isDelivered
                        ? `Assigned partner (${partnerName}) collected package at hub counter.`
                        : isPartnerAssigned
                        ? `Assigned partner (${partnerName}) is heading to Store Hub for package pickup.`
                        : isPacked
                        ? 'Order is packed and waiting at pickup counter for express rider handover.'
                        : `Assigned partner (${partnerName}) collects package at hub counter.`}
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className={`p-3 rounded-2xl border flex items-start gap-3 transition-all ${
                  isOutForDelivery || isDelivered
                    ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-500/30'
                    : 'bg-slate-50 dark:bg-[#111827] border-[#E5E7EB] dark:border-[#263241]'
                }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    isOutForDelivery || isDelivered
                      ? 'bg-purple-600 text-white animate-pulse'
                      : 'bg-slate-200 dark:bg-[#1B2430] text-slate-600 dark:text-[#9CA3AF]'
                  }`}>
                    {isDelivered ? '✓' : isOutForDelivery ? '●' : '4'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className={`text-xs font-bold ${isOutForDelivery || isDelivered ? 'text-purple-950 dark:text-purple-300' : 'text-slate-700 dark:text-[#D1D5DB]'}`}>
                        4. Live GPS Map Tracking
                      </h4>
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                        isDelivered
                          ? 'text-emerald-700 bg-emerald-100 dark:bg-emerald-900/60 dark:text-emerald-300'
                          : isOutForDelivery
                          ? 'text-purple-800 bg-purple-200/80 dark:bg-purple-900/60 dark:text-purple-300 animate-pulse'
                          : 'text-slate-500 bg-slate-200 dark:bg-[#1F2937]'
                      }`}>
                        {isDelivered ? 'Delivered' : isOutForDelivery ? 'Active Now' : 'Auto-activates'}
                      </span>
                    </div>
                    <p className={`text-[10px] mt-0.5 ${isOutForDelivery || isDelivered ? 'text-purple-900 dark:text-purple-200' : 'text-slate-500 dark:text-[#9CA3AF]'}`}>
                      {isDelivered
                        ? 'Order successfully delivered to your doorstep.'
                        : isOutForDelivery
                        ? 'Live GPS navigation is active! Rider is currently en route to your address.'
                        : 'Live Map navigation will automatically activate once rider departs!'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Stepper Timeline */}
          <div className="bg-white dark:bg-[#151B23] border border-[#E5E7EB] dark:border-[#263241] rounded-3xl p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#263241] pb-2.5">
              <h3 className="text-xs font-black text-[#111827] dark:text-[#F9FAFB] uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Order Status
              </h3>
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/20 animate-pulse">
                Live Sync
              </span>
            </div>

            <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-emerald-500/40">
              
              {/* Step 1: Placed */}
              <div className="relative flex items-start gap-3">
                <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold ring-4 ring-emerald-500/20">
                  ✓
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#111827] dark:text-[#F9FAFB]">Order Confirmed</h4>
                  <span className="text-[10px] text-slate-500 dark:text-[#9CA3AF] block mt-0.5">{placedDateFormatted}</span>
                </div>
              </div>

              {/* Step 2: Packed */}
              <div className="relative flex items-start gap-3">
                <div className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ring-4 transition-colors ${
                  isPacked || isDelivered ? 'bg-emerald-500 text-white ring-emerald-500/20' : 'bg-emerald-600 text-white animate-pulse'
                }`}>
                  {isPacked || isDelivered ? '✓' : '2'}
                </div>
                <div>
                  <h4 className={`text-xs font-bold ${isPacked || isDelivered ? 'text-[#111827] dark:text-[#F9FAFB]' : 'text-emerald-700 dark:text-emerald-400'}`}>
                    Prepared & Packed
                  </h4>
                  <span className={`text-[10px] block mt-0.5 ${isPacked || isDelivered ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-slate-500 dark:text-[#9CA3AF]'}`}>
                    {isPacked || isDelivered ? 'Packed at Store Hub' : 'Preparing and verifying items'}
                  </span>
                </div>
              </div>

              {/* Step 3: Out for Delivery */}
              <div className="relative flex items-start gap-3">
                <div className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ring-4 transition-colors ${
                  isOutForDelivery || isDelivered ? 'bg-emerald-500 text-white ring-emerald-500/20' : 'bg-slate-200 dark:bg-[#1B2430] text-slate-500 dark:text-[#9CA3AF] ring-slate-100 dark:ring-[#111827]'
                }`}>
                  {isOutForDelivery || isDelivered ? '✓' : '3'}
                </div>
                <div>
                  <h4 className={`text-xs font-bold ${isOutForDelivery || isDelivered ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400 dark:text-[#6B7280]'}`}>
                    Out for Delivery
                  </h4>
                  <p className={`text-[10px] block mt-0.5 ${isOutForDelivery || isDelivered ? 'text-slate-600 dark:text-[#D1D5DB]' : 'text-slate-400 dark:text-[#6B7280]'}`}>
                    {isDelivered ? 'Rider reached destination' : isOutForDelivery ? `${partnerName} is en route` : 'Awaiting rider pickup'}
                  </p>
                </div>
              </div>

              {/* Step 4: Delivered */}
              <div className="relative flex items-start gap-3">
                <div className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                  isDelivered ? 'bg-emerald-500 text-white ring-4 ring-emerald-500/20' : 'bg-slate-200 dark:bg-[#1B2430] text-slate-500 dark:text-[#9CA3AF] ring-4 ring-slate-100 dark:ring-[#111827]'
                }`}>
                  {isDelivered ? '✓' : '4'}
                </div>
                <div>
                  <h4 className={`text-xs font-bold ${isDelivered ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400 dark:text-[#6B7280]'}`}>
                    Doorstep Delivery
                  </h4>
                  <span className="text-[10px] text-slate-500 dark:text-[#9CA3AF] block mt-0.5">
                    {isDelivered ? 'Delivered successfully' : 'Within 30 mins Express'}
                  </span>
                </div>
              </div>

            </div>
          </div>

          {/* Delivery Partner Driver Card */}
          <div className="bg-white dark:bg-[#151B23] border border-[#E5E7EB] dark:border-[#263241] rounded-3xl p-4 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Bike className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-xs text-[#111827] dark:text-[#F9FAFB] truncate">
                  {partnerName}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF] flex items-center gap-1 mt-0.5">
                  <span>Express Partner</span>
                  <span className="text-amber-500 font-bold">⭐ 4.9</span>
                </p>
              </div>
            </div>

            <a
              href={`tel:${partnerPhone}`}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all shrink-0 cursor-pointer"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Call</span>
            </a>
          </div>

          {/* Deliver To */}
          <div className="bg-white dark:bg-[#151B23] border border-[#E5E7EB] dark:border-[#263241] rounded-3xl p-4 space-y-1.5 shadow-xs">
            <h3 className="text-xs font-black text-slate-500 dark:text-[#9CA3AF] uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Deliver to
            </h3>
            <p className="text-xs text-slate-700 dark:text-[#D1D5DB] leading-relaxed font-medium pl-5">
              {deliveryAddressStr}
            </p>
          </div>

          {/* Items Summary */}
          <div className="bg-white dark:bg-[#151B23] border border-[#E5E7EB] dark:border-[#263241] rounded-3xl p-4 space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#263241] pb-2">
              <h3 className="text-xs font-black text-[#111827] dark:text-[#F9FAFB] uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-slate-400 dark:text-[#9CA3AF]" /> Items ({itemsCount})
              </h3>
              <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400">₹{order.total}</span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-[#263241] max-h-48 overflow-y-auto">
              {order.items && order.items.length > 0 ? (
                order.items.map((item: any, idx: number) => {
                  const name = item.product?.name || item.productName || item.name || 'Item';
                  const qty = item.quantity || 1;
                  const price = item.price || item.product?.sellingPrice || item.unitPrice || 0;
                  const img = item.product?.thumbnail || item.product?.image || null;

                  return (
                    <div key={idx} className="py-2 flex items-center justify-between text-xs first:pt-0 last:pb-0">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#263241] flex items-center justify-center overflow-hidden shrink-0">
                          {img ? (
                            <img src={img} alt="" className="w-full h-full object-contain" />
                          ) : (
                            <Package className="w-3.5 h-3.5 text-slate-400 dark:text-[#9CA3AF]" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-slate-800 dark:text-[#D1D5DB] truncate block">{name}</span>
                          <span className="text-[10px] text-slate-400 dark:text-[#9CA3AF]">Qty: {qty}</span>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-[#111827] dark:text-[#F9FAFB] shrink-0 ml-2">₹{price * qty}</span>
                    </div>
                  );
                })
              ) : (
                <div className="text-xs text-slate-400 dark:text-[#9CA3AF] py-2">Items data unavailable</div>
              )}
            </div>
          </div>

        </div>
      ) : (

        /* ════════════════════════════════════════════════════════════════
            CASE B: DELIVERED ORDER (PROFESSIONAL ORDER SUMMARY VIEW)
           ════════════════════════════════════════════════════════════════ */
        <div className="flex-1 max-w-lg w-full mx-auto px-4 pt-4 pb-28 space-y-6">

          {/* ── 1. ORDER SUMMARY HEADER ── */}
          <div className="space-y-1.5 pt-1">
            <h1 className="text-2xl font-black text-[#111827] dark:text-[#F9FAFB] tracking-tight">
              Order summary
            </h1>
            <p className="text-sm font-semibold text-slate-600 dark:text-[#D1D5DB]">
              {deliveryHeadline}
            </p>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleDownloadInvoice}
                disabled={isDownloadingInvoice}
                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDownloadingInvoice ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>Download Invoice</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('track')}
                className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-[#D1D5DB] hover:text-[#111827] dark:hover:text-white transition-colors cursor-pointer"
              >
                <Navigation className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>View Route Map</span>
              </button>
            </div>
          </div>

          {/* ── 2. ITEMS IN THIS ORDER ── */}
          <div className="space-y-3">
            <h2 className="text-sm font-black text-[#111827] dark:text-[#F9FAFB] tracking-tight">
              {itemsCount} {itemsCount === 1 ? 'item' : 'items'} in this order
            </h2>

            <div className="space-y-3">
              {order.items && order.items.length > 0 ? (
                order.items.map((item: any, idx: number) => {
                  const name = item.product?.name || item.productName || item.name || 'Grocery Item';
                  const unit = item.product?.unit || item.unit || '500 ml';
                  const qty = item.quantity || 1;
                  const sellingPrice = item.price || item.product?.sellingPrice || item.unitPrice || 0;
                  const mrp = item.product?.mrp || item.mrp || (sellingPrice > 0 ? Math.round(sellingPrice * 1.15) : sellingPrice);
                  const hasDiscount = mrp > sellingPrice;
                  const totalItemPrice = sellingPrice * qty;
                  const totalMrp = mrp * qty;
                  const image = item.product?.image || item.product?.thumbnail || item.image || null;

                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 dark:border-[#263241] last:border-0"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        {/* Product Thumbnail container */}
                        <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-[#151B23] border border-[#E5E7EB] dark:border-[#263241] flex items-center justify-center p-1.5 shrink-0 overflow-hidden">
                          {image ? (
                            <img
                              src={image}
                              alt={name}
                              className="w-full h-full object-contain rounded-lg"
                            />
                          ) : (
                            <Package className="w-6 h-6 text-slate-400 dark:text-[#9CA3AF]" />
                          )}
                        </div>

                        {/* Name & Pack Size */}
                        <div className="min-w-0">
                          <h3 className="text-xs font-black text-[#111827] dark:text-[#F9FAFB] truncate block">
                            {name}
                          </h3>
                          <p className="text-[11px] font-medium text-slate-500 dark:text-[#9CA3AF] mt-0.5">
                            {unit} x {qty}
                          </p>
                        </div>
                      </div>

                      {/* Pricing */}
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1.5 justify-end">
                          {hasDiscount && (
                            <span className="text-xs text-slate-400 dark:text-[#9CA3AF] line-through font-medium">
                              ₹{totalMrp}
                            </span>
                          )}
                          <span className="text-xs font-black text-[#111827] dark:text-[#F9FAFB] font-mono">
                            ₹{totalItemPrice}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-xs text-slate-400 dark:text-[#9CA3AF] py-3">
                  Items data unavailable.
                </div>
              )}
            </div>
          </div>

          {/* ── 3. RATING SECTION ("How were your ordered items?") ── */}
          <div className="bg-white dark:bg-[#151B23] border border-[#E5E7EB] dark:border-[#263241] rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-[#1B2430] border border-amber-200 dark:border-[#263241] text-amber-500 flex items-center justify-center shrink-0">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              </div>
              <span className="text-xs font-bold text-slate-700 dark:text-[#D1D5DB] truncate">
                {isRated ? 'Rating submitted • Thank you!' : 'How were your ordered items?'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowRatingModal(true)}
              className="shrink-0 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs px-4 py-2 rounded-xl transition-all cursor-pointer shadow-xs"
            >
              {isRated ? 'Edit rating' : 'Rate now'}
            </button>
          </div>

          {/* ── 4. BILL DETAILS ── */}
          <div className="space-y-3 pt-1">
            <h2 className="text-sm font-black text-[#111827] dark:text-[#F9FAFB] tracking-tight">
              Bill details
            </h2>

            <div className="space-y-2.5 text-xs text-slate-600 dark:text-[#D1D5DB]">
              <div className="flex items-center justify-between font-medium">
                <span>MRP</span>
                <span className="font-mono text-slate-800 dark:text-[#D1D5DB]">₹{billCalc.mrpTotal}</span>
              </div>

              {billCalc.discount > 0 && (
                <div className="flex items-center justify-between font-bold text-emerald-700 dark:text-emerald-400">
                  <span>Product discount</span>
                  <span className="font-mono">-₹{billCalc.discount}</span>
                </div>
              )}

              <div className="flex items-center justify-between font-medium">
                <span>Item total</span>
                <span className="font-mono text-slate-800 dark:text-[#D1D5DB]">₹{billCalc.itemTotal}</span>
              </div>

              <div className="flex items-center justify-between font-medium">
                <span>Handling charge</span>
                <span className="font-mono text-slate-800 dark:text-[#D1D5DB]">+₹{billCalc.handlingFee}</span>
              </div>

              <div className="flex items-center justify-between font-medium">
                <span>Delivery charges</span>
                <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                  {billCalc.deliveryCharge === 0 ? 'FREE' : `₹${billCalc.deliveryCharge}`}
                </span>
              </div>

              <div className="flex items-center justify-between font-black text-sm text-[#111827] dark:text-[#F9FAFB] pt-2.5 border-t border-slate-100 dark:border-[#263241]">
                <span>Bill total</span>
                <span className="font-mono text-base text-[#111827] dark:text-[#F9FAFB]">₹{billCalc.billTotal}</span>
              </div>
            </div>
          </div>

          {/* ── 5. ORDER DETAILS ── */}
          <div className="space-y-3 pt-2">
            <h2 className="text-sm font-black text-[#111827] dark:text-[#F9FAFB] tracking-tight">
              Order details
            </h2>

            <div className="space-y-3 text-xs">
              {/* Order ID with Copy Icon */}
              <div>
                <span className="text-[11px] text-slate-400 dark:text-[#9CA3AF] font-medium block">
                  Order id
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono font-bold text-slate-800 dark:text-[#F9FAFB]">
                    {order.orderNumber || order.id}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyOrderId}
                    className="text-slate-400 dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white transition-colors cursor-pointer"
                    title="Copy Order ID"
                  >
                    {copiedId ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <span className="text-[11px] text-slate-400 dark:text-[#9CA3AF] font-medium block">
                  Payment
                </span>
                <span className="font-bold text-slate-800 dark:text-[#F9FAFB] block mt-0.5 capitalize">
                  {order.paymentMethod === 'cod' ? 'Cash on Delivery' : order.paymentMethod === 'upi' ? 'Paid via UPI' : 'Paid Online'}
                </span>
              </div>

              {/* Deliver To */}
              <div>
                <span className="text-[11px] text-slate-400 dark:text-[#9CA3AF] font-medium block">
                  Deliver to
                </span>
                <span className="font-medium text-slate-700 dark:text-[#D1D5DB] block mt-0.5 leading-relaxed">
                  {deliveryAddressStr}
                </span>
              </div>

              {/* Order Placed Timestamp */}
              <div>
                <span className="text-[11px] text-slate-400 dark:text-[#9CA3AF] font-medium block">
                  Order placed
                </span>
                <span className="font-medium text-slate-700 dark:text-[#D1D5DB] block mt-0.5">
                  {placedDateFormatted}
                </span>
              </div>
            </div>
          </div>

          {/* ── 6. NEED HELP WITH YOUR ORDER? ── */}
          <div className="pt-2 space-y-3">
            <h2 className="text-sm font-black text-[#111827] dark:text-[#F9FAFB] tracking-tight">
              Need help with your order?
            </h2>

            <div
              onClick={() => setShowSupportModal(true)}
              className="bg-white dark:bg-[#151B23] border border-[#E5E7EB] dark:border-[#263241] rounded-2xl p-4 flex items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-neutral-700 transition-colors cursor-pointer group shadow-xs"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-[#1B2430] border border-[#E5E7EB] dark:border-[#263241] text-slate-600 dark:text-[#D1D5DB] flex items-center justify-center shrink-0">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-black text-[#111827] dark:text-[#F9FAFB] block">
                    Chat with us
                  </h3>
                  <p className="text-[11px] text-slate-400 dark:text-[#9CA3AF] truncate mt-0.5">
                    About any issues related to your order
                  </p>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-slate-400 dark:text-neutral-500 group-hover:text-slate-900 dark:group-hover:text-white transition-colors shrink-0" />
            </div>
          </div>

          {/* ── 7. FIXED BOTTOM ACTION BAR (REPEAT ORDER - ONLY FOR DELIVERED) ── */}
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md border-t border-[#E5E7EB] dark:border-[#263241] px-4 py-3">
            <div className="max-w-lg mx-auto">
              <button
                type="button"
                onClick={handleRepeatOrder}
                className="w-full py-3 px-6 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black rounded-2xl shadow-lg transition-all flex flex-col items-center justify-center cursor-pointer"
              >
                <span className="text-sm font-black leading-tight">
                  Repeat Order
                </span>
                <span className="text-[10px] font-extrabold text-emerald-100 tracking-wider uppercase leading-none mt-0.5">
                  VIEW CART ON NEXT STEP
                </span>
              </button>
            </div>
          </div>

        </div>
      )}

      {/* ── 8. RATING MODAL ── */}
      {showRatingModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1B2430] border border-[#E5E7EB] dark:border-[#263241] rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-[#111827] dark:text-[#F9FAFB]">Rate your items</h3>
              <button
                onClick={() => setShowRatingModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#111827] text-slate-500 dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-[#9CA3AF]">
              How was the product freshness, packaging and delivery speed?
            </p>

            {/* 5 Stars */}
            <div className="flex items-center justify-center gap-3 py-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRatingScore(star)}
                  className="p-1 cursor-pointer transition-transform hover:scale-110 active:scale-95"
                >
                  <Star
                    className={`w-8 h-8 ${
                      star <= ratingScore
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-300 dark:text-[#263241]'
                    }`}
                  />
                </button>
              ))}
            </div>

            <textarea
              rows={3}
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
              placeholder="Leave a comment or feedback (optional)..."
              className="w-full bg-slate-50 dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#263241] rounded-xl p-3 text-xs text-[#111827] dark:text-[#F9FAFB] placeholder:text-slate-400 dark:placeholder:text-[#9CA3AF] focus:outline-none focus:border-emerald-500 resize-none"
            />

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRatingModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#263241] text-slate-700 dark:text-[#D1D5DB] font-bold text-xs hover:bg-slate-100 dark:hover:bg-[#111827] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitRating}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md cursor-pointer"
              >
                Submit Rating
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 9. SUPPORT MODAL ── */}
      {showSupportModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1B2430] border border-[#E5E7EB] dark:border-[#263241] rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-[#111827] dark:text-[#F9FAFB]">Pocket Kirana Support</h3>
              <button
                onClick={() => setShowSupportModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#111827] text-slate-500 dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-[#9CA3AF]">
              Need assistance with Order #{order.orderNumber || order.id}? We are available 24/7 to resolve queries.
            </p>

            <div className="space-y-2 pt-1">
              <a
                href={`https://wa.me/918698893348?text=${encodeURIComponent(`Hi PocketKirana Support, I need help with my Order #${order.orderNumber || order.id}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-between p-3.5 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl text-xs font-bold text-emerald-700 dark:text-emerald-400 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <MessageSquare className="w-4 h-4" />
                  <span>Chat on WhatsApp</span>
                </div>
                <ChevronRight className="w-4 h-4" />
              </a>

              <a
                href="tel:+918698893348"
                className="w-full flex items-center justify-between p-3.5 bg-slate-50 dark:bg-[#111827] hover:bg-slate-100 dark:hover:bg-[#151B23] border border-[#E5E7EB] dark:border-[#263241] rounded-2xl text-xs font-bold text-slate-700 dark:text-[#D1D5DB] transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4" />
                  <span>Call Customer Care</span>
                </div>
                <ChevronRight className="w-4 h-4" />
              </a>
            </div>

            <button
              type="button"
              onClick={() => setShowSupportModal(false)}
              className="w-full py-2.5 bg-slate-100 dark:bg-[#111827] hover:bg-slate-200 dark:hover:bg-[#151B23] text-slate-700 dark:text-[#D1D5DB] font-bold text-xs rounded-xl cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
