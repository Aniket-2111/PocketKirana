'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Minus, Star, Clock } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { showToast } from '@/components/ui/Toast';
import type { Product } from '@/types';

interface ProductCardProps {
  product: Product;
  onOpenDetail?: (product: Product) => void;
}

export function ProductCard({ product, onOpenDetail }: ProductCardProps) {
  const router = useRouter();
  const { cart, addToCart, updateCartQuantity } = useAppStore();

  const cartItem = cart.find(
    (i) => i.productId === product.id || i.id === product.id
  );
  const qtyInCart = cartItem ? cartItem.quantity : 0;

  const discountPct =
    product.mrp > product.sellingPrice
      ? Math.round(((product.mrp - product.sellingPrice) / product.mrp) * 100)
      : 0;

  const thumbnail =
    product.thumbnail ||
    (product as any).image ||
    'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80';

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart(product, 1);
    showToast(`Added ${product.name} 🛒`, 'success');
  };

  const handleIncrease = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (cartItem) {
      updateCartQuantity(cartItem.id, qtyInCart + 1);
    }
  };

  const handleDecrease = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (cartItem) {
      updateCartQuantity(cartItem.id, qtyInCart - 1);
    }
  };

  const handleCardClick = () => {
    if (onOpenDetail) {
      onOpenDetail(product);
    } else {
      router.push(`/product/${product.id || product.slug}`);
    }
  };

  // Per unit cost
  const unitStr = (product.unit || '').toLowerCase();
  const match = unitStr.match(/(\d+(\.\d+)?)\s*(g|gm|gram|ml|l|kg|ltr|liter)/);
  let per100Text: string | null = null;
  if (match) {
    let qty = parseFloat(match[1]);
    const u = match[3];
    if (u === 'kg' || u === 'l' || u === 'ltr' || u === 'liter') qty *= 1000;
    if (qty > 0) {
      const per100 = (product.sellingPrice / qty) * 100;
      const unitLabel = u === 'ml' || u === 'l' || u === 'ltr' || u === 'liter' ? '100ml' : '100g';
      per100Text = `₹${per100.toFixed(1)}/${unitLabel}`;
    }
  }

  return (
    <div
      onClick={handleCardClick}
      className="bg-white dark:bg-[#151B23] border border-[#E5E7EB] dark:border-[#263241] rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform duration-150 flex flex-col shadow-2xs hover:shadow-md"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {/* Product Image */}
      <div className="relative bg-slate-50 dark:bg-[#111827] w-full aspect-square flex items-center justify-center p-3 overflow-hidden">
        <img
          src={thumbnail}
          alt={product.name}
          className="max-h-full max-w-full object-contain drop-shadow-sm"
          loading="lazy"
        />
        {/* Veg indicator */}
        <div className="absolute bottom-2 right-2 bg-white dark:bg-[#151B23] p-0.5 rounded border border-emerald-600 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-emerald-600" />
        </div>
        {/* Discount badge */}
        {discountPct > 0 && (
          <div className="absolute top-2 left-2 bg-[#008F5A] text-white text-[9px] font-black px-1.5 py-0.5 rounded-md">
            {discountPct}% OFF
          </div>
        )}
      </div>

      {/* Weight + ADD button row */}
      <div className="bg-white dark:bg-[#111827] px-2.5 py-2 flex items-center justify-between border-t border-[#E5E7EB] dark:border-[#263241]">
        <span className="text-xs text-[#374151] dark:text-[#D1D5DB] font-bold">
          {product.unit || '1 pack'}
        </span>

        {qtyInCart === 0 ? (
          <button
            onClick={handleAddToCart}
            className="bg-[#008F5A] hover:bg-[#007044] active:scale-95 text-white font-black text-xs px-3 py-1.5 rounded-lg transition-all cursor-pointer shadow-md shadow-emerald-900/20"
          >
            ADD
          </button>
        ) : (
          <div className="flex items-center gap-1 bg-[#008F5A] rounded-lg overflow-hidden shadow-md shadow-emerald-900/20">
            <button
              onClick={handleDecrease}
              className="text-white px-2 py-1.5 hover:bg-black/15 active:scale-95 transition-all cursor-pointer font-black"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="text-white font-black text-xs min-w-[20px] text-center">
              {qtyInCart}
            </span>
            <button
              onClick={handleIncrease}
              className="text-white px-2 py-1.5 hover:bg-black/15 active:scale-95 transition-all cursor-pointer font-black"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Product Details */}
      <div className="p-2.5 pt-2 flex flex-col gap-0.5 flex-1 bg-white dark:bg-[#151B23]">
        {/* Per 100g price */}
        {per100Text && (
          <span className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] font-semibold">{per100Text}</span>
        )}

        {/* Selling price + MRP */}
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-sm font-black text-[#111827] dark:text-[#F9FAFB]">₹{product.sellingPrice}</span>
          {product.mrp > product.sellingPrice && (
            <span className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] line-through font-semibold">₹{product.mrp}</span>
          )}
        </div>

        {/* Discount label */}
        {discountPct > 0 && (
          <span className="text-[10px] font-black text-[#008F5A] dark:text-[#45C483]">
            {discountPct}% OFF on MRP
          </span>
        )}

        {/* Product name */}
        <p className="text-[11px] text-[#111827] dark:text-[#F9FAFB] font-bold leading-tight mt-0.5 line-clamp-2">
          {product.name}
        </p>

        {/* Rating + Delivery */}
        <div className="flex items-center gap-2 mt-1">
          <div className="flex items-center gap-0.5">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`w-2.5 h-2.5 ${
                  i < Math.round(product.rating || 4)
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-slate-300 dark:text-slate-700'
                }`}
              />
            ))}
          </div>
          {product.reviewsCount != null && (
            <span className="text-[9px] text-[#6B7280] dark:text-[#9CA3AF] font-semibold">
              {product.reviewsCount >= 1000
                ? `${(product.reviewsCount / 1000).toFixed(1)}k`
                : product.reviewsCount}
            </span>
          )}
          <div className="flex items-center gap-0.5 ml-auto">
            <Clock className="w-2.5 h-2.5 text-[#6B7280] dark:text-[#9CA3AF]" />
            <span className="text-[9px] text-[#6B7280] dark:text-[#9CA3AF] font-semibold">30 mins</span>
          </div>
        </div>
      </div>
    </div>
  );
}
