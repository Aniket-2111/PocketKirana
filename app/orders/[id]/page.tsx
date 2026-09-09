'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { subscribeSingleOrderFS } from '@/lib/firebaseServices';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { LiveTrackingMap } from '@/components/customer/LiveTrackingMap';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Order } from '@/types';
import {
  CheckCircle2,
  Clock,
  Phone,
  HelpCircle,
  Truck,
  MapPin,
  Store,
  Star,
  Package,
  ShieldCheck
} from 'lucide-react';

export default function OrderTrackingPage() {
  const params = useParams();
  const orderId = (params?.id as string) || '';
  const { orders } = useAppStore();

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [liveOrder, setLiveOrder] = useState<Order | null>(null);

  // Real-time Firestore document listener for live order status updates
  useEffect(() => {
    if (!orderId) return;

    // Subscribe to Firestore live document changes
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
  const orderStatus = order?.orderStatus || 'PLACED';

  const placedDateStr = isMounted
    ? (order?.placedAt ? new Date(order.placedAt).toLocaleString() : 'Recently')
    : '';
  const placedTimeStr = isMounted
    ? (order?.placedAt ? new Date(order.placedAt).toLocaleTimeString() : 'Recently')
    : '';

  const statusLower = orderStatus.toLowerCase();

  // Progress Stepper Calculations
  const isStep1Done = true; // Placed & Confirmed

  const isStep2Done = [
    'preparing', 'picking', 'picked', 'packing', 'packed', 'ready', 'ready_for_pickup',
    'assigned', 'accepted', 'arrived_at_store', 'picked_up', 'out_for_delivery',
    'arrived_at_customer', 'delivered', 'completed'
  ].includes(statusLower);

  const isStep3Done = [
    'picked_up', 'out_for_delivery', 'arrived_at_customer', 'delivered', 'completed'
  ].includes(statusLower);

  const isStep4Done = ['delivered', 'completed'].includes(statusLower);

  // Dynamic Step 2 Status Label
  const getStep2Text = () => {
    if (isStep3Done || isStep4Done) return 'Order Packed & Handed to Delivery Agent ✓';
    if (statusLower === 'packed' || statusLower === 'ready_for_pickup' || statusLower === 'ready') return 'Order Packed & Sealed by Picker ✓';
    if (statusLower === 'packing') return 'Picker is Packing Bags at Hub...';
    if (statusLower === 'picking' || statusLower === 'preparing') return 'Picker is Picking Items in Warehouse...';
    return 'Dark Store Dispatch Hub';
  };

  // Dynamic Step 3 Status Label
  const getStep3Text = () => {
    if (isStep4Done) return 'Order Delivered Successfully ✓';
    if (statusLower === 'out_for_delivery' || statusLower === 'picked_up' || statusLower === 'arrived_at_customer') {
      return `${order?.partnerName || 'Delivery Partner'} is on the way to your location 🚴`;
    }
    if (isStep2Done) return 'Waiting for delivery agent pickup...';
    return 'Pending pickup';
  };

  return (
    <>
      <RoleSwitcher />
      <CustomerLayout>
        <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
          <Breadcrumb items={[{ label: 'My Orders', href: '/orders' }, { label: `Order #${orderNumber}` }]} />

          {/* Header Bar with HELP Button & Real-time Live Badge */}
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-gray-900 tracking-tight">Order #{orderNumber}</h1>
                <span className={`text-xs font-black px-3 py-1 rounded-full uppercase flex items-center gap-1.5 ${
                  isStep4Done
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : isStep3Done
                    ? 'bg-purple-100 text-purple-800 border border-purple-300'
                    : isStep2Done
                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}>
                  <span className="w-2 h-2 rounded-full bg-current animate-ping" />
                  {orderStatus.replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5" suppressHydrationWarning>Placed at {placedDateStr}</p>
            </div>
            <Link
              href="/faq"
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold text-xs px-3.5 py-2 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <HelpCircle className="w-4 h-4 text-gray-500" /> HELP
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column: Live Timeline Stepper */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-xs text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-emerald-600" /> Live Tracking Status
                  </h3>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md animate-pulse">
                    Live Syncing
                  </span>
                </div>

                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-emerald-500">
                  
                  {/* Step 1: Placed */}
                  <div className="relative flex items-start gap-3">
                    <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-[#006E2F] text-white flex items-center justify-center text-xs font-bold ring-4 ring-emerald-50 shadow-sm">
                      ✓
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-gray-900">Order Placed &amp; Confirmed</h4>
                      <span className="text-[11px] text-gray-500 block" suppressHydrationWarning>{placedTimeStr}</span>
                    </div>
                  </div>

                  {/* Step 2: Picked & Packed */}
                  <div className="relative flex items-start gap-3">
                    <div className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ring-4 ring-emerald-50 transition-colors ${
                      isStep2Done ? 'bg-[#006E2F] text-white' : 'bg-gray-200 text-gray-500'
                    }`}>
                      {isStep2Done ? '✓' : '2'}
                    </div>
                    <div>
                      <h4 className={`text-xs font-extrabold ${isStep2Done ? 'text-gray-900' : 'text-gray-400'}`}>
                        Order Prepared &amp; Packed
                      </h4>
                      <span className={`text-[11px] block mt-0.5 ${isStep2Done ? 'text-emerald-700 font-bold' : 'text-gray-400'}`}>
                        {getStep2Text()}
                      </span>
                    </div>
                  </div>

                  {/* Step 3: Out for Delivery */}
                  <div className="relative flex items-start gap-3">
                    <div className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ring-4 ring-emerald-50 transition-colors ${
                      isStep3Done ? 'bg-[#006E2F] text-white' : 'bg-gray-200 text-gray-500'
                    }`}>
                      {isStep3Done ? '✓' : '3'}
                    </div>
                    <div>
                      <h4 className={`text-xs font-extrabold ${isStep3Done ? 'text-[#006E2F]' : 'text-gray-400'}`}>
                        Out for Delivery
                      </h4>
                      <p className={`text-[11px] block mt-0.5 ${isStep3Done ? 'text-purple-700 font-bold' : 'text-gray-500'}`}>
                        {getStep3Text()}
                      </p>
                      {order?.deliveryOtp && (
                        <span className="text-[10px] font-black text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full block w-fit mt-1.5">
                          Share Delivery OTP: {order.deliveryOtp}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Step 4: Delivered */}
                  <div className="relative flex items-start gap-3">
                    <div className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      isStep4Done ? 'bg-[#006E2F] text-white' : 'bg-gray-200 text-gray-400'
                    }`}>
                      {isStep4Done ? '✓' : '4'}
                    </div>
                    <div>
                      <h4 className={`text-xs font-bold ${isStep4Done ? 'text-emerald-800 font-black' : 'text-gray-400'}`}>
                        Delivered
                      </h4>
                      <span className="text-[11px] text-gray-400 block mt-0.5">
                        {isStep4Done ? 'Order delivered successfully!' : '8-15 mins delivery'}
                      </span>
                    </div>
                  </div>

                </div>
              </div>

              {/* Order Items Breakdown */}
              {order?.items && order.items.length > 0 && (
                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs space-y-3">
                  <h4 className="text-xs font-extrabold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-gray-500" /> Order Items ({order.items.length})
                  </h4>
                  <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
                    {order.items.map((item: any, idx: number) => (
                      <div key={idx} className="py-2 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          {item.product?.thumbnail && (
                            <img src={item.product.thumbnail} alt={item.product?.name} className="w-8 h-8 rounded-lg object-cover bg-gray-50 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <span className="font-bold text-gray-900 truncate block">{item.product?.name || item.productName || 'Product'}</span>
                            <span className="text-[10px] text-gray-500">Qty: {item.quantity}</span>
                          </div>
                        </div>
                        <span className="font-mono font-bold text-gray-900 shrink-0 ml-2">₹{(item.price || item.product?.sellingPrice || 0) * item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Driver Card & Interactive Live Map */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Delivery Partner Driver Card */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-2xs flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
                    alt={order?.partnerName || 'Delivery Partner'}
                    className="w-12 h-12 rounded-full object-cover border-2 border-[#006E2F]"
                  />
                  <div>
                    <h4 className="font-extrabold text-sm text-gray-900">{order?.partnerName || 'Sunil Kumar (Express Agent)'}</h4>
                    <p className="text-xs text-gray-500 font-medium flex items-center gap-1 mt-0.5">
                      <span>Delivery Partner</span>
                      <span className="text-amber-500 font-bold flex items-center gap-0.5">⭐ 4.9</span>
                    </p>
                  </div>
                </div>

                <a
                  href={`tel:${order?.partnerPhone || '+919876543210'}`}
                  className="bg-emerald-50 text-[#006E2F] hover:bg-emerald-100 border border-emerald-300 font-extrabold text-xs px-4 py-2.5 rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5" /> Call Agent
                </a>
              </div>

              {/* Live Tracking Map Component */}
              <LiveTrackingMap orderId={orderId} />

            </div>

          </div>
        </div>
      </CustomerLayout>
    </>
  );
}
