'use client';

import React, { useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { Product } from '@/types';
import { useAppStore } from '@/lib/store';
import { getProductBrand } from '@/lib/brandUtils';
import { Heart, Plus, Minus, ShoppingCart } from 'lucide-react';
import { showToast } from '@/components/ui/Toast';
import { ProductImage } from './ProductImage';

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
        className="w-full h-[330px] sm:h-[350px] bg-white dark:bg-[#151B23] rounded-2xl sm:rounded-3xl border border-[#E5E7EB] dark:border-[#263241] hover:border-[#075C3C]/50 dark:hover:border-[#008F5A]/70 p-3 sm:p-3.5 flex flex-col justify-between group transition-all duration-200 shadow-2xs hover:shadow-md cursor-pointer relative overflow-hidden"
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
            <div className="w-3.5 h-3.5 border border-emerald-600 rounded-xs flex items-center justify-center p-0.5 bg-white dark:bg-[#151B23]" title="Vegetarian">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            </div>
            <button
              type="button"
              suppressHydrationWarning
              onClick={(e) => {
                e.stopPropagation();
                toggleWishlist(product.id);
              }}
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all active:scale-90 border shadow-2xs ${
                isWishlisted
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 text-rose-500'
                  : 'bg-slate-50/90 dark:bg-slate-800/90 border-slate-200/80 dark:border-slate-700 text-slate-400 hover:text-rose-500 hover:bg-rose-50/50'
              }`}
              title={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isWishlisted ? 'fill-current text-rose-500' : ''}`} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* ── PRODUCT IMAGE ── */}
        <div className="w-full h-28 sm:h-32 rounded-xl sm:rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 p-1.5 my-1 relative shrink-0 overflow-hidden flex items-center justify-center">
          <ProductImage
            src={product.thumbnail}
            alt={product.name}
            containerClassName="w-full h-full"
            className="w-full h-full max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300 drop-shadow-xs"
          />
          {isOutOfStock && (
            <div className="absolute inset-0 bg-white/85 dark:bg-[#151B23]/90 backdrop-blur-[1px] rounded-xl sm:rounded-2xl flex items-center justify-center">
              <span className="bg-rose-500 text-white font-bold text-[9px] sm:text-[10px] px-2 py-0.5 sm:py-1 rounded-full uppercase tracking-wider shadow-xs">
                Out of Stock
              </span>
            </div>
          )}
        </div>

        {/* ── PRODUCT DETAILS ── */}
        <div className="flex flex-col flex-1 justify-between min-h-0 pt-0.5">
          <div className="space-y-0.5">
            {/* Brand Name */}
            {brand ? (
              <Link
                href={`/brand/${brand.slug}`}
                onClick={(e) => e.stopPropagation()}
                className="text-[10px] sm:text-[11px] font-bold text-[#075C3C] dark:text-emerald-400 hover:underline tracking-wide block truncate"
              >
                {brand.name}
              </Link>
            ) : (
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 tracking-wide block truncate">
                Farm Fresh Organic
              </span>
            )}

            {/* Product Title */}
            <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-slate-100 leading-snug line-clamp-2 min-h-[32px] sm:min-h-[36px] group-hover:text-[#075C3C] dark:group-hover:text-emerald-400 transition-colors">
              {product.name}
            </h3>

            {/* Stock Status & Unit */}
            <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-semibold text-slate-600 dark:text-slate-300 pt-0.5">
              <span className="truncate">{product.unit || '1 pc'}</span>
              {isOutOfStock ? (
                <span className="text-rose-600 dark:text-rose-400 font-bold text-[9px] sm:text-[10px]">● Out of Stock</span>
              ) : isLowStock ? (
                <span className="text-amber-600 dark:text-amber-400 font-bold text-[9px] sm:text-[10px]">● {product.stock} left</span>
              ) : (
                <span className="text-[#075C3C] dark:text-emerald-400 font-bold text-[9px] sm:text-[10px]">● In Stock</span>
              )}
            </div>
          </div>

          {/* ── PRICING & CTA ── */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-1.5 mt-auto">
            <div className="flex items-baseline gap-1.5 sm:gap-2">
              <span className="text-sm sm:text-base font-black text-[#075C3C] dark:text-emerald-400">
                ₹{product.sellingPrice}
              </span>
              {product.mrp > product.sellingPrice && (
                <span className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 font-semibold line-through">
                  ₹{product.mrp}
                </span>
              )}
            </div>

            {isOutOfStock ? (
              <button
                disabled
                type="button"
                suppressHydrationWarning
                className="w-full h-8 sm:h-9 bg-slate-100 dark:bg-[#1B2430] text-slate-400 dark:text-slate-500 font-bold text-[11px] sm:text-xs rounded-xl cursor-not-allowed text-center"
              >
                Unavailable
              </button>
            ) : qty === 0 ? (
              <button
                type="button"
                suppressHydrationWarning
                onClick={handleAddToCartClick}
                className="w-full h-8 sm:h-9 bg-[#075C3C] hover:bg-[#0B8F5A] active:bg-[#05442C] text-white font-bold text-xs px-3 rounded-xl transition-all shadow-2xs active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#075C3C]"
                aria-label={`Add ${product.name} to cart`}
              >
                <ShoppingCart className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Add</span>
              </button>
            ) : (
              <div className="w-full h-8 sm:h-9 flex items-center justify-between bg-[#075C3C] text-white rounded-xl font-bold text-xs p-1 shadow-2xs">
                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={handleMinusClick}
                  className="w-7 h-7 flex items-center justify-center hover:bg-black/20 rounded-lg transition-colors cursor-pointer"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                </button>
                <span className="px-1 font-bold text-[11px] sm:text-xs">{qty} in cart</span>
                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={handlePlusClick}
                  className="w-7 h-7 flex items-center justify-center hover:bg-black/20 rounded-lg transition-colors cursor-pointer"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
