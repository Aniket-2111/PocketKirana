'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Minus, Plus, ShoppingBag, Star } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { showToast } from '@/components/ui/Toast';
import type { Product } from '@/types';

interface ProductCardProps {
  product: Product;
  onOpenDetail?: (product: Product) => void;
  badge?: string;
}

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80';

function getUnitPrice(product: Product) {
  const match = (product.unit || '').toLowerCase().match(/(\d+(?:\.\d+)?)\s*(g|gm|gram|ml|l|kg|ltr|liter)/);
  if (!match) return null;

  let quantity = Number.parseFloat(match[1]);
  const unit = match[2];
  if (['kg', 'l', 'ltr', 'liter'].includes(unit)) quantity *= 1000;
  if (!quantity) return null;

  const label = ['ml', 'l', 'ltr', 'liter'].includes(unit) ? '100ml' : '100g';
  return `₹${((product.sellingPrice / quantity) * 100).toFixed(1)}/${label}`;
}

export function ProductCard({ product, onOpenDetail, badge }: ProductCardProps) {
  const router = useRouter();
  const { cart, addToCart, updateCartQuantity } = useAppStore();
  const [imgError, setImgError] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const cartItem = cart.find((item) => item.productId === product.id || item.id === product.id);
  const quantity = cartItem?.quantity || 0;
  const discount = product.mrp > product.sellingPrice
    ? Math.round(((product.mrp - product.sellingPrice) / product.mrp) * 100)
    : 0;
  const unitPrice = getUnitPrice(product);
  const thumbnail = product.thumbnail || (product as any).image || FALLBACK_IMAGE;

  const isOutOfStock = product.status === 'out_of_stock' || product.stock === 0 || (product as any).inStock === false;
  const isLowStock = !isOutOfStock && typeof product.stock === 'number' && product.stock > 0 && product.stock <= 5;
  const badgeLabel = badge || ((product as any).isBestseller || (product as any).bestseller ? 'Bestseller' : (product as any).isNew ? 'New' : null);

  const openDetails = () => {
    if (onOpenDetail) {
      onOpenDetail(product);
      return;
    }
    router.push(`/product/${product.id || product.slug}`);
  };

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOutOfStock || isAdding) return;
    setIsAdding(true);
    addToCart(product, 1);
    showToast(`Added ${product.name} to cart`, 'success');
    setTimeout(() => setIsAdding(false), 200);
  };

  const updateQuantity = (nextQuantity: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (cartItem) updateCartQuantity(cartItem.id, nextQuantity);
  };

  return (
    <article className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm transition-all duration-200 hover:shadow-md hover:border-emerald-500/40">
      
      {/* ── Product Media Container ── */}
      <button
        type="button"
        onClick={openDetails}
        aria-label={`View ${product.name}${product.unit ? `, ${product.unit}` : ''} details`}
        className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-secondary-bg p-3.5 text-left focus-visible:z-10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 active:scale-[0.98] transition-transform"
      >
        {!imgError && thumbnail ? (
          <img
            src={thumbnail}
            alt={product.name}
            onError={(event) => {
              const image = event.currentTarget;
              if (image.src !== FALLBACK_IMAGE) image.src = FALLBACK_IMAGE;
              else setImgError(true);
            }}
            className={`max-h-full max-w-full object-contain transition-transform duration-200 group-hover:scale-105 ${
              isOutOfStock ? 'opacity-40 grayscale' : ''
            }`}
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-center text-muted-foreground" aria-hidden="true">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ShoppingBag className="h-6 w-6" />
            </span>
            <span className="text-xs font-semibold">Image unavailable</span>
          </div>
        )}

        {/* Top Badges (Discount, Bestseller, Out of stock) */}
        <div className="absolute left-2.5 top-2.5 flex flex-col gap-1 items-start z-10">
          {discount > 0 && !isOutOfStock && (
            <span className="rounded-lg bg-primary-700 px-2 py-0.5 text-[11px] font-black text-white shadow-xs">
              {discount}% OFF
            </span>
          )}
          {badgeLabel && !isOutOfStock && (
            <span className="rounded-lg bg-amber-500 px-2 py-0.5 text-[10px] font-black text-slate-900 shadow-xs uppercase tracking-wider">
              {badgeLabel}
            </span>
          )}
        </div>

        {/* Out of Stock Overlay Ribbon */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] flex items-center justify-center z-10">
            <span className="bg-slate-900/95 text-white text-[11px] font-black px-2.5 py-1 rounded-lg border border-white/20 uppercase tracking-wider shadow-md">
              Out of stock
            </span>
          </div>
        )}
      </button>

      {/* ── Product Information ── */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        
        {/* Unit & Brand Row */}
        <div className="flex min-h-5 items-center justify-between gap-1.5">
          <span className="min-w-0 truncate rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
            {product.unit || '1 pack'}
          </span>
          {product.brandName && (
            <span className="min-w-0 truncate text-[11px] font-medium text-muted-foreground">
              {product.brandName}
            </span>
          )}
        </div>

        {/* Product Title */}
        <button
          type="button"
          onClick={openDetails}
          className="min-h-9 rounded-md text-left text-xs sm:text-sm font-semibold leading-snug text-card-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <span className="line-clamp-2">{product.name}</span>
        </button>

        {/* Per 100g / 100ml Unit Price */}
        {unitPrice && <p className="text-[11px] font-mono text-muted-foreground leading-none">{unitPrice}</p>}

        {/* Low Stock Indicator */}
        {isLowStock && (
          <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1 leading-none">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Only {product.stock} left in stock
          </p>
        )}

        {/* Pricing Row */}
        <div className="flex min-h-6 flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-sm sm:text-base font-extrabold text-card-foreground">₹{product.sellingPrice}</span>
          {product.mrp > product.sellingPrice && (
            <span className="text-xs text-muted-foreground line-through">₹{product.mrp}</span>
          )}
          {discount > 0 && (
            <span className="text-xs font-semibold text-primary">Save {discount}%</span>
          )}
        </div>

        {/* Rating and Delivery Row */}
        <div className="mt-auto flex min-h-6 items-center justify-between gap-2 border-t border-border/80 pt-2">
          <span
            role="img"
            className="flex items-center gap-1 text-[11px] font-medium text-secondary-foreground"
            aria-label={`Rated ${product.rating || 4} out of 5`}
          >
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" aria-hidden="true" />
            {product.rating || 4}
            {product.reviewsCount != null && (
              <span className="text-muted-foreground">({product.reviewsCount})</span>
            )}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
            <Clock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            30 mins
          </span>
        </div>

        {/* ── Add to Cart CTA / Stepper ── */}
        <div className="pt-1">
          {isOutOfStock ? (
            <button
              type="button"
              disabled
              aria-label={`${product.name} is currently out of stock`}
              className="min-h-11 w-full rounded-xl bg-muted text-muted-foreground text-xs font-bold uppercase tracking-wider cursor-not-allowed border border-border"
            >
              Out of stock
            </button>
          ) : quantity === 0 ? (
            <button
              type="button"
              onClick={handleAdd}
              disabled={isAdding}
              aria-label={`Add ${product.name} to cart`}
              className={`min-h-11 w-full rounded-xl bg-primary-700 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs transition-all duration-150 hover:bg-primary-800 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 flex items-center justify-center gap-2 cursor-pointer ${
                isAdding ? 'scale-[0.98] bg-primary-800' : ''
              }`}
            >
              <span>Add to cart</span>
            </button>
          ) : (
            <div className="flex min-h-11 items-center justify-between rounded-xl border border-primary bg-primary/5 px-1 animate-in zoom-in-95 duration-150">
              <button
                type="button"
                onClick={(e) => updateQuantity(quantity - 1, e)}
                aria-label={`Remove one ${product.name} from cart`}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-primary transition-colors hover:bg-primary/10 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 cursor-pointer"
              >
                <Minus className="h-4 w-4" aria-hidden="true" />
              </button>
              <span
                role="status"
                className="min-w-8 text-center text-sm font-black text-card-foreground font-mono"
                aria-label={`${quantity} in cart`}
              >
                {quantity}
              </span>
              <button
                type="button"
                onClick={(e) => updateQuantity(quantity + 1, e)}
                aria-label={`Add one ${product.name} to cart`}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-white transition-colors hover:bg-primary-700 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 cursor-pointer"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

      </div>
    </article>
  );
}
