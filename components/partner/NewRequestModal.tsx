'use client';

import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Clock, ShieldCheck, Check, X } from 'lucide-react';

interface NewRequestModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export const NewRequestModal: React.FC<NewRequestModalProps> = ({
  isOpen,
  onAccept,
  onDecline,
}) => {
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    if (!isOpen) return;
    setTimeLeft(30);
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onDecline();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, onDecline]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl text-white space-y-5 animate-in slide-in-from-bottom duration-300">
        
        {/* Top Countdown Bar */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="font-extrabold text-xs uppercase tracking-wider text-emerald-400">
              New Delivery Order Nearby
            </span>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-800 text-amber-400 flex items-center justify-center font-black text-xs border border-amber-500/30">
            {timeLeft}s
          </div>
        </div>

        {/* Earning & Distance */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 block uppercase font-bold tracking-wider">Estimated Earning</span>
            <span className="text-2xl font-black text-emerald-400">₹45.00</span>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-slate-400 block uppercase font-bold tracking-wider">Distance</span>
            <span className="text-sm font-extrabold text-white">1.8 km</span>
          </div>
        </div>

        {/* Pickup & Drop Points */}
        <div className="space-y-3 text-xs">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 font-bold text-[10px] mt-0.5">
              A
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Pickup Location</span>
              <p className="font-bold text-white">PocketKirana Dark Store - Indiranagar</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 font-bold text-[10px] mt-0.5">
              B
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Delivery Drop</span>
              <p className="font-bold text-white">100ft Road, HAL 2nd Stage, Indiranagar</p>
            </div>
          </div>
        </div>

        {/* Accept / Reject Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={onDecline}
            className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-extrabold py-3.5 rounded-2xl text-xs transition-colors"
          >
            <X className="w-4 h-4 text-red-400" /> Decline
          </button>
          <button
            onClick={onAccept}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3.5 rounded-2xl text-xs transition-all shadow-lg active:scale-95"
          >
            <Check className="w-4 h-4 text-white" /> Accept Order
          </button>
        </div>

      </div>
    </div>
  );
};
