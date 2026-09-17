'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { INITIAL_BANNERS } from '@/lib/mockData';
import { ChevronLeft, ChevronRight, ArrowRight, CheckCircle2 } from 'lucide-react';

export const HeroBanner: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const { banners } = useAppStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  const allBanners = (mounted && banners && banners.length > 0) ? banners : INITIAL_BANNERS;
  
  const activeBanners = (allBanners || []).filter(
    (b) =>
      b.active !== false &&
      (b.placement === 'hero' || (!b.placement && !b.id.startsWith('promo-')))
  );
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (activeBanners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeBanners.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [activeBanners.length]);

  if (activeBanners.length === 0) return null;

  const current = activeBanners[currentIndex % activeBanners.length];

  return (
    <div className="relative w-full rounded-2xl sm:rounded-3xl overflow-hidden shadow-xs border border-amber-200/60 dark:border-emerald-900/40 bg-gradient-to-r from-[#FFFDF5] via-[#FFF8E7] to-[#EBF6EE] dark:from-[#111827] dark:via-[#1A2232] dark:to-[#0F291E] group min-h-[220px] sm:min-h-[280px] md:min-h-[320px] flex items-center transition-colors duration-200">
      {/* Decorative Organic Shapes */}
      <div className="absolute top-0 right-0 w-72 sm:w-96 h-72 sm:h-96 bg-gradient-to-bl from-[#0B8F5A]/10 to-transparent rounded-full blur-2xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-48 sm:w-64 h-48 sm:h-64 bg-amber-200/30 dark:bg-emerald-900/10 rounded-full blur-xl pointer-events-none" />

      {/* Main Content & Side Graphic */}
      <div className="relative z-10 w-full p-4 sm:p-8 md:p-10 flex flex-col-reverse sm:flex-row items-center justify-between gap-4 sm:gap-6">
        
        {/* Left Text & Call-To-Action */}
        <div className="space-y-2.5 sm:space-y-3.5 max-w-xl text-center sm:text-left">
          
          {/* Organic / Quality Badge */}
          <div className="inline-flex items-center gap-1.5 bg-white/90 dark:bg-[#151B23]/90 border border-[#0B8F5A]/30 dark:border-[#0B8F5A]/50 text-[#075C3C] dark:text-emerald-400 px-3 py-1 rounded-full text-[10px] sm:text-xs font-black shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0B8F5A] animate-pulse" />
            <span className="uppercase tracking-wider">100% Fresh &amp; Natural</span>
          </div>

          {/* Heading */}
          <h1 className="text-xl sm:text-3xl md:text-4xl font-black text-[#075C3C] dark:text-emerald-400 tracking-tight leading-tight">
            {current.title || 'Quality & Freshness Guaranteed!'}
          </h1>

          {/* Subtitle */}
          <p className="text-[11px] sm:text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 max-w-md line-clamp-2 leading-relaxed">
            {current.subtitle ||
              'Pure milk, organic vegetables, fresh bakery and pantry essentials delivered directly to your doorstep in 30 minutes.'}
          </p>

          {/* Buttons */}
          <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-2.5 sm:gap-3">
            <Link
              href={current.redirectUrl || '/category/fruits-vegetables'}
              className="bg-[#E65100] hover:bg-[#D84315] text-white font-black text-xs sm:text-sm px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl shadow-md transition-all active:scale-95 flex items-center gap-2 group/btn cursor-pointer"
            >
              <span>SHOP NOW</span>
              <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover/btn:translate-x-1 transition-transform" />
            </Link>

            <div className="hidden md:flex items-center gap-2 text-xs font-extrabold text-[#075C3C] dark:text-emerald-400 bg-white/80 dark:bg-[#151B23]/80 px-3.5 py-2.5 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60 shadow-2xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#0B8F5A] dark:text-emerald-400" />
              <span>30 Min Express</span>
            </div>
          </div>
        </div>

        {/* Right Side Visual Image */}
        <div className="w-40 sm:w-60 md:w-80 h-32 sm:h-48 md:h-60 relative shrink-0 flex items-center justify-center">
          <div className="relative w-full h-full rounded-2xl sm:rounded-3xl overflow-hidden border-2 sm:border-4 border-white dark:border-[#1A2232] shadow-lg bg-white dark:bg-[#1A2232] group-hover:scale-102 transition-transform duration-500">
            <img
              key={`hero-img-${current.id}`}
              src={current.image || 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=800&q=80'}
              alt={current.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-2 right-2 bg-[#E65100] text-white font-black text-[9px] sm:text-[10px] uppercase px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg shadow-xs">
              Top Deals
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Arrows */}
      {activeBanners.length > 1 && (
        <>
          <button
            type="button"
            suppressHydrationWarning
            onClick={() =>
              setCurrentIndex((prev) => (prev === 0 ? activeBanners.length - 1 : prev - 1))
            }
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
            title="Previous Banner"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            suppressHydrationWarning
            onClick={() => setCurrentIndex((prev) => (prev + 1) % activeBanners.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
            title="Next Banner"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Dot Indicators */}
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20">
            {activeBanners.map((_, idx) => (
              <button
                key={idx}
                type="button"
                suppressHydrationWarning
                onClick={() => setCurrentIndex(idx)}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  currentIndex === idx ? 'w-5 bg-[#0B8F5A]' : 'w-1.5 bg-slate-300'
                }`}
                title={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
