'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Award,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Heart,
  Info,
  Minus,
  Package,
  Plus,
  Search,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  X,
  Zap,
} from 'lucide-react';

import { useAppStore } from '@/lib/store';
import CustomerShell from '../../../components/CustomerShell';
import { INITIAL_PRODUCTS } from '@/lib/mockData';
import { showToast } from '@/components/ui/Toast';
import type { Product, ProductVariant } from '@/types';
import {
  normalizeProductSections,
  sanitizeVisibleSectionsForCustomer,
} from '@/lib/productSectionUtils';
import { apiFetch } from '@/lib/apiClient';
import { trackProductView } from '@/lib/analytics';

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=85';

export default function ProductDetailClient() {
  const router = useRouter();
  const params = useParams();

  const idOrSlug = (params?.id as string) || '';

  const { products, cart, addToCart, updateCartQuantity } = useAppStore();

  const [mounted, setMounted] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({});
  const [apiProduct, setApiProduct] = useState<Product | null>(null);
  const [liked, setLiked] = useState(false);
  const [imageError, setImageError] = useState(false);

  const detailsSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);

    if (!idOrSlug) return;

    apiFetch(`/api/v1/products/${idOrSlug}`)
      .then((response) => response.json())
      .then((data) => {
        if (data?.success && data?.data) {
          setApiProduct(data.data);
        }
      })
      .catch(() => {});
  }, [idOrSlug]);

  const allProducts = useMemo(() => {
    const map = new Map<string, Product>();

    INITIAL_PRODUCTS.forEach((product) => {
      map.set(product.id, product);
    });

    (products || []).forEach((product) => {
      const existing = map.get(product.id);
      map.set(product.id, {
        ...existing,
        ...product,
      });
    });

    return Array.from(map.values()).filter(
      (product) => product.status !== 'discontinued'
    );
  }, [products]);

  const product = useMemo(() => {
    if (
      apiProduct &&
      (apiProduct.id === idOrSlug || apiProduct.slug === idOrSlug)
    ) {
      return apiProduct;
    }

    return (
      allProducts.find(
        (item) => item.id === idOrSlug || item.slug === idOrSlug
      ) || allProducts[0]
    );
  }, [allProducts, apiProduct, idOrSlug]);

  useEffect(() => {
    if (product) {
      trackProductView({
        product_id: product.id,
        category_id: product.categoryId,
        brand_id: product.brandId,
        product_name: product.name,
        price: product.sellingPrice,
        source: 'customer_app_product_detail',
      });
    }
  }, [product?.id]);

  const dynamicSections = useMemo(() => {
    return sanitizeVisibleSectionsForCustomer(
      normalizeProductSections(product)
    );
  }, [product]);

  const variants = product?.variants || [];

  const [selectedVariant, setSelectedVariant] = useState<
    ProductVariant | undefined
  >(undefined);

  useEffect(() => {
    if (variants.length > 0) {
      const stillExists = selectedVariant
        ? variants.some((variant) => variant.id === selectedVariant.id)
        : false;

      if (!stillExists) {
        setSelectedVariant(variants[0]);
      }
    } else {
      setSelectedVariant(undefined);
    }
  }, [variants, selectedVariant]);

  const similarProducts = useMemo(() => {
    if (!product) return [];

    return allProducts
      .filter(
        (item) =>
          item.id !== product.id &&
          ((product.categoryId &&
            item.categoryId === product.categoryId) ||
            (product.category &&
              item.category === product.category) ||
            item.brandId === product.brandId)
      )
      .slice(0, 6);
  }, [allProducts, product]);

  const images = useMemo(() => {
    if (!product) return [];

    const list: string[] = [];

    if (product.thumbnail) {
      list.push(product.thumbnail);
    }

    if (
      (product as any).image &&
      !list.includes((product as any).image)
    ) {
      list.push((product as any).image);
    }

    if (Array.isArray(product.images)) {
      product.images.forEach((image) => {
        if (image && !list.includes(image)) {
          list.push(image);
        }
      });
    }

    if (list.length === 0) {
      list.push(FALLBACK_IMAGE);
    }

    if (product.maxDisplayImages && product.maxDisplayImages > 0) {
      return list.slice(0, product.maxDisplayImages);
    }

    return list;
  }, [product]);

  useEffect(() => {
    setActiveImageIndex(0);
    setImageError(false);
  }, [product?.id]);

  if (!mounted || !product) {
    return (
      <CustomerShell title="Product Details" noPadding>
        <div className="min-h-screen bg-white p-4 dark:bg-[#080C10]">
          <div className="mx-auto max-w-2xl space-y-4">
            <div className="h-[360px] animate-pulse rounded-[28px] bg-slate-100 dark:bg-[#121820]" />
            <div className="h-56 animate-pulse rounded-[28px] bg-slate-100 dark:bg-[#121820]" />
            <div className="h-32 animate-pulse rounded-[28px] bg-slate-100 dark:bg-[#121820]" />
          </div>
        </div>
      </CustomerShell>
    );
  }

  const effectivePrice = selectedVariant
    ? selectedVariant.sellingPrice
    : product.sellingPrice;

  const effectiveMrp = selectedVariant
    ? selectedVariant.mrp
    : product.mrp;

  const discountPercent =
    effectiveMrp > effectivePrice
      ? Math.round(
          ((effectiveMrp - effectivePrice) / effectiveMrp) * 100
        )
      : 0;

  const currentUnit = selectedVariant
    ? selectedVariant.variantName
    : product.unit || '1 pack';

  const calculatePer100 = () => {
    const unitStr = currentUnit.toLowerCase();

    const match = unitStr.match(
      /(\d+(\.\d+)?)\s*(g|gm|gram|ml|l|kg|ltr|liter)/
    );

    if (!match) return null;

    let quantity = parseFloat(match[1]);
    const unit = match[3];

    if (
      unit === 'kg' ||
      unit === 'l' ||
      unit === 'ltr' ||
      unit === 'liter'
    ) {
      quantity *= 1000;
    }

    if (quantity <= 0) return null;

    const per100 = (effectivePrice / quantity) * 100;

    const unitLabel =
      unit === 'ml' ||
      unit === 'l' ||
      unit === 'ltr' ||
      unit === 'liter'
        ? '100 ml'
        : '100 g';

    return `₹${per100.toFixed(1)}/${unitLabel}`;
  };

  const per100Text = calculatePer100();

  // Clean base product title (strips embedded unit if variants are present)
  const cleanBaseName = product?.name
    ? product.name
        .replace(/\s*\(\s*\d+(\.\d+)?\s*(kg|g|gm|gram|ml|l|ltr|liter|pack|pcs|piece|pieces|unit)\s*\)/i, '')
        .replace(/\s*-\s*\d+(\.\d+)?\s*(kg|g|gm|gram|ml|l|ltr|liter|pack|pcs|piece|pieces|unit)$/i, '')
        .trim()
    : '';

  const displayTitle = selectedVariant && selectedVariant.variantName
    ? `${cleanBaseName} (${selectedVariant.variantName})`
    : product?.name || '';

  const itemKey = `${product.id}::${
    selectedVariant?.id || 'default'
  }`;

  const cartItem = cart.find(
    (item) =>
      item.id === itemKey ||
      (item.productId === product.id && !selectedVariant)
  );

  const qtyInCart = cartItem?.quantity || 0;

  const handleAddToCart = () => {
    addToCart(product, 1, selectedVariant);
    showToast(`Added ${displayTitle} to cart`, 'success');
  };

  const handleUpdateQty = (newQuantity: number) => {
    updateCartQuantity(itemKey, newQuantity);
  };

  const handleShare = async () => {
    if (typeof window === 'undefined') return;

    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: product.name,
          text: `Check out ${product.name} on PocketKirana!`,
          url,
        });

        return;
      } catch {
        // User cancelled share.
      }
    }

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      showToast('Product link copied to clipboard! 📋', 'info');
    }
  };

  const toggleAccordion = (key: string) => {
    setOpenAccordions((previous) => ({
      ...previous,
      [key]: !previous[key],
    }));
  };

  const scrollToDetails = () => {
    detailsSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  return (
    <CustomerShell
      title={displayTitle || product.name}
      noPadding
    >
      <div 
        style={{ '--toast-bottom-offset': '144px', '--bottom-stack-height': '144px' } as React.CSSProperties}
        className="min-h-screen bg-[#F7F8F6] pb-44 font-sans text-[#172019] transition-colors dark:bg-[#080C10] dark:text-white"
      >
        {/* =========================================================
            TOP PRODUCT MEDIA
        ========================================================== */}
        <section className="relative overflow-hidden bg-white dark:bg-[#0E141A]">
          <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 pt-4">
            <button
              onClick={() => router.back()}
              aria-label="Go back"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-black/5 bg-white/90 text-slate-900 shadow-lg backdrop-blur-xl transition active:scale-90 dark:border-white/10 dark:bg-black/50 dark:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/search')}
                aria-label="Search"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-black/5 bg-white/90 text-slate-900 shadow-lg backdrop-blur-xl transition active:scale-90 dark:border-white/10 dark:bg-black/50 dark:text-white"
              >
                <Search className="h-5 w-5" />
              </button>

              <button
                onClick={handleShare}
                aria-label="Share"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-black/5 bg-white/90 text-slate-900 shadow-lg backdrop-blur-xl transition active:scale-90 dark:border-white/10 dark:bg-black/50 dark:text-white"
              >
                <Share2 className="h-5 w-5" />
              </button>
            </div>
          </div>

          <button
            onClick={() => setLiked((value) => !value)}
            aria-label="Wishlist"
            className="absolute right-5 top-[72px] z-20 flex h-10 w-10 items-center justify-center rounded-full border border-black/5 bg-white/90 shadow-md backdrop-blur-xl transition active:scale-90 dark:border-white/10 dark:bg-black/50"
          >
            <Heart
              className={`h-5 w-5 transition ${
                liked
                  ? 'fill-rose-500 text-rose-500'
                  : 'text-slate-700 dark:text-white'
              }`}
            />
          </button>

          <div className="mx-auto flex h-[260px] sm:h-[320px] max-w-2xl items-center justify-center px-6 pb-4 pt-16">
            <div className="relative flex h-full w-full items-center justify-center rounded-[28px] bg-gradient-to-b from-[#F4F7F3] to-white dark:from-[#131B21] dark:to-[#0D1318]">
              {discountPercent > 0 && (
                <div className="absolute left-3.5 top-3.5 z-10 rounded-full bg-[#DDF7E7] px-2.5 py-1 text-[10px] font-black text-[#087A3B] dark:bg-emerald-950 dark:text-emerald-300">
                  {discountPercent}% OFF
                </div>
              )}

              <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 rounded-full border border-emerald-100 bg-white/90 px-2.5 py-1 text-[10px] font-bold text-emerald-700 shadow-xs backdrop-blur dark:border-emerald-900 dark:bg-[#111A16] dark:text-emerald-300">
                <ShieldCheck className="h-3 w-3" />
                Quality checked
              </div>

              <img
                src={imageError ? FALLBACK_IMAGE : images[activeImageIndex]}
                alt={displayTitle || product.name}
                onError={() => setImageError(true)}
                className="max-h-[190px] sm:max-h-[240px] max-w-[78%] object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.10)] transition duration-500"
              />

              {images.length > 1 && (
                <div className="absolute bottom-4 right-4 flex items-center gap-1 rounded-full bg-black/55 px-3 py-1.5 backdrop-blur">
                  {images.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setActiveImageIndex(index)}
                      aria-label={`Image ${index + 1}`}
                      className={`h-1.5 rounded-full transition-all ${
                        index === activeImageIndex
                          ? 'w-5 bg-white'
                          : 'w-1.5 bg-white/45'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {images.length > 1 && (
            <div className="flex justify-center gap-2 overflow-x-auto px-5 pb-5 scrollbar-none">
              {images.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  onClick={() => {
                    setActiveImageIndex(index);
                    setImageError(false);
                  }}
                  className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border bg-[#F8FAF8] p-1.5 transition dark:bg-[#141B21] ${
                    activeImageIndex === index
                      ? 'border-emerald-500 ring-2 ring-emerald-500/15'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <img
                    src={image}
                    alt=""
                    className="max-h-full max-w-full object-contain"
                  />
                </button>
              ))}
            </div>
          )}
        </section>

        {/* =========================================================
            DELIVERY PROMISE
        ========================================================== */}
        <div className="border-y border-[#E5EAE5] bg-white px-4 py-3 dark:border-[#202A32] dark:bg-[#0E141A]">
          <div className="mx-auto flex max-w-2xl items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                <Zap className="h-4 w-4 fill-current" />
              </div>

              <div>
                <p className="text-[11px] font-black text-slate-900 dark:text-white">
                  Delivery in 30 mins
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Fast delivery from your local store
                </p>
              </div>
            </div>

            <button
              onClick={scrollToDetails}
              className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400"
            >
              Details
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* =========================================================
            MAIN CONTENT
        ========================================================== */}
        <main className="mx-auto max-w-2xl space-y-3 px-3 py-3">
          {/* Product information */}
          <section className="rounded-[24px] border border-[#E3E8E3] bg-white p-4 shadow-[0_4px_20px_rgba(20,40,25,0.04)] dark:border-[#202A32] dark:bg-[#10171D]">
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                {product.brandName || 'PocketKirana'}
              </span>

              <div className="flex items-center gap-1 text-[10px] font-bold text-amber-500">
                <Star className="h-3.5 w-3.5 fill-current" />
                4.8
              </div>
            </div>

            <h1 className="text-[22px] font-black leading-[1.15] tracking-tight text-slate-950 dark:text-white sm:text-2xl">
              {displayTitle}
            </h1>

            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
              {currentUnit}
            </p>

            {product.description && (
              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {product.description}
              </p>
            )}

            <div className="mt-5 flex items-end justify-between gap-4">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[28px] font-black tracking-tight text-slate-950 dark:text-white">
                    ₹{effectivePrice}
                  </span>

                  {effectiveMrp > effectivePrice && (
                    <span className="text-sm font-medium text-slate-400 line-through">
                      ₹{effectiveMrp}
                    </span>
                  )}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {discountPercent > 0 && (
                    <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                      Save ₹{effectiveMrp - effectivePrice}
                    </span>
                  )}

                  {per100Text && (
                    <span className="text-[10px] font-medium text-slate-400">
                      {per100Text}
                    </span>
                  )}
                </div>
              </div>

              <div className="hidden items-center gap-1 rounded-xl bg-slate-50 px-3 py-2 text-[10px] font-bold text-slate-500 dark:bg-[#171F26] dark:text-slate-300 sm:flex">
                <Clock className="h-3.5 w-3.5 text-emerald-500" />
                30 min
              </div>
            </div>

            {/* Variants */}
            {variants.length > 0 && (
              <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-black text-slate-900 dark:text-white">
                    Choose quantity
                  </p>

                  <span className="text-[10px] font-medium text-slate-400">
                    {variants.length} options
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {variants.map((variant) => {
                    const isSelected =
                      selectedVariant?.id === variant.id;

                    const variantDiscount =
                      variant.mrp > variant.sellingPrice
                        ? Math.round(
                            ((variant.mrp - variant.sellingPrice) /
                              variant.mrp) *
                              100
                          )
                        : 0;

                    return (
                      <button
                        key={variant.id}
                        onClick={() => setSelectedVariant(variant)}
                        className={`relative rounded-2xl border p-3 text-left transition active:scale-[0.98] ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/10 dark:bg-emerald-950/40'
                            : 'border-slate-200 bg-white hover:border-emerald-300 dark:border-slate-700 dark:bg-[#151D24]'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                            <Check className="h-3 w-3" />
                          </div>
                        )}

                        <span className="block pr-5 text-xs font-black text-slate-900 dark:text-white">
                          {variant.variantName}
                        </span>

                        <span className="mt-2 block text-base font-black text-slate-950 dark:text-white">
                          ₹{variant.sellingPrice}
                        </span>

                        {variant.mrp > variant.sellingPrice && (
                          <span className="mt-0.5 block text-[10px] text-slate-400 line-through">
                            MRP ₹{variant.mrp}
                          </span>
                        )}

                        {variantDiscount > 0 && (
                          <span className="mt-1.5 block text-[9px] font-black text-emerald-600 dark:text-emerald-400">
                            {variantDiscount}% OFF
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* Benefits */}
          <section className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-[#E3E8E3] bg-white p-3 text-center dark:border-[#202A32] dark:bg-[#10171D]">
              <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                <Zap className="h-4 w-4" />
              </div>
              <p className="text-[10px] font-black text-slate-800 dark:text-white">
                Fast
              </p>
              <p className="mt-0.5 text-[9px] text-slate-400">
                30 min
              </p>
            </div>

            <div className="rounded-2xl border border-[#E3E8E3] bg-white p-3 text-center dark:border-[#202A32] dark:bg-[#10171D]">
              <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <p className="text-[10px] font-black text-slate-800 dark:text-white">
                Trusted
              </p>
              <p className="mt-0.5 text-[9px] text-slate-400">
                Quality
              </p>
            </div>

            <div className="rounded-2xl border border-[#E3E8E3] bg-white p-3 text-center dark:border-[#202A32] dark:bg-[#10171D]">
              <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                <Award className="h-4 w-4" />
              </div>
              <p className="text-[10px] font-black text-slate-800 dark:text-white">
                Verified
              </p>
              <p className="mt-0.5 text-[9px] text-slate-400">
                Product
              </p>
            </div>
          </section>

          {/* Brand */}
          <button
            onClick={() =>
              router.push(
                `/search?q=${encodeURIComponent(
                  product.brandName ||
                    product.categoryId ||
                    product.category ||
                    ''
                )}`
              )
            }
            className="flex w-full items-center justify-between rounded-[22px] border border-[#E3E8E3] bg-white p-3.5 text-left shadow-[0_4px_20px_rgba(20,40,25,0.03)] transition active:scale-[0.99] dark:border-[#202A32] dark:bg-[#10171D]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-[9px] font-black uppercase text-emerald-800 dark:bg-white">
                {(product.brandName || 'BRAND').slice(0, 6)}
              </div>

              <div>
                <p className="text-xs font-black text-slate-900 dark:text-white">
                  {product.brandName || 'PocketKirana Certified'}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  Explore products from this brand
                </p>
              </div>
            </div>

            <ChevronRight className="h-5 w-5 text-slate-400" />
          </button>

          {/* Details Section (Full inline details + modal option) */}
          <section
            ref={detailsSectionRef}
            className="overflow-hidden rounded-[24px] border border-[#E3E8E3] bg-white p-4 shadow-[0_4px_20px_rgba(20,40,25,0.04)] dark:border-[#202A32] dark:bg-[#10171D]"
          >
            <div className="flex items-center justify-between pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                  <Info className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-900 dark:text-white sm:text-base">
                    Product Details & Specifications
                  </h2>
                  <p className="text-[10px] text-slate-400">
                    Ingredients, nutrition, manufacturer & policy
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowDetailsModal(true)}
                className="rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-700 transition hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300"
              >
                Expand All
              </button>
            </div>

            {/* Description */}
            {product.description && (
              <div className="mb-4 rounded-2xl bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-700 dark:bg-[#151D24] dark:text-slate-300">
                <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  About this item
                </p>
                {product.description}
              </div>
            )}

            {/* Quick Highlights Grid */}
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-[#151D24]">
                <p className="text-[9px] font-medium uppercase tracking-wide text-slate-400">
                  Shelf life
                </p>
                <p className="mt-1 text-xs font-black text-slate-900 dark:text-white">
                  {product.shelfLife || '9 months'}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-[#151D24]">
                <p className="text-[9px] font-medium uppercase tracking-wide text-slate-400">
                  Product type
                </p>
                <p className="mt-1 line-clamp-1 text-xs font-black text-slate-900 dark:text-white">
                  {product.productType ||
                    product.foodType ||
                    product.category ||
                    'Dairy & Grocery'}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-[#151D24]">
                <p className="text-[9px] font-medium uppercase tracking-wide text-slate-400">
                  Diet Preference
                </p>
                <p className="mt-1 line-clamp-1 text-xs font-black text-emerald-600 dark:text-emerald-400">
                  {product.dietPreference || '100% Vegetarian'}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-[#151D24]">
                <p className="text-[9px] font-medium uppercase tracking-wide text-slate-400">
                  Unit Pack
                </p>
                <p className="mt-1 line-clamp-1 text-xs font-black text-slate-900 dark:text-white">
                  {currentUnit}
                </p>
              </div>
            </div>

            {/* Dynamic Accordion Sections directly inline */}
            <div className="space-y-2">
              {dynamicSections.map((section) => {
                const isOpen =
                  openAccordions[section.id] ??
                  section.defaultExpanded;

                return (
                  <div
                    key={section.id}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition dark:border-slate-700/80 dark:bg-[#151D24]"
                  >
                    <button
                      onClick={() => toggleAccordion(section.id)}
                      className="flex w-full items-center justify-between p-3.5 text-left transition hover:bg-slate-50 dark:hover:bg-[#1A232C]"
                    >
                      <span className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        {section.title}
                      </span>

                      {isOpen ? (
                        <ChevronUp className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      )}
                    </button>

                    {isOpen && (
                      <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3 dark:border-slate-800 dark:bg-[#12181E]">
                        {(section.attributes || []).map((attribute) => (
                          <div
                            key={attribute.id}
                            className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5 last:border-0 dark:border-slate-800"
                          >
                            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              {attribute.label}
                            </span>

                            <span className="text-right text-[11px] font-bold text-slate-900 dark:text-white">
                              {attribute.value}{' '}
                              {attribute.unit && (
                                <span className="font-medium text-slate-400">
                                  {attribute.unit}
                                </span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>


          {/* Similar products */}
          {similarProducts.length > 0 && (
            <section className="space-y-3 pt-2">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-lg font-black tracking-tight text-slate-950 dark:text-white">
                    You may also like
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Similar products from PocketKirana
                  </p>
                </div>

                <button
                  onClick={() =>
                    router.push(
                      `/category/${
                        product.categoryId ||
                        product.category ||
                        'all'
                      }`
                    )
                  }
                  className="text-[11px] font-black text-emerald-600 dark:text-emerald-400"
                >
                  See all
                </button>
              </div>

              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                {similarProducts.map((similarProduct) => {
                  const similarKey = `${similarProduct.id}::default`;

                  const similarCartItem = cart.find(
                    (item) =>
                      item.id === similarKey ||
                      item.productId === similarProduct.id
                  );

                  const similarQty =
                    similarCartItem?.quantity || 0;

                  const similarDiscount =
                    similarProduct.mrp >
                    similarProduct.sellingPrice
                      ? Math.round(
                          ((similarProduct.mrp -
                            similarProduct.sellingPrice) /
                            similarProduct.mrp) *
                            100
                        )
                      : 0;

                  return (
                    <article
                      key={similarProduct.id}
                      className="w-[156px] shrink-0 rounded-[22px] border border-[#E3E8E3] bg-white p-2.5 dark:border-[#202A32] dark:bg-[#10171D]"
                    >
                      <button
                        onClick={() =>
                          router.push(
                            `/product/${similarProduct.id}`
                          )
                        }
                        className="block w-full text-left"
                      >
                        <div className="relative flex h-[125px] items-center justify-center rounded-[17px] bg-[#F5F7F5] p-3 dark:bg-[#151D24]">
                          {similarDiscount > 0 && (
                            <span className="absolute left-2 top-2 rounded-full bg-rose-500 px-2 py-1 text-[8px] font-black text-white">
                              {similarDiscount}% OFF
                            </span>
                          )}

                          <img
                            src={
                              similarProduct.thumbnail ||
                              (similarProduct as any).image ||
                              FALLBACK_IMAGE
                            }
                            alt={similarProduct.name}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>

                        <div className="mt-3">
                          <p className="line-clamp-2 text-[11px] font-black leading-tight text-slate-900 dark:text-white">
                            {similarProduct.name}
                          </p>

                          <p className="mt-1 text-[9px] font-medium text-slate-400">
                            {similarProduct.unit || '1 pack'}
                          </p>
                        </div>
                      </button>

                      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-800">
                        <div>
                          <p className="text-sm font-black text-slate-950 dark:text-white">
                            ₹{similarProduct.sellingPrice}
                          </p>

                          {similarProduct.mrp >
                            similarProduct.sellingPrice && (
                            <p className="text-[8px] text-slate-400 line-through">
                              ₹{similarProduct.mrp}
                            </p>
                          )}
                        </div>

                        {similarQty === 0 ? (
                          <button
                            onClick={() => {
                              addToCart(similarProduct, 1);
                              showToast(
                                `Added ${similarProduct.name} to cart`,
                                'success'
                              );
                            }}
                            className="rounded-xl bg-emerald-600 px-3 py-2 text-[10px] font-black text-white shadow-sm transition active:scale-95"
                          >
                            ADD
                          </button>
                        ) : (
                          <div className="flex items-center gap-1 rounded-xl border border-emerald-500 bg-emerald-50 p-1 dark:bg-emerald-950/40">
                            <button
                              onClick={() =>
                                updateCartQuantity(
                                  similarKey,
                                  similarQty - 1
                                )
                              }
                              className="flex h-6 w-6 items-center justify-center rounded-lg text-emerald-700 dark:text-white"
                            >
                              <Minus className="h-3 w-3" />
                            </button>

                            <span className="min-w-4 text-center text-[10px] font-black text-emerald-700 dark:text-white">
                              {similarQty}
                            </span>

                            <button
                              onClick={() =>
                                updateCartQuantity(
                                  similarKey,
                                  similarQty + 1
                                )
                              }
                              className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-600 text-white"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {/* Quality promise */}
          <section className="rounded-[24px] bg-[#0F2418] p-5 text-white dark:bg-[#10231A]">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                <Sparkles className="h-5 w-5 text-emerald-300" />
              </div>

              <div>
                <p className="text-sm font-black">
                  PocketKirana quality promise
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-white/60">
                  Carefully selected products delivered quickly from
                  your local store.
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-white/5 p-3">
                <Package className="mb-2 h-4 w-4 text-emerald-300" />
                <p className="text-[10px] font-bold">
                  Freshly packed
                </p>
              </div>

              <div className="rounded-2xl bg-white/5 p-3">
                <ShieldCheck className="mb-2 h-4 w-4 text-emerald-300" />
                <p className="text-[10px] font-bold">
                  Quality checked
                </p>
              </div>
            </div>
          </section>
        </main>

        {/* =========================================================
            STICKY CART BAR (docked directly above bottom navigation)
        ========================================================== */}
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-slate-200/80 bg-white/95 px-3 py-2.5 shadow-[0_-8px_25px_rgba(0,0,0,0.08)] backdrop-blur-xl dark:border-slate-800 dark:bg-[#0E141A]/95">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-bold text-slate-400">
                {currentUnit}
              </p>

              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black text-slate-950 dark:text-white">
                  ₹{effectivePrice}
                </span>

                {effectiveMrp > effectivePrice && (
                  <span className="text-[10px] text-slate-400 line-through">
                    ₹{effectiveMrp}
                  </span>
                )}
              </div>
            </div>

            {qtyInCart === 0 ? (
              <button
                onClick={handleAddToCart}
                className="flex min-h-12 min-w-[155px] items-center justify-center rounded-2xl bg-emerald-600 px-6 text-sm font-black text-white shadow-[0_8px_24px_rgba(5,150,105,0.28)] transition hover:bg-emerald-700 active:scale-[0.98]"
              >
                Add to cart
              </button>
            ) : (
              <div className="flex min-h-12 items-center gap-3 rounded-2xl border-2 border-emerald-500 bg-emerald-50 px-2 dark:bg-emerald-950/40">
                <button
                  onClick={() =>
                    handleUpdateQty(qtyInCart - 1)
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-slate-900 shadow-sm dark:bg-[#172019] dark:text-white"
                >
                  <Minus className="h-4 w-4" />
                </button>

                <span className="min-w-5 text-center text-sm font-black text-emerald-700 dark:text-emerald-300">
                  {qtyInCart}
                </span>

                <button
                  onClick={() =>
                    handleUpdateQty(qtyInCart + 1)
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* =========================================================
            DETAILS BOTTOM SHEET
        ========================================================== */}
        {showDetailsModal && (
          <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/60 backdrop-blur-sm">
            <button
              aria-label="Close details"
              className="absolute inset-0 cursor-default"
              onClick={() => setShowDetailsModal(false)}
            />

            <div className="relative max-h-[88vh] overflow-hidden rounded-t-[30px] bg-white shadow-2xl dark:bg-[#10171D]">
              <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-700" />

              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600">
                    Product information
                  </p>

                  <h2 className="mt-1 line-clamp-1 text-lg font-black text-slate-950 dark:text-white">
                    {product.name}
                  </h2>
                </div>

                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="overflow-y-auto px-4 py-4 pb-28">
                {/* Highlights */}
                <section className="mb-5">
                  <h3 className="mb-3 text-sm font-black text-slate-950 dark:text-white">
                    Highlights
                  </h3>

                  <div className="flex gap-2 overflow-x-auto scrollbar-none">
                    <div className="min-w-[120px] rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-[#171F26]">
                      <p className="text-[9px] uppercase tracking-wide text-slate-400">
                        Shelf life
                      </p>
                      <p className="mt-1 text-xs font-black text-slate-900 dark:text-white">
                        {product.shelfLife || '9 months'}
                      </p>
                    </div>

                    <div className="min-w-[120px] rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-[#171F26]">
                      <p className="text-[9px] uppercase tracking-wide text-slate-400">
                        Type
                      </p>
                      <p className="mt-1 line-clamp-1 text-xs font-black text-slate-900 dark:text-white">
                        {product.productType ||
                          product.foodType ||
                          product.category ||
                          'Grocery'}
                      </p>
                    </div>

                    {(product.dietPreference ||
                      product.foodType) && (
                      <div className="min-w-[120px] rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-[#171F26]">
                        <p className="text-[9px] uppercase tracking-wide text-slate-400">
                          Preference
                        </p>
                        <p className="mt-1 line-clamp-1 text-xs font-black text-emerald-600 dark:text-emerald-400">
                          {product.dietPreference ||
                            product.foodType}
                        </p>
                      </div>
                    )}
                  </div>
                </section>

                {/* Dynamic sections */}
                <section>
                  <h3 className="mb-3 text-sm font-black text-slate-950 dark:text-white">
                    All details
                  </h3>

                  <div className="space-y-2">
                    {dynamicSections.map((section) => {
                      const isOpen =
                        openAccordions[section.id] ??
                        section.defaultExpanded;

                      return (
                        <div
                          key={section.id}
                          className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-[#151D24]"
                        >
                          <button
                            onClick={() =>
                              toggleAccordion(section.id)
                            }
                            className="flex w-full items-center justify-between p-4 text-left"
                          >
                            <span className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white">
                              <span className="h-2 w-2 rounded-full bg-emerald-500" />
                              {section.title}
                            </span>

                            {isOpen ? (
                              <ChevronUp className="h-4 w-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-slate-400" />
                            )}
                          </button>

                          {isOpen && (
                            <div className="border-t border-slate-100 px-4 pb-4 dark:border-slate-800">
                              {(section.attributes || []).map(
                                (attribute) => (
                                  <div
                                    key={attribute.id}
                                    className="flex items-start justify-between gap-4 border-b border-slate-100 py-3 last:border-0 dark:border-slate-800"
                                  >
                                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                      {attribute.label}
                                    </span>

                                    <span className="text-right text-[11px] font-bold text-slate-900 dark:text-white">
                                      {attribute.value}{' '}
                                      {attribute.unit && (
                                        <span className="font-medium text-slate-400">
                                          {attribute.unit}
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>

              {/* Modal cart footer */}
              <div className="absolute inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 p-3 backdrop-blur-xl dark:border-slate-800 dark:bg-[#10171D]/95">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-[9px] text-slate-400">
                      {currentUnit}
                    </p>
                    <p className="text-lg font-black text-slate-950 dark:text-white">
                      ₹{effectivePrice}
                    </p>
                  </div>

                  {qtyInCart === 0 ? (
                    <button
                      onClick={handleAddToCart}
                      className="rounded-2xl bg-emerald-600 px-6 py-3 text-xs font-black text-white"
                    >
                      Add to cart
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-1.5 dark:bg-emerald-950/40">
                      <button
                        onClick={() =>
                          handleUpdateQty(qtyInCart - 1)
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-xl bg-white dark:bg-[#172019]"
                      >
                        <Minus className="h-4 w-4" />
                      </button>

                      <span className="min-w-5 text-center text-xs font-black">
                        {qtyInCart}
                      </span>

                      <button
                        onClick={() =>
                          handleUpdateQty(qtyInCart + 1)
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </CustomerShell>
  );
}
