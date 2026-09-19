'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import CustomerShell from '../../../components/CustomerShell';
import { 
  ArrowLeft, 
  Search, 
  Share2, 
  Star, 
  Clock, 
  Zap, 
  ChevronRight, 
  Plus, 
  Minus, 
  Check, 
  ChevronDown,
  ChevronUp,
  Info,
  Sparkles,
  Award,
  Package,
  X
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';
import type { Product, ProductVariant } from '@/types';
import { normalizeProductSections, sanitizeVisibleSectionsForCustomer } from '@/lib/productSectionUtils';

export default function ProductDetailClient() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const params = useParams();
  const idOrSlug = (params?.id as string) || '';

  const { products, cart, addToCart, updateCartQuantity } = useAppStore();

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [openAccordions, setOpenAccordions] = useState<{ [key: string]: boolean }>({});
  const [apiProduct, setApiProduct] = useState<Product | null>(null);

  const toggleAccordion = (key: string) => {
    setOpenAccordions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const detailsSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    if (idOrSlug) {
      fetch(`/api/v1/products/${idOrSlug}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.data) {
            setApiProduct(data.data);
          }
        })
        .catch(() => {});
    }
  }, [idOrSlug]);

  // Authoritative products
  const allProducts = useMemo(() => {
    return (products || []).filter((p) => p.status !== 'discontinued');
  }, [products]);

  const product = useMemo(() => {
    if (apiProduct && (apiProduct.id === idOrSlug || apiProduct.slug === idOrSlug)) {
      return apiProduct;
    }
    return allProducts.find((p) => p.id === idOrSlug || p.slug === idOrSlug) || null;
  }, [allProducts, idOrSlug, apiProduct]);

  const dynamicSections = useMemo(() => {
    return sanitizeVisibleSectionsForCustomer(normalizeProductSections(product));
  }, [product]);

  const variants = product?.variants || [];
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | undefined>(undefined);

  useEffect(() => {
    if (variants.length > 0 && !selectedVariant) {
      setSelectedVariant(variants[0]);
    }
  }, [variants, selectedVariant]);

  // Similar Products in the same category
  const similarProducts = useMemo(() => {
    if (!product) return [];
    return allProducts
      .filter((p) => p.id !== product.id && ((product.categoryId && p.categoryId === product.categoryId) || (product.category && p.category === product.category) || p.brandId === product.brandId))
      .slice(0, 6);
  }, [allProducts, product]);

  // Multi-image list for carousel — Dynamic multi-photo with deduplication & display limit support
  const images = useMemo(() => {
    if (!product) return [];
    const list: string[] = [];
    if (product.thumbnail) list.push(product.thumbnail);
    if ((product as any).image && !list.includes((product as any).image)) list.push((product as any).image);
    if (product.images && Array.isArray(product.images) && product.images.length > 0) {
      product.images.forEach((img) => {
        if (img && !list.includes(img)) list.push(img);
      });
    }
    if (list.length === 0) {
      list.push('https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80');
    }
    // Respect admin display limit if set
    if (product.maxDisplayImages && product.maxDisplayImages > 0) {
      return list.slice(0, product.maxDisplayImages);
    }
    return list;
  }, [product]);  if (!mounted) {
    return (
      <CustomerShell title="Product Details" hideBottomNav>
        <div className="min-h-screen bg-white dark:bg-[#0B0F14] p-4 space-y-4 animate-pulse">
          <div className="h-80 bg-slate-200 dark:bg-[#151B23] rounded-3xl" />
          <div className="h-40 bg-slate-200 dark:bg-[#151B23] rounded-3xl" />
          <div className="h-20 bg-slate-200 dark:bg-[#151B23] rounded-3xl" />
        </div>
      </CustomerShell>
    );
  }

  if (!product) {
    return (
      <CustomerShell title="Product Not Found" hideBottomNav>
        <div className="min-h-[70vh] bg-white dark:bg-[#0B0F14] flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
            <Package className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-black text-slate-900 dark:text-white">Product Not Found</h2>
            <p className="text-xs text-slate-500 max-w-xs">
              The item you are looking for is currently unavailable or may have been removed.
            </p>
          </div>
          <button
            onClick={() => router.push('/categories')}
            className="bg-[#008F5A] hover:bg-[#007044] text-white text-xs font-black px-5 py-2.5 rounded-xl transition-all shadow-md cursor-pointer"
          >
            Browse Products
          </button>
        </div>
      </CustomerShell>
    );
  }

  const effectivePrice = selectedVariant ? selectedVariant.sellingPrice : product.sellingPrice;
  const effectiveMrp = selectedVariant ? selectedVariant.mrp : product.mrp;
  const discountPercent = effectiveMrp > effectivePrice ? Math.round(((effectiveMrp - effectivePrice) / effectiveMrp) * 100) : 0;
  const currentUnit = selectedVariant ? selectedVariant.variantName : (product.unit || '1 pack');

  // Calculate per 100g / 100ml price
  const calculatePer100 = () => {
    const unitStr = currentUnit.toLowerCase();
    const match = unitStr.match(/(\d+(\.\d+)?)\s*(g|gm|gram|ml|l|kg|ltr|liter)/);
    if (!match) return null;
    let qty = parseFloat(match[1]);
    const u = match[3];
    if (u === 'kg' || u === 'l' || u === 'ltr' || u === 'liter') {
      qty = qty * 1000;
    }
    if (qty > 0) {
      const per100 = (effectivePrice / qty) * 100;
      const unitLabel = (u === 'ml' || u === 'l' || u === 'ltr' || u === 'liter') ? '100 ml' : '100 g';
      return `₹${per100.toFixed(1)}/${unitLabel}`;
    }
    return null;
  };

  const per100Text = calculatePer100();

  // (images useMemo moved above early return — see above)

  const itemKey = `${product.id}::${selectedVariant?.id || 'default'}`;
  const cartItem = cart.find((i) => i.id === itemKey || (i.productId === product.id && !selectedVariant));
  const qtyInCart = cartItem ? cartItem.quantity : 0;

  const handleAddToCart = () => {
    addToCart(product, 1, selectedVariant);
    showToast(`Added ${product.name} to cart 🛒`, 'success');
  };

  const handleUpdateQty = (newQty: number) => {
    updateCartQuantity(itemKey, newQty);
  };

  const handleShare = async () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.name,
          text: `Check out ${product.name} on PocketKirana!`,
          url: url,
        });
        return;
      } catch (e) {
        // User cancelled or unsupported
      }
    }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      showToast('Product link copied to clipboard! 📋', 'info');
    }
  };

  const scrollToDetails = () => {
    detailsSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <CustomerShell title={product.name} hideBottomNav noPadding>
      <div className="min-h-screen w-full bg-white dark:bg-[#0B0F14] text-[#111827] dark:text-[#F9FAFB] pb-24 selection:bg-emerald-500 selection:text-white font-sans transition-colors duration-200">
        
        {/* ── 1. PRODUCT IMAGE SHOWCASE & FLOATING ACTION BUTTONS ── */}
        <div className="relative bg-slate-50 dark:bg-[#151B23] rounded-b-2xl overflow-hidden border-b border-[#E5E7EB] dark:border-[#263241] shadow-xs">
          
          {/* Floating Navigation Controls */}
          <div className="absolute top-3 inset-x-3 z-20 flex items-center justify-between pointer-events-none">
            {/* Back Button */}
            <button
              onClick={() => router.back()}
              aria-label="Go Back"
              className="pointer-events-auto w-9 h-9 rounded-full bg-white/90 dark:bg-black/60 hover:bg-white dark:hover:bg-black/80 backdrop-blur-md text-[#111827] dark:text-white flex items-center justify-center shadow-md transition-all active:scale-90 cursor-pointer border border-[#E5E7EB] dark:border-white/10"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
            </button>

            {/* Right Icons: Search & Share */}
            <div className="flex items-center gap-2 pointer-events-auto">
              <button
                onClick={() => router.push('/search')}
                aria-label="Search"
                className="w-9 h-9 rounded-full bg-white/90 dark:bg-black/60 hover:bg-white dark:hover:bg-black/80 backdrop-blur-md text-[#111827] dark:text-white flex items-center justify-center shadow-md transition-all active:scale-90 cursor-pointer border border-[#E5E7EB] dark:border-white/10"
              >
                <Search className="w-4 h-4 stroke-[2.2]" />
              </button>
              <button
                onClick={handleShare}
                aria-label="Share"
                className="w-9 h-9 rounded-full bg-white/90 dark:bg-black/60 hover:bg-white dark:hover:bg-black/80 backdrop-blur-md text-[#111827] dark:text-white flex items-center justify-center shadow-md transition-all active:scale-90 cursor-pointer border border-[#E5E7EB] dark:border-white/10"
              >
                <Share2 className="w-4 h-4 stroke-[2.2]" />
              </button>
            </div>
          </div>

          {/* Main Product Image Container */}
          <div className="w-full h-[240px] sm:h-[280px] flex items-center justify-center p-4 pt-10 relative">
            <img
              key={`img-view-${activeImageIndex}`}
              src={images[activeImageIndex]}
              alt={product.name}
              className="max-h-full max-w-full object-contain drop-shadow-sm transition-all duration-300 animate-in fade-in zoom-in-95"
            />

            {/* Veg Category Badge Indicator (Bottom Right) */}
            <div className="absolute bottom-3 right-3 z-10 bg-white dark:bg-[#111827] p-1 rounded border border-emerald-600 shadow-xs flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-emerald-600" />
            </div>

            {/* Carousel Dot Indicators */}
            {images.length > 1 && (
              <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10 bg-black/20 dark:bg-black/40 backdrop-blur-xs px-2.5 py-1 rounded-full">
                {images.map((_, idx) => (
                  <button
                    key={`dot-${idx}`}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`transition-all rounded-full ${
                      activeImageIndex === idx
                        ? 'w-4 h-1 bg-emerald-500'
                        : 'w-1 h-1 bg-slate-400 hover:bg-slate-300'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── SHELF LIFE & VIEW DETAILS CONTRAST BANNER ── */}
          <div className="bg-slate-100/90 dark:bg-[#111827] border-t border-[#E5E7EB] dark:border-[#263241] px-4 py-2 flex items-center justify-between text-[#111827] dark:text-white">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500 dark:text-[#9CA3AF] font-medium">Shelf Life:</span>
              <strong className="text-xs font-bold text-[#111827] dark:text-[#F9FAFB]">
                {product.shelfLife || '9 months'}
              </strong>
            </div>

            <button
              onClick={() => setShowDetailsModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-[11px] px-3 py-1 rounded-lg transition-all shadow-xs cursor-pointer flex items-center gap-1"
            >
              <span>View details</span>
            </button>
          </div>

        </div>

        {/* ── 2. MAIN PRODUCT INFO CARD ── */}
        <div className="p-3 space-y-2.5">
          
          <div className="bg-white dark:bg-[#151B23] border border-[#E5E7EB] dark:border-[#263241] rounded-2xl p-3.5 space-y-2.5 shadow-xs">
            
            {/* Delivery Time & Rating Row */}
            <div className="flex items-center gap-2 text-[11px] font-bold">
              <div className="flex items-center gap-1 text-slate-700 dark:text-[#D1D5DB] bg-slate-100 dark:bg-[#111827] px-2 py-0.5 rounded-full border border-[#E5E7EB] dark:border-[#263241]">
                <Clock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span className="text-[10px]">30 mins</span>
              </div>

              <div className="h-3 w-px bg-slate-200 dark:bg-[#263241]" />

              <div className="flex items-center gap-1 text-amber-500">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <span className="text-slate-500 dark:text-[#9CA3AF] text-[10px] font-medium ml-0.5">21,132</span>
              </div>
            </div>

            {/* Product Title & Unit */}
            <div className="space-y-0.5">
              <h1 className="text-base sm:text-lg font-bold text-[#111827] dark:text-[#F9FAFB] leading-tight tracking-tight">
                {product.name}
              </h1>
              <span className="text-xs font-semibold text-slate-500 dark:text-[#9CA3AF] block font-mono">
                {currentUnit}
              </span>
            </div>

            {/* Pricing Details */}
            <div className="space-y-0.5 pt-0.5">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-[#111827] dark:text-[#F9FAFB] font-mono tracking-tight">
                  ₹{effectivePrice}
                </span>
                {effectiveMrp > effectivePrice && (
                  <span className="text-xs font-semibold text-slate-400 dark:text-[#9CA3AF] line-through font-mono">
                    MRP ₹{effectiveMrp}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                {discountPercent > 0 && (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-sky-400 uppercase tracking-wider">
                    {discountPercent}% OFF on MRP
                  </span>
                )}
                {per100Text && (
                  <span className="text-[10px] font-medium text-slate-500 dark:text-[#9CA3AF] font-mono">
                    {per100Text}
                  </span>
                )}
              </div>
            </div>

            {/* Pack Size / Variant Selector (if variants present) */}
            {variants.length > 0 && (
              <div className="pt-2 border-t border-slate-100 dark:border-[#263241] space-y-2">
                <span className="text-[10px] font-bold text-slate-500 dark:text-[#9CA3AF] block uppercase tracking-wider">
                  Select Unit
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {variants.map((v) => {
                    const isSelected = selectedVariant?.id === v.id;
                    const vDiscount = v.mrp > v.sellingPrice ? Math.round(((v.mrp - v.sellingPrice) / v.mrp) * 100) : 0;
                    // Per-unit cost calculation
                    const vuStr = v.variantName.toLowerCase();
                    const vuMatch = vuStr.match(/(\d+(\.\d+)?)\s*(g|gm|gram|ml|l|kg|ltr|liter)/);
                    let vPerUnit: string | null = null;
                    if (vuMatch) {
                      let qty = parseFloat(vuMatch[1]);
                      const u = vuMatch[3];
                      if (u === 'kg' || u === 'l' || u === 'ltr' || u === 'liter') qty *= 1000;
                      if (qty > 0) {
                        const per = (v.sellingPrice / qty) * 100;
                        const uLabel = (u === 'ml' || u === 'l' || u === 'ltr' || u === 'liter') ? '100ml' : '100g';
                        vPerUnit = `₹${per.toFixed(1)}/${uLabel}`;
                      }
                    }
                    return (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVariant(v)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer active:scale-[0.98] ${
                          isSelected
                            ? 'bg-emerald-500/10 dark:bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500'
                            : 'bg-slate-50 dark:bg-[#111827] border-[#E5E7EB] dark:border-[#263241] hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        {/* Weight / variant name */}
                        <span className={`text-xs font-bold block ${ isSelected ? 'text-[#111827] dark:text-white' : 'text-slate-800 dark:text-slate-200' }`}>
                          {v.variantName}
                        </span>
                        {/* Price row */}
                        <div className="mt-0.5 flex items-baseline gap-1.5 font-mono">
                          <span className={`text-sm font-black ${ isSelected ? 'text-emerald-700 dark:text-white' : 'text-[#111827] dark:text-slate-100' }`}>
                            ₹{v.sellingPrice}
                          </span>
                          {v.mrp > v.sellingPrice && (
                            <span className="text-[10px] text-slate-400 dark:text-[#9CA3AF] line-through">₹{v.mrp}</span>
                          )}
                        </div>
                        {/* Discount */}
                        {vDiscount > 0 && (
                          <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                            {vDiscount}% OFF on MRP
                          </span>
                        )}
                        {/* Per-unit cost */}
                        {vPerUnit && (
                          <span className="text-[9px] text-slate-400 dark:text-[#9CA3AF] font-medium font-mono block">
                            {vPerUnit}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

          </div>

          {/* ── 3. BRAND ROW CARD ── */}
          <div 
            onClick={() => router.push(`/search?q=${encodeURIComponent(product.brandName || product.categoryId || product.category || '')}`)}
            className="bg-white dark:bg-[#151B23] hover:bg-slate-50 dark:hover:bg-[#1B2430] border border-[#E5E7EB] dark:border-[#263241] rounded-2xl p-2.5 px-3 flex items-center justify-between shadow-xs transition-all active:scale-[0.99] cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white p-1.5 flex items-center justify-center shrink-0 shadow-inner">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-tighter text-center leading-none">
                  {product.brandName ? product.brandName.slice(0, 6) : 'BRAND'}
                </span>
              </div>
              <div>
                <strong className="text-xs font-bold text-[#111827] dark:text-[#F9FAFB] block">
                  {product.brandName || 'Pocket Kirana Certified'}
                </strong>
                <span className="text-[10px] text-slate-500 dark:text-[#9CA3AF] font-medium">Explore all products</span>
              </div>
            </div>

            <ChevronRight className="w-4 h-4 text-slate-400 dark:text-[#9CA3AF]" />
          </div>

          {/* ── 5. SIMILAR PRODUCTS HORIZONTAL CAROUSEL ── */}
          {similarProducts.length > 0 && (
            <div className="pt-1.5 space-y-2">
              <div className="flex items-center justify-between px-0.5">
                <h3 className="text-xs font-bold text-[#111827] dark:text-[#F9FAFB] tracking-tight">Similar products</h3>
                <button
                  onClick={() => router.push(`/category/${product.categoryId || product.category || 'all'}`)}
                  className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 cursor-pointer"
                >
                  See all
                </button>
              </div>

              <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none snap-x">
                {similarProducts.map((sp) => {
                  const spKey = `${sp.id}::default`;
                  const spInCart = cart.find((i) => i.id === spKey || i.productId === sp.id);
                  const spQty = spInCart ? spInCart.quantity : 0;
                  const spDiscount = sp.mrp > sp.sellingPrice ? Math.round(((sp.mrp - sp.sellingPrice) / sp.mrp) * 100) : 0;

                  return (
                    <div
                      key={sp.id}
                      className="w-32 shrink-0 bg-white dark:bg-[#151B23] border border-[#E5E7EB] dark:border-[#263241] rounded-xl p-2.5 flex flex-col justify-between snap-start shadow-xs"
                    >
                      <div 
                        onClick={() => router.push(`/product/${sp.id}`)}
                        className="cursor-pointer space-y-1.5"
                      >
                        <div className="w-full h-20 bg-slate-50 dark:bg-[#111827] rounded-lg p-1.5 flex items-center justify-center relative overflow-hidden border border-slate-100 dark:border-[#263241]">
                          {spDiscount > 0 && (
                            <span className="absolute top-1 left-1 bg-rose-600 text-white text-[8px] font-black px-1 py-0.5 rounded shadow-xs">
                              {spDiscount}% OFF
                            </span>
                          )}
                          <img
                            src={sp.thumbnail || (sp as any).image || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=200&q=80'}
                            alt={sp.name}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>

                        <div className="space-y-0.5">
                          <strong className="text-[11px] font-bold text-[#111827] dark:text-[#F9FAFB] line-clamp-1 block">
                            {sp.name}
                          </strong>
                          <span className="text-[9px] text-slate-500 dark:text-[#9CA3AF] block font-mono">
                            {sp.unit}
                          </span>
                        </div>
                      </div>

                      <div className="pt-1.5 flex items-center justify-between border-t border-slate-100 dark:border-[#263241] mt-1.5">
                        <div className="font-mono">
                          <span className="text-[11px] font-bold text-[#111827] dark:text-[#F9FAFB]">₹{sp.sellingPrice}</span>
                          {sp.mrp > sp.sellingPrice && (
                            <span className="text-[8px] text-slate-400 dark:text-[#9CA3AF] line-through block">₹{sp.mrp}</span>
                          )}
                        </div>

                        {spQty === 0 ? (
                          <button
                            onClick={() => {
                              addToCart(sp, 1);
                              showToast(`Added ${sp.name} to cart`, 'success');
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg transition-all shadow-xs cursor-pointer"
                          >
                            ADD
                          </button>
                        ) : (
                          <div className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950 border border-emerald-500 rounded-lg px-1 py-0.5">
                            <button
                              onClick={() => updateCartQuantity(spKey, spQty - 1)}
                              className="w-4 h-4 flex items-center justify-center text-emerald-800 dark:text-white hover:bg-emerald-100 dark:hover:bg-emerald-800 rounded cursor-pointer"
                            >
                              <Minus className="w-2.5 h-2.5" />
                            </button>
                            <span className="text-[10px] font-bold font-mono text-emerald-700 dark:text-emerald-400 px-0.5">{spQty}</span>
                            <button
                              onClick={() => updateCartQuantity(spKey, spQty + 1)}
                              className="w-4 h-4 flex items-center justify-center text-emerald-800 dark:text-white hover:bg-emerald-100 dark:hover:bg-emerald-800 rounded cursor-pointer"
                            >
                              <Plus className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* ── 6. STICKY BOTTOM BAR ── */}
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md border-t border-[#E5E7EB] dark:border-[#263241] px-4 py-2.5 shadow-2xl flex items-center justify-between">
          
          {/* Left Pricing Details */}
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-slate-500 dark:text-[#9CA3AF] block font-mono">
              {currentUnit}
            </span>
            <div className="flex items-baseline gap-1.5">
              <strong className="text-lg font-black text-[#111827] dark:text-[#F9FAFB] font-mono tracking-tight">
                ₹{effectivePrice}
              </strong>
              {effectiveMrp > effectivePrice && (
                <span className="text-[10px] font-semibold text-slate-400 dark:text-[#9CA3AF] line-through font-mono">
                  MRP ₹{effectiveMrp}
                </span>
              )}
            </div>
            <span className="text-[9px] text-slate-400 dark:text-[#9CA3AF] block font-medium">
              Inclusive of all taxes
            </span>
          </div>

          {/* Right Action: Add to Cart Button or Stepper */}
          <div>
            {qtyInCart === 0 ? (
              <button
                onClick={handleAddToCart}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-6 sm:px-8 py-2.5 rounded-xl shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Add to cart</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-500 rounded-xl p-1 px-2.5 shadow-sm">
                <button
                  onClick={() => handleUpdateQty(qtyInCart - 1)}
                  className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-[#18181B] hover:bg-slate-300 dark:hover:bg-slate-800 text-[#111827] dark:text-white flex items-center justify-center font-bold transition-colors cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono font-bold text-emerald-800 dark:text-white text-sm px-1">{qtyInCart}</span>
                <button
                  onClick={() => handleUpdateQty(qtyInCart + 1)}
                  className="w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center font-bold transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

        </div>

        {/* ── 7. HALF-SCREEN PRODUCT DETAILS BOTTOM SHEET MODAL ── */}
        {showDetailsModal && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            {/* Click outside backdrop to close */}
            <div className="flex-1" onClick={() => setShowDetailsModal(false)} />

            {/* Floating Top Close Button above Bottom Sheet */}
            <div className="flex justify-center pb-2.5">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="w-9 h-9 rounded-full bg-white dark:bg-[#202026] hover:bg-slate-100 dark:hover:bg-[#2B2B34] border border-[#E5E7EB] dark:border-white/20 text-[#111827] dark:text-white flex items-center justify-center shadow-2xl active:scale-90 transition-all cursor-pointer"
                aria-label="Close details"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {/* Bottom Sheet Drawer */}
            <div className="bg-white dark:bg-[#18181F] rounded-t-3xl border-t border-[#E5E7EB] dark:border-slate-700/60 overflow-hidden flex flex-col max-h-[80vh] shadow-2xl animate-in slide-in-from-bottom-6 duration-200">
              
              {/* Product Header (Details Only - No Image) */}
              <div className="p-3.5 px-4 bg-white dark:bg-[#18181F] border-b border-slate-100 dark:border-slate-800/80 shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/50">
                      Product Details
                    </span>
                    <h2 className="text-sm sm:text-base font-bold text-[#111827] dark:text-white leading-snug mt-1">
                      {product.name}
                    </h2>
                  </div>
                </div>
              </div>

              {/* Scrollable Specifications Content inside bottom sheet */}
              <div className="overflow-y-auto px-4 py-3 space-y-3.5 text-xs text-[#111827] dark:text-white pb-5 scrollbar-thin">
                
                {/* 1. Highlights Section */}
                <div className="space-y-1.5">
                  <h3 className="text-xs font-bold text-[#111827] dark:text-white tracking-tight">Highlights</h3>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {/* Shelf Life Pill */}
                    <div className="bg-slate-100 dark:bg-[#24242C] border border-[#E5E7EB] dark:border-slate-700/60 rounded-xl p-2 px-3 min-w-[85px] shrink-0">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block">Shelf Life</span>
                      <strong className="text-[11px] font-bold text-[#111827] dark:text-slate-100 block mt-0.5">
                        {product.shelfLife || '90 days'}
                      </strong>
                    </div>

                    {/* Product / Atta Type Pill */}
                    <div className="bg-slate-100 dark:bg-[#24242C] border border-[#E5E7EB] dark:border-slate-700/60 rounded-xl p-2 px-3 min-w-[95px] shrink-0">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block">
                        {product.categoryId?.includes('atta') || product.name.toLowerCase().includes('atta') ? 'Atta Type' : 'Type'}
                      </span>
                      <strong className="text-[11px] font-bold text-[#111827] dark:text-slate-100 block mt-0.5">
                        {product.productType || product.foodType || 'Sehori Atta'}
                      </strong>
                    </div>

                    {/* Diet Preference Pill */}
                    {(product.dietPreference || product.foodType) && (
                      <div className="bg-slate-100 dark:bg-[#24242C] border border-[#E5E7EB] dark:border-slate-700/60 rounded-xl p-2 px-3 min-w-[95px] shrink-0">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block">Diet Preference</span>
                        <strong className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                          {product.dietPreference || product.foodType || 'High Fiber'}
                        </strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. All Details Section (Dynamic Accordions) */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-[#111827] dark:text-white tracking-tight">All details</h3>

                  {dynamicSections.map((sec) => {
                    const isSecOpen = openAccordions[sec.id] ?? sec.defaultExpanded;
                    return (
                      <div
                        key={sec.id}
                        className="bg-slate-50 dark:bg-[#24242C] border border-[#E5E7EB] dark:border-slate-700/60 rounded-xl overflow-hidden shadow-xs transition-all"
                      >
                        <button
                          onClick={() => toggleAccordion(sec.id)}
                          className="w-full p-3 flex items-center justify-between text-left font-bold text-[#111827] dark:text-white text-xs cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {sec.title}
                          </span>
                          {isSecOpen ? (
                            <ChevronUp className="w-3.5 h-3.5 text-slate-500 dark:text-slate-300" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </button>

                        {isSecOpen && (
                          <div className="px-3 pb-3 border-t border-slate-200 dark:border-slate-700/40 pt-2 space-y-1.5 text-xs">
                            {(sec.attributes || []).map((attr) => (
                              <div
                                key={attr.id}
                                className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-700/20 last:border-0"
                              >
                                <span className="text-slate-700 dark:text-slate-300 font-medium text-[11px]">{attr.label}</span>
                                <span className="text-slate-800 dark:text-slate-200 font-mono font-medium text-[11px] text-right">
                                  {attr.value} {attr.unit ? <span className="text-slate-400 font-sans">{attr.unit}</span> : null}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

              </div>

              {/* Sticky Bottom Bar inside Bottom Sheet Modal */}
              <div className="p-3 px-4 bg-white dark:bg-[#18181F] border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-300 block font-mono">{currentUnit}</span>
                  <div className="flex items-baseline gap-1.5">
                    <strong className="text-base font-black text-[#111827] dark:text-white font-mono tracking-tight">₹{effectivePrice}</strong>
                    {effectiveMrp > effectivePrice && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 line-through font-mono">MRP ₹{effectiveMrp}</span>
                    )}
                  </div>
                  <span className="text-[9px] text-slate-400 block font-medium">Inclusive of all taxes</span>
                </div>

                <div>
                  {qtyInCart === 0 ? (
                    <button
                      onClick={handleAddToCart}
                      className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md cursor-pointer"
                    >
                      Add to cart
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-500 rounded-xl p-1 px-2 shadow-md">
                      <button onClick={() => handleUpdateQty(qtyInCart - 1)} className="w-6 h-6 rounded-lg bg-slate-200 dark:bg-[#18181B] text-[#111827] dark:text-white flex items-center justify-center font-bold cursor-pointer">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-mono font-bold text-emerald-800 dark:text-white text-xs px-1">{qtyInCart}</span>
                      <button onClick={() => handleUpdateQty(qtyInCart + 1)} className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold cursor-pointer">
                        <Plus className="w-3 h-3" />
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
