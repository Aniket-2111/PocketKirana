'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { INITIAL_BANNERS } from '@/lib/mockData';
import { ChevronLeft, ChevronRight, ArrowRight, Zap, Sparkles, CheckCircle2 } from 'lucide-react';

export const HeroBanner: React.FC = () => {
  const { banners } = useAppStore();
  const allBanners = banners && banners.length > 0 ? banners : INITIAL_BANNERS;
  
  // Filter ONLY hero slideshow banners (exclude mid dual promo banners)
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
    <div className="relative w-full rounded-3xl overflow-hidden shadow-xs border border-amber-200/60 bg-gradient-to-r from-[#FFFDF5] via-[#FFF8E7] to-[#EBF6EE] group min-h-[260px] sm:min-h-[320px] md:min-h-[360px] flex items-center">
      {/* Decorative Organic Leaf / Geometric Shapes */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-[#0B8F5A]/10 to-transparent rounded-full blur-2xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-amber-200/30 rounded-full blur-xl pointer-events-none" />

      {/* Main Content & Side Graphic */}
      <div className="relative z-10 w-full p-6 sm:p-10 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
        
        {/* Left Text & Call-To-Action */}
        <div className="space-y-4 max-w-xl text-center md:text-left">
          
          {/* Organic / Quality Badge */}
          <div className="inline-flex items-center gap-2 bg-white/90 border border-[#0B8F5A]/30 text-[#075C3C] px-3.5 py-1.5 rounded-full text-xs font-black shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-[#0B8F5A] animate-pulse" />
            <span className="uppercase tracking-wider">100% Fresh &amp; Natural</span>
          </div>

          {/* Heading */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-[#075C3C] tracking-tight leading-[1.15]">
            {current.title || 'Quality & Freshness Guaranteed!'}
          </h1>

          {/* Subtitle */}
          <p className="text-xs sm:text-sm font-medium text-slate-700 max-w-md line-clamp-2 leading-relaxed">
            {current.subtitle ||
              'Pure milk, organic vegetables, fresh bakery and pantry essentials delivered directly to your doorstep in 10-15 minutes.'}
          </p>

          {/* Buttons */}
          <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-3.5">
            <Link
              href={current.redirectUrl || '/category/fruits-vegetables'}
              className="bg-[#E65100] hover:bg-[#D84315] text-white font-black text-sm px-7 py-3.5 rounded-2xl shadow-md transition-all active:scale-95 flex items-center gap-2 group/btn"
            >
              <span>SHOP NOW</span>
              <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
            </Link>

            <div className="hidden sm:flex items-center gap-2 text-xs font-extrabold text-[#075C3C] bg-white/80 px-4 py-3 rounded-2xl border border-emerald-200/80 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-[#0B8F5A]" />
              <span>10-15 Min Express DarkStore</span>
            </div>
          </div>
        </div>

        {/* Right Side Visual Imagery (Matching Grocery Reference Feel) */}
        <div className="w-64 sm:w-80 md:w-96 h-48 sm:h-64 md:h-72 relative shrink-0 flex items-center justify-center">
          {/* Main Visual Image Card */}
          <div className="relative w-full h-full rounded-3xl overflow-hidden border-4 border-white shadow-xl bg-white group-hover:scale-102 transition-transform duration-500">
            <img
              key={`hero-img-${current.id}`}
              src={current.image || 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=800&q=80'}
              alt={current.title}
              className="w-full h-full object-cover"
            />

            {/* Diagonal Ribbon Overlay on Image (Matching Reference Banner style) */}
            <div className="absolute top-3 right-3 bg-[#E65100] text-white font-black text-[10px] uppercase px-3 py-1 rounded-xl shadow-md">
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
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
            title="Previous Banner"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            suppressHydrationWarning
            onClick={() => setCurrentIndex((prev) => (prev + 1) % activeBanners.length)}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
            title="Next Banner"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Dot Indicators */}
          <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20">
            {activeBanners.map((_, idx) => (
              <button
                key={idx}
                type="button"
                suppressHydrationWarning
                onClick={() => setCurrentIndex(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  currentIndex === idx ? 'w-6 bg-[#0B8F5A]' : 'w-2 bg-slate-300'
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
