'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { Product } from '@/types';
import { ProductCard } from '@/components/customer/ProductCard';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';

interface ProductCarouselSectionProps {
  title: string;
  badge?: string;
  viewAllHref?: string;
  products: Product[];
  onOpenDetail?: (product: Product) => void;
}

export const ProductCarouselSection: React.FC<ProductCarouselSectionProps> = ({
  title,
  badge,
  viewAllHref = '/categories',
  products,
  onOpenDetail,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -360 : 360;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (!products || products.length === 0) return null;

  return (
    <section className="space-y-3.5 my-6">
      {/* ── SECTION HEADER (Matching Reference Style) ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h2 className="text-xl sm:text-2xl font-black text-[#075C3C] tracking-tight">
            {title}
          </h2>
          {badge && (
            <span className="bg-[#E65100] text-white font-black text-[11px] uppercase px-2.5 py-0.5 rounded-md shadow-2xs tracking-wide">
              {badge}
            </span>
          )}
        </div>

        {/* View All Link */}
        <Link
          href={viewAllHref}
          className="text-xs sm:text-sm font-bold text-[#0B8F5A] hover:text-[#075C3C] flex items-center gap-1 hover:underline transition-colors shrink-0"
        >
          <span>View All</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* ── CAROUSEL WRAPPER WITH NAVIGATION BUTTONS ── */}
      <div className="relative group/carousel">
        {/* Left Arrow Button (Matching Reference Turquoise Pill) */}
        <button
          type="button"
          suppressHydrationWarning
          onClick={() => scroll('left')}
          className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-[#0B8F5A] text-white shadow-md items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer opacity-90 hover:opacity-100"
          title="Scroll Left"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Product Cards Horizontal Row */}
        <div
          ref={scrollRef}
          className="flex items-stretch gap-3 sm:gap-4 overflow-x-auto scrollbar-none no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-2 px-0.5 scroll-smooth snap-x"
        >
          {products.map((product) => (
            <div key={product.id} className="w-[162px] sm:w-52 shrink-0 snap-start">
              <ProductCard product={product} onOpenDetail={onOpenDetail} />
            </div>
          ))}
        </div>

        {/* Right Arrow Button */}
        <button
          type="button"
          suppressHydrationWarning
          onClick={() => scroll('right')}
          className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-[#0B8F5A] text-white shadow-md items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer opacity-90 hover:opacity-100"
          title="Scroll Right"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </section>
  );
};
