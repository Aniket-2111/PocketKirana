'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { ChevronRight, ChevronLeft, Layers } from 'lucide-react';

export const CategoryGrid: React.FC = () => {
  const { categories, products } = useAppStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  const mainCategories = (categories || [])
    .filter((c) => !c.parentId && c.isActive !== false)
    .sort((a, b) => (a.displayOrder || a.sortOrder || 0) - (b.displayOrder || b.sortOrder || 0));

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -320 : 320;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (mainCategories.length === 0) return null;

  return (
    <div className="relative group/carousel my-4">
      {/* Left Scroll Button (Matching Reference Turquoise/Green Pill) */}
      <button
        type="button"
        suppressHydrationWarning
        onClick={() => scroll('left')}
        className="absolute -left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-[#0B8F5A] text-white shadow-md flex items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer opacity-90 hover:opacity-100"
        title="Scroll Left"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Categories Horizontal Row (Matching Reference Circle Icon Layout) */}
      <div
        ref={scrollRef}
        className="flex items-center gap-4 sm:gap-6 overflow-x-auto scrollbar-none no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-3 px-2 scroll-smooth"
      >
        {mainCategories.map((cat) => {
          const itemCount = (products || []).filter(
            (p) => p.categoryId === cat.id || (p as any).category?.toLowerCase() === cat.name.toLowerCase()
          ).length;

          return (
            <Link
              key={cat.id}
              href={`/category/${cat.slug}`}
              className="group flex flex-col items-center gap-2 shrink-0 text-center w-24 sm:w-28 transition-transform hover:-translate-y-1"
            >
              {/* Circular / Rounded Image Icon Container (Matching Reference) */}
              <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-white border-2 border-slate-100 group-hover:border-[#0B8F5A] p-2 flex items-center justify-center shadow-xs group-hover:shadow-md transition-all">
                <img
                  src={cat.image || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=200&q=80'}
                  alt={cat.name}
                  loading="lazy"
                  decoding="async"
                  className="w-12 h-12 sm:w-14 sm:h-14 object-contain rounded-full group-hover:scale-105 transition-transform duration-200"
                />
              </div>

              {/* Category Name */}
              <span className="text-xs font-bold text-slate-900 group-hover:text-[#0B8F5A] leading-tight line-clamp-2 min-h-[28px] flex items-center justify-center">
                {cat.name}
              </span>

              {/* Item Count Subtitle (Matching Reference "12 items") */}
              <span className="text-[10px] text-slate-400 font-semibold -mt-1">
                {itemCount > 0 ? `${itemCount} items` : 'Fresh In Stock'}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Right Scroll Button */}
      <button
        type="button"
        suppressHydrationWarning
        onClick={() => scroll('right')}
        className="absolute -right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-[#0B8F5A] text-white shadow-md flex items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer opacity-90 hover:opacity-100"
        title="Scroll Right"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};
