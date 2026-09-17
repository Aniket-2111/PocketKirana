'use client';

import React, { useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { Product } from '@/types';
import { useAppStore } from '@/lib/store';
import { getProductBrand } from '@/lib/brandUtils';
import { Heart, Plus, Minus, ShoppingCart } from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

interface ProductCardProps {
  product: Product;
  onOpenDetail?: (product: Product) => void;
  badge?: string;
}

// ── Fly-To-Cart Ghost Image ────────────────────────────────────────────────
interface FlyingImage {
  id: number;
  src: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

let flyCounter = 0;

function FlyingBubble({ img, onDone }: { img: FlyingImage; onDone: () => void }) {
  return (
    <img
      src={img.src}
      alt=""
      onAnimationEnd={onDone}
      style={{
        position: 'fixed',
        left: img.startX,
        top: img.startY,
        width: 50,
        height: 50,
        objectFit: 'contain',
        borderRadius: '50%',
        background: 'white',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        zIndex: 9999,
        pointerEvents: 'none',
        ['--tx' as string]: `${img.endX - img.startX}px`,
        ['--ty' as string]: `${img.endY - img.startY}px`,
        animation: 'flyToCart 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
      } as React.CSSProperties}
    />
  );
}

// ── Main ProductCard ───────────────────────────────────────────────────────
export const ProductCard: React.FC<ProductCardProps> = ({ product, onOpenDetail, badge }) => {
  const { cart, addToCart, updateQuantity, removeFromCart, wishlist, toggleWishlist, brands } = useAppStore();
  const brand = getProductBrand(product, brands);
  const imgRef = useRef<HTMLImageElement>(null);

  const [flyingImages, setFlyingImages] = useState<FlyingImage[]>([]);

  const cartItem = cart.find((item) => item.productId === product.id || item.id === product.id);
  const qty = cartItem ? cartItem.quantity : 0;
  const isWishlisted = (wishlist || []).includes(product.id);

  const discountPercent =
    product.mrp > product.sellingPrice
      ? Math.round(((product.mrp - product.sellingPrice) / product.mrp) * 100)
      : 0;

  const isOutOfStock = product.status === 'out_of_stock' || product.stock === 0;
  const isLowStock = product.stock !== undefined && product.stock > 0 && product.stock <= 5;

  // ── Fly-to-cart trigger ──────────────────────────────────────────────────
  const launchFlyAnimation = useCallback(() => {
    if (!imgRef.current) return;

    const imgRect = imgRef.current.getBoundingClientRect();

    const cartBtn =
      document.getElementById('header-cart-btn') ||
      document.querySelector('[data-cart-target]') ||
      document.querySelector('a[href="/cart"]');

    const endX = cartBtn
      ? cartBtn.getBoundingClientRect().left + cartBtn.getBoundingClientRect().width / 2 - 25
      : window.innerWidth - 50;
    const endY = cartBtn
      ? cartBtn.getBoundingClientRect().top + cartBtn.getBoundingClientRect().height / 2 - 25
      : 20;

    const startX = imgRect.left + imgRect.width / 2 - 25;
    const startY = imgRect.top + imgRect.height / 2 - 25;

    const newFly: FlyingImage = {
      id: ++flyCounter,
      src:
        product.thumbnail ||
        'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=200&q=80',
      startX,
      startY,
      endX,
      endY,
    };

    setFlyingImages((prev) => [...prev, newFly]);
  }, [product.thumbnail]);

  const handleAddToCartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOutOfStock) return;
    launchFlyAnimation();
    addToCart(product, 1);
    showToast(`${product.name} added to cart!`, 'success');
  };

  const handleMinusClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!cartItem) return;
    if (qty <= 1) {
      removeFromCart(product.id);
      showToast(`${product.name} removed from cart`, 'info');
    } else {
      updateQuantity(product.id, qty - 1);
    }
  };

  const handlePlusClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOutOfStock) return;
    launchFlyAnimation();
    if (!cartItem) {
      addToCart(product, 1);
    } else {
      updateQuantity(product.id, qty + 1);
    }
  };

  return (
    <>
      {/* ── Flying bubbles portal ── */}
      {flyingImages.map((img) => (
        <FlyingBubble
          key={img.id}
          img={img}
          onDone={() => setFlyingImages((prev) => prev.filter((i) => i.id !== img.id))}
        />
      ))}

      {/* ── CARD ── */}
      <div
        onClick={() => onOpenDetail ? onOpenDetail(product) : undefined}
        className="w-full h-[290px] sm:h-[315px] bg-white dark:bg-[#151B23] rounded-2xl sm:rounded-3xl border border-[#E5E7EB] dark:border-[#263241] hover:border-[#008F5A]/40 dark:hover:border-[#008F5A]/60 p-2.5 sm:p-3.5 flex flex-col justify-between group transition-all duration-200 shadow-2xs hover:shadow-md cursor-pointer relative overflow-hidden"
      >
        {/* ── TOP BADGE & WISHLIST ROW ── */}
        <div className="flex items-center justify-between gap-1 z-10 shrink-0">
          {discountPercent > 0 ? (
            <span className="bg-[#E6F4EA] dark:bg-emerald-950/80 text-[#008F5A] dark:text-emerald-400 border border-[#008F5A]/20 font-black text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-lg tracking-tight">
              {discountPercent}% OFF
            </span>
          ) : badge ? (
            <span className="bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-700/50 font-black text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-lg">
              {badge}
            </span>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 border border-emerald-600 rounded-xs flex items-center justify-center p-0.5 bg-white dark:bg-[#151B23]">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            </div>
            <button
              type="button"
              suppressHydrationWarning
              onClick={(e) => {
                e.stopPropagation();
                toggleWishlist(product.id);
              }}
              className={`p-1 rounded-full transition-transform active:scale-90 ${isWishlisted ? 'text-rose-500 fill-rose-500' : 'text-slate-300 dark:text-slate-600 hover:text-rose-500'
                }`}
              title="Wishlist"
              aria-label="Toggle wishlist"
            >
              <Heart className={`w-3.5 h-3.5 ${isWishlisted ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>

        {/* ── PRODUCT IMAGE ── */}
        <div className="w-full h-[95px] sm:h-[110px] flex items-center justify-center p-1 sm:p-2 my-0.5 relative shrink-0">
          <img
            ref={imgRef}
            src={product.thumbnail || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80'}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300 drop-shadow-xs"
          />
          {isOutOfStock && (
            <div className="absolute inset-0 bg-white/85 dark:bg-[#151B23]/90 backdrop-blur-[1px] rounded-xl sm:rounded-2xl flex items-center justify-center">
              <span className="bg-rose-500 text-white font-black text-[9px] sm:text-[10px] px-2 py-0.5 sm:py-1 rounded-full uppercase tracking-wider shadow-xs">
                Out of Stock
              </span>
            </div>
          )}
        </div>

        {/* ── PRODUCT DETAILS ── */}
        <div className="flex flex-col flex-1 justify-between min-h-0">
          <div className="space-y-0.5">
            {/* Brand Name */}
            {brand ? (
              <Link
                href={`/brand/${brand.slug}`}
                onClick={(e) => e.stopPropagation()}
                className="text-[9px] sm:text-[10px] font-bold text-[#008F5A] dark:text-[#22C55E] hover:underline uppercase tracking-wider block truncate"
              >
                {brand.name}
              </Link>
            ) : (
              <span className="text-[9px] sm:text-[10px] font-bold text-[#6B7280] dark:text-[#9CA3AF] uppercase tracking-wider block truncate">
                PocketKirana
              </span>
            )}

            {/* Product Title */}
            <h3 className="font-extrabold text-xs sm:text-sm text-[#111827] dark:text-[#F9FAFB] leading-snug line-clamp-2 min-h-[32px] sm:min-h-[36px] group-hover:text-[#008F5A] dark:group-hover:text-[#22C55E] transition-colors">
              {product.name}
            </h3>

            {/* Stock Status & Unit */}
            <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-semibold text-[#6B7280] dark:text-[#D1D5DB] pt-0.5">
              <span className="truncate">{product.unit || '1 pc'}</span>
              {isOutOfStock ? (
                <span className="text-rose-600 dark:text-rose-400 font-bold text-[9px] sm:text-[10px]">● Out of Stock</span>
              ) : isLowStock ? (
                <span className="text-amber-600 dark:text-amber-400 font-bold text-[9px] sm:text-[10px]">● {product.stock} left</span>
              ) : (
                <span className="text-[#008F5A] dark:text-[#22C55E] font-bold text-[9px] sm:text-[10px]">● In Stock</span>
              )}
            </div>
          </div>

          {/* ── PRICING & CTA ── */}
          <div className="pt-1.5 sm:pt-2 border-t border-[#E5E7EB] dark:border-[#263241] flex flex-col gap-1.5 sm:gap-2">
            <div className="flex items-baseline gap-1.5 sm:gap-2">
              <span className="text-xs sm:text-base font-black text-[#008F5A] dark:text-[#22C55E]">
                ₹{product.sellingPrice}
              </span>
              {product.mrp > product.sellingPrice && (
                <span className="text-[10px] sm:text-xs text-[#6B7280] dark:text-[#9CA3AF] font-semibold line-through">
                  ₹{product.mrp}
                </span>
              )}
            </div>

            {isOutOfStock ? (
              <button
                disabled
                type="button"
                suppressHydrationWarning
                className="w-full bg-slate-100 dark:bg-[#1B2430] text-slate-400 dark:text-[#6B7280] font-bold text-[11px] sm:text-xs py-1.5 sm:py-2 rounded-xl cursor-not-allowed text-center"
              >
                Unavailable
              </button>
            ) : qty === 0 ? (
              <button
                type="button"
                suppressHydrationWarning
                onClick={handleAddToCartClick}
                className="w-full bg-[#E65100] hover:bg-[#D84315] text-white font-black text-[11px] sm:text-xs py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-xl transition-all shadow-2xs active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            ) : (
              <div className="w-full flex items-center justify-between bg-[#008F5A] text-white rounded-xl font-black text-xs p-0.5 sm:p-1 shadow-2xs">
                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={handleMinusClick}
                  className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center hover:bg-black/15 rounded-lg transition-colors cursor-pointer"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[2.5]" />
                </button>
                <span className="px-1 sm:px-2 font-black text-[11px] sm:text-xs">{qty} in cart</span>
                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={handlePlusClick}
                  className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center hover:bg-black/15 rounded-lg transition-colors cursor-pointer"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[2.5]" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
