'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import CustomerShell from './CustomerShell';
import { INITIAL_PRODUCTS, INITIAL_CATEGORIES } from '@/lib/mockData';
import { Product, Category } from '@/types';
import { 
  SlidersHorizontal, 
  ArrowUpDown, 
  ChevronDown, 
  Search, 
  Star, 
  Clock, 
  Plus, 
  Minus, 
  Check, 
  Grid, 
  Sparkles,
  Zap,
  ShoppingBag
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

type SortOption = 'relevance' | 'price-low' | 'price-high' | 'rating' | 'discount';

interface CategorySplitCatalogProps {
  initialCategorySlug?: string;
}

export default function CategorySplitCatalog({ initialCategorySlug }: CategorySplitCatalogProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { categories, products, cart, addToCart, updateCartQuantity, addresses } = useAppStore();

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(initialCategorySlug || 'all');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const sortMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Update selected category if initialCategorySlug changes
  useEffect(() => {
    if (initialCategorySlug) {
      setSelectedCategoryId(initialCategorySlug);
    }
  }, [initialCategorySlug]);

  // Close sort menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // All Categories list with fallback
  const allCategories = useMemo(() => {
    const list = categories && categories.length > 0 ? categories : INITIAL_CATEGORIES;
    return list
      .filter((c) => !c.parentId && c.isActive !== false)
      .sort((a, b) => (a.displayOrder || a.sortOrder || 0) - (b.displayOrder || b.sortOrder || 0));
  }, [categories]);

  // All Products with fallback
  const allProducts = useMemo(() => {
    const map = new Map<string, Product>();
    INITIAL_PRODUCTS.forEach((p) => map.set(p.id, p));
    (products || []).forEach((p) => {
      const existing = map.get(p.id);
      map.set(p.id, { ...existing, ...p });
    });
    return Array.from(map.values()).filter((p) => p.status !== 'discontinued');
  }, [products]);

  // Active Category Object
  const currentCategory = useMemo(() => {
    if (selectedCategoryId === 'all') return null;
    return allCategories.find((c) => c.id === selectedCategoryId || c.slug === selectedCategoryId) || null;
  }, [allCategories, selectedCategoryId]);

  // Subcategories of active category
  const subcategories = useMemo(() => {
    if (!currentCategory) return [];
    const list = (categories && categories.length > 0 ? categories : INITIAL_CATEGORIES)
      .filter((c) => c.parentId === currentCategory.id && c.isActive !== false)
      .sort((a, b) => (a.displayOrder || a.sortOrder || 0) - (b.displayOrder || b.sortOrder || 0));
    return list;
  }, [categories, currentCategory]);

  // Reset subcategory when category changes
  const handleSelectCategory = (catIdOrSlug: string) => {
    setSelectedCategoryId(catIdOrSlug);
    setSelectedSubcategory('all');
  };

  // Filter and Sort Products
  const filteredProducts = useMemo(() => {
    let list = allProducts;

    // Filter by category
    if (selectedCategoryId !== 'all' && currentCategory) {
      list = list.filter((p) => {
        const catMatch = 
          p.categoryId === currentCategory.id || 
          p.categoryId === currentCategory.slug ||
          ((p as any).category && currentCategory.name && (p as any).category.toLowerCase() === currentCategory.name.toLowerCase());
        
        if (!catMatch) return false;

        if (selectedSubcategory !== 'all') {
          return p.subcategoryId === selectedSubcategory;
        }
        return true;
      });
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) => 
        p.name.toLowerCase().includes(q) || 
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.brandId && p.brandId.toLowerCase().includes(q))
      );
    }

    // Sorting
    if (sortBy === 'price-low') {
      list = [...list].sort((a, b) => a.sellingPrice - b.sellingPrice);
    } else if (sortBy === 'price-high') {
      list = [...list].sort((a, b) => b.sellingPrice - a.sellingPrice);
    } else if (sortBy === 'rating') {
      list = [...list].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === 'discount') {
      list = [...list].sort((a, b) => {
        const discA = a.mrp > a.sellingPrice ? ((a.mrp - a.sellingPrice) / a.mrp) : 0;
        const discB = b.mrp > b.sellingPrice ? ((b.mrp - b.sellingPrice) / b.mrp) : 0;
        return discB - discA;
      });
    }

    return list;
  }, [allProducts, selectedCategoryId, currentCategory, selectedSubcategory, searchQuery, sortBy]);

  const defaultAddress = addresses.find((a) => a.isDefault) || addresses[0] || {
    addressLine1: 'Express DarkStore Hub',
    city: 'Neral',
  };

  const pageTitle = currentCategory ? currentCategory.name : 'All Categories';

  const handleOpenDetail = (product: Product) => {
    router.push(`/product/${product.id || product.slug}`);
  };

  // Unit price calculation helper
  const getPerUnitPrice = (product: Product) => {
    const unitStr = (product.unit || '1 pc').toLowerCase();
    const match = unitStr.match(/(\d+(\.\d+)?)\s*(g|gm|gram|ml|l|kg|ltr|liter)/);
    if (!match) return null;
    let qty = parseFloat(match[1]);
    const u = match[3];
    if (u === 'kg' || u === 'l' || u === 'ltr' || u === 'liter') {
      qty = qty * 1000;
    }
    if (qty > 0) {
      const per100 = (product.sellingPrice / qty) * 100;
      const unitLabel = (u === 'ml' || u === 'l' || u === 'ltr' || u === 'liter') ? '100 ml' : '100 g';
      return `₹${per100.toFixed(1)}/${unitLabel}`;
    }
    return null;
  };

  if (!mounted) {
    return (
      <CustomerShell title="Categories" hideBottomNav={false} noPadding>
        <div className="min-h-screen bg-[#0d1117] text-white animate-pulse p-4 space-y-4">
          <div className="h-10 bg-slate-800 rounded-xl w-full" />
          <div className="flex gap-2">
            <div className="w-20 bg-slate-800 rounded-2xl h-[70vh]" />
            <div className="flex-1 grid grid-cols-2 gap-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-52 bg-slate-800 rounded-2xl" />
              ))}
            </div>
          </div>
        </div>
      </CustomerShell>
    );
  }

  return (
    <CustomerShell title={pageTitle} showBack backUrl="/home" hideBottomNav={false} noPadding fixedViewport>
      <div className="flex-1 min-h-0 w-full bg-[#0d1117] text-white flex flex-col font-sans select-none overflow-hidden pb-16">
        
        {/* ── 1. TOP SUB-HEADER & FILTER/SORT TOOLBAR ── */}
        <div className="shrink-0 bg-[#121620] border-b border-slate-800/90 shadow-md">
          
          {/* Filter / Sort Pills Row */}
          <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto no-scrollbar scroll-smooth">
            {/* Filters Button */}
            <button
              onClick={() => router.push('/search')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1c2230] hover:bg-[#252d40] border border-slate-700/60 text-slate-200 text-xs font-bold shrink-0 active:scale-95 transition-all cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
              <span>Filters</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {/* Sort Dropdown Button */}
            <div className="relative shrink-0" ref={sortMenuRef}>
              <button
                onClick={() => setShowSortMenu((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold active:scale-95 transition-all cursor-pointer ${
                  sortBy !== 'relevance'
                    ? 'bg-emerald-950/80 border-emerald-500 text-emerald-400'
                    : 'bg-[#1c2230] hover:bg-[#252d40] border-slate-700/60 text-slate-200'
                }`}
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  {sortBy === 'relevance'
                    ? 'Sort'
                    : sortBy === 'price-low'
                    ? 'Price: Low'
                    : sortBy === 'price-high'
                    ? 'Price: High'
                    : sortBy === 'discount'
                    ? 'Discount'
                    : 'Rating'}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {/* Sort Menu Floating Dropdown */}
              {showSortMenu && (
                <div className="absolute left-0 top-full mt-1.5 w-48 bg-[#181f2c] border border-slate-700/80 rounded-2xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                  {[
                    { id: 'relevance', label: 'Relevance' },
                    { id: 'price-low', label: 'Price: Low to High' },
                    { id: 'price-high', label: 'Price: High to Low' },
                    { id: 'discount', label: 'Biggest Discount' },
                    { id: 'rating', label: 'Customer Rating' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setSortBy(opt.id as SortOption);
                        setShowSortMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center justify-between cursor-pointer ${
                        sortBy === opt.id
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-300 hover:bg-slate-800/80'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {sortBy === opt.id && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Filter: In Stock */}
            <button
              onClick={() => setSelectedSubcategory('all')}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold shrink-0 active:scale-95 transition-all cursor-pointer ${
                selectedSubcategory === 'all'
                  ? 'bg-emerald-950/60 border-emerald-500/70 text-emerald-300'
                  : 'bg-[#1c2230] border-slate-700/60 text-slate-300'
              }`}
            >
              Quantity
            </button>

            {/* Price Pill */}
            <button
              onClick={() => {
                setSortBy(sortBy === 'price-low' ? 'price-high' : 'price-low');
              }}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold shrink-0 active:scale-95 transition-all cursor-pointer ${
                sortBy === 'price-low' || sortBy === 'price-high'
                  ? 'bg-emerald-950/60 border-emerald-500/70 text-emerald-300'
                  : 'bg-[#1c2230] border-slate-700/60 text-slate-300'
              }`}
            >
              Price {sortBy === 'price-low' ? '↑' : sortBy === 'price-high' ? '↓' : ''}
            </button>
          </div>

          {/* Subcategories Horizontally Scrollable Pills (if current category has subcategories) */}
          {subcategories.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-2 bg-[#0e121a] border-t border-slate-800/70 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setSelectedSubcategory('all')}
                className={`px-3 py-1 rounded-lg text-xs font-black transition-all shrink-0 cursor-pointer ${
                  selectedSubcategory === 'all'
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : 'bg-[#1a202c] text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                All
              </button>
              {subcategories.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setSelectedSubcategory(sub.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    selectedSubcategory === sub.id
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'bg-[#1a202c] text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {sub.name}
                </button>
              ))}
            </div>
          )}

        </div>

        {/* ── 2. SPLIT LAYOUT: LEFT SIDEBAR + RIGHT PRODUCT GRID ── */}
        <div className="flex-1 min-h-0 flex w-full overflow-hidden">
          
          {/* ── LEFT SIDEBAR (INDEPENDENT VERTICAL CATEGORY SELECTOR) ── */}
          <aside className="w-20 sm:w-24 shrink-0 bg-[#0e121a] border-r border-slate-800/90 flex flex-col h-full overflow-y-auto no-scrollbar pb-8">
            
            {/* 1. "ALL" BUTTON (FIRST ITEM & SELECTED BY DEFAULT) */}
            <button
              onClick={() => handleSelectCategory('all')}
              className={`relative w-full py-3.5 px-1.5 flex flex-col items-center gap-1.5 transition-all text-center group cursor-pointer border-b border-slate-800/40 ${
                selectedCategoryId === 'all'
                  ? 'bg-[#182130] text-emerald-400 font-black'
                  : 'hover:bg-[#141924] text-slate-400 font-semibold'
              }`}
            >
              {/* Active Indicator Bar on Left */}
              {selectedCategoryId === 'all' && (
                <span className="absolute left-0 top-2 bottom-2 w-1 bg-emerald-500 rounded-r-full shadow-md shadow-emerald-500/50" />
              )}

              {/* Icon Box */}
              <div
                className={`w-12 h-12 rounded-2xl p-2 flex items-center justify-center transition-all ${
                  selectedCategoryId === 'all'
                    ? 'bg-emerald-950/80 border-2 border-emerald-500 shadow-md shadow-emerald-500/20 scale-105'
                    : 'bg-[#1a202c] border border-slate-700/60 group-hover:border-slate-600'
                }`}
              >
                <Grid className={`w-6 h-6 ${selectedCategoryId === 'all' ? 'text-emerald-400' : 'text-slate-300'}`} />
              </div>

              {/* Label */}
              <span className={`text-[10px] leading-tight line-clamp-2 px-0.5 ${
                selectedCategoryId === 'all' ? 'text-emerald-400 font-black' : 'text-slate-300'
              }`}>
                All
              </span>
            </button>

            {/* 2. CATEGORY ITEMS LIST */}
            {allCategories.map((cat) => {
              const isSelected = selectedCategoryId === cat.id || selectedCategoryId === cat.slug;

              return (
                <button
                  key={cat.id}
                  onClick={() => handleSelectCategory(cat.slug || cat.id)}
                  className={`relative w-full py-3 px-1 flex flex-col items-center gap-1.5 transition-all text-center group cursor-pointer border-b border-slate-800/30 ${
                    isSelected
                      ? 'bg-[#182130] text-emerald-400 font-black'
                      : 'hover:bg-[#141924] text-slate-400 font-semibold'
                  }`}
                >
                  {/* Active Indicator Bar on Left */}
                  {isSelected && (
                    <span className="absolute left-0 top-2 bottom-2 w-1 bg-emerald-500 rounded-r-full shadow-md shadow-emerald-500/50" />
                  )}

                  {/* Icon Container */}
                  <div
                    className={`w-12 h-12 rounded-2xl p-1 flex items-center justify-center transition-all overflow-hidden ${
                      isSelected
                        ? 'bg-emerald-950/80 border-2 border-emerald-500 shadow-md shadow-emerald-500/20 scale-105'
                        : 'bg-[#1a202c] border border-slate-700/60 group-hover:border-slate-600'
                    }`}
                  >
                    <img
                      src={cat.image || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=100&q=80'}
                      alt={cat.name}
                      loading="lazy"
                      className="w-full h-full object-contain rounded-xl"
                    />
                  </div>

                  {/* Category Name */}
                  <span className={`text-[10px] leading-tight line-clamp-2 px-0.5 ${
                    isSelected ? 'text-emerald-400 font-black' : 'text-slate-300'
                  }`}>
                    {cat.name}
                  </span>
                </button>
              );
            })}

          </aside>

          {/* ── RIGHT MAIN CONTENT: 2-COLUMN PRODUCT GRID (MATCHING SCREENSHOT 2) ── */}
          <main className="flex-1 h-full overflow-y-auto p-2 sm:p-3 pb-12 space-y-3 bg-[#0d1117]">
            
            {/* Header / Product Count Row */}
            <div className="flex items-center justify-between px-1 pt-1">
              <div>
                <h2 className="text-sm sm:text-base font-black text-white tracking-tight">
                  {currentCategory ? currentCategory.name : 'All Products'}
                </h2>
                <span className="text-[11px] text-slate-400 font-bold">
                  {filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'items'} available
                </span>
              </div>
            </div>

            {/* Empty State */}
            {filteredProducts.length === 0 && (
              <div className="bg-[#151922] border border-slate-800 rounded-2xl p-8 text-center space-y-3 my-4">
                <div className="w-14 h-14 rounded-full bg-slate-800/80 flex items-center justify-center mx-auto text-slate-400">
                  <ShoppingBag className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-black text-white">No products found</h3>
                <p className="text-xs text-slate-400">
                  No items match the selected category or filter criteria.
                </p>
                <button
                  onClick={() => {
                    setSelectedCategoryId('all');
                    setSelectedSubcategory('all');
                    setSearchQuery('');
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-4 py-2 rounded-xl transition-all shadow-md cursor-pointer"
                >
                  View All Products
                </button>
              </div>
            )}

            {/* 2-Column Product Grid */}
            <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
              {filteredProducts.map((p) => {
                const cartItem = cart.find((item) => item.productId === p.id || item.id === p.id);
                const qtyInCart = cartItem ? cartItem.quantity : 0;
                const discountPercent = p.mrp > p.sellingPrice 
                  ? Math.round(((p.mrp - p.sellingPrice) / p.mrp) * 100) 
                  : 0;
                const per100Text = getPerUnitPrice(p);

                return (
                  <div
                    key={p.id}
                    className="bg-[#151922] hover:bg-[#181d28] border border-slate-800/90 hover:border-slate-700/90 rounded-2xl p-2.5 flex flex-col justify-between transition-all duration-200 shadow-sm relative group"
                  >
                    {/* Top: Product Image with Veg Badge & Discount */}
                    <div 
                      onClick={() => handleOpenDetail(p)}
                      className="cursor-pointer space-y-2"
                    >
                      <div className="relative w-full h-28 sm:h-32 bg-[#1b202c] rounded-xl flex items-center justify-center p-2 overflow-hidden">
                        <img
                          src={p.thumbnail || (p as any).image || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=200&q=80'}
                          alt={p.name}
                          loading="lazy"
                          className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-200"
                        />

                        {/* Veg Badge (Green dot in square) */}
                        <div className="absolute bottom-2 right-2 bg-white/95 p-0.5 rounded-sm border border-emerald-600 shadow-xs flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-emerald-600" />
                        </div>
                      </div>

                      {/* Unit & ADD Button Row */}
                      <div className="flex items-center justify-between gap-1 pt-0.5">
                        <span className="bg-[#202738] text-slate-300 text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-md truncate max-w-[70px]">
                          {p.unit || '1 pack'}
                        </span>

                        {/* ADD / Stepper Button */}
                        <div>
                          {qtyInCart === 0 ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                addToCart(p, 1);
                                showToast(`Added ${p.name} 🛒`, 'success');
                              }}
                              className="bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-500 text-emerald-400 font-black text-[11px] px-3 py-1 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                            >
                              ADD
                            </button>
                          ) : (
                            <div 
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1 bg-emerald-950 border border-emerald-500 rounded-xl p-0.5 px-1.5 shadow-sm"
                            >
                              <button
                                onClick={() => updateCartQuantity(p.id, qtyInCart - 1)}
                                className="w-5 h-5 rounded-lg bg-[#151922] text-white flex items-center justify-center font-bold text-xs"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="font-mono font-black text-white text-xs px-1">{qtyInCart}</span>
                              <button
                                onClick={() => updateCartQuantity(p.id, qtyInCart + 1)}
                                className="w-5 h-5 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Per-100g Price (if available) */}
                      {per100Text && (
                        <span className="text-[10px] text-slate-400 font-mono block">
                          {per100Text}
                        </span>
                      )}

                      {/* Price & MRP Row */}
                      <div className="flex items-baseline gap-1.5">
                        <strong className="text-sm sm:text-base font-black text-white font-mono tracking-tight">
                          ₹{p.sellingPrice}
                        </strong>
                        {p.mrp > p.sellingPrice && (
                          <span className="text-[11px] text-slate-500 line-through font-mono">
                            ₹{p.mrp}
                          </span>
                        )}
                      </div>

                      {/* Discount Label */}
                      {discountPercent > 0 && (
                        <span className="text-[10px] font-extrabold text-blue-400 block tracking-tight">
                          {discountPercent}% OFF on MRP
                        </span>
                      )}

                      {/* Product Title */}
                      <h3 className="text-xs font-bold text-slate-100 line-clamp-2 leading-snug min-h-[32px]">
                        {p.name}
                      </h3>
                    </div>

                    {/* Bottom: Rating & Delivery Time */}
                    <div 
                      onClick={() => handleOpenDetail(p)}
                      className="cursor-pointer pt-2 mt-1 border-t border-slate-800/60 flex items-center justify-between text-[10px]"
                    >
                      <div className="flex items-center gap-1 text-amber-400 font-bold">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <span>{p.rating || 4.8}</span>
                        <span className="text-slate-500 font-medium">({p.reviewsCount || '1.2k'})</span>
                      </div>

                      <div className="flex items-center gap-1 text-slate-400 font-medium">
                        <Clock className="w-3 h-3 text-emerald-400" />
                        <span>9 mins</span>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>

          </main>

        </div>

      </div>
    </CustomerShell>
  );
}
