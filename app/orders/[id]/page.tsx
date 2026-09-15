'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { subscribeSingleOrderFS } from '@/lib/firebaseServices';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { LiveTrackingMap } from '@/components/customer/LiveTrackingMap';
import { OrderProcessStageBanner } from '@/components/customer/OrderProcessStageBanner';
import { Order, DeliveryPartner } from '@/types';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Phone,
  HelpCircle,
  MapPin,
  Home,
  Building,
  Star,
  Package,
  ShieldCheck,
  FileText,
  Bike,
  Sparkles,
  ShoppingBag,
  CreditCard,
  ChevronRight,
  Download,
  Loader2
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

export default function OrderTrackingPage() {
  const params = useParams();
  const orderId = (params?.id as string) || '';
  const { orders, deliveryPartners, downloadInvoicePDF } = useAppStore();

  const [isMounted, setIsMounted] = useState(false);
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);

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
  const orderStatus = order?.orderStatus || 'CREATED';
  const statusLower = orderStatus.toLowerCase();

  // Resolve assigned partner details
  const partnerName = order?.partnerName || (order as any)?.assignedPartnerName || 'Sunil Kumar';
  const partnerPhone = order?.partnerPhone || '+919876543210';
  const partnerRating = (order as any)?.rating || '4.9';
  const partnerVehicle = (order as any)?.vehicleType || 'EV Scooter';

  const placedDateStr = isMounted
    ? (order?.placedAt ? new Date(order.placedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Today')
    : 'Today';
  const placedTimeStr = isMounted
    ? (order?.placedAt ? new Date(order.placedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '3:51 PM')
    : '3:51 PM';

  // Lifecycle states
  const isConfirmed = true;
  const isPacked = [
    'preparing', 'picking', 'picked', 'packing', 'packed', 'ready', 'ready_for_pickup',
    'assigned', 'accepted', 'arrived_at_store', 'picked_up', 'out_for_delivery',
    'arrived_at_customer', 'delivered', 'completed'
  ].includes(statusLower);

  const isPickedUp = [
    'picked_up', 'out_for_delivery', 'arrived_at_customer', 'delivered', 'completed'
  ].includes(statusLower);

  const isOutForDelivery = [
    'out_for_delivery', 'arrived_at_customer', 'delivered', 'completed'
  ].includes(statusLower);

  const isDelivered = ['delivered', 'completed'].includes(statusLower);

  const isDeliveryAccepted = [
    'accepted', 'arrived_at_store', 'picked_up', 'out_for_delivery',
    'arrived_at_customer', 'delivered', 'completed'
  ].includes(statusLower) || (Boolean(order?.partnerId) && statusLower === 'assigned');

  // Status headline & subtext for consumer clarity
  const statusHeadline = useMemo(() => {
    if (isDelivered) return 'Order Delivered';
    if (statusLower === 'arrived_at_customer') return 'Rider has arrived';
    if (isOutForDelivery) return 'Rider is on the way';
    if (isPacked) return 'Order Packed & Ready';
    return 'Order Placed & Confirmed';
  }, [isDelivered, statusLower, isOutForDelivery, isPacked]);

  const statusSubtext = useMemo(() => {
    if (isDelivered) return 'Enjoy your groceries! Thank you for choosing Pocket Kirana.';
    if (statusLower === 'arrived_at_customer') return 'Your rider is at your doorstep. Please collect your order.';
    if (isOutForDelivery) return `${partnerName} is heading to your delivery location.`;
    if (isPacked) return 'Your order is sealed and waiting for rider pickup.';
    return 'Dark store hub is preparing fresh items for dispatch.';
  }, [isDelivered, statusLower, isOutForDelivery, isPacked, partnerName]);

  // Order items pricing totals
  const subtotal = useMemo(() => {
    if (!order?.items) return 0;
    return order.items.reduce((acc, item: any) => {
      const price = item.price || item.product?.sellingPrice || 0;
      return acc + price * (item.quantity || 1);
    }, 0);
  }, [order]);

  const deliveryFee = subtotal > 199 ? 0 : 15;
  const grandTotal = (order as any)?.totalAmount ?? order?.total ?? (subtotal + deliveryFee);

  const handleDownloadInvoice = async () => {
    if (!order) return;
    setIsDownloadingInvoice(true);
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(order.id)}/invoice?format=pdf`, {
        headers: { 'Accept': 'application/pdf' },
      });

      if (response.ok) {
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `Pocket-Kirana-Invoice-${order.orderNumber || order.id}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
        showToast('Invoice downloaded successfully.', 'success');
      } else {
        const res = await downloadInvoicePDF(order.id);
        if (res.success) {
          showToast('Invoice downloaded successfully.', 'success');
        } else {
          showToast('Unable to download invoice. Please try again.', 'error');
        }
      }
    } catch (err) {
      try {
        const res = await downloadInvoicePDF(order.id);
        if (res.success) {
          showToast('Invoice downloaded successfully.', 'success');
        } else {
          showToast('Unable to download invoice. Please try again.', 'error');
        }
      } catch (_) {
        showToast('Unable to download invoice. Please try again.', 'error');
      }
    } finally {
      setIsDownloadingInvoice(false);
    }
  };

  return (
    <CustomerLayout>
      <div className="bg-[#FAFBF9] min-h-[calc(100vh-64px)] pb-16">

        {/* ── 1. TOP SUB-HEADER BAR ── */}
        <div className="border-b border-slate-200/80 bg-white sticky top-0 z-30 shadow-2xs">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
            <Link
              href="/orders"
              className="inline-flex items-center gap-2 text-xs font-black text-slate-600 hover:text-[#0F532B] transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:text-[#0F532B] transition-transform group-hover:-translate-x-0.5" />
              <span>Back to Orders</span>
            </Link>

            <div className="flex items-center gap-2.5">
              <a
                href={`/api/orders/${orderId}/invoice`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-700 bg-slate-50 hover:bg-slate-100 hover:text-[#0F532B] border border-slate-200 px-3 py-1.5 rounded-xl transition-all shadow-2xs cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>Tax Invoice</span>
              </a>
              <Link
                href="/faq"
                className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-700 bg-slate-50 hover:bg-slate-100 hover:text-[#0F532B] border border-slate-200 px-3 py-1.5 rounded-xl transition-all shadow-2xs"
              >
                <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                <span>Help</span>
              </Link>
            </div>
          </div>
        </div>

        {/* ── 2. MAIN CONTAINER ── */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-6">

          {/* ── 3. ORDER TITLE & STATUS BANNER ── */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  Order #{orderNumber}
                </h1>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wide uppercase ${isDelivered
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : isOutForDelivery
                      ? 'bg-emerald-50 text-[#0F532B] border border-emerald-300/80 shadow-2xs'
                      : 'bg-blue-50 text-blue-800 border border-blue-200'
                  }`}>
                  <span className={`w-2 h-2 rounded-full ${isDelivered ? 'bg-emerald-600' : 'bg-[#0F532B] animate-ping'}`} />
                  {isDelivered ? 'Delivered' : isOutForDelivery ? 'On the way' : 'In Progress'}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500 mt-1" suppressHydrationWarning>
                Placed {placedDateStr} · {placedTimeStr}
              </p>
            </div>

            {/* Quick Status Pill */}
            <div className="text-left sm:text-right">
              <div className="text-base sm:text-lg font-black text-slate-900">
                {statusHeadline}
              </div>
              <div className="text-xs text-slate-500 font-medium max-w-sm">
                {statusSubtext}
              </div>
            </div>
          </div>

          {/* ── 4. TOP ROW: ORDER PROGRESS (LEFT) & LIVE MAP (RIGHT) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            
            {/* ── A. ORDER PROGRESS STEPPER (Left Column: 5 cols) ── */}
            <div className="order-2 lg:order-1 lg:col-span-5">
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-2xs space-y-5 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#0F532B]" />
                    <span>Order Progress</span>
                  </h3>
                  <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
                    Live Status
                  </span>
                </div>

                <div className="relative pl-7 space-y-5.5 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 flex-1 flex flex-col justify-around py-1">

                  {/* Step 1: Confirmed */}
                  <div className="relative flex items-start gap-3">
                    <div className="absolute -left-7 top-0.5 w-6 h-6 rounded-full bg-[#0F532B] text-white flex items-center justify-center text-xs font-black ring-4 ring-emerald-50">
                      ✓
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900">Order Confirmed</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5" suppressHydrationWarning>
                        Order received at {placedTimeStr}
                      </p>
                    </div>
                  </div>

                  {/* Step 2: Packed */}
                  <div className="relative flex items-start gap-3">
                    <div className={`absolute -left-7 top-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ring-4 ring-emerald-50 transition-colors ${
                      isPacked ? 'bg-[#0F532B] text-white' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {isPacked ? '✓' : '2'}
                    </div>
                    <div>
                      <h4 className={`text-xs font-black ${isPacked ? 'text-slate-900' : 'text-slate-400'}`}>
                        Packed & Sealed
                      </h4>
                      <p className={`text-[11px] mt-0.5 ${isPacked ? 'text-emerald-800 font-bold' : 'text-slate-400'}`}>
                        {isPacked ? 'Prepared at Dark Store Hub' : 'Picking items in warehouse...'}
                      </p>
                    </div>
                  </div>

                  {/* Step 3: Picked Up */}
                  <div className="relative flex items-start gap-3">
                    <div className={`absolute -left-7 top-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ring-4 ring-emerald-50 transition-colors ${
                      isPickedUp ? 'bg-[#0F532B] text-white' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {isPickedUp ? '✓' : '3'}
                    </div>
                    <div>
                      <h4 className={`text-xs font-black ${isPickedUp ? 'text-slate-900' : 'text-slate-400'}`}>
                        Picked up by Rider
                      </h4>
                      <p className={`text-[11px] mt-0.5 ${isPickedUp ? 'text-emerald-800 font-bold' : 'text-slate-400'}`}>
                        {isPickedUp ? `${partnerName} assigned for delivery` : 'Waiting for partner pickup'}
                      </p>
                    </div>
                  </div>

                  {/* Step 4: On the Way */}
                  <div className="relative flex items-start gap-3">
                    <div className={`absolute -left-7 top-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ring-4 ring-emerald-50 transition-colors ${
                      isDelivered
                        ? 'bg-[#0F532B] text-white'
                        : isOutForDelivery
                        ? 'bg-[#0F532B] text-white animate-pulse'
                        : 'bg-slate-200 text-slate-400'
                    }`}>
                      {isDelivered ? '✓' : '4'}
                    </div>
                    <div>
                      <h4 className={`text-xs font-black ${isOutForDelivery ? 'text-[#0F532B]' : 'text-slate-400'}`}>
                        On the way to doorstep
                      </h4>
                      <p className={`text-[11px] mt-0.5 ${isOutForDelivery ? 'text-slate-600 font-bold' : 'text-slate-400'}`}>
                        {isOutForDelivery ? 'Real-time road navigation active' : 'Scheduled for quick delivery'}
                      </p>
                    </div>
                  </div>

                  {/* Step 5: Delivered */}
                  <div className="relative flex items-start gap-3">
                    <div className={`absolute -left-7 top-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black transition-colors ${
                      isDelivered ? 'bg-[#0F532B] text-white' : 'bg-slate-200 text-slate-400'
                    }`}>
                      {isDelivered ? '✓' : '5'}
                    </div>
                    <div>
                      <h4 className={`text-xs font-black ${isDelivered ? 'text-emerald-800' : 'text-slate-400'}`}>
                        Delivered
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {isDelivered ? 'Order completed successfully!' : 'Delivering fresh & fast'}
                      </p>
                    </div>
                  </div>

                </div>
              </div>
            </div>

            {/* ── B. LIVE MAP OR PROCESS STAGE BANNER (Right Column: 7 cols) ── */}
            <div className="order-1 lg:order-2 lg:col-span-7 flex flex-col justify-center">
              {isDeliveryAccepted ? (
                <LiveTrackingMap orderId={orderId} />
              ) : (
                <OrderProcessStageBanner 
                  order={order} 
                  placedTimeStr={placedTimeStr} 
                  isDark={false} 
                />
              )}
            </div>

          </div>

          {/* ── 5. BOTTOM DETAILS SECTION (2 COLUMNS: PARTNER + OTP ON LEFT, ADDRESS + ORDER ON RIGHT) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* ── LEFT / PARTNER & OTP COLUMN (7 cols) ── */}
            <div className="lg:col-span-7 space-y-6">

              {/* ── DELIVERY PARTNER CARD ── */}
              {isPickedUp && !isDelivered && (
                <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="relative w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-800 shrink-0">
                        <Bike className="w-6 h-6 text-[#0F532B]" />
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
                          <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-black text-slate-900 truncate">
                            {partnerName}
                          </h3>
                          <span className="inline-flex items-center gap-0.5 bg-amber-50 text-amber-900 border border-amber-200/80 px-1.5 py-0.5 rounded-md text-[10px] font-black">
                            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                            {partnerRating}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                          Delivery Partner · {partnerVehicle}
                        </p>
                      </div>
                    </div>

                    {/* Call Partner Button */}
                    <a
                      href={`tel:${partnerPhone}`}
                      aria-label="Call delivery partner"
                      className="inline-flex items-center gap-2 bg-[#0F532B] hover:bg-[#0c4323] active:scale-95 text-white font-black text-xs px-4 py-2.5 rounded-2xl transition-all shadow-sm shrink-0 cursor-pointer"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-200" />
                      <span>Call Partner</span>
                    </a>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-3 text-xs text-slate-600 font-medium flex items-center gap-2 border border-slate-100">
                    <Sparkles className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Your order is on the way and handled with hygiene-first protocols.</span>
                  </div>
                </div>
              )}

              {/* ── COMPACT DELIVERY OTP SECTION ── */}
              {isPickedUp && !isDelivered && order?.deliveryOtp && (
                <div className="bg-gradient-to-r from-emerald-50 via-white to-emerald-50/50 rounded-3xl p-5 sm:p-6 border border-emerald-200/90 shadow-2xs space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-emerald-100 text-[#0F532B] flex items-center justify-center">
                        <ShieldCheck className="w-4 h-4 text-[#0F532B]" />
                      </div>
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                        Delivery OTP
                      </h3>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full">
                      Required for Handover
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 font-medium">
                    Your rider will ask for this code when delivering at your doorstep:
                  </p>

                  {/* Clean 4-Digit OTP Cards */}
                  <div className="flex items-center justify-center gap-3 py-1">
                    {order.deliveryOtp.split('').map((digit, idx) => (
                      <div
                        key={idx}
                        className="w-14 h-16 sm:w-16 sm:h-18 rounded-2xl bg-white border-2 border-emerald-300 text-slate-900 font-mono font-black text-3xl sm:text-4xl flex items-center justify-center shadow-xs"
                      >
                        {digit}
                      </div>
                    ))}
                  </div>

                  <p className="text-[11px] font-bold text-slate-500 text-center">
                    Only share this OTP when your order reaches you.
                  </p>
                </div>
              )}

            </div>

            {/* ── RIGHT / ADDRESS & ORDER SUMMARY COLUMN (5 cols) ── */}
            <div className="lg:col-span-5 space-y-6">

              {/* ── DELIVERY ADDRESS CARD ── */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-2xs space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#0F532B]" />
                    <span>Delivery Address</span>
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[11px] font-black text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md">
                    <Home className="w-3 h-3 text-[#0F532B]" />
                    <span>Home</span>
                  </span>
                </div>

                <div className="text-xs text-slate-700 font-semibold leading-relaxed space-y-1">
                  <div className="font-black text-slate-900 text-sm">
                    {(order?.address as any)?.name || order?.address?.fullName || order?.customerName || 'Customer'}
                  </div>
                  <div className="text-slate-600 font-medium">
                    {order?.address?.addressLine1 || 'Flat 302, Rama Residence'}
                    {order?.address?.addressLine2 && `, ${order.address.addressLine2}`}
                  </div>
                  <div className="text-slate-600 font-medium">
                    {order?.address?.city || 'Neral'}, {order?.address?.state || 'Maharashtra'} - {order?.address?.postalCode || (order?.address as any)?.pincode || '410101'}
                  </div>
                  {order?.address?.phone && (
                    <div className="text-slate-500 font-semibold pt-1">
                      Phone: {order.address.phone}
                    </div>
                  )}
                </div>
              </div>

              {/* ── YOUR ORDER SUMMARY ── */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-[#0F532B]" />
                    <span>Your Order ({order?.items?.length || 0})</span>
                  </h3>
                </div>

                {/* Items List */}
                <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto pr-1">
                  {order?.items && order.items.length > 0 ? (
                    order.items.map((item: any, idx: number) => {
                      const itemPrice = item.price || item.product?.sellingPrice || 0;
                      const itemTotal = itemPrice * (item.quantity || 1);
                      const itemName = item.product?.name || item.productName || 'Product';
                      const itemUnit = item.product?.unit || item.unit || '1 unit';
                      const itemThumbnail = item.product?.thumbnail || item.product?.image || null;

                      return (
                        <div key={idx} className="py-3 flex items-center justify-between gap-3 text-xs first:pt-0 last:pb-0">
                          <div className="flex items-center gap-3 min-w-0">
                            {itemThumbnail ? (
                              <img
                                src={itemThumbnail}
                                alt={itemName}
                                className="w-10 h-10 rounded-xl object-cover bg-slate-50 border border-slate-100 shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                                <Package className="w-5 h-5" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <span className="font-bold text-slate-900 truncate block">
                                {itemName}
                              </span>
                              <span className="text-[11px] text-slate-500 font-medium">
                                {itemUnit} × {item.quantity || 1}
                              </span>
                            </div>
                          </div>
                          <span className="font-mono font-black text-slate-900 shrink-0 ml-2">
                            ₹{itemTotal}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-4 text-center text-xs text-slate-400 font-medium">
                      No items found in this order.
                    </div>
                  )}
                </div>

                {/* Bill Breakdown */}
                <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-600 font-medium">
                    <span>Item Total</span>
                    <span className="font-mono font-bold text-slate-900">₹{subtotal}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 font-medium">
                    <span>Delivery Fee</span>
                    <span className={`font-mono font-bold ${deliveryFee === 0 ? 'text-emerald-700' : 'text-slate-900'}`}>
                      {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-900 font-black text-sm pt-2 border-t border-slate-100">
                    <span>Total Amount</span>
                    <span className="font-mono text-base text-[#0F532B]">₹{grandTotal}</span>
                  </div>
                </div>

                {/* Payment Mode */}
                <div className="bg-slate-50 rounded-2xl p-3 flex items-center justify-between text-xs text-slate-700 font-bold border border-slate-100">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-[#0F532B]" />
                    <span>Payment Mode</span>
                  </div>
                  <span className="text-[11px] font-black uppercase text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                    {order?.paymentMethod || 'Online Paid'}
                  </span>
                </div>

                {/* ── DOWNLOAD INVOICE BUTTON ── */}
                <button
                  type="button"
                  onClick={handleDownloadInvoice}
                  disabled={isDownloadingInvoice}
                  className="w-full mt-3 py-3.5 px-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-2xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed uppercase tracking-wider"
                >
                  {isDownloadingInvoice ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#0F532B]" />
                      <span>Downloading Invoice...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 text-[#0F532B]" />
                      <span>Download Invoice</span>
                    </>
                  )}
                </button>
              </div>

            </div>

          </div>

        </div>
      </div>
    </CustomerLayout>
  );
}

