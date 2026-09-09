'use client';

import React from 'react';
import { Order, DeliveryLifecycleStage, ProofOfDelivery } from '@/types';
import {
  Bike,
  Store,
  MapPin,
  CheckCircle2,
  Phone,
  MessageSquare,
  Navigation,
  ShieldCheck,
  Package,
  ArrowRight
} from 'lucide-react';
import { PartnerMapNavigation } from './PartnerMapNavigation';
import { showToast } from '@/components/ui/Toast';

interface ActiveDeliveryWorkflowProps {
  order: Order;
  currentStage: DeliveryLifecycleStage;
  onAdvanceStage: (orderId: string, nextStage: DeliveryLifecycleStage, proof?: ProofOfDelivery) => void;
  onVerifyPickup: (orderId: string, pickupOtp: string) => { success: boolean; message: string };
  onVerifyDelivery: (orderId: string, proof: ProofOfDelivery) => { success: boolean; message: string };
}

export const ActiveDeliveryWorkflow: React.FC<ActiveDeliveryWorkflowProps> = ({
  order,
  currentStage = 'ACCEPTED',
  onAdvanceStage,
  onVerifyDelivery,
}) => {
  // Stage mapping helper
  const isAtStore = currentStage === 'ASSIGNED' || currentStage === 'ACCEPTED' || currentStage === 'ARRIVING_AT_STORE' || currentStage === 'ARRIVED_AT_STORE' || currentStage === 'PICKUP_VERIFICATION';
  const isInTransit = currentStage === 'PICKED_UP' || currentStage === 'OUT_FOR_DELIVERY';
  const isAtCustomerDoorstep = currentStage === 'ARRIVED_AT_CUSTOMER' || currentStage === 'DELIVERY_VERIFICATION';
  const isDelivered = currentStage === 'DELIVERED' || currentStage === 'COMPLETED';

  const handlePickUpOrder = () => {
    onAdvanceStage(order.id, 'OUT_FOR_DELIVERY');
    showToast(`Order #${order.orderNumber} picked up! Starting navigation to customer.`, 'success');
  };

  const handleArrivedAtCustomer = () => {
    onAdvanceStage(order.id, 'ARRIVED_AT_CUSTOMER');
    showToast(`Arrived at customer doorstep!`, 'info');
  };

  const handleMarkDelivered = () => {
    const proof: ProofOfDelivery = {
      type: 'otp',
      timestamp: new Date().toISOString(),
    };
    const result = onVerifyDelivery(order.id, proof);
    if (result.success) {
      showToast(`✓ Order #${order.orderNumber} Delivered successfully!`, 'success');
    } else {
      showToast(result.message || 'Delivery marked completed', 'success');
    }
  };

  return (
    <div className="space-y-4 text-slate-900 font-sans">
      
      {/* Stage Pill Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between text-white shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-black">
            <Bike className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
              Active Order #{order.orderNumber}
            </span>
            <strong className="text-xs font-black text-emerald-400 uppercase tracking-wider">
              {currentStage.replace(/_/g, ' ')}
            </strong>
          </div>
        </div>

        <a
          href={`tel:${order.customerPhone || '+918698893348'}`}
          className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Phone className="w-3.5 h-3.5 text-emerald-400" />
          <span>Call Customer</span>
        </a>
      </div>

      {/* ── STAGE 1: STORE PICKUP ── */}
      {isAtStore && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <PartnerMapNavigation
            isHeadingToCustomer={false}
            distanceRemainingKm={0.6}
            etaMinutes={2}
          />

          <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-sm">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0 font-bold">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block">
                    STEP 1: STORE PICKUP
                  </span>
                  <h4 className="font-black text-base text-slate-900">{order.storeName || 'PocketKirana Store'}</h4>
                  <p className="text-xs text-slate-500 font-bold mt-0.5">Indiranagar, DarkStore Hub</p>
                </div>
              </div>

              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 font-black text-[10px] px-2.5 py-1 rounded-full uppercase">
                Packed &amp; Ready
              </span>
            </div>

            {/* Items Checklist */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-500 font-bold">
                <span>Products in Order ({(order.items || []).length} Products)</span>
                <span className="text-emerald-800 font-mono font-black">Bag 1 of 1</span>
              </div>
              <div className="space-y-1.5 divide-y divide-slate-200/60">
                {(order.items || []).map((item, idx) => (
                  <div key={item.id || idx} className="pt-1.5 first:pt-0 flex items-center justify-between">
                    <span className="text-slate-900 font-bold">{item.product?.name || (item as any).productName || 'Grocery Item'}</span>
                    <span className="text-emerald-800 font-mono font-black">{item.quantity}x</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Single Tap Action to Pick Up */}
            <button
              type="button"
              onClick={handlePickUpOrder}
              className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer uppercase tracking-wider"
            >
              <Package className="w-5 h-5" />
              <span>PICK UP ORDER &amp; START DELIVERY</span>
            </button>
          </div>
        </div>
      )}

      {/* ── STAGE 2: IN TRANSIT TO CUSTOMER ── */}
      {isInTransit && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <PartnerMapNavigation
            isHeadingToCustomer={true}
            distanceRemainingKm={1.8}
            etaMinutes={6}
          />

          <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-sm">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0 font-bold">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-black text-rose-600 uppercase tracking-wider block">
                    STEP 2: CUSTOMER DOORSTEP
                  </span>
                  <h4 className="font-black text-base text-slate-900">
                    {order.customerName || 'Rahul Sharma'}
                  </h4>
                  <p className="text-xs text-slate-500 font-bold mt-0.5">
                    {order.address?.addressLine1 || 'Matoshree Nagar, Neral'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <a
                href={`tel:${order.customerPhone || '+918698893348'}`}
                className="py-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Phone className="w-4 h-4 text-emerald-600" />
                <span>Call Customer</span>
              </a>

              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${order.address?.latitude || 19.033},${order.address?.longitude || 73.317}`}
                target="_blank"
                rel="noreferrer"
                className="py-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Navigation className="w-4 h-4 text-emerald-600" />
                <span>Google Maps</span>
              </a>
            </div>

            <button
              type="button"
              onClick={handleArrivedAtCustomer}
              className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer uppercase tracking-wider"
            >
              <MapPin className="w-5 h-5" />
              <span>I HAVE REACHED CUSTOMER</span>
            </button>
          </div>
        </div>
      )}

      {/* ── STAGE 3: CUSTOMER DOORSTEP & DELIVERY COMPLETION ── */}
      {isAtCustomerDoorstep && (
        <div className="bg-white border-2 border-emerald-500 rounded-3xl p-6 space-y-5 shadow-lg text-center animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <span className="text-xs font-black text-emerald-800 uppercase tracking-widest block">
              FINAL STEP: HANDOVER
            </span>
            <h3 className="text-xl font-black text-slate-900 mt-1">
              Hand Over Package to {order.customerName || 'Customer'}
            </h3>
            <p className="text-xs text-slate-500 font-bold mt-1">
              Address: {order.address?.addressLine1 || 'Matoshree Nagar, Neral'}
            </p>
          </div>

          <button
            type="button"
            onClick={handleMarkDelivered}
            className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer uppercase tracking-wider"
          >
            <ShieldCheck className="w-6 h-6" />
            <span>HAND OVER TO CUSTOMER &amp; MARK DELIVERED</span>
          </button>
        </div>
      )}
    </div>
  );
};
