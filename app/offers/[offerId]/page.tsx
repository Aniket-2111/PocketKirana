'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ProductCard } from '@/components/customer/ProductCard';
import { showToast } from '@/components/ui/Toast';
import {
  Tag,
  Clock,
  Sparkles,
  ShoppingBag,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Copy,
  ChevronRight,
  Percent,
  Flame,
  Zap,
} from 'lucide-react';

interface OfferDetail {
  id: string;
  title: string;
  description: string;
  discountPercentage?: number;
  discountAmount?: number;
  minOrderValue?: number;
  couponCode?: string;
  expiresAt: string; // ISO string
  active: boolean;
  bannerImage?: string;
  productId?: string;
  categorySlug?: string;
}

// Curated offer database matching campaigns & promotions
const KNOWN_OFFERS: Record<string, OfferDetail> = {
  'weekend-sale': {
    id: 'weekend-sale',
    title: '🔥 Weekend Grocery Sale',
    description: 'Save up to ₹100 on selected daily grocery essentials and fresh produce.',
    discountAmount: 100,
    minOrderValue: 499,
    couponCode: 'WEEKEND100',
    expiresAt: new Date(Date.now() + 3 * 86400000).toISOString(), // 3 days from now
    active: true,
    bannerImage: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80',
    productId: 'prod-milk-1',
  },
  'daily-essentials': {
    id: 'daily-essentials',
    title: '🔥 ₹50 OFF on Daily Essentials',
    description: 'Special instant discount on cooking essentials, pulses, and pantry staples.',
    discountAmount: 50,
    minOrderValue: 299,
    couponCode: 'ESSENTIAL50',
    expiresAt: new Date(Date.now() + 5 * 86400000).toISOString(),
    active: true,
    bannerImage: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=1200&q=80',
    productId: 'prod-bread-1',
  },
  'flash-deals': {
    id: 'flash-deals',
    title: '⚡ Flash Sale Live!',
    description: 'Limited-time grocery discounts on dairy, beverages, and snack packs.',
    discountPercentage: 25,
    minOrderValue: 199,
    couponCode: 'FLASH25',
    expiresAt: new Date(Date.now() + 12 * 3600000).toISOString(), // 12 hours from now
    active: true,
    bannerImage: 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?auto=format&fit=crop&w=1200&q=80',
    productId: 'prod-eggs-1',
  },
  'milk-deal': {
    id: 'milk-deal',
    title: '🥛 Milk at Special Price',
    description: 'Today only — Special discount on fresh dairy and morning staples.',
    discountAmount: 10,
    minOrderValue: 100,
    couponCode: 'DAIRY10',
    expiresAt: new Date(Date.now() + 1 * 86400000).toISOString(),
    active: true,
    bannerImage: 'https://images.unsplash.com/photo-1527153857715-3908f2ae5e81?auto=format&fit=crop&w=1200&q=80',
    productId: 'prod-milk-1',
  },
  'expired-promo': {
    id: 'expired-promo',
    title: '⏰ Midnight Mega Sale (Expired)',
    description: 'This promotional campaign has ended.',
    discountAmount: 150,
    minOrderValue: 500,
    couponCode: 'MIDNIGHT150',
    expiresAt: new Date(Date.now() - 24 * 3600000).toISOString(), // Expired yesterday
    active: false,
    bannerImage: 'https://images.unsplash.com/photo-1534452203293-494d7ddbf7e0?auto=format&fit=crop&w=1200&q=80',
  },
};

