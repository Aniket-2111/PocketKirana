'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import DeliveryShell from '../../components/DeliveryShell';
import { 
  Bike, 
  MapPin, 
  Phone, 
  Navigation, 
  CheckCircle2, 
  Package, 
  ShieldCheck, 
  Clock, 
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';
import { Address } from '@/types';

export default function ActiveDeliveryPage() {
  const router = useRouter();
  const { 
    orders, 
    deliveryPartners, 
    activePartnerId, 
    authenticatedPartnerId, 
    markDeliveryArrived, 
    completeDeliveryDirect 
  } = useAppStore();

  const partner = deliveryPartners.find((p) => p.id === authenticatedPartnerId || p.id === activePartnerId) || deliveryPartners[0] || {
    id: 'partner-1',
    name: 'Rahul Sharma',
    activeOrderId: undefined,
  };

  const activeOrder = orders.find((o) => {
    if (partner.activeOrderId && (o.id === partner.activeOrderId || o.orderNumber === partner.activeOrderId)) return true;
    const s = (o.orderStatus || '').toUpperCase();
    return o.partnerId === partner.id && (s === 'OUT_FOR_DELIVERY' || s === 'ARRIVED' || s === 'ARRIVED_AT_CUSTOMER' || s === 'ASSIGNED_TO_DELIVERY');
  });

  const [isCompleting, setIsCompleting] = useState(false);

  if (!activeOrder) {
    return (
      <DeliveryShell title="Active Delivery">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-4 shadow-xs mt-6">
          <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
            <Bike className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900">No Active Delivery</h3>
            <p className="text-xs text-slate-500 mt-1">You do not have any ongoing delivery trips right now.</p>
          </div>
          <button
            onClick={() => router.push('/home')}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-2xl shadow-md shadow-emerald-600/30 cursor-pointer uppercase tracking-wider"
          >
            Check Delivery Queue
          </button>
        </div>
      </DeliveryShell>
    );
  }

  const orderNumber = activeOrder.orderNumber || activeOrder.id;
  const statusUpper = (activeOrder.orderStatus || 'OUT_FOR_DELIVERY').toUpperCase();
  const isArrived = statusUpper === 'ARRIVED' || statusUpper === 'ARRIVED_AT_CUSTOMER';

  const customerName = activeOrder.customerName || 'Customer';
  const customerPhone = activeOrder.customerPhone || '+91 8698893348';
  const address: Partial<Address> = activeOrder.address || activeOrder.deliveryAddress || {
    addressLine1: 'Customer Street Address',
    city: 'Neral',
    postalCode: '410101',
    latitude: 19.0224,
    longitude: 73.3210,
  };

  const openNavigation = () => {
    const lat = address.latitude || 19.0224;
    const lng = address.longitude || 73.3210;
    const destName = encodeURIComponent(`${address.addressLine1}, ${address.city}`);
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${destName}`;
    if (typeof window !== 'undefined') {
      window.open(mapsUrl, '_blank');
    }
  };

  const handleMarkArrived = () => {
    const res = markDeliveryArrived(activeOrder.id, partner.id);
    if (res.success) {
      showToast('📍 Marked Arrived! Customer notified in real time.', 'success');
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleCompleteDelivery = () => {
    setIsCompleting(true);
    const res = completeDeliveryDirect(activeOrder.id, partner.id);
    setIsCompleting(false);

    if (res.success) {
      showToast('🎉 Delivery Complete! Transferred to Delivered History.', 'success');
      // Auto-return to queue for next order
      router.push('/home');
    } else {
      showToast(res.message, 'error');
    }
  };

  return (
    <DeliveryShell title={`Active Delivery #${orderNumber}`}>
      <div className="space-y-4 animate-in fade-in duration-200 pb-16">
        
        {/* ── STATUS BANNER ── */}
        <div className={`p-5 rounded-3xl space-y-2 shadow-md ${
          isArrived ? 'bg-purple-600 text-white' : 'bg-emerald-600 text-white'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full">
              {isArrived ? 'Rider Arrived at Customer' : 'Out for Delivery'}
            </span>
            <span className="text-xs font-mono font-bold bg-black/20 px-2 py-0.5 rounded-lg">
              Order #{orderNumber}
            </span>
          </div>
          <h2 className="text-lg font-black leading-tight">
            {isArrived ? 'You Have Arrived at Doorstep' : 'Deliver Order to Customer'}
          </h2>
          <p className="text-xs text-white/90 leading-snug">
            {isArrived ? 'Hand over the packed grocery bags to the customer and complete the trip.' : 'Follow GPS navigation to the customer delivery address.'}
          </p>
        </div>

        {/* ── CUSTOMER CONTACT & ADDRESS CARD ── */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-xs">
          
          {/* Customer Call Strip */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Customer Name</span>
              <strong className="text-sm font-black text-slate-900 block mt-0.5">{customerName}</strong>
            </div>

            <a
              href={`tel:${customerPhone}`}
              className="py-2 px-4 bg-emerald-50 hover:bg-emerald-600 text-emerald-800 hover:text-white border border-emerald-300 rounded-xl text-xs font-black flex items-center gap-1.5 transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Call Customer</span>
            </a>
          </div>

          {/* Delivery Location & Map Launcher */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                <MapPin className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <strong className="block text-xs font-bold text-slate-900 leading-snug">
                  {address.addressLine1} {address.houseNumber ? `, Flat/House: ${address.houseNumber}` : ''}
                </strong>
                {address.landmark && (
                  <span className="text-[11px] text-slate-500 font-bold block mt-0.5">
                    Landmark: {address.landmark}
                  </span>
                )}
                <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                  {address.city} - {address.postalCode}
                </span>
              </div>
            </div>

            <button
              onClick={openNavigation}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-2xl shadow-xs flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider transition-colors"
            >
              <Navigation className="w-4 h-4" />
              <span>OPEN GPS MAP NAVIGATION</span>
            </button>
          </div>

        </div>

        {/* ── ORDER ITEMS SUMMARY (BAGS & PRODUCTS) ── */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-3 shadow-xs text-xs font-bold text-slate-600">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h4 className="font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Package className="w-4 h-4 text-emerald-600" />
              <span>Grocery Bags to Handover</span>
            </h4>
            <span className="font-mono text-emerald-800 font-bold">
              {activeOrder.items?.length || 0} Products
            </span>
          </div>

          <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto">
            {(activeOrder.items || []).map((item, idx) => (
              <div key={idx} className="py-2 flex items-center justify-between">
                <span className="text-slate-900 truncate max-w-[200px]">
                  {item.product?.name || (item as any).productName || 'Grocery Item'}
                </span>
                <span className="font-mono text-slate-500 font-bold">
                  Qty: {item.quantity}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── WORKFLOW ACTIONS ── */}
        <div className="space-y-3 pt-2">
          {!isArrived ? (
            <button
              onClick={handleMarkArrived}
              className="w-full py-4 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-black text-sm rounded-2xl shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider transition-transform"
            >
              <MapPin className="w-5 h-5" />
              <span>I HAVE ARRIVED AT CUSTOMER</span>
            </button>
          ) : (
            <button
              onClick={handleCompleteDelivery}
              disabled={isCompleting}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider transition-transform"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>{isCompleting ? 'COMPLETING...' : 'COMPLETE DELIVERY'}</span>
            </button>
          )}
        </div>

      </div>
    </DeliveryShell>
  );
}
