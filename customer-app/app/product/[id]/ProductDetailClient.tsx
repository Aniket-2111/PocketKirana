'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import CustomerShell from '../../../components/CustomerShell';
import { INITIAL_PRODUCTS } from '@/lib/mockData';
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

export default function ProductDetailClient() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const params = useParams();
  const idOrSlug = (params?.id as string) || '';

  const { products, cart, addToCart, updateCartQuantity } = useAppStore();

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [openAccordions, setOpenAccordions] = useState<{ [key: string]: boolean }>({
    keyInfo: true,
    nutrition: false,
    info: false,
  });

  const toggleAccordion = (key: string) => {
    setOpenAccordions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const detailsSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Combine products with fallback mock data
  const allProducts = useMemo(() => {
    const map = new Map<string, Product>();
    INITIAL_PRODUCTS.forEach((p) => map.set(p.id, p));
    (products || []).forEach((p) => {
      const existing = map.get(p.id);
      map.set(p.id, { ...existing, ...p });
    });
    return Array.from(map.values()).filter((p) => p.status !== 'discontinued');
  }, [products]);

  const product = useMemo(() => {
    return allProducts.find((p) => p.id === idOrSlug || p.slug === idOrSlug) || allProducts[0];
  }, [allProducts, idOrSlug]);

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

  // Multi-image list for carousel — must be before any early return
  const images = useMemo(() => {
    if (!product) return [];
    const list = [
      product.thumbnail || (product as any).image || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
    ];
    if (product.images && product.images.length > 0) {
      product.images.forEach((img) => {
        if (!list.includes(img)) list.push(img);
      });
    }
    // If only 1 image, add packaging/nutritional views for carousel feel
    if (list.length === 1) {
      list.push(
        'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80'
      );
    }
    return list;
  }, [product]);

  if (!mounted || !product) {
    return (
      <CustomerShell title="Product Details" hideBottomNav>
        <div className="min-h-screen bg-[#121215] p-4 space-y-4 animate-pulse">
          <div className="h-80 bg-slate-800/60 rounded-3xl" />
          <div className="h-40 bg-slate-800/60 rounded-3xl" />
          <div className="h-20 bg-slate-800/60 rounded-3xl" />
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
    <CustomerShell title={product.name} hideBottomNav>
      <div className="min-h-screen bg-[#121215] text-white pb-32 selection:bg-emerald-500 selection:text-white font-sans">
        
        {/* ── 1. PRODUCT IMAGE SHOWCASE & FLOATING ACTION BUTTONS ── */}
        <div className="relative bg-[#FFFFFF] rounded-b-[36px] overflow-hidden shadow-2xl">
          
          {/* Floating Navigation Controls */}
          <div className="absolute top-4 inset-x-4 z-20 flex items-center justify-between pointer-events-none">
            {/* Back Button */}
            <button
              onClick={() => router.back()}
              aria-label="Go Back"
              className="pointer-events-auto w-11 h-11 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-md text-white flex items-center justify-center shadow-lg transition-all active:scale-90 cursor-pointer border border-white/10"
            >
              <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
            </button>

            {/* Right Icons: Search & Share */}
            <div className="flex items-center gap-2.5 pointer-events-auto">
              <button
                onClick={() => router.push('/search')}
                aria-label="Search"
                className="w-11 h-11 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-md text-white flex items-center justify-center shadow-lg transition-all active:scale-90 cursor-pointer border border-white/10"
              >
                <Search className="w-5 h-5 stroke-[2.2]" />
              </button>
              <button
                onClick={handleShare}
                aria-label="Share"
                className="w-11 h-11 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-md text-white flex items-center justify-center shadow-lg transition-all active:scale-90 cursor-pointer border border-white/10"
              >
                <Share2 className="w-5 h-5 stroke-[2.2]" />
              </button>
            </div>
          </div>

          {/* Main Product Image Container */}
          <div className="w-full h-[360px] sm:h-[420px] flex items-center justify-center p-6 pt-16 relative">
            <img
              key={`img-view-${activeImageIndex}`}
              src={images[activeImageIndex]}
              alt={product.name}
              className="max-h-full max-w-full object-contain drop-shadow-md transition-all duration-300 animate-in fade-in zoom-in-95"
            />

            {/* Veg Category Badge Indicator (Bottom Right) */}
            <div className="absolute bottom-5 right-5 z-10 bg-white/95 p-1 rounded-md border border-emerald-600 shadow-sm flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
            </div>

            {/* Carousel Dot Indicators */}
            {images.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10 bg-black/20 backdrop-blur-xs px-3 py-1.5 rounded-full">
                {images.map((_, idx) => (
                  <button
                    key={`dot-${idx}`}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`transition-all rounded-full ${
                      activeImageIndex === idx
                        ? 'w-5 h-1.5 bg-emerald-500'
                        : 'w-1.5 h-1.5 bg-slate-400 hover:bg-slate-300'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── SHELF LIFE & VIEW DETAILS CONTRAST BANNER ── */}
          <div className="bg-[#1C1C22] border-t border-slate-800 px-5 py-3 flex items-center justify-between text-white">
            <div>
              <span className="text-[11px] text-slate-400 font-medium block">Shelf Life</span>
              <strong className="text-sm font-black text-slate-100">
                {product.shelfLife || '9 months'}
              </strong>
            </div>

            <button
              onClick={() => setShowDetailsModal(true)}
              className="bg-[#16A34A] hover:bg-[#15803D] active:scale-95 text-white font-black text-xs px-4 py-2 rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1"
            >
              <span>View details</span>
            </button>
          </div>

        </div>

        {/* ── 2. MAIN PRODUCT INFO CARD (DARK THEME REFERENCE) ── */}
        <div className="p-4 space-y-3.5">
          
          <div className="bg-[#1C1C22] border border-slate-800/80 rounded-3xl p-5 space-y-4 shadow-lg">
            
            {/* Delivery Time & Rating Row */}
            <div className="flex items-center gap-3 text-xs font-bold">
              <div className="flex items-center gap-1.5 text-slate-300 bg-slate-800/70 px-2.5 py-1 rounded-full border border-slate-700/60">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>9 mins</span>
              </div>

              <div className="h-3.5 w-px bg-slate-700" />

              <div className="flex items-center gap-1 text-amber-400">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <span className="text-slate-400 text-[11px] font-medium ml-1">21,132</span>
              </div>
            </div>

            {/* Product Title & Unit */}
            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-black text-white leading-snug tracking-tight">
                {product.name}
              </h1>
              <span className="text-sm font-bold text-slate-400 block font-mono">
                {currentUnit}
              </span>
            </div>

            {/* Pricing Details */}
            <div className="space-y-1 pt-1">
              <div className="flex items-baseline gap-2.5">
                <span className="text-3xl font-black text-white font-mono tracking-tight">
                  ₹{effectivePrice}
                </span>
                {effectiveMrp > effectivePrice && (
                  <span className="text-sm font-bold text-slate-400 line-through font-mono">
                    MRP ₹{effectiveMrp}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                {discountPercent > 0 && (
                  <span className="text-xs font-black text-[#38BDF8] uppercase tracking-wider">
                    {discountPercent}% OFF on MRP
                  </span>
                )}
                {per100Text && (
                  <span className="text-xs font-bold text-slate-400 font-mono">
                    {per100Text}
                  </span>
                )}
              </div>
            </div>

            {/* Pack Size / Variant Selector (if variants present) */}
            {variants.length > 0 && (
              <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
                <span className="text-xs font-bold text-slate-300 block uppercase tracking-wider text-[11px]">
                  Select Unit
                </span>
                <div className="grid grid-cols-2 gap-2.5">
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
                        className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer active:scale-[0.97] ${
                          isSelected
                            ? 'bg-emerald-950/50 border-emerald-500 ring-1 ring-emerald-500'
                            : 'bg-[#18181B] border-slate-700/60 hover:border-slate-600'
                        }`}
                      >
                        {/* Weight / variant name */}
                        <span className={`text-sm font-black block ${ isSelected ? 'text-white' : 'text-slate-200' }`}>
                          {v.variantName}
                        </span>
                        {/* Price row */}
                        <div className="mt-1 flex items-baseline gap-1.5 font-mono">
                          <span className={`text-base font-black ${ isSelected ? 'text-white' : 'text-slate-100' }`}>
                            ₹{v.sellingPrice}
                          </span>
                          {v.mrp > v.sellingPrice && (
                            <span className="text-[11px] text-slate-500 line-through">MRP ₹{v.mrp}</span>
                          )}
                        </div>
                        {/* Discount */}
                        {vDiscount > 0 && (
                          <span className="text-[10px] font-black text-emerald-400 mt-0.5 block">
                            {vDiscount}% OFF on MRP
                          </span>
                        )}
                        {/* Per-unit cost */}
                        {vPerUnit && (
                          <span className="text-[10px] text-slate-500 font-semibold font-mono block mt-0.5">
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
            className="bg-[#1C1C22] hover:bg-[#23232A] border border-slate-800/80 rounded-3xl p-4 flex items-center justify-between shadow-md transition-all active:scale-[0.99] cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-white p-2 flex items-center justify-center shrink-0 shadow-inner">
                <span className="text-xs font-black text-emerald-800 uppercase tracking-tighter text-center leading-none">
                  {product.brandName ? product.brandName.slice(0, 6) : 'BRAND'}
                </span>
              </div>
              <div>
                <strong className="text-sm font-black text-white block">
                  {product.brandName || 'Pocket Kirana Certified'}
                </strong>
                <span className="text-xs text-slate-400 font-medium">Explore all products</span>
              </div>
            </div>

            <ChevronRight className="w-5 h-5 text-slate-400" />
          </div>



          {/* ── 5. SIMILAR PRODUCTS HORIZONTAL CAROUSEL ── */}
          {similarProducts.length > 0 && (
            <div className="pt-2 space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-base font-black text-white tracking-tight">Similar products</h3>
                <button
                  onClick={() => router.push(`/category/${product.categoryId || product.category || 'all'}`)}
                  className="text-xs font-bold text-emerald-400 hover:text-emerald-300"
                >
                  See all
                </button>
              </div>

              <div className="flex gap-3.5 overflow-x-auto pb-2 scrollbar-none snap-x">
                {similarProducts.map((sp) => {
                  const spKey = `${sp.id}::default`;
                  const spInCart = cart.find((i) => i.id === spKey || i.productId === sp.id);
                  const spQty = spInCart ? spInCart.quantity : 0;
                  const spDiscount = sp.mrp > sp.sellingPrice ? Math.round(((sp.mrp - sp.sellingPrice) / sp.mrp) * 100) : 0;

                  return (
                    <div
                      key={sp.id}
                      className="w-36 sm:w-40 shrink-0 bg-[#1C1C22] border border-slate-800/80 rounded-2xl p-3 flex flex-col justify-between snap-start shadow-md"
                    >
                      <div 
                        onClick={() => router.push(`/product/${sp.id}`)}
                        className="cursor-pointer space-y-2"
                      >
                        <div className="w-full h-28 bg-white rounded-xl p-2 flex items-center justify-center relative overflow-hidden">
                          {spDiscount > 0 && (
                            <span className="absolute top-1 left-1 bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-xs">
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
                          <strong className="text-xs font-bold text-slate-100 line-clamp-1 block">
                            {sp.name}
                          </strong>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            {sp.unit}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 flex items-center justify-between border-t border-slate-800 mt-2">
                        <div className="font-mono">
                          <span className="text-xs font-black text-white">₹{sp.sellingPrice}</span>
                          {sp.mrp > sp.sellingPrice && (
                            <span className="text-[9px] text-slate-500 line-through block">₹{sp.mrp}</span>
                          )}
                        </div>

                        {spQty === 0 ? (
                          <button
                            onClick={() => {
                              addToCart(sp, 1);
                              showToast(`Added ${sp.name} to cart`, 'success');
                            }}
                            className="bg-[#16A34A] hover:bg-[#15803D] active:scale-95 text-white font-black text-[11px] px-3 py-1.5 rounded-xl transition-all shadow-xs cursor-pointer"
                          >
                            ADD
                          </button>
                        ) : (
                          <div className="flex items-center gap-1 bg-emerald-950 border border-emerald-600 rounded-xl px-1 py-0.5">
                            <button
                              onClick={() => updateCartQuantity(spKey, spQty - 1)}
                              className="w-5 h-5 flex items-center justify-center text-white hover:bg-emerald-800 rounded"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-[11px] font-black font-mono text-emerald-400 px-1">{spQty}</span>
                            <button
                              onClick={() => updateCartQuantity(spKey, spQty + 1)}
                              className="w-5 h-5 flex items-center justify-center text-white hover:bg-emerald-800 rounded"
                            >
                              <Plus className="w-3 h-3" />
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

        {/* ── 6. STICKY BOTTOM BAR (MATCHING REFERENCE SCREENSHOT) ── */}
        <div className="fixed bottom-0 inset-x-0 z-40 bg-[#1C1C22] border-t border-slate-800 px-5 py-3.5 shadow-2xl flex items-center justify-between">
          
          {/* Left Pricing Details */}
          <div className="space-y-0.5">
            <span className="text-xs font-black text-slate-300 block font-mono">
              {currentUnit}
            </span>
            <div className="flex items-baseline gap-2">
              <strong className="text-xl font-black text-white font-mono tracking-tight">
                ₹{effectivePrice}
              </strong>
              {effectiveMrp > effectivePrice && (
                <span className="text-xs font-bold text-slate-400 line-through font-mono">
                  MRP ₹{effectiveMrp}
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-400 block font-medium">
              Inclusive of all taxes
            </span>
          </div>

          {/* Right Action: Add to Cart Button or Stepper */}
          <div>
            {qtyInCart === 0 ? (
              <button
                onClick={handleAddToCart}
                className="bg-[#16A34A] hover:bg-[#15803D] text-white font-black text-sm px-8 sm:px-12 py-3.5 rounded-2xl shadow-lg shadow-emerald-950/40 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Add to cart</span>
              </button>
            ) : (
              <div className="flex items-center gap-3 bg-emerald-950/80 border border-emerald-500 rounded-2xl p-1.5 px-3 shadow-md">
                <button
                  onClick={() => handleUpdateQty(qtyInCart - 1)}
                  className="w-8 h-8 rounded-xl bg-[#18181B] hover:bg-slate-800 text-white flex items-center justify-center font-black transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="font-mono font-black text-white text-base px-1.5">{qtyInCart}</span>
                <button
                  onClick={() => handleUpdateQty(qtyInCart + 1)}
                  className="w-8 h-8 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white flex items-center justify-center font-black transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

        </div>

        {/* ── 7. HALF-SCREEN PRODUCT DETAILS BOTTOM SHEET MODAL (MATCHING REFERENCE SCREENSHOT) ── */}
        {showDetailsModal && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
            {/* Click outside backdrop to close */}
            <div className="flex-1" onClick={() => setShowDetailsModal(false)} />

            {/* Floating Top Close Button above Bottom Sheet */}
            <div className="flex justify-center pb-3">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="w-11 h-11 rounded-full bg-[#202026] hover:bg-[#2B2B34] border border-white/20 text-white flex items-center justify-center shadow-2xl active:scale-90 transition-all cursor-pointer"
                aria-label="Close details"
              >
                <X className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>

            {/* Bottom Sheet Drawer */}
            <div className="bg-[#18181F] rounded-t-[28px] border-t border-slate-700/60 overflow-hidden flex flex-col max-h-[82vh] shadow-2xl animate-in slide-in-from-bottom-6 duration-200">
              
              {/* Product Preview Card */}
              <div className="p-4 px-5 flex items-center gap-3.5 bg-[#18181F] border-b border-slate-800/80 shrink-0">
                <div className="w-13 h-13 rounded-2xl bg-white p-1 flex items-center justify-center shrink-0 border border-slate-700/40 shadow-sm overflow-hidden">
                  <img
                    src={product.thumbnail || (product as any).image}
                    alt={product.name}
                    className="w-full h-full object-contain"
                  />
                </div>
                <h2 className="text-sm sm:text-base font-black text-white leading-snug line-clamp-2">
                  {product.name}
                </h2>
              </div>

              {/* Scrollable Specifications Content inside bottom sheet */}
              <div className="overflow-y-auto px-5 py-4 space-y-5 text-xs text-white pb-6 scrollbar-thin">
                
                {/* 1. Highlights Section */}
                <div className="space-y-2">
                  <h3 className="text-sm font-black text-white tracking-tight">Highlights</h3>
                  <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none">
                    {/* Shelf Life Pill */}
                    <div className="bg-[#24242C] border border-slate-700/60 rounded-2xl p-2.5 px-4 min-w-[95px] shrink-0">
                      <span className="text-[11px] text-slate-400 font-medium block">Shelf Life</span>
                      <strong className="text-xs font-black text-slate-100 block mt-0.5">
                        {product.shelfLife || '90 days'}
                      </strong>
                    </div>

                    {/* Product / Atta Type Pill */}
                    <div className="bg-[#24242C] border border-slate-700/60 rounded-2xl p-2.5 px-4 min-w-[105px] shrink-0">
                      <span className="text-[11px] text-slate-400 font-medium block">
                        {product.categoryId?.includes('atta') || product.name.toLowerCase().includes('atta') ? 'Atta Type' : 'Type'}
                      </span>
                      <strong className="text-xs font-black text-slate-100 block mt-0.5">
                        {product.productType || product.foodType || 'Sehori Atta'}
                      </strong>
                    </div>

                    {/* Diet Preference Pill */}
                    {(product.dietPreference || product.foodType) && (
                      <div className="bg-[#24242C] border border-slate-700/60 rounded-2xl p-2.5 px-4 min-w-[105px] shrink-0">
                        <span className="text-[11px] text-slate-400 font-medium block">Diet Preference</span>
                        <strong className="text-xs font-black text-emerald-400 block mt-0.5">
                          {product.dietPreference || product.foodType || 'High Fiber'}
                        </strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. All Details Section (Accordions) */}
                <div className="space-y-2.5">
                  <h3 className="text-sm font-black text-white tracking-tight">All details</h3>

                  {/* ── Accordion 1: Key Information ── */}
                  <div className="bg-[#24242C] border border-slate-700/60 rounded-2xl overflow-hidden shadow-xs">
                    <button
                      onClick={() => toggleAccordion('keyInfo')}
                      className="w-full p-4 flex items-center justify-between text-left font-bold text-white text-xs sm:text-sm cursor-pointer"
                    >
                      <span>Key Information</span>
                      {openAccordions.keyInfo ? <ChevronUp className="w-4 h-4 text-slate-300" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>

                    {openAccordions.keyInfo && (
                      <div className="px-4 pb-4 border-t border-slate-700/40 pt-3 space-y-2.5 text-xs">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <span className="text-slate-400 font-medium">
                            {product.categoryId?.includes('atta') || product.name.toLowerCase().includes('atta') ? 'Atta Type' : 'Product Type'}
                          </span>
                          <span className="text-slate-200 font-semibold">
                            {product.productType || 'Sehori Atta'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <span className="text-slate-400 font-medium">Source</span>
                          <span className="text-slate-200 font-semibold">
                            {product.source || 'Sehore, Madhya Pradesh'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <span className="text-slate-400 font-medium">Diet Preference</span>
                          <span className="text-slate-200 font-semibold">
                            {product.dietPreference || product.foodType || 'High Fiber'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Accordion 2: Nutritional Information ── */}
                  <div className="bg-[#24242C] border border-slate-700/60 rounded-2xl overflow-hidden shadow-xs">
                    <button
                      onClick={() => toggleAccordion('nutrition')}
                      className="w-full p-4 flex items-center justify-between text-left font-bold text-white text-xs sm:text-sm cursor-pointer"
                    >
                      <span>Nutritional Information</span>
                      {openAccordions.nutrition ? <ChevronUp className="w-4 h-4 text-slate-300" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>

                    {openAccordions.nutrition && (
                      <div className="px-4 pb-4 border-t border-slate-700/40 pt-3 space-y-2 text-xs">
                        <div className="flex items-center justify-between py-1">
                          <span className="text-slate-300 font-bold">Protein Per 100 g (g)</span>
                          <span className="text-slate-300 font-mono font-medium">{product.nutritionalInfo?.protein || '10.5 g'}</span>
                        </div>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-slate-300 font-bold">Total Carbohydrates Per 100 g</span>
                          <span className="text-slate-300 font-mono font-medium">{product.nutritionalInfo?.carbohydrates || '77.1 g'}</span>
                        </div>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-slate-300 font-bold">Total Sugar Per 100 g</span>
                          <span className="text-slate-300 font-mono font-medium">{product.nutritionalInfo?.totalSugar || '3.4 g'}</span>
                        </div>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-slate-300 font-bold">Added Sugar Per 100 g</span>
                          <span className="text-slate-300 font-mono font-medium">{product.nutritionalInfo?.addedSugar || '0 g'}</span>
                        </div>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-slate-300 font-bold">Total Fat Per 100 g</span>
                          <span className="text-slate-300 font-mono font-medium">{product.nutritionalInfo?.totalFat || '1.6 g'}</span>
                        </div>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-slate-300 font-bold">Saturated Fat Per 100 g</span>
                          <span className="text-slate-300 font-mono font-medium">{product.nutritionalInfo?.saturatedFat || '0.3 g'}</span>
                        </div>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-slate-300 font-bold">Unsaturated Fat Per 100 g</span>
                          <span className="text-slate-300 font-mono font-medium">{product.nutritionalInfo?.unsaturatedFat || '1.3 g'}</span>
                        </div>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-slate-300 font-bold">Trans Fat Per 100 g</span>
                          <span className="text-slate-300 font-mono font-medium">{product.nutritionalInfo?.transFat || '0 g'}</span>
                        </div>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-slate-300 font-bold">Dietary Fiber Per 100 g</span>
                          <span className="text-slate-300 font-mono font-medium">{product.nutritionalInfo?.dietaryFiber || '10.8 g'}</span>
                        </div>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-slate-300 font-bold">Sodium Per 100 g</span>
                          <span className="text-slate-300 font-mono font-medium">{product.nutritionalInfo?.sodium || '1.7 mg'}</span>
                        </div>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-slate-300 font-bold">Energy Per 100 g</span>
                          <span className="text-slate-300 font-mono font-medium">{product.nutritionalInfo?.energy || '343 kcal'}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Accordion 3: Info ── */}
                  <div className="bg-[#24242C] border border-slate-700/60 rounded-2xl overflow-hidden shadow-xs">
                    <button
                      onClick={() => toggleAccordion('info')}
                      className="w-full p-4 flex items-center justify-between text-left font-bold text-white text-xs sm:text-sm cursor-pointer"
                    >
                      <span>Info</span>
                      {openAccordions.info ? <ChevronUp className="w-4 h-4 text-slate-300" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>

                    {openAccordions.info && (
                      <div className="px-4 pb-4 border-t border-slate-700/40 pt-3 space-y-3.5 text-xs">
                        {/* Key Features */}
                        <div className="grid grid-cols-3 gap-2">
                          <span className="text-slate-300 font-bold">Key Features</span>
                          <p className="col-span-2 text-slate-300 leading-relaxed text-[11px] whitespace-pre-line">
                            {product.keyFeatures || product.description || 'EXPERIENCE THE GOLDEN GRAINS: Indulge in the finest quality atta made with Premium MP Sehori Wheat carefully selected and sourced from the farmers of Sehore, Madhya Pradesh, for its exceptional aroma and taste\nBRINGING YOU WHAT YOU LIKE: Made with your preferred wheat variety, in your way of traditional chakki jaisi pisai, provided with guarantee of wheat sourcing through quality certificate'}
                          </p>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <span className="text-slate-300 font-bold">Unit</span>
                          <span className="col-span-2 text-slate-300 font-mono">{currentUnit}</span>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <span className="text-slate-300 font-bold">FSSAI License</span>
                          <span className="col-span-2 text-slate-300 font-mono">{product.fssaiLicense || '10012031000312'}</span>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <span className="text-slate-300 font-bold">Shelf Life</span>
                          <span className="col-span-2 text-slate-300">{product.shelfLife || '90 days'}</span>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <span className="text-slate-300 font-bold">Disclaimer</span>
                          <p className="col-span-2 text-slate-300 text-[11px] leading-relaxed">
                            {product.disclaimer || 'Every effort is made to maintain accuracy of all information. However, actual product packaging and materials may contain more and/or different information.'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Sticky Bottom Bar inside Bottom Sheet Modal */}
              <div className="p-4 px-5 bg-[#18181F] border-t border-slate-800 flex items-center justify-between shrink-0">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-300 block font-mono">{currentUnit}</span>
                  <div className="flex items-baseline gap-2">
                    <strong className="text-lg font-black text-white font-mono tracking-tight">₹{effectivePrice}</strong>
                    {effectiveMrp > effectivePrice && (
                      <span className="text-xs text-slate-500 line-through font-mono">MRP ₹{effectiveMrp}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 block font-medium">Inclusive of all taxes</span>
                </div>

                <div>
                  {qtyInCart === 0 ? (
                    <button
                      onClick={handleAddToCart}
                      className="bg-[#16A34A] hover:bg-[#15803D] active:scale-95 text-white font-black text-xs sm:text-sm px-6 sm:px-8 py-3 rounded-2xl transition-all shadow-md cursor-pointer"
                    >
                      Add to cart
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 bg-emerald-950/80 border border-emerald-500 rounded-2xl p-1 px-2.5 shadow-md">
                      <button onClick={() => handleUpdateQty(qtyInCart - 1)} className="w-7 h-7 rounded-xl bg-[#18181B] text-white flex items-center justify-center font-black">
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-mono font-black text-white text-sm px-1">{qtyInCart}</span>
                      <button onClick={() => handleUpdateQty(qtyInCart + 1)} className="w-7 h-7 rounded-xl bg-[#16A34A] text-white flex items-center justify-center font-black">
                        <Plus className="w-3.5 h-3.5" />
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