export default function OfferDetailPage({ params }: { params: Promise<{ offerId: string }> }) {
  const resolvedParams = use(params);
  const offerId = resolvedParams.offerId;
  const router = useRouter();
  const { products, addToCart, applyCoupon } = useAppStore();

  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number } | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  // Look up offer from known records or generate fallback
  const offer: OfferDetail = KNOWN_OFFERS[offerId] || {
    id: offerId,
    title: `🔥 Special Offer: ${offerId.replace(/-/g, ' ').toUpperCase()}`,
    description: 'Exclusive limited-time discount for PocketKirana customers.',
    discountPercentage: 20,
    minOrderValue: 299,
    couponCode: offerId.toUpperCase().replace(/-/g, '').slice(0, 10),
    expiresAt: new Date(Date.now() + 2 * 86400000).toISOString(),
    active: true,
    bannerImage: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80',
  };

  // Check expiration & start countdown
  useEffect(() => {
    const checkExpiry = () => {
      const now = Date.now();
      const expiryTime = new Date(offer.expiresAt).getTime();
      const diff = expiryTime - now;

      if (diff <= 0 || !offer.active) {
        setIsExpired(true);
        setTimeLeft(null);
      } else {
        setIsExpired(false);
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft({ hours, minutes, seconds });
      }
    };

    checkExpiry();
    const interval = setInterval(checkExpiry, 1000);
    return () => clearInterval(interval);
  }, [offer.expiresAt, offer.active]);

  const handleCopyCode = () => {
    if (isExpired) {
      showToast('This offer has expired and cannot be copied.', 'error');
      return;
    }
    if (offer.couponCode) {
      navigator.clipboard.writeText(offer.couponCode);
      setCopied(true);
      showToast(`Coupon code ${offer.couponCode} copied!`, 'success');
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleApplyAndShop = (prod?: any) => {
    if (isExpired) {
      showToast('This offer is expired. Please choose an active deal below.', 'error');
      return;
    }

    if (offer.couponCode) {
      applyCoupon(offer.couponCode);
    }

    if (prod) {
      addToCart(prod);
      showToast(`Added ${prod.name} to cart with ${offer.couponCode || 'offer'} applied!`, 'success');
    } else {
      showToast(`Offer ${offer.couponCode} applied to your cart!`, 'success');
    }
  };

  // Find eligible products
  const featuredProduct = offer.productId
    ? products.find((p) => p.id === offer.productId) || products[0]
    : products[0];

  const relatedProducts = products
    .filter((p) => p.id !== featuredProduct?.id)
    .slice(0, 6);

  return (
    <CustomerLayout>
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8 animate-in fade-in duration-300">
        <Breadcrumb
          items={[
            { label: 'Offers', href: '/offers' },
            { label: offer.title },
          ]}
        />

        {/* ── EXPIRATION ALERT (Section S) ── */}
        {isExpired ? (
          <div className="bg-rose-50 border-2 border-rose-200 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-md">
            <div className="flex items-start gap-4">
              <div className="p-3.5 bg-rose-100 text-rose-600 rounded-2xl shrink-0">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <span className="inline-block px-3 py-1 bg-rose-600 text-white font-extrabold text-[11px] rounded-full uppercase tracking-wider mb-2">
                  Offer Expired
                </span>
                <h2 className="text-2xl font-black text-rose-950">
                  {offer.title} has ended
                </h2>
                <p className="text-sm text-rose-700 mt-1 max-w-xl">
                  This promotional offer has expired and can no longer be applied to checkout. Explore currently active flash sales and discounted groceries below!
                </p>
              </div>
            </div>

            <Link
              href="/offers"
              className="bg-slate-900 hover:bg-slate-800 text-white font-black text-sm px-6 py-3.5 rounded-2xl shadow-md transition-all active:scale-95 inline-flex items-center gap-2 shrink-0"
            >
              <span>View Active Deals</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          /* ── ACTIVE HERO OFFER CARD (Section B) ── */
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-emerald-900 via-slate-900 to-slate-950 text-white p-6 sm:p-10 shadow-2xl border border-emerald-500/20">
            {/* Ambient background glow */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Left Details */}
              <div className="lg:col-span-7 space-y-5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="bg-emerald-500 text-slate-950 font-black text-xs px-3.5 py-1 rounded-full uppercase tracking-wider inline-flex items-center gap-1.5 shadow-sm">
                    <Sparkles className="w-3.5 h-3.5 fill-current" /> Verified Deal
                  </span>
                  {timeLeft && (
                    <span className="bg-amber-500/20 border border-amber-400/40 text-amber-300 font-bold text-xs px-3 py-1 rounded-full inline-flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 animate-spin text-amber-400" />
                      Ends in: {String(timeLeft.hours).padStart(2, '0')}h {String(timeLeft.minutes).padStart(2, '0')}m {String(timeLeft.seconds).padStart(2, '0')}s
                    </span>
                  )}
                </div>

                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight text-white">
                  {offer.title}
                </h1>

                <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl">
                  {offer.description} Min order value: ₹{offer.minOrderValue || 199}.
                </p>

                {/* Coupon Box & Action */}
                {offer.couponCode && (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                    <div
                      onClick={handleCopyCode}
                      className="bg-slate-800/80 hover:bg-slate-800 border-2 border-dashed border-emerald-400/60 rounded-2xl px-5 py-3.5 flex items-center justify-between gap-4 cursor-pointer transition-all active:scale-98 group"
                    >
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                          Coupon Code
                        </span>
                        <span className="font-mono font-black text-lg text-emerald-400 tracking-wider">
                          {offer.couponCode}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="text-slate-300 group-hover:text-emerald-300 transition-colors p-1"
                      >
                        {copied ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                      </button>
                    </div>

                    <button
                      onClick={() => handleApplyAndShop(featuredProduct)}
                      className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm px-7 py-4 rounded-2xl shadow-lg transition-all active:scale-95 inline-flex items-center justify-center gap-2"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>Add to Cart & Apply Offer</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Right Hero Product Card */}
              {featuredProduct && (
                <div className="lg:col-span-5 bg-white/10 backdrop-blur-md rounded-3xl p-5 border border-white/10 shadow-xl flex flex-col items-center text-center">
                  <div className="w-48 h-48 rounded-2xl overflow-hidden mb-4 bg-white/5 p-3 flex items-center justify-center">
                    <img
                      src={featuredProduct.thumbnail || offer.bannerImage}
                      alt={featuredProduct.name}
                      className="max-h-full max-w-full object-contain rounded-xl"
                    />
                  </div>
                  <span className="text-emerald-400 font-bold text-xs uppercase tracking-wider">
                    Featured in this offer
                  </span>
                  <h3 className="text-lg font-black text-white mt-1">{featuredProduct.name}</h3>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-2xl font-black text-emerald-400">
                      ₹{featuredProduct.sellingPrice}
                    </span>
                    {featuredProduct.mrp > featuredProduct.sellingPrice && (
                      <span className="text-sm text-slate-400 line-through">
                        ₹{featuredProduct.mrp}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleApplyAndShop(featuredProduct)}
                    className="w-full mt-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs py-3 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <span>1-Tap Add to Cart</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── SECTION: ELIGIBLE / POPULAR ITEMS ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-gray-200 pb-3">
            <h2 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-500" />
              {isExpired ? 'Explore Active Deals' : 'More Eligible Items for this Deal'}
            </h2>
            <Link
              href="/offers"
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 hover:underline"
            >
              <span>View all offers</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {relatedProducts.map((prod) => (
              <ProductCard key={prod.id} product={prod} />
            ))}
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}
