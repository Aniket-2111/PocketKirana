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
        width: 56,
        height: 56,
        objectFit: 'contain',
        borderRadius: '50%',
        background: 'white',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        zIndex: 9999,
        pointerEvents: 'none',
        // CSS custom properties for the keyframe
        ['--tx' as string]: `${img.endX - img.startX}px`,
        ['--ty' as string]: `${img.endY - img.startY}px`,
        animation: 'flyToCart 0.75s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
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

    // Find the cart icon in the DOM — it has id="cart-btn" or look for the header cart
    const cartBtn =
      document.getElementById('header-cart-btn') ||
      document.querySelector('[data-cart-target]') ||
      document.querySelector('a[href="/cart"]');

    const endX = cartBtn
      ? cartBtn.getBoundingClientRect().left + cartBtn.getBoundingClientRect().width / 2 - 28
      : window.innerWidth - 60;
    const endY = cartBtn
      ? cartBtn.getBoundingClientRect().top + cartBtn.getBoundingClientRect().height / 2 - 28
      : 20;

    const startX = imgRect.left + imgRect.width / 2 - 28;
    const startY = imgRect.top + imgRect.height / 2 - 28;

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
      {/* ── Flying bubbles portal (rendered at body level via fixed positioning) ── */}
      {flyingImages.map((img) => (
        <FlyingBubble
          key={img.id}
          img={img}
          onDone={() => setFlyingImages((prev) => prev.filter((i) => i.id !== img.id))}
        />
      ))}

      {/* ── CARD — Fixed height so all cards are the same size ── */}
      <div className="w-full h-[300px] sm:h-[320px] bg-white rounded-3xl border border-slate-200/80 hover:border-[#0B8F5A]/40 p-3.5 flex flex-col group transition-all duration-200 shadow-2xs hover:shadow-md cursor-pointer relative overflow-hidden">

        {/* ── TOP BADGE & WISHLIST ROW ── */}
        <div className="flex items-center justify-between gap-1 z-10 shrink-0">
          {discountPercent > 0 ? (
            <span className="bg-[#E6F4EA] text-[#0B8F5A] border border-[#0B8F5A]/20 font-black text-[10px] px-2 py-0.5 rounded-lg tracking-tight">
              {discountPercent}% OFF
            </span>
          ) : badge ? (
            <span className="bg-amber-50 text-amber-800 border border-amber-200/60 font-black text-[10px] px-2 py-0.5 rounded-lg">
              {badge}
            </span>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 border border-emerald-600 rounded-xs flex items-center justify-center p-0.5 bg-white">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            </div>
            <button
              type="button"
              suppressHydrationWarning
              onClick={(e) => {
                e.stopPropagation();
                toggleWishlist(product.id);
              }}
              className={`p-1 rounded-full transition-transform active:scale-90 ${
                isWishlisted ? 'text-rose-500 fill-rose-500' : 'text-slate-300 hover:text-rose-500'
              }`}
              title="Wishlist"
            >
              <Heart className={`w-3.5 h-3.5 ${isWishlisted ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>

        {/* ── PRODUCT IMAGE — fixed height ── */}
        <div
          onClick={() => onOpenDetail ? onOpenDetail(product) : undefined}
          className="w-full h-[110px] flex items-center justify-center p-2 my-1 relative shrink-0"
        >
          <img
            ref={imgRef}
            src={product.thumbnail || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80'}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300 drop-shadow-xs"
          />
          {isOutOfStock && (
            <div className="absolute inset-0 bg-white/85 backdrop-blur-[1px] rounded-2xl flex items-center justify-center">
              <span className="bg-rose-500 text-white font-black text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider shadow-xs">
                Out of Stock
              </span>
            </div>
          )}
        </div>

        {/* ── PRODUCT DETAILS — flex-1 so it fills the remaining space ── */}
        <div className="flex flex-col flex-1 justify-between min-h-0">
          <div className="space-y-0.5">
            {/* Brand Name */}
            {brand && (
              <Link
                href={`/brand/${brand.slug}`}
                onClick={(e) => e.stopPropagation()}
                className="text-[10px] font-bold text-[#0B8F5A] hover:underline uppercase tracking-wider block truncate"
              >
                {brand.name}
              </Link>
            )}

            {/* Product Title — always 2 lines worth of space */}
            <h3
              onClick={() => onOpenDetail ? onOpenDetail(product) : undefined}
              className="font-extrabold text-xs text-slate-900 leading-snug line-clamp-2 h-[30px] group-hover:text-[#0B8F5A] transition-colors"
            >
              {product.name}
            </h3>

            {/* Stock Status & Unit */}
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 pt-0.5">
              <span className="truncate">{product.unit || '1 pc'}</span>
              {isOutOfStock ? (
                <span className="text-rose-600 font-bold text-[10px]">● Out of Stock</span>
              ) : isLowStock ? (
                <span className="text-amber-600 font-bold text-[10px]">● Only {product.stock} left</span>
              ) : (
                <span className="text-[#0B8F5A] font-bold text-[10px]">● In Stock</span>
              )}
            </div>
          </div>

          {/* ── PRICING & CTA ── */}
          <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
              <span className="text-sm sm:text-base font-black text-[#075C3C]">
                ₹{product.sellingPrice}
              </span>
              {product.mrp > product.sellingPrice && (
                <span className="text-xs text-slate-400 font-semibold line-through">
                  ₹{product.mrp}
                </span>
              )}
            </div>

            {isOutOfStock ? (
              <button
                disabled
                type="button"
                suppressHydrationWarning
                className="w-full bg-slate-100 text-slate-400 font-bold text-xs py-2 rounded-xl cursor-not-allowed text-center"
              >
                Unavailable
              </button>
            ) : qty === 0 ? (
              <button
                type="button"
                suppressHydrationWarning
                onClick={handleAddToCartClick}
                className="w-full bg-[#E65100] hover:bg-[#D84315] text-white font-black text-xs py-2 px-3 rounded-xl transition-all shadow-2xs active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Add to cart</span>
              </button>
            ) : (
              <div className="w-full flex items-center justify-between bg-[#0B8F5A] text-white rounded-xl font-black text-xs p-1 shadow-2xs">
                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={handleMinusClick}
                  className="w-7 h-7 flex items-center justify-center hover:bg-black/15 rounded-lg transition-colors cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
                <span className="px-2 font-black text-xs">{qty} in cart</span>
                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={handlePlusClick}
                  className="w-7 h-7 flex items-center justify-center hover:bg-black/15 rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
