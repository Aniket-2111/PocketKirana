'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';
import { useAppStore } from '@/lib/store';
import { updatePartnerLocationFS } from '@/lib/firebaseServices';
import {
  Navigation,
  MapPin,
  Phone,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  ArrowLeft,
  Clock,
  Package
} from 'lucide-react';

export default function ActiveDeliveryPage() {
  const { orders, deliveryPartners, activePartnerId, verifyDeliveryOtp, updateOrderStatus } = useAppStore();

  const partner = deliveryPartners.find((p) => p.id === activePartnerId) || deliveryPartners[0] || {
    id: 'partner-placeholder',
    name: 'Loading Partner...',
    phone: '',
    currentStatus: 'offline',
    walletBalance: 0,
    todayEarnings: 0,
    completedDeliveries: 0,
    activeOrderId: null,
    activeDeliveryStage: null,
  };

  const activeOrder = orders.find(
    (o) => o.orderStatus === 'out_for_delivery' || o.orderStatus === 'packed' || o.orderStatus === 'preparing'
  ) || orders[0];

  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Throttled Live GPS Location Tracker (Updates max once every 30s to minimize Firestore cost)
  React.useEffect(() => {
    if (!partner || partner.currentStatus !== 'online') return;
    if (typeof window === 'undefined' || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        updatePartnerLocationFS(partner.id, latitude, longitude);
      },
      (err) => {
        console.warn('GPS location tracking error:', err);
      },
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 27000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [partner?.id, partner?.currentStatus]);

  const handleOtpVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length !== 4) {
      setError('Please enter 4-digit OTP code');
      return;
    }
    if (!activeOrder) return;
    const isValid = verifyDeliveryOtp(activeOrder.id, otp);
    if (isValid) {
      setSuccess(true);
      setError('');
      updateOrderStatus(activeOrder.id, 'delivered');
    } else {
      setError(`Invalid OTP. Correct code for demo: ${activeOrder.deliveryOtp}`);
    }
  };

  // Guard: no active order or partner yet
  if (!activeOrder || !partner) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-4 font-sans">
        <RoleSwitcher />
        <Package className="w-12 h-12 text-slate-600" />
        <p className="text-sm font-bold text-slate-400">No active delivery order</p>
        <Link href="/delivery" className="bg-emerald-600 text-white text-xs font-black px-5 py-2.5 rounded-xl hover:bg-emerald-500 transition-all">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans pb-12">
      <RoleSwitcher />

      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 p-4 sticky top-[37px] z-40">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Link href="/delivery" className="flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <span className="bg-emerald-500/20 text-emerald-400 text-[11px] font-black uppercase px-2.5 py-1 rounded-full border border-emerald-500/40">
            Active Order #{activeOrder.id.slice(-6)}
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-md w-full mx-auto p-4 space-y-5">
        
        {/* Live Route Guidance Card */}
        <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black">
                <Navigation className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-white">Route Guidance</h3>
                <span className="text-[11px] text-slate-400">Est. Arrival: 6 Mins</span>
              </div>
            </div>
            <a
              href={`tel:${activeOrder.customerPhone || '9876543210'}`}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black px-3 py-1.5 rounded-xl transition-all"
            >
              <Phone className="w-3.5 h-3.5" /> Call Customer
            </a>
          </div>

          {/* Pickup & Drop Details */}
          <div className="space-y-3 pt-1 text-xs">
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center shrink-0 font-bold text-[10px]">
                1
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500">Pickup Store</span>
                <p className="font-bold text-slate-200">PocketKirana Dark Store - Indiranagar</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 font-bold text-[10px]">
                2
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500">Customer Drop</span>
                <p className="font-bold text-white">{activeOrder.address?.fullName || activeOrder.customerName}</p>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  {activeOrder.address ? `${activeOrder.address.addressLine1}, ${activeOrder.address.city}` : 'Indiranagar, Bengaluru'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Order Items & Total */}
        <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800 space-y-3">
          <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider">
            Package Content ({activeOrder.items.length} items)
          </h4>
          <div className="divide-y divide-slate-800">
            {activeOrder.items.map((item) => (
              <div key={item.productId} className="py-2 flex items-center justify-between text-xs">
                <span className="font-extrabold text-slate-200">{item.product?.name || 'Grocery Item'} × {item.quantity}</span>
                <span className="text-slate-400">₹{item.unitPrice * item.quantity}</span>
              </div>
            ))}
          </div>
        </div>

        {/* OTP Verification & Complete Delivery */}
        <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-xs uppercase tracking-wider">
            <KeyRound className="w-4 h-4" /> Complete Delivery via Customer OTP
          </div>

          {success ? (
            <div className="bg-emerald-950 border border-emerald-800 rounded-2xl p-4 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h4 className="font-extrabold text-emerald-200 text-sm">Delivery Completed!</h4>
              <p className="text-xs text-emerald-300">₹40 credited to your daily wallet.</p>
              <Link
                href="/delivery"
                className="inline-block bg-emerald-600 text-white font-black text-xs px-5 py-2 rounded-xl mt-2"
              >
                Back to Dashboard
              </Link>
            </div>
          ) : (
            <form onSubmit={handleOtpVerify} className="space-y-3">
              <p className="text-xs text-slate-300">
                Ask customer for the 4-digit OTP displayed on their order tracking screen.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={4}
                  placeholder="Enter 4-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-center text-sm font-black text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-4 py-2 rounded-xl transition-all"
                >
                  Verify &amp; Deliver
                </button>
              </div>
              {error && <p className="text-xs text-red-400 font-bold">{error}</p>}
            </form>
          )}
        </div>

      </main>
    </div>
  );
}
