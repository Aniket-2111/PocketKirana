'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Order } from '@/types';
import { Sparkles, ArrowRight } from 'lucide-react';

interface OrderConfirmationAnimationProps {
  order: Order;
  onComplete: () => void;
  autoRedirectMs?: number;
}

export const OrderConfirmationAnimation: React.FC<OrderConfirmationAnimationProps> = ({
  order,
  onComplete,
  autoRedirectMs = 3000,
}) => {
  // Animation Phases: 'confirmed' (0 - 1.1s) -> 'packing' (1.1s - 3.0s)
  const [phase, setPhase] = useState<'confirmed' | 'packing'>('confirmed');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Completely lock background scrolling and touchmove to prevent sliding/dragging on mobile
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    const preventTouch = (e: TouchEvent) => {
      e.preventDefault();
    };
    document.addEventListener('touchmove', preventTouch, { passive: false });

    // Phase 1 -> Phase 2 transition at 1.1s
    const phaseTimer = setTimeout(() => {
      setPhase('packing');
    }, 1100);

    // Auto-complete redirect
    timerRef.current = setTimeout(() => {
      onComplete();
    }, autoRedirectMs);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
      document.removeEventListener('touchmove', preventTouch);
      clearTimeout(phaseTimer);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [onComplete, autoRedirectMs]);

  const handleSkip = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    onComplete();
  };

  const orderNum = order.orderNumber || order.id || 'PK-ORDER';

  return (
    <div 
      className="fixed inset-0 z-[99999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 select-none touch-none overscroll-none overflow-hidden animate-in fade-in duration-200"
      style={{ touchAction: 'none', overscrollBehavior: 'none' }}
      onTouchMove={(e) => { e.preventDefault(); e.stopPropagation(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Order Confirmation Animation"
    >
      {/* Main Container - Fixed, centered, no drag or slide */}
      <div 
        className="relative w-full max-w-sm bg-white dark:bg-[#121820] rounded-[36px] p-6 text-center shadow-2xl border border-emerald-100/60 dark:border-emerald-950/60 overflow-hidden select-none touch-none animate-pop-success"
        style={{ touchAction: 'none', transform: 'translateZ(0)' }}
        onTouchMove={(e) => { e.preventDefault(); e.stopPropagation(); }}
      >
        
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-emerald-500/15 dark:bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* ── PHASE 1: GREEN SUCCESS CHECKMARK & RIPPLE ── */}
        {phase === 'confirmed' ? (
          <div className="relative flex flex-col items-center justify-center py-6 min-h-[220px]">
            {/* Expanding Green Ripple Rings */}
            <div className="absolute w-28 h-28 rounded-full bg-emerald-500/20 animate-pulse-ring-1 pointer-events-none" />
            <div className="absolute w-36 h-36 rounded-full bg-emerald-500/15 animate-pulse-ring-2 pointer-events-none" />
            
            {/* Center Success Badge */}
            <div className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-xl shadow-emerald-600/30">
              <svg
                className="w-10 h-10 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3.2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                  style={{
                    strokeDasharray: 50,
                    strokeDashoffset: 50,
                    animation: 'checkStroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) 0.15s forwards',
                  }}
                />
              </svg>
            </div>

            {/* Micro Particles */}
            <div className="absolute top-8 left-12 w-2 h-2 rounded-full bg-emerald-400 opacity-80 animate-ping" />
            <div className="absolute top-10 right-14 w-1.5 h-1.5 rounded-full bg-teal-300 opacity-70 animate-pulse" />
            <div className="absolute bottom-12 left-16 w-2 h-2 rounded-full bg-amber-400 opacity-80 animate-bounce" />

            <div className="mt-4 space-y-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[11px] font-black tracking-wide uppercase">
                <Sparkles className="w-3 h-3 text-amber-500 fill-amber-500" />
                <span>Order Placed</span>
              </span>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Your order is confirmed!
              </h2>
            </div>
          </div>
        ) : (
          /* ── PHASE 2: GROCERY BAG PACKING ANIMATION ── */
          <div className="relative flex flex-col items-center justify-center py-2 min-h-[220px] animate-in fade-in zoom-in-95 duration-300">
            
            {/* Bag & Dropping Items Stage */}
            <div className="relative w-44 h-36 flex items-end justify-center mb-1">
              
              {/* Item 1: Milk Bottle (Left top arc) */}
              <div 
                className="absolute text-xl pointer-events-none"
                style={{
                  animation: 'itemDrop1 1.2s cubic-bezier(0.25, 1, 0.5, 1) 0.05s forwards',
                }}
              >
                🥛
              </div>

              {/* Item 2: Fresh Bread (Right top arc) */}
              <div 
                className="absolute text-xl pointer-events-none"
                style={{
                  animation: 'itemDrop2 1.2s cubic-bezier(0.25, 1, 0.5, 1) 0.2s forwards',
                }}
              >
                🍞
              </div>

              {/* Item 3: Fresh Apple (Center-left) */}
              <div 
                className="absolute text-lg pointer-events-none"
                style={{
                  animation: 'itemDrop3 1.2s cubic-bezier(0.25, 1, 0.5, 1) 0.35s forwards',
                }}
              >
                🍎
              </div>

              {/* Item 4: Farm Carrot / Veggie (Center-right) */}
              <div 
                className="absolute text-lg pointer-events-none"
                style={{
                  animation: 'itemDrop4 1.2s cubic-bezier(0.25, 1, 0.5, 1) 0.45s forwards',
                }}
              >
                🥕
              </div>

              {/* Item 5: Grocery Cereal / Snack Pack */}
              <div 
                className="absolute text-lg pointer-events-none"
                style={{
                  animation: 'itemDrop5 1.2s cubic-bezier(0.25, 1, 0.5, 1) 0.55s forwards',
                }}
              >
                📦
              </div>

              {/* Pocket Kirana Grocery Bag SVG */}
              <div 
                className="relative z-10 w-28 h-28"
                style={{
                  animation: 'bagBounce 1.4s ease-out 0.6s forwards',
                }}
              >
                <svg
                  viewBox="0 0 100 100"
                  className="w-full h-full drop-shadow-md"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* Bag Handles */}
                  <path
                    d="M36 32 C36 18, 64 18, 64 32"
                    stroke="#0B8F5A"
                    strokeWidth="4"
                    strokeLinecap="round"
                    fill="none"
                  />
                  
                  {/* Bag Back Interior (Darker shade) */}
                  <path
                    d="M20 32 L80 32 L74 92 L26 92 Z"
                    fill="#E2E8F0"
                  />
                  
                  {/* Bag Front Body (Pocket Kirana Emerald & Cream) */}
                  <path
                    d="M18 36 L82 36 L76 94 L24 94 Z"
                    fill="#0B8F5A"
                  />

                  {/* Top Bag Fold Accent */}
                  <path
                    d="M18 36 L82 36 L80 44 L20 44 Z"
                    fill="#075C3C"
                  />

                  {/* Center Pocket Kirana Emblem */}
                  <rect x="37" y="52" width="26" height="24" rx="6" fill="#F8FAFC" />
                  <text
                    x="50"
                    y="69"
                    textAnchor="middle"
                    fill="#0B8F5A"
                    fontSize="13"
                    fontWeight="900"
                    fontFamily="sans-serif"
                  >
                    PK
                  </text>

                  {/* Subtle Front Crease */}
                  <path
                    d="M50 44 L50 94"
                    stroke="#075C3C"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                    opacity="0.5"
                  />
                </svg>
              </div>

              {/* Shadow underneath */}
              <div className="absolute -bottom-1 w-20 h-2 bg-slate-900/15 dark:bg-black/40 rounded-full blur-xs" />
            </div>

            {/* Dynamic Status Text */}
            <div className="mt-2 space-y-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[11px] font-black tracking-wide uppercase">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>Preparing Order</span>
              </span>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Your groceries are getting ready
              </h2>
            </div>
          </div>
        )}

        {/* ── SHARED ORDER INFO & DETAILS CARD ── */}
        <div className="mt-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700/60 text-left">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              Order ID: <strong className="font-mono text-emerald-700 dark:text-emerald-400 font-black">#{orderNum}</strong>
            </span>
            <span className="text-xs font-black text-slate-900 dark:text-white font-mono">
              ₹{order.total || 0}
            </span>
          </div>
        </div>

        {/* ── SKIP / TRACK NOW BUTTON ── */}
        <button
          onClick={handleSkip}
          className="mt-4 w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
        >
          <span>Track Live Order</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>

      </div>
    </div>
  );
};
