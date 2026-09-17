'use client';

import React from 'react';
import { 
  CheckCircle2, 
  Package, 
  Bike, 
  Clock, 
  Sparkles, 
  Store, 
  ShieldCheck, 
  Radio, 
  ChevronRight,
  ShoppingBag,
  Zap
} from 'lucide-react';
import type { Order } from '@/types';

interface OrderProcessStageBannerProps {
  order: Order | null;
  placedTimeStr?: string;
  isDark?: boolean;
}

export const OrderProcessStageBanner: React.FC<OrderProcessStageBannerProps> = ({
  order,
  placedTimeStr = 'Just now',
  isDark = false,
}) => {
  const statusLower = (order?.orderStatus || 'CONFIRMED').toLowerCase();

  const isPackingStage = [
    'preparing', 'picking', 'picked', 'packing', 'packed', 'ready', 'ready_for_pickup'
  ].includes(statusLower);

  const isAssigningStage = statusLower === 'assigned';

  // Stage configuration
  let stageTitle = 'Order Placed & Confirmed';
  let stageSubtext = 'Dark store team has received your order and started inventory allocation.';
  let stageBadge = 'Order Confirmed';
  let estimatedTime = '30 mins';

  if (isAssigningStage) {
    stageTitle = 'Assigning Delivery Partner';
    stageSubtext = 'Your order is packed & sealed. Connecting with the nearest express delivery rider...';
    stageBadge = 'Assigning Rider';
    estimatedTime = '20-25 mins';
  } else if (isPackingStage) {
    stageTitle = 'Packing Fresh Items at Dark Store';
    stageSubtext = 'Our warehouse picker is gathering your fresh groceries and sealing the delivery bag.';
    stageBadge = 'Items Being Packed';
    estimatedTime = '25-30 mins';
  }

  const itemsCount = order?.items?.reduce((sum, i) => sum + (i.quantity || 1), 0) || order?.items?.length || 0;

  return (
    <div className={`relative w-full rounded-3xl overflow-hidden border shadow-md transition-all duration-300 select-none ${
      isDark 
        ? 'bg-gradient-to-b from-[#161c28] to-[#0f141f] border-slate-800 text-white' 
        : 'bg-gradient-to-b from-white to-emerald-50/40 border-emerald-100/80 text-slate-900'
    }`}>
      
      {/* ── TOP LIVE PULSING STRIP ── */}
      <div className={`px-4 sm:px-6 py-3 border-b flex items-center justify-between gap-3 ${
        isDark ? 'bg-slate-900/80 border-slate-800/80' : 'bg-emerald-50/70 border-emerald-100/60'
      }`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className={`text-[11px] font-black uppercase tracking-wider truncate ${
            isDark ? 'text-emerald-400' : 'text-[#0F532B]'
          }`}>
            {stageBadge}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Clock className={`w-3.5 h-3.5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
          <span className={`text-xs font-black font-mono ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
            ETA: {estimatedTime}
          </span>
        </div>
      </div>

      {/* ── MAIN ANIMATED CONTENT CARD ── */}
      <div className="p-5 sm:p-7 flex flex-col items-center text-center space-y-5">
        
        {/* Animated Icon Avatar */}
        <div className="relative">
          {/* Pulsing Aura Rings */}
          <div className="absolute -inset-3 rounded-full bg-emerald-500/15 animate-ping duration-1000" />
          <div className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl flex items-center justify-center shadow-xl border-2 transition-transform duration-300 hover:scale-105 ${
            isDark 
              ? 'bg-gradient-to-tr from-emerald-950 via-[#13281d] to-[#1e3d2c] border-emerald-500/40 text-emerald-400 shadow-emerald-950/40' 
              : 'bg-gradient-to-tr from-emerald-600 to-emerald-500 border-white text-white shadow-emerald-600/30'
          }`}>
            {isAssigningStage ? (
              <Bike className="w-10 h-10 sm:w-12 sm:h-12 animate-pulse" />
            ) : isPackingStage ? (
              <Package className="w-10 h-10 sm:w-12 sm:h-12 animate-bounce" />
            ) : (
              <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12" />
            )}
            
            {/* Sparkle Badge */}
            <span className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center shadow-md border-2 border-white">
              <Sparkles className="w-3.5 h-3.5 fill-current" />
            </span>
          </div>
        </div>

        {/* Title & Description */}
        <div className="space-y-1.5 max-w-md mx-auto">
          <h2 className={`text-lg sm:text-2xl font-black tracking-tight ${
            isDark ? 'text-white' : 'text-slate-900'
          }`}>
            {stageTitle}
          </h2>
          <p className={`text-xs sm:text-sm font-medium leading-relaxed ${
            isDark ? 'text-slate-300' : 'text-slate-600'
          }`}>
            {stageSubtext}
          </p>
        </div>

        {/* ── 3-STEP HORIZONTAL PROCESS PROGRESS BAR ── */}
        <div className="w-full max-w-lg pt-2 pb-1">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            
            {/* Step 1: Confirmed */}
            <div className={`p-2.5 sm:p-3 rounded-2xl border text-center transition-all ${
              isDark 
                ? 'bg-[#182130] border-emerald-500/50 text-white shadow-xs' 
                : 'bg-white border-emerald-300 text-slate-900 shadow-xs'
            }`}>
              <div className="flex items-center justify-center gap-1 mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-[10px] font-black uppercase text-emerald-500">Done</span>
              </div>
              <strong className="text-[11px] sm:text-xs font-black block truncate">1. Confirmed</strong>
              <span className={`text-[9px] block truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {placedTimeStr}
              </span>
            </div>

            {/* Step 2: Packing */}
            <div className={`p-2.5 sm:p-3 rounded-2xl border text-center transition-all ${
              isPackingStage || isAssigningStage
                ? isDark 
                  ? 'bg-[#182130] border-emerald-500/60 text-white shadow-xs ring-1 ring-emerald-500/30' 
                  : 'bg-white border-emerald-400 text-slate-900 shadow-xs ring-1 ring-emerald-400/30'
                : isDark 
                  ? 'bg-[#121620]/60 border-slate-800 text-slate-500 opacity-60' 
                  : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
            }`}>
              <div className="flex items-center justify-center gap-1 mb-1">
                {isPackingStage || isAssigningStage ? (
                  <Package className="w-4 h-4 text-amber-400 animate-pulse" />
                ) : (
                  <Package className="w-4 h-4 text-slate-400" />
                )}
                <span className={`text-[10px] font-black uppercase ${
                  isAssigningStage ? 'text-emerald-500' : isPackingStage ? 'text-amber-400' : 'text-slate-400'
                }`}>
                  {isAssigningStage ? 'Done' : isPackingStage ? 'In Progress' : 'Pending'}
                </span>
              </div>
              <strong className="text-[11px] sm:text-xs font-black block truncate">2. Packing</strong>
              <span className={`text-[9px] block truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {itemsCount > 0 ? `${itemsCount} Items` : 'Dark Store Hub'}
              </span>
            </div>

            {/* Step 3: Rider Assignment */}
            <div className={`p-2.5 sm:p-3 rounded-2xl border text-center transition-all ${
              isAssigningStage
                ? isDark 
                  ? 'bg-[#182130] border-emerald-500 text-white shadow-xs ring-1 ring-emerald-500/40' 
                  : 'bg-white border-emerald-500 text-slate-900 shadow-xs ring-1 ring-emerald-500/40'
                : isDark 
                  ? 'bg-[#121620]/60 border-slate-800 text-slate-500 opacity-60' 
                  : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
            }`}>
              <div className="flex items-center justify-center gap-1 mb-1">
                <Bike className={`w-4 h-4 ${isAssigningStage ? 'text-emerald-400 animate-bounce' : 'text-slate-400'}`} />
                <span className={`text-[10px] font-black uppercase ${isAssigningStage ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {isAssigningStage ? 'Assigning' : 'Next Step'}
                </span>
              </div>
              <strong className="text-[11px] sm:text-xs font-black block truncate">3. Rider Pickup</strong>
              <span className={`text-[9px] block truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Express Delivery
              </span>
            </div>

          </div>
        </div>

        {/* ── REASSURANCE PILL & LIVE MAP ACTIVATION NOTICE ── */}
        <div className={`w-full max-w-md p-3 sm:p-3.5 rounded-2xl border flex items-center gap-3 text-left ${
          isDark 
            ? 'bg-[#121824] border-slate-800 text-slate-300' 
            : 'bg-emerald-50/80 border-emerald-200/70 text-emerald-950'
        }`}>
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div className="min-w-0">
            <h4 className="text-[11px] sm:text-xs font-black leading-tight">
              Live Map GPS Tracking
            </h4>
            <p className="text-[10px] sm:text-[11px] opacity-80 leading-snug mt-0.5">
              Activates automatically as soon as your delivery partner accepts and starts driving to your location.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
};
