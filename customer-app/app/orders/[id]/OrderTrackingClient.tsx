'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useParams } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import CustomerShell from '../../../components/CustomerShell';
import { OrderProcessStageBanner } from '@/components/customer/OrderProcessStageBanner';
import { subscribeSingleOrderFS } from '@/lib/firebaseServices';

const LiveTrackingMap = dynamic(
  () => import('@/components/customer/LiveTrackingMap').then((m) => m.LiveTrackingMap),
  { ssr: false }
);
import type { Order } from '@/types';
import { 
  CheckCircle2, 
  Clock, 
  Package, 
  Bike, 
  MapPin, 
  Home,
  Phone, 
  ShieldCheck, 
  Sparkles,
  ChevronRight,
  ArrowLeft,
  FileText,
  CreditCard,
  ShoppingBag,
  Star,
  Download,
  Loader2
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

export default function OrderTrackingClient() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
  const params = useParams();
  const [searchId, setSearchId] = useState<string>('');

  const { orders, activeOrderTrackingId, downloadInvoicePDF } = useAppStore();

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const q = sp.get('id') || sp.get('orderId') || '';
      if (q) setSearchId(q);
    }
  }, []);

  const routeId = (params?.id as string) || '';
  const id = searchId || routeId || activeOrderTrackingId || (orders.length > 0 ? orders[0]?.id : 'PK-10245');

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
          <div className="h-64 bg-slate-200 rounded-3xl" />
        </div>
      </CustomerShell>
    );
  }

  if (!order) {
    return (
      <CustomerShell title="Order Tracking" showBack backUrl="/orders">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-3">
          <h3 className="font-bold text-sm">Order #{id} not found</h3>
          <button onClick={() => router.push('/orders')} className="px-4 py-2 bg-[#0F532B] text-white text-xs font-bold rounded-xl">
            Return to Orders
          </button>
        </div>
      </CustomerShell>
    );
  }

  const orderNumber = order.orderNumber || id;
  const statusLower = (order.orderStatus || 'CONFIRMED').toLowerCase();

  // Resolve partner details
  const partnerName = order.partnerName || (order as any)?.assignedPartnerName || 'Sunil Kumar';
  const partnerPhone = order.partnerPhone || '+919876543210';
  const partnerRating = (order as any)?.rating || '4.9';
  const partnerVehicle = (order as any)?.vehicleType || 'EV Scooter';

  const placedDateStr = order.placedAt
    ? new Date(order.placedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Today';
  const placedTimeStr = order.placedAt
    ? new Date(order.placedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : '3:51 PM';

  // Progress Stepper Status
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
  ].includes(statusLower) || (Boolean(order.partnerId) && statusLower === 'assigned');

  // Status headline & subtext
  const statusHeadline = isDelivered
    ? 'Order Delivered'
    : statusLower === 'arrived_at_customer'
    ? 'Rider has arrived'
    : isOutForDelivery
    ? 'Rider is on the way'
    : isPacked
    ? 'Order Packed & Ready'
    : 'Order Placed & Confirmed';

  const statusSubtext = isDelivered
    ? 'Enjoy your groceries! Thank you for choosing Pocket Kirana.'
    : statusLower === 'arrived_at_customer'
    ? 'Your rider is at your doorstep. Please collect your order.'
    : isOutForDelivery
    ? `${partnerName} is heading to your delivery location.`
    : isPacked
    ? 'Your order is sealed and waiting for rider pickup.'
    : 'Dark store hub is preparing fresh items for dispatch.';

  // Order items pricing totals
  const subtotal = order.items
    ? order.items.reduce((acc, item: any) => {
        const price = item.price || item.product?.sellingPrice || item.unitPrice || 0;
        return acc + price * (item.quantity || 1);
      }, 0)
    : 0;

  const deliveryFee = subtotal > 199 ? 0 : 15;
  const grandTotal = (order as any)?.totalAmount ?? order.total ?? (subtotal + deliveryFee);

  const handleDownloadInvoice = async () => {
    if (!order) return;
    setIsDownloadingInvoice(true);
    try {
      // First try backend API for authenticated invoice retrieval
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
        // Fallback to client-side invoice engine
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

  if (!mounted) {
    return (
      <CustomerShell title="Order Tracking" showBack backUrl="/orders">
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        </div>
      </CustomerShell>
    );
  }

  return (
    <CustomerShell title={`Order #${orderNumber}`} showBack backUrl="/orders">
      <div className="space-y-4 animate-in fade-in duration-200 pb-16">
        
        {/* ── 1. ORDER TITLE & STATUS HEADER ── */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-black text-slate-900 tracking-tight">
                Order #{orderNumber}
              </h1>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                isDelivered
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : isOutForDelivery
                  ? 'bg-emerald-50 text-[#0F532B] border border-emerald-300/80 shadow-2xs'
                  : 'bg-blue-50 text-blue-800 border border-blue-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isDelivered ? 'bg-emerald-600' : 'bg-[#0F532B] animate-ping'}`} />
                {isDelivered ? 'Delivered' : isOutForDelivery ? 'On the way' : 'In Progress'}
              </span>
            </div>

            <span className="text-[11px] font-bold text-slate-500 font-mono">
              {placedTimeStr}
            </span>
          </div>

          <div className="pt-1 border-t border-slate-100">
            <div className="text-sm font-black text-slate-900">
              {statusHeadline}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              {statusSubtext}
            </div>
          </div>
        </div>

        {/* ── 2. HERO LIVE DELIVERY MAP OR PROCESS STAGE BANNER ── */}
        {isDeliveryAccepted ? (
          <div className="w-full h-[360px] sm:h-[420px] rounded-3xl overflow-hidden border border-slate-200 shadow-sm">
            <LiveTrackingMap orderId={id} />
          </div>
        ) : (
          <OrderProcessStageBanner 
            order={order} 
            placedTimeStr={placedTimeStr} 
            isDark={false} 
          />
        )}

        {/* ── 3. DELIVERY PARTNER CARD ── */}
        {isPickedUp && !isDelivered && (
          <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-2xs space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-800 shrink-0">
                  <Bike className="w-5 h-5 text-[#0F532B]" />
                  <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
                    <span className="w-1 h-1 rounded-full bg-white" />
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <strong className="text-xs font-black text-slate-900 truncate">
                      {partnerName}
                    </strong>
                    <span className="inline-flex items-center gap-0.5 bg-amber-50 text-amber-900 border border-amber-200/80 px-1 py-0.2 rounded-md text-[9px] font-black">
                      <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                      {partnerRating}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium truncate block">
                    Delivery Partner · {partnerVehicle}
                  </span>
                </div>
              </div>

              {/* Call Partner Button */}
              <a
                href={`tel:${partnerPhone}`}
                aria-label="Call delivery partner"
                className="inline-flex items-center gap-1.5 bg-[#0F532B] hover:bg-[#0c4323] active:scale-95 text-white font-black text-xs px-3.5 py-2 rounded-2xl transition-all shadow-sm shrink-0"
              >
                <Phone className="w-3.5 h-3.5 text-emerald-200" />
                <span>Call</span>
              </a>
            </div>

            <div className="bg-slate-50 rounded-2xl p-2.5 text-[11px] text-slate-600 font-medium flex items-center gap-2 border border-slate-100">
              <Sparkles className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span>Handled with contactless &amp; hygiene-first standards.</span>
            </div>
          </div>
        )}

        {/* ── 4. COMPACT DELIVERY OTP SECTION ── */}
        {isPickedUp && !isDelivered && order.deliveryOtp && (
          <div className="bg-gradient-to-r from-emerald-50 via-white to-emerald-50/50 rounded-3xl p-4 sm:p-5 border border-emerald-200/90 shadow-2xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-lg bg-emerald-100 text-[#0F532B] flex items-center justify-center">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#0F532B]" />
                </div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Delivery OTP
                </h3>
              </div>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                Required for Handover
              </span>
            </div>

            <p className="text-[11px] text-slate-600 font-medium">
              Share this 4-digit code with your rider when collecting your order:
            </p>

            {/* Clean 4-Digit OTP Cards */}
            <div className="flex items-center justify-center gap-2.5 py-1">
              {order.deliveryOtp.split('').map((digit, idx) => (
                <div
                  key={idx}
                  className="w-12 h-14 sm:w-14 sm:h-16 rounded-2xl bg-white border-2 border-emerald-300 text-slate-900 font-mono font-black text-2xl sm:text-3xl flex items-center justify-center shadow-xs"
                >
                  {digit}
                </div>
              ))}
            </div>

            <p className="text-[10px] font-bold text-slate-500 text-center">
              Only share this OTP when your order reaches you.
            </p>
          </div>
        )}

        {/* ── 5. ORDER PROGRESS STEPPER ── */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#0F532B]" />
              <span>Order Progress</span>
            </h3>
            <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
              Live Status
            </span>
          </div>

          <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">

            {/* Step 1: Confirmed */}
            <div className="relative flex items-start gap-2.5">
              <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-[#0F532B] text-white flex items-center justify-center text-[10px] font-black ring-4 ring-emerald-50">
                ✓
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-900">Order Confirmed</h4>
                <p className="text-[10px] text-slate-500 mt-0.2">
                  Received at {placedTimeStr}
                </p>
              </div>
            </div>

            {/* Step 2: Packed */}
            <div className="relative flex items-start gap-2.5">
              <div className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ring-4 ring-emerald-50 transition-colors ${
                isPacked ? 'bg-[#0F532B] text-white' : 'bg-slate-200 text-slate-500'
              }`}>
                {isPacked ? '✓' : '2'}
              </div>
              <div>
                <h4 className={`text-xs font-black ${isPacked ? 'text-slate-900' : 'text-slate-400'}`}>
                  Packed &amp; Sealed
                </h4>
                <p className={`text-[10px] mt-0.2 ${isPacked ? 'text-emerald-800 font-bold' : 'text-slate-400'}`}>
                  {isPacked ? 'Prepared at Dark Store Hub' : 'Picking items in warehouse...'}
                </p>
              </div>
            </div>

            {/* Step 3: Picked Up */}
            <div className="relative flex items-start gap-2.5">
              <div className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ring-4 ring-emerald-50 transition-colors ${
                isPickedUp ? 'bg-[#0F532B] text-white' : 'bg-slate-200 text-slate-500'
              }`}>
                {isPickedUp ? '✓' : '3'}
              </div>
              <div>
                <h4 className={`text-xs font-black ${isPickedUp ? 'text-slate-900' : 'text-slate-400'}`}>
                  Picked up by Rider
                </h4>
                <p className={`text-[10px] mt-0.2 ${isPickedUp ? 'text-emerald-800 font-bold' : 'text-slate-400'}`}>
                  {isPickedUp ? `${partnerName} assigned for delivery` : 'Waiting for partner pickup'}
                </p>
              </div>
            </div>

            {/* Step 4: On the Way */}
            <div className="relative flex items-start gap-2.5">
              <div className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ring-4 ring-emerald-50 transition-colors ${
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
                <p className={`text-[10px] mt-0.2 ${isOutForDelivery ? 'text-slate-600 font-bold' : 'text-slate-400'}`}>
                  {isOutForDelivery ? 'Real-time road navigation active' : 'Scheduled for quick delivery'}
                </p>
              </div>
            </div>

            {/* Step 5: Delivered */}
            <div className="relative flex items-start gap-2.5">
              <div className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black transition-colors ${
                isDelivered ? 'bg-[#0F532B] text-white' : 'bg-slate-200 text-slate-400'
              }`}>
                {isDelivered ? '✓' : '5'}
              </div>
              <div>
                <h4 className={`text-xs font-black ${isDelivered ? 'text-emerald-800' : 'text-slate-400'}`}>
                  Delivered
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.2">
                  {isDelivered ? 'Order completed successfully!' : 'Delivering fresh & fast'}
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* ── 6. DELIVERY ADDRESS CARD ── */}
        <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#0F532B]" />
              <span>Delivery Address</span>
            </h3>
            <span className="inline-flex items-center gap-1 text-[10px] font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
              <Home className="w-3 h-3 text-[#0F532B]" />
              <span>Home</span>
            </span>
          </div>

          <div className="text-xs text-slate-700 font-semibold leading-relaxed space-y-0.5">
            <div className="font-black text-slate-900 text-xs">
              {(order.address as any)?.name || order.address?.fullName || order.customerName || 'Customer'}
            </div>
            <div className="text-slate-600 font-medium text-[11px]">
              {order.address?.addressLine1 || 'Flat 302, Rama Residence'}
              {order.address?.addressLine2 && `, ${order.address.addressLine2}`}
            </div>
            <div className="text-slate-600 font-medium text-[11px]">
              {order.address?.city || 'Neral'}, {order.address?.state || 'Maharashtra'} - {order.address?.postalCode || (order.address as any)?.pincode || '410101'}
            </div>
            {order.address?.phone && (
              <div className="text-slate-500 font-semibold text-[10px] pt-0.5">
                Phone: {order.address.phone}
              </div>
            )}
          </div>
        </div>

        {/* ── 7. ORDER ITEMS SUMMARY ── */}
        <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5 text-[#0F532B]" />
              <span>Your Order ({order.items?.length || 0})</span>
            </h3>
          </div>

          {/* Items List */}
          <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
            {order.items && order.items.length > 0 ? (
              order.items.map((item: any, idx: number) => {
                const itemPrice = item.price || item.product?.sellingPrice || item.unitPrice || 0;
                const itemTotal = itemPrice * (item.quantity || 1);
                const itemName = item.product?.name || item.productName || 'Grocery Item';
                const itemUnit = item.product?.unit || item.unit || '1 unit';
                const itemThumbnail = item.product?.thumbnail || item.product?.image || null;

                return (
                  <div key={idx} className="py-2.5 flex items-center justify-between gap-2.5 text-xs first:pt-0 last:pb-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {itemThumbnail ? (
                        <img
                          src={itemThumbnail}
                          alt={itemName}
                          className="w-9 h-9 rounded-xl object-cover bg-slate-50 border border-slate-100 shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                          <Package className="w-4 h-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="font-bold text-slate-900 truncate block text-xs">
                          {itemName}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
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
              <div className="py-3 text-center text-xs text-slate-400 font-medium">
                No items found in this order.
              </div>
            )}
          </div>

          {/* Bill Breakdown */}
          <div className="pt-2.5 border-t border-slate-100 space-y-1.5 text-xs">
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
          <div className="bg-slate-50 rounded-2xl p-2.5 flex items-center justify-between text-xs text-slate-700 font-bold border border-slate-100">
            <div className="flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-[#0F532B]" />
              <span>Payment Mode</span>
            </div>
            <span className="text-[10px] font-black uppercase text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-md">
              {order.paymentMethod || 'Online Paid'}
            </span>
          </div>

          {/* ── DOWNLOAD INVOICE BUTTON ── */}
          <button
            type="button"
            onClick={handleDownloadInvoice}
            disabled={isDownloadingInvoice}
            className="w-full mt-3 py-3 px-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-2xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed uppercase tracking-wider"
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
    </CustomerShell>
  );
}
