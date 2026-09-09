'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { Category, Product } from '@/types';
import { ProductCard } from '@/components/customer/ProductCard';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CategoryProductRowProps {
  category: Category;
  products: Product[];
  onOpenDetail: (product: Product) => void;
}

export const CategoryProductRow: React.FC<CategoryProductRowProps> = ({
  category,
  products,
  onOpenDetail,
}) => {
  const rowRef = useRef<HTMLDivElement>(null);

  if (!products || products.length === 0) return null;

  const scroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const amount = direction === 'left' ? -350 : 350;
      rowRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-3 relative group/row my-6">
      {/* Category Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
          {category.name}
        </h2>
        <Link
          href={`/category/${category.slug}`}
          className="text-sm font-extrabold text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1 transition-colors"
        >
          see all
        </Link>
      </div>

      {/* Left Scroll Button */}
      <button
        type="button"
        onClick={() => scroll('left')}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/95 shadow-md border border-gray-200 text-gray-800 flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity hover:bg-white"
        title="Scroll Left"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      {/* Right Scroll Button */}
      <button
        type="button"
        onClick={() => scroll('right')}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/95 shadow-md border border-gray-200 text-gray-800 flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity hover:bg-white"
        title="Scroll Right"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* Product Horizontal Carousel */}
      <div
        ref={rowRef}
        className="flex items-stretch gap-4 overflow-x-auto scrollbar-none no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-2 px-1 scroll-smooth"
      >
        {products.map((product, idx) => (
          <div key={`${category.id}-${product.id}-${idx}`} className="w-40 sm:w-48 shrink-0">
            <ProductCard
              product={product}
              onOpenDetail={onOpenDetail}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
