'use client';

import React, { useState, useEffect } from 'react';
import { Order } from '@/types';
import {
  Bike,
  Package,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Store,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { soundAlerts } from '@/lib/audioAlerts';

interface NewDeliveryRequestModalProps {
  order: Order;
  isOpen: boolean;
  onAccept: (orderId: string) => void;
  onReject: (orderId: string) => void;
}

export const NewDeliveryRequestModal: React.FC<NewDeliveryRequestModalProps> = ({
  order,
  isOpen,
  onAccept,
  onReject,
}) => {
  const [timeLeft, setTimeLeft] = useState(25);
  const totalTime = 25;

  useEffect(() => {
    if (!isOpen) return;
    if (timeLeft === 0) {
      onReject(order.id);
    }
  }, [timeLeft, isOpen, order.id, onReject]);

  useEffect(() => {
    if (!isOpen) return;

    // Reset and play chime
    setTimeLeft(totalTime);
    soundAlerts.playPartnerDispatch();

    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, order.id]);

  if (!isOpen) return null;

  const estimatedEarnings = 45;
  const progressPercent = (timeLeft / totalTime) * 100;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 space-y-5 shadow-2xl animate-in slide-in-from-bottom-6 duration-300 text-white">
        
        {/* Top Header with Timer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
            <h3 className="font-black text-lg text-white uppercase tracking-wider flex items-center gap-1.5">
              <Bike className="w-5 h-5 text-emerald-400" />
              New Delivery Dispatch
            </h3>
          </div>

          {/* Countdown Clock */}
          <div className="bg-slate-800 border border-slate-700 px-3 py-1 rounded-full text-xs font-mono font-black text-amber-400 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}</span>
          </div>
        </div>

        {/* Timer Progress Bar */}
        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all duration-1000 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Big Earnings & Order Highlight Card */}
        <div className="bg-gradient-to-br from-emerald-950/60 to-slate-800/80 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase">
              Order #{order.orderNumber || order.id}
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <Package className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-black text-white">{order.items?.length || 3} Items</span>
              <span className="text-slate-500">•</span>
              <span className="text-xs font-bold text-slate-300">2.4 km</span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-extrabold text-emerald-400 block uppercase">Earnings</span>
            <strong className="text-2xl font-black text-emerald-400 block font-mono">
              +₹{estimatedEarnings}
            </strong>
          </div>
        </div>

        {/* Route Steps */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3.5">
          {/* Pickup */}
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
              <Store className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                Pickup (Store)
              </span>
              <h5 className="font-bold text-xs text-white truncate">PocketKirana Central Store</h5>
              <p className="text-[11px] text-slate-400">100ft Road, Indiranagar • 0.6 km away</p>
            </div>
          </div>

          <div className="border-l-2 border-dashed border-slate-700 ml-3.5 h-3" />

          {/* Delivery */}
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0 mt-0.5">
              <MapPin className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block">
                Delivery (Customer)
              </span>
              <h5 className="font-bold text-xs text-white truncate">
                {order.customerName || 'Customer'}
              </h5>
              <p className="text-[11px] text-slate-400 truncate">
                {order.address?.addressLine1 || 'Matoshree Nagar, Neral'} • 1.8 km from store
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={() => onReject(order.id)}
            className="py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-black text-sm flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
          >
            <XCircle className="w-4 h-4 text-slate-400" />
            <span>Pass / Reject</span>
          </button>

          <button
            onClick={() => onAccept(order.id)}
            className="py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm shadow-xl flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
          >
            <CheckCircle2 className="w-5 h-5 fill-slate-950 text-emerald-500" />
            <span>ACCEPT DISPATCH</span>
          </button>
        </div>

        <p className="text-center text-[11px] text-slate-500 font-medium">
          Auto-rejects in {timeLeft}s if no action taken
        </p>
      </div>
    </div>
  );
};
