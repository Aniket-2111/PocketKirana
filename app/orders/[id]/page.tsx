'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useParams, usePathname, useSearchParams } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { subscribeSingleOrderFS } from '@/lib/firebaseServices';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { LiveTrackingMap } from '@/components/customer/LiveTrackingMap';
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
  RotateCcw,
  Clock,
  HelpCircle,
  CreditCard,
  MapPin,
  Truck,
  CheckCircle2,
  Navigation
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

function OrderTrackingContent() {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const orderId = (params?.id as string) || '';
  const { orders, products, addToCart, downloadInvoicePDF, addReview } = useAppStore();

  const [isMounted, setIsMounted] = useState(false);
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Rating Modal State
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [isRated, setIsRated] = useState(false);

  // Support Chat Modal State
  const [showSupportModal, setShowSupportModal] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [liveOrder, setLiveOrder] = useState<Order | null>(null);

  // Real-time Firestore document listener for live order status updates
  useEffect(() => {
    if (!orderId) return;

    const unsub = subscribeSingleOrderFS(orderId, (updatedOrder) => {
      if (updatedOrder) {
        setLiveOrder(updatedOrder);
      }
    });

    return () => unsub();
  }, [orderId]);

  const order = useMemo(() => {
    if (liveOrder) return liveOrder;
    const storeMatch = orders.find((o) => o.id === orderId || o.orderNumber === orderId);
    if (storeMatch) return storeMatch;
    return orders.length > 0 ? orders[0] : null;
  }, [liveOrder, orders, orderId]);

  const orderNumber = order?.orderNumber || orderId || 'PK102938';
  const rawStatus = (order?.orderStatus || (order as any)?.status || (order as any)?.order_status || 'CONFIRMED').toString();
  const statusUpper = rawStatus.toUpperCase();
  const statusLower = rawStatus.toLowerCase();

  // Partner info
  const partnerName = order?.partnerName || (order as any)?.assignedPartnerName || 'Sunil Kumar (Express Agent)';
  const partnerPhone = order?.partnerPhone || '+918698893348';

  const isDelivered = ['DELIVERED', 'COMPLETED'].includes(statusUpper);
  const isOutForDelivery = ['OUT_FOR_DELIVERY', 'ARRIVED_AT_CUSTOMER', 'DELIVERED', 'COMPLETED'].includes(statusUpper);
  const isPickedUp = ['PICKED_UP', 'ORDER_PICKED_UP', 'OUT_FOR_DELIVERY', 'ARRIVED_AT_CUSTOMER', 'DELIVERED', 'COMPLETED'].includes(statusUpper);
  const isPartnerAssigned = ['DELIVERY_PARTNER_NOTIFIED', 'DELIVERY_PARTNER_ACCEPTED', 'ASSIGNED', 'PARTNER_ASSIGNED', 'PARTNER_ARRIVED_STORE', 'PICKED_UP', 'ORDER_PICKED_UP', 'OUT_FOR_DELIVERY', 'ARRIVED_AT_CUSTOMER', 'DELIVERED', 'COMPLETED'].includes(statusUpper);
  const isPacked = ['ORDER_PACKED', 'PACKED', 'WAITING_FOR_DELIVERY', 'READY_FOR_PICKUP', 'READY', 'DELIVERY_PARTNER_NOTIFIED', 'DELIVERY_PARTNER_ACCEPTED', 'ASSIGNED', 'PARTNER_ASSIGNED', 'PARTNER_ARRIVED_STORE', 'PICKED_UP', 'ORDER_PICKED_UP', 'OUT_FOR_DELIVERY', 'ARRIVED_AT_CUSTOMER', 'DELIVERED', 'COMPLETED'].includes(statusUpper);

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

  // Determine whether to display the Live Tracking Page vs Delivered Summary
  const isExplicitTrackRoute = pathname?.endsWith('/track') || searchParams?.get('tab') === 'track';
  const showLiveTracking = isExplicitTrackRoute || !isDelivered;

  // Auto-redirect to bill summary when order becomes delivered while on live tracking view
  const [hasRedirectedToSummary, setHasRedirectedToSummary] = useState(false);
  useEffect(() => {
    if (isDelivered && showLiveTracking && !hasRedirectedToSummary && orderId) {
      setHasRedirectedToSummary(true);
      showToast('🎉 Order Delivered! Showing your bill summary...', 'success');
      const timer = setTimeout(() => {
        router.replace(`/orders/${orderId}`);
      }, 1500);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDelivered, showLiveTracking, hasRedirectedToSummary, orderId]);

  const safeParseDate = (dateVal?: any): Date | null => {
    if (!dateVal) return null;
    try {
      const d = new Date(dateVal);
      if (!isNaN(d.getTime())) return d;
      return null;
    } catch {
      return null;
    }
  };

  // Delivery Headline
  const deliveryHeadline = useMemo(() => {
    if (!order) return '';
    if (isDelivered) {
      const d = safeParseDate(order.placedAt);
      if (d) {
        const timeStr = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
        return `Arrived at ${timeStr}`;
      }
      return 'Arrived recently';
    }
    if (statusLower === 'arrived_at_customer') return 'Rider has arrived at your doorstep';
    if (isOutForDelivery) return 'On the way • Expected in 10-15 mins';
    return `Order Placed • ${order.deliverySlot || '30 mins Express'}`;
  }, [order, isDelivered, statusLower, isOutForDelivery]);

  // Placed date string formatted
  const placedDateFormatted = useMemo(() => {
    if (!order?.placedAt) return 'placed recently';
    const d = safeParseDate(order.placedAt);
    if (d) {
      const weekday = d.toLocaleDateString('en-IN', { weekday: 'short' });
      const day = d.getDate();
      const month = d.toLocaleDateString('en-IN', { month: 'short' });
      const year = String(d.getFullYear()).slice(-2);
      const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
      return `placed on ${weekday}, ${day} ${month}'${year}, ${time}`;
    }
    return `placed on ${order.placedAt}`;
  }, [order]);

  // Bill calculation breakdown
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
    const idToCopy = order?.orderNumber || order?.id || orderId;
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

  const itemsCount = order?.items?.length || 0;
  const deliveryAddressStr = order?.address
    ? `${(order.address as any).name || (order.address as any).fullName || order.customerName || 'Customer'}, ${order.address.addressLine1 || ''}${order.address.addressLine2 ? ', ' + order.address.addressLine2 : ''}, ${order.address.city || 'Neral'}`
    : `${order?.customerName || 'Customer'}, Flat 302, Rama Heights, Station Road, Neral`;

  return (
    <CustomerLayout>
      <div className="bg-[#F8F9FA] min-h-[calc(100vh-64px)] pb-28">

        {/* ── SUB-HEADER NAVIGATION BAR ── */}
        <div className="border-b border-gray-200/80 bg-white sticky top-0 z-30 shadow-2xs backdrop-blur-md">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
            <Link
              href="/profile?tab=my_orders"
              className="inline-flex items-center gap-2 text-xs font-black text-gray-700 hover:text-[#006E2F] transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 text-gray-400 group-hover:text-[#006E2F] transition-transform group-hover:-translate-x-0.5" />
              <span>Back to Orders</span>
            </Link>

            <div className="flex items-center gap-2.5">
              <span className={`text-[11px] font-black px-3 py-1 rounded-full uppercase border shadow-2xs ${
                isDelivered
                  ? 'bg-emerald-50 text-[#006E2F] border-emerald-300'
                  : isOutForDelivery
                  ? 'bg-purple-50 text-purple-700 border-purple-300 animate-pulse'
                  : 'bg-amber-50 text-amber-800 border-amber-300'
              }`}>
                {order?.orderStatus?.replace('_', ' ') || 'CONFIRMED'}
              </span>

              {/* Toggle button between Track and Details */}
              {isDelivered && (
                showLiveTracking ? (
                  <Link
                    href={`/orders/${order?.id || orderId}`}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-xl transition-all shadow-2xs"
                  >
                    <span>View Summary</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                ) : (
                  <Link
                    href={`/orders/${order?.id || orderId}/track`}
                    className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#006E2F] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-xl transition-all shadow-2xs"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>Track on Map</span>
                  </Link>
                )
              )}

              {isDelivered && (
                <button
                  type="button"
                  onClick={handleDownloadInvoice}
                  disabled={isDownloadingInvoice}
                  className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95"
                >
                  {isDownloadingInvoice ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#006E2F]" />
                  ) : (
                    <Download className="w-3.5 h-3.5 text-[#006E2F]" />
                  )}
                  <span className="hidden sm:inline">Invoice</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowSupportModal(true)}
                className="inline-flex items-center gap-1.5 text-xs font-extrabold text-gray-700 bg-gray-50 hover:bg-gray-100 hover:text-[#006E2F] border border-gray-200 px-3 py-1 rounded-xl transition-all shadow-2xs cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5 text-gray-500" />
                <span>Help</span>
              </button>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            CASE A: LIVE TRACKING EXPERIENCE (TRACK ORDER PAGE)
           ════════════════════════════════════════════════════════════════ */}
        {showLiveTracking ? (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
            
            {/* 1. TOP PROMINENT DELIVERY OTP CARD (In Middle / Large Size) */}
            {!isDelivered && (
              <div className="bg-gradient-to-r from-emerald-700 via-[#006E2F] to-teal-800 rounded-3xl p-5 sm:p-6 text-white shadow-lg border border-emerald-600/50">
                <div className="flex flex-col md:flex-row items-center justify-between gap-5 text-center md:text-left">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-amber-300 shrink-0 shadow-inner">
                      <ShieldCheck className="w-7 h-7" />
                    </div>
                    <div>
                      <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-300 bg-black/30 px-2.5 py-0.5 rounded-full border border-amber-300/30">
                          Share at Doorstep
                        </span>
                        <span className="text-xs text-emerald-200 font-bold">Order #{orderNumber}</span>
                      </div>
                      <h2 className="text-lg sm:text-xl font-black text-white">
                        Delivery Verification OTP
                      </h2>
                      <p className="text-xs text-emerald-100 font-medium mt-0.5">
                        Please provide this 4-digit code to your delivery partner upon arrival
                      </p>
                    </div>
                  </div>

                  {/* Large Centered 4-Digit OTP PIN */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/20 shadow-inner">
                      <span className="text-xs font-black text-amber-300 uppercase tracking-widest mr-1">OTP</span>
                      {deliveryOtp.split('').map((digit, i) => (
                        <span
                          key={i}
                          className="w-10 h-12 sm:w-11 sm:h-13 rounded-xl bg-white/15 border border-white/30 flex items-center justify-center text-2xl sm:text-3xl font-black font-mono text-white shadow-sm"
                        >
                          {digit}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Live Tracking Status Banner */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                    isOutForDelivery 
                      ? 'bg-purple-100 text-purple-800' 
                      : isPacked
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {isOutForDelivery ? '● Live Rider GPS Active' : isPacked ? '● Packed & Ready for Handover' : '● Store Hub Fulfilling'}
                  </span>
                  <span className="text-xs text-gray-500 font-bold">
                    30 Min Express Delivery
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                  {isDelivered ? (
                    <CheckCircle2 className="w-6 h-6 text-[#006E2F]" />
                  ) : isOutForDelivery ? (
                    <Truck className="w-6 h-6 animate-pulse text-[#006E2F]" />
                  ) : (
                    <Package className="w-6 h-6 animate-bounce text-[#006E2F]" />
                  )}
                  {isDelivered
                    ? 'Order Delivered Successfully!'
                    : isOutForDelivery
                    ? 'Rider is Out for Delivery!'
                    : isPartnerAssigned
                    ? `Assigned to ${partnerName}`
                    : isPacked
                    ? 'Order Packed • Ready for Express Delivery'
                    : 'Order Confirmed • Packing at Store Hub'}
                </h1>
                <p className="text-xs text-gray-600 font-medium">
                  {isDelivered
                    ? 'Your express grocery order has reached your doorstep.'
                    : isOutForDelivery
                    ? 'Expected doorstep arrival in 10-15 mins'
                    : isPartnerAssigned
                    ? `${partnerName} is heading to Store Hub for package pickup.`
                    : isPacked
                    ? 'Your items have been safely packed and are ready for express rider handover.'
                    : 'PocketKirana Store Hub is gathering and packing your fresh items'}
                </p>
              </div>

              <div className="flex items-center gap-2 bg-emerald-50 px-4 py-3 rounded-2xl border border-emerald-200">
                <Clock className="w-5 h-5 text-[#006E2F]" />
                <div>
                  <span className="text-[10px] font-black text-emerald-800 uppercase block tracking-wider">Estimated Time</span>
                  <span className="text-xs font-black text-emerald-950">
                    {isDelivered ? 'Delivered' : isOutForDelivery ? '10-15 Mins' : 'Within 30 Mins'}
                  </span>
                </div>
              </div>
            </div>

            {/* 2-Column Responsive Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

              {/* ── LEFT COLUMN: STATUS TIMELINE & DETAILS (lg:col-span-5) ── */}
              <div className="lg:col-span-5 space-y-4">
                
                {/* 1. Live Tracking Timeline Stepper */}
                <div className="bg-white rounded-3xl p-6 border border-gray-200/90 shadow-2xs space-y-5">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#006E2F]" /> Live Status
                    </h2>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full animate-pulse">
                      Live Syncing
                    </span>
                  </div>

                  <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-emerald-500">
                    
                    {/* Step 1: Placed */}
                    <div className="relative flex items-start gap-3">
                      <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-[#006E2F] text-white flex items-center justify-center text-xs font-bold ring-4 ring-emerald-50 shadow-xs">
                        ✓
                      </div>
                      <div>
                        <h4 className="text-xs font-extrabold text-gray-900">Order Placed & Confirmed</h4>
                        <span className="text-[11px] text-gray-500 block mt-0.5">{placedDateFormatted}</span>
                      </div>
                    </div>

                    {/* Step 2: Packed */}
                    <div className="relative flex items-start gap-3">
                      <div className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ring-4 ring-emerald-50 transition-colors ${
                        isPacked || isDelivered ? 'bg-[#006E2F] text-white' : 'bg-emerald-600 text-white animate-pulse'
                      }`}>
                        {isPacked || isDelivered ? '✓' : '2'}
                      </div>
                      <div>
                        <h4 className={`text-xs font-extrabold ${isPacked || isDelivered ? 'text-gray-900' : 'text-[#006E2F]'}`}>
                          Prepared & Packed
                        </h4>
                        <span className={`text-[11px] block mt-0.5 ${isPacked || isDelivered ? 'text-emerald-700 font-bold' : 'text-gray-500'}`}>
                          {isPacked || isDelivered ? 'Packed securely at Store Hub' : 'Items being gathered and verified'}
                        </span>
                      </div>
                    </div>

                    {/* Step 3: Out for Delivery */}
                    <div className="relative flex items-start gap-3">
                      <div className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ring-4 ring-emerald-50 transition-colors ${
                        isOutForDelivery || isDelivered ? 'bg-[#006E2F] text-white' : 'bg-gray-200 text-gray-500'
                      }`}>
                        {isOutForDelivery || isDelivered ? '✓' : '3'}
                      </div>
                      <div>
                        <h4 className={`text-xs font-extrabold ${isOutForDelivery || isDelivered ? 'text-[#006E2F]' : 'text-gray-400'}`}>
                          Out for Express Delivery
                        </h4>
                        <p className={`text-[11px] block mt-0.5 ${isOutForDelivery || isDelivered ? 'text-purple-700 font-bold' : 'text-gray-500'}`}>
                          {isDelivered ? 'Express rider completed trip' : isOutForDelivery ? `${partnerName} is on the way` : 'Rider dispatch pending'}
                        </p>
                      </div>
                    </div>

                    {/* Step 4: Delivered */}
                    <div className="relative flex items-start gap-3">
                      <div className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                        isDelivered ? 'bg-[#006E2F] text-white ring-4 ring-emerald-50 shadow-xs' : 'bg-gray-200 text-gray-400'
                      }`}>
                        {isDelivered ? '✓' : '4'}
                      </div>
                      <div>
                        <h4 className={`text-xs font-bold ${isDelivered ? 'text-emerald-800 font-black' : 'text-gray-400'}`}>
                          Doorstep Delivery
                        </h4>
                        <span className="text-[11px] text-gray-500 block mt-0.5">
                          {isDelivered ? 'Delivered successfully at doorstep' : 'Within 30 mins Express'}
                        </span>
                      </div>
                    </div>

                  </div>
                </div>

                {/* 2. Delivery Partner Driver Card */}
                <div className="bg-white rounded-3xl p-5 border border-gray-200/90 shadow-2xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-emerald-50 border-2 border-[#006E2F] flex items-center justify-center text-[#006E2F] font-black text-base shrink-0">
                      <Bike className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-sm text-gray-900 truncate">
                        {partnerName}
                      </h4>
                      <p className="text-xs text-gray-500 font-medium flex items-center gap-1 mt-0.5">
                        <span>Express Delivery Partner</span>
                        <span className="text-amber-500 font-bold">⭐ 4.9</span>
                      </p>
                    </div>
                  </div>

                  <a
                    href={`tel:${partnerPhone}`}
                    className="bg-[#006E2F] hover:bg-emerald-800 text-white font-black text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer shrink-0"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call</span>
                  </a>
                </div>

                {/* 3. Deliver To Address */}
                <div className="bg-white rounded-3xl p-5 border border-gray-200/90 shadow-2xs space-y-2">
                  <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-[#006E2F]" /> Delivery Address
                  </h3>
                  <p className="text-xs text-gray-700 font-medium leading-relaxed pl-5.5">
                    {deliveryAddressStr}
                  </p>
                </div>

                {/* 4. Items in this order */}
                <div className="bg-white rounded-3xl p-5 border border-gray-200/90 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                    <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-gray-500" /> Items ({itemsCount})
                    </h3>
                    <span className="text-xs font-bold text-gray-800 font-mono">₹{order?.total || billCalc.billTotal}</span>
                  </div>

                  <div className="divide-y divide-gray-100 max-h-56 overflow-y-auto">
                    {order?.items && order.items.length > 0 ? (
                      order.items.map((item: any, idx: number) => {
                        const name = item.product?.name || item.productName || item.name || 'Item';
                        const qty = item.quantity || 1;
                        const price = item.price || item.product?.sellingPrice || item.unitPrice || 0;
                        const img = item.product?.thumbnail || item.product?.image || null;

                        return (
                          <div key={idx} className="py-2.5 flex items-center justify-between text-xs first:pt-0 last:pb-0">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                                {img ? (
                                  <img src={img} alt="" className="w-full h-full object-contain" />
                                ) : (
                                  <Package className="w-4 h-4 text-gray-400" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <span className="font-bold text-gray-900 truncate block">{name}</span>
                                <span className="text-[11px] text-gray-500">Qty: {qty}</span>
                              </div>
                            </div>
                            <span className="font-mono font-bold text-gray-900 shrink-0 ml-2">₹{price * qty}</span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-xs text-gray-400 py-2">Item details unavailable</div>
                    )}
                  </div>
                </div>

              </div>

              {/* ── RIGHT COLUMN: MAP (WHEN OUT FOR DELIVERY) OR ORDER PROCESS (WHEN PREPARING) (lg:col-span-7) ── */}
              <div className="lg:col-span-7 space-y-4">
                
                {/* CONDITIONAL: IF OUT FOR DELIVERY OR DELIVERED, SHOW LIVE GPS MAP; OTHERWISE SHOW DETAILED ORDER PROCESS */}
                {isOutForDelivery || isDelivered ? (
                  /* 1. Live Tracking Map Card */
                  <div className="bg-white rounded-3xl p-3 sm:p-4 border border-gray-200/90 shadow-sm space-y-3">
                    <div className="flex items-center justify-between px-2 pt-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                        <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider">
                          Live GPS Map Navigation
                        </h3>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                        Express Route Active
                      </span>
                    </div>

                    <div className="w-full h-[380px] sm:h-[460px] rounded-2xl overflow-hidden border border-gray-100 shadow-inner">
                      <LiveTrackingMap orderId={orderId} />
                    </div>

                    <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-[#006E2F]" />
                        <span className="font-bold text-gray-700">PocketKirana Safety Assurance</span>
                      </div>
                      <span className="text-gray-500 text-[11px]">Contactless Delivery</span>
                    </div>
                  </div>
                ) : (
                  /* 2. ORDER PROCESSING & STORE PREPARATION HUB (IN PLACE OF MAP) */
                  <div className="bg-white rounded-3xl p-6 sm:p-7 border border-gray-200/90 shadow-sm space-y-6">
                    
                    {/* Header with Live Animation */}
                    <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#006E2F] shrink-0">
                          <Package className="w-5 h-5 animate-pulse" />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">
                            Order Fulfillment Process
                          </h3>
                          <p className="text-xs text-gray-500 font-medium">
                            Store Hub is processing your order
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full flex items-center gap-1.5 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        In Progress
                      </span>
                    </div>

                    {/* Visual Animated Fulfillment Pipeline */}
                    <div className="space-y-4">
                      
                      {/* Step 1 */}
                      <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 flex items-start gap-3.5">
                        <div className="w-8 h-8 rounded-full bg-[#006E2F] text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs">
                          ✓
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-xs font-black text-gray-900">1. Order Verified & Inventory Reserved</h4>
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">Completed</span>
                          </div>
                          <p className="text-[11px] text-gray-600 mt-1">
                            Your payment and items have been confirmed. Stock reserved at PocketKirana Store Hub.
                          </p>
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div className={`p-4 rounded-2xl flex items-start gap-3.5 transition-all ${
                        isPacked || isDelivered
                          ? 'bg-emerald-50/70 border border-emerald-200/90 shadow-2xs'
                          : 'bg-amber-50/70 border border-amber-200/90 shadow-2xs'
                      }`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          isPacked || isDelivered
                            ? 'bg-[#006E2F] text-white shadow-xs'
                            : 'bg-amber-500 text-white animate-spin'
                        }`}>
                          {isPacked || isDelivered ? '✓' : <Loader2 className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className={`text-xs font-black ${isPacked || isDelivered ? 'text-gray-900' : 'text-amber-900'}`}>
                              2. Picking & Fresh Packaging
                            </h4>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                              isPacked || isDelivered
                                ? 'text-emerald-700 bg-emerald-100/80'
                                : 'text-amber-800 bg-amber-200/80 animate-pulse'
                            }`}>
                              {isPacked || isDelivered ? 'Completed' : 'Packing Now'}
                            </span>
                          </div>
                          <p className={`text-[11px] mt-1 ${isPacked || isDelivered ? 'text-gray-600' : 'text-amber-800'}`}>
                            {isPacked || isDelivered
                              ? 'All fresh items verified, expiry dates checked, and securely sealed in tamper-evident eco bags.'
                              : 'Our store executive is hand-picking fresh items, checking expiry dates, and sealing bags in tamper-evident eco packaging.'}
                          </p>
                        </div>
                      </div>

                      {/* Step 3 */}
                      <div className={`p-4 rounded-2xl flex items-start gap-3.5 transition-all ${
                        isPickedUp || isOutForDelivery || isDelivered
                          ? 'bg-emerald-50/70 border border-emerald-200/90 shadow-2xs'
                          : isPartnerAssigned || isPacked
                          ? 'bg-amber-50/70 border border-amber-200/90 shadow-2xs'
                          : 'bg-gray-50 border border-gray-200'
                      }`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          isPickedUp || isOutForDelivery || isDelivered
                            ? 'bg-[#006E2F] text-white shadow-xs'
                            : isPartnerAssigned || isPacked
                            ? 'bg-amber-500 text-white animate-spin'
                            : 'bg-gray-200 text-gray-600'
                        }`}>
                          {isPickedUp || isOutForDelivery || isDelivered ? (
                            '✓'
                          ) : isPartnerAssigned || isPacked ? (
                            <Loader2 className="w-4 h-4" />
                          ) : (
                            '3'
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className={`text-xs font-black ${
                              isPickedUp || isOutForDelivery || isDelivered
                                ? 'text-gray-900'
                                : isPartnerAssigned || isPacked
                                ? 'text-amber-900'
                                : 'text-gray-700'
                            }`}>
                              3. Express Rider Handover
                            </h4>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                              isPickedUp || isOutForDelivery || isDelivered
                                ? 'text-emerald-700 bg-emerald-100/80'
                                : isPartnerAssigned
                                ? 'text-amber-800 bg-amber-200/80 animate-pulse'
                                : isPacked
                                ? 'text-amber-800 bg-amber-200/80 animate-pulse'
                                : 'text-gray-500 bg-gray-200'
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
                          <p className={`text-[11px] mt-1 ${
                            isPickedUp || isOutForDelivery || isDelivered
                              ? 'text-gray-600'
                              : isPartnerAssigned || isPacked
                              ? 'text-amber-800 font-medium'
                              : 'text-gray-500'
                          }`}>
                            {isPickedUp || isOutForDelivery || isDelivered
                              ? `Assigned rider (${partnerName}) collected your sealed bag from the hub counter.`
                              : isPartnerAssigned
                              ? `Assigned rider (${partnerName}) is heading to Store Hub for bag collection.`
                              : isPacked
                              ? 'Order packed and placed at dispatch counter. Waiting for rider pickup.'
                              : `Assigned rider (${partnerName}) will collect your sealed bag from the hub counter.`}
                          </p>
                        </div>
                      </div>

                      {/* Step 4 */}
                      <div className={`p-4 rounded-2xl flex items-start gap-3.5 transition-all ${
                        isOutForDelivery || isDelivered
                          ? 'bg-purple-50/70 border border-purple-200/90 shadow-2xs'
                          : 'bg-gray-50 border border-gray-200'
                      }`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          isOutForDelivery || isDelivered
                            ? 'bg-purple-600 text-white shadow-xs animate-pulse'
                            : 'bg-gray-200 text-gray-600'
                        }`}>
                          {isDelivered ? '✓' : isOutForDelivery ? '●' : '4'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className={`text-xs font-black ${isOutForDelivery || isDelivered ? 'text-purple-950' : 'text-gray-700'}`}>
                              4. Live GPS Map Activation
                            </h4>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                              isDelivered
                                ? 'text-emerald-700 bg-emerald-100/80'
                                : isOutForDelivery
                                ? 'text-purple-800 bg-purple-200/80 animate-pulse'
                                : 'text-gray-500 bg-gray-200'
                            }`}>
                              {isDelivered ? 'Delivered' : isOutForDelivery ? 'Active Now' : 'Auto-activates'}
                            </span>
                          </div>
                          <p className={`text-[11px] mt-1 ${isOutForDelivery || isDelivered ? 'text-purple-900 font-medium' : 'text-gray-500'}`}>
                            {isDelivered
                              ? 'Order successfully delivered to your doorstep.'
                              : isOutForDelivery
                              ? 'Live GPS navigation is active! Rider is currently en route to your address.'
                              : 'The interactive GPS Route Map will automatically appear right here once the delivery partner begins the ride!'}
                          </p>
                        </div>
                      </div>

                    </div>

                    {/* Freshness & Hygiene Seal */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-100 flex items-center gap-2.5">
                        <Sparkles className="w-5 h-5 text-[#006E2F]" />
                        <div>
                          <h5 className="text-[11px] font-black text-emerald-950">100% Quality Checked</h5>
                          <p className="text-[10px] text-emerald-700">Triple quality check before packing</p>
                        </div>
                      </div>

                      <div className="p-3 bg-blue-50/60 rounded-2xl border border-blue-100 flex items-center gap-2.5">
                        <ShieldCheck className="w-5 h-5 text-blue-700" />
                        <div>
                          <h5 className="text-[11px] font-black text-blue-950">Insulated Safe Bag</h5>
                          <p className="text-[10px] text-blue-700">Maintains peak freshness</p>
                        </div>
                      </div>
                    </div>

                  </div>
                )}

                {/* Need Help Card */}
                <div
                  onClick={() => setShowSupportModal(true)}
                  className="bg-white border border-gray-200/90 rounded-3xl p-4 sm:p-5 flex items-center justify-between gap-3 hover:border-emerald-400 transition-all cursor-pointer shadow-2xs group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center shrink-0">
                      <MessageSquare className="w-5 h-5 text-[#006E2F]" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-gray-900">Need help with this express order?</h4>
                      <p className="text-[11px] text-gray-500 mt-0.5">24/7 WhatsApp and Call support available</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#006E2F] transition-colors" />
                </div>

              </div>

            </div>

          </div>
        ) : (

          /* ════════════════════════════════════════════════════════════════
              CASE B: DELIVERED ORDER (PROFESSIONAL ORDER SUMMARY VIEW)
             ════════════════════════════════════════════════════════════════ */
          <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 space-y-4">

            {/* ── 1. ORDER SUMMARY HEADER CARD ── */}
            <div className="bg-white rounded-3xl p-6 border border-gray-200/90 shadow-2xs space-y-2.5 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                    <Check className="w-4 h-4 text-[#006E2F]" />
                  </div>
                  <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                    Order summary
                  </h1>
                </div>

                <span className="text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider border shadow-2xs bg-emerald-50 text-[#006E2F] border-emerald-300">
                  DELIVERED
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm font-bold text-gray-600 pl-10">
                <Clock className="w-4 h-4 text-gray-400" />
                <span>{deliveryHeadline}</span>
              </div>

              <div className="pt-2 pl-10 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleDownloadInvoice}
                  disabled={isDownloadingInvoice}
                  className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#006E2F] hover:text-emerald-800 bg-emerald-50/70 hover:bg-emerald-100 border border-emerald-200/80 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-2xs"
                >
                  {isDownloadingInvoice ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>Download Invoice</span>
                </button>

                <Link
                  href={`/orders/${order?.id || orderId}/track`}
                  className="inline-flex items-center gap-1.5 text-xs font-extrabold text-gray-700 hover:text-[#006E2F] bg-gray-50 hover:bg-emerald-50 border border-gray-200 px-3 py-1.5 rounded-xl transition-all shadow-2xs"
                >
                  <Navigation className="w-3.5 h-3.5 text-[#006E2F]" />
                  <span>View Route Map</span>
                </Link>
              </div>
            </div>

            {/* ── 2. ITEMS IN THIS ORDER ── */}
            <div className="bg-white rounded-3xl p-6 border border-gray-200/90 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h2 className="text-sm font-black text-gray-900 tracking-tight">
                  {itemsCount} {itemsCount === 1 ? 'item' : 'items'} in this order
                </h2>
                <span className="text-xs text-gray-400 font-bold">PocketKirana Fresh</span>
              </div>

              <div className="divide-y divide-gray-100">
                {order?.items && order.items.length > 0 ? (
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
                        className="flex items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          {/* Thumbnail */}
                          <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-200/80 flex items-center justify-center p-1.5 shrink-0 overflow-hidden shadow-2xs">
                            {image ? (
                              <img
                                src={image}
                                alt={name}
                                className="w-full h-full object-contain rounded-lg"
                              />
                            ) : (
                              <Package className="w-6 h-6 text-gray-400" />
                            )}
                          </div>

                          {/* Details */}
                          <div className="min-w-0">
                            <h3 className="text-xs sm:text-sm font-black text-gray-900 truncate block">
                              {name}
                            </h3>
                            <p className="text-[11px] font-medium text-gray-500 mt-0.5">
                              {unit} x {qty}
                            </p>
                          </div>
                        </div>

                        {/* Pricing */}
                        <div className="text-right shrink-0">
                          <div className="flex items-center gap-2 justify-end">
                            {hasDiscount && (
                              <span className="text-xs text-gray-400 line-through font-medium">
                                ₹{totalMrp}
                              </span>
                            )}
                            <span className="text-sm font-black text-gray-900 font-mono">
                              ₹{totalItemPrice}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-xs text-gray-400 py-3 text-center">
                    Items data unavailable.
                  </div>
                )}
              </div>
            </div>

            {/* ── 3. RATING SECTION ("How were your ordered items?") ── */}
            <div className="bg-white border border-gray-200/90 rounded-3xl p-5 flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-500 flex items-center justify-center shrink-0">
                  <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                </div>
                <div>
                  <span className="text-xs sm:text-sm font-bold text-gray-800 block">
                    {isRated ? 'Rating submitted • Thank you!' : 'How were your ordered items?'}
                  </span>
                  <span className="text-[10px] text-gray-400 font-medium">
                    Help us maintain premium freshness
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowRatingModal(true)}
                className="shrink-0 bg-[#006E2F] hover:bg-emerald-800 active:scale-95 text-white font-black text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-2xs"
              >
                {isRated ? 'Edit rating' : 'Rate now'}
              </button>
            </div>

            {/* ── 4. BILL DETAILS ── */}
            <div className="bg-white rounded-3xl p-6 border border-gray-200/90 shadow-2xs space-y-3.5">
              <h2 className="text-sm font-black text-gray-900 tracking-tight">
                Bill details
              </h2>

              <div className="space-y-3 text-xs text-gray-600">
                <div className="flex items-center justify-between font-medium">
                  <span>MRP</span>
                  <span className="font-mono text-gray-800 font-bold">₹{billCalc.mrpTotal}</span>
                </div>

                {billCalc.discount > 0 && (
                  <div className="flex items-center justify-between font-bold text-blue-600">
                    <span>Product discount</span>
                    <span className="font-mono bg-blue-50 px-2 py-0.5 rounded-md">-₹{billCalc.discount}</span>
                  </div>
                )}

                <div className="flex items-center justify-between font-medium">
                  <span>Item total</span>
                  <span className="font-mono text-gray-800 font-bold">₹{billCalc.itemTotal}</span>
                </div>

                <div className="flex items-center justify-between font-medium">
                  <span>Handling charge</span>
                  <span className="font-mono text-gray-800 font-bold">+₹{billCalc.handlingFee}</span>
                </div>

                <div className="flex items-center justify-between font-medium">
                  <span>Delivery charges</span>
                  <span className="font-mono text-emerald-700 font-black bg-emerald-50 px-2 py-0.5 rounded-md">
                    {billCalc.deliveryCharge === 0 ? 'FREE' : `₹${billCalc.deliveryCharge}`}
                  </span>
                </div>

                <div className="flex items-center justify-between font-black text-base text-gray-900 pt-3 border-t border-gray-100">
                  <span>Bill total</span>
                  <span className="font-mono text-lg text-[#006E2F]">₹{billCalc.billTotal}</span>
                </div>
              </div>
            </div>

            {/* ── 5. ORDER DETAILS ── */}
            <div className="bg-white rounded-3xl p-6 border border-gray-200/90 shadow-2xs space-y-3.5">
              <h2 className="text-sm font-black text-gray-900 tracking-tight">
                Order details
              </h2>

              <div className="space-y-3 text-xs">
                {/* Order ID with Copy Icon */}
                <div className="flex items-center justify-between py-1 border-b border-gray-100">
                  <div>
                    <span className="text-[11px] text-gray-400 font-medium block">
                      Order id
                    </span>
                    <span className="font-mono font-black text-gray-900 mt-0.5 block">
                      {order?.orderNumber || order?.id || orderId}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyOrderId}
                    className="flex items-center gap-1 text-xs font-bold text-gray-600 hover:text-[#006E2F] bg-gray-50 hover:bg-emerald-50 border border-gray-200 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer shadow-2xs"
                    title="Copy Order ID"
                  >
                    {copiedId ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 text-[10px]">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span className="text-[10px]">Copy</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Payment Method */}
                <div className="py-1 border-b border-gray-100">
                  <span className="text-[11px] text-gray-400 font-medium block">
                    Payment
                  </span>
                  <span className="font-bold text-gray-900 block mt-0.5 capitalize">
                    {order?.paymentMethod === 'cod' ? 'Cash on Delivery' : order?.paymentMethod === 'upi' ? 'Paid via UPI' : 'Paid Online'}
                  </span>
                </div>

                {/* Deliver To */}
                <div className="py-1 border-b border-gray-100">
                  <span className="text-[11px] text-gray-400 font-medium block">
                    Deliver to
                  </span>
                  <span className="font-medium text-gray-800 block mt-0.5 leading-relaxed">
                    {deliveryAddressStr}
                  </span>
                </div>

                {/* Order Placed Timestamp */}
                <div className="pt-1">
                  <span className="text-[11px] text-gray-400 font-medium block">
                    Order placed
                  </span>
                  <span className="font-medium text-gray-700 block mt-0.5">
                    {placedDateFormatted}
                  </span>
                </div>
              </div>
            </div>

            {/* ── 6. NEED HELP WITH YOUR ORDER? ── */}
            <div className="space-y-3">
              <h2 className="text-sm font-black text-gray-900 tracking-tight">
                Need help with your order?
              </h2>

              <div
                onClick={() => setShowSupportModal(true)}
                className="bg-white border border-gray-200/90 rounded-3xl p-5 flex items-center justify-between gap-3 hover:border-emerald-400 transition-all cursor-pointer group shadow-2xs"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-5 h-5 text-[#006E2F]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-black text-gray-900 block">
                      Chat with us
                    </h3>
                    <p className="text-[11px] text-gray-500 truncate mt-0.5">
                      About any issues related to your order
                    </p>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#006E2F] transition-colors shrink-0" />
              </div>
            </div>

            {/* ── 7. STICKY BOTTOM ACTION BAR (REPEAT ORDER - ONLY FOR DELIVERED) ── */}
            <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 px-4 py-3.5 shadow-lg">
              <div className="max-w-2xl mx-auto">
                <button
                  type="button"
                  onClick={handleRepeatOrder}
                  className="w-full py-3.5 px-6 bg-[#006E2F] hover:bg-emerald-800 active:scale-[0.99] text-white font-black rounded-2xl shadow-md transition-all flex flex-col items-center justify-center cursor-pointer"
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

        {/* ── RATING MODAL ── */}
        {showRatingModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200 border border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-gray-900">Rate your items</h3>
                <button
                  onClick={() => setShowRatingModal(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:text-gray-800 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-gray-500">
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
                          : 'text-gray-200'
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
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#006E2F] resize-none"
              />

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRatingModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-bold text-xs hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitRating}
                  className="flex-1 py-2.5 rounded-xl bg-[#006E2F] hover:bg-emerald-800 text-white font-bold text-xs shadow-md cursor-pointer"
                >
                  Submit Rating
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── SUPPORT MODAL ── */}
        {showSupportModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200 border border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-gray-900">Pocket Kirana Support</h3>
                <button
                  onClick={() => setShowSupportModal(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:text-gray-800 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-gray-500">
                Need assistance with Order #{order?.orderNumber || order?.id || orderId}? We are available 24/7 to resolve queries.
              </p>

              <div className="space-y-2 pt-1">
                <a
                  href={`https://wa.me/918698893348?text=${encodeURIComponent(`Hi PocketKirana Support, I need help with my Order #${order?.orderNumber || order?.id || orderId}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-between p-3.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-800 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <MessageSquare className="w-4 h-4 text-[#006E2F]" />
                    <span>Chat on WhatsApp</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </a>

                <a
                  href="tel:+918698893348"
                  className="w-full flex items-center justify-between p-3.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-2xl text-xs font-bold text-gray-800 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Phone className="w-4 h-4 text-gray-600" />
                    <span>Call Customer Care</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </a>
              </div>

              <button
                type="button"
                onClick={() => setShowSupportModal(false)}
                className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}

      </div>
    </CustomerLayout>
  );
}

export default function OrderTrackingPage() {
  return (
    <Suspense fallback={
      <CustomerLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-[#006E2F]" />
        </div>
      </CustomerLayout>
    }>
      <OrderTrackingContent />
    </Suspense>
  );
}
