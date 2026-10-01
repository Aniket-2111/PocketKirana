'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import CustomerShell from './CustomerShell';
import type { Product } from '@/types';
import { 
  ArrowUpDown, 
  Check, 
  ChevronDown, 
  Grid, 
  Search, 
  ShoppingBag, 
  SlidersHorizontal, 
  X 
} from 'lucide-react';
import { ProductCard } from './customer/ProductCard';

type SortOption = 'relevance' | 'price-low' | 'price-high' | 'rating' | 'discount';
type PriceRangeOption = 'all' | 'under-100' | '100-300' | '300-plus';

interface CategorySplitCatalogProps {
  initialCategorySlug?: string;
}

export default function CategorySplitCatalog({ initialCategorySlug }: CategorySplitCatalogProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { categories, products } = useAppStore();

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(initialCategorySlug || 'all');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [priceRange, setPriceRange] = useState<PriceRangeOption>('all');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
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

  // All Categories list (root categories only)
  const allCategories = useMemo(() => {
    return (categories || [])
      .filter((c) => !c.parentId && c.isActive !== false)
      .sort((a, b) => (a.displayOrder || a.sortOrder || 0) - (b.displayOrder || b.sortOrder || 0));
  }, [categories]);

  // All Products
  const allProducts = useMemo(() => {
    return (products || []).filter((p) => p.status !== 'discontinued');
  }, [products]);

  // Active Category Object
  const currentCategory = useMemo(() => {
    if (selectedCategoryId === 'all') return null;
    return allCategories.find((c) => c.id === selectedCategoryId || c.slug === selectedCategoryId) || null;
  }, [allCategories, selectedCategoryId]);

  // Subcategories of active category
  const subcategories = useMemo(() => {
    if (!currentCategory) return [];
    return (categories || [])
      .filter((c) => c.parentId === currentCategory.id && c.isActive !== false)
      .sort((a, b) => (a.displayOrder || a.sortOrder || 0) - (b.displayOrder || b.sortOrder || 0));
  }, [categories, currentCategory]);

  // Reset subcategory when category changes
  const handleSelectCategory = (catIdOrSlug: string) => {
    setSelectedCategoryId(catIdOrSlug);
    setSelectedSubcategory('all');
  };

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCategoryId !== 'all' && selectedCategoryId !== initialCategorySlug) count++;
    if (selectedSubcategory !== 'all') count++;
    if (inStockOnly) count++;
    if (priceRange !== 'all') count++;
    if (sortBy !== 'relevance') count++;
    return count;
  }, [selectedCategoryId, initialCategorySlug, selectedSubcategory, inStockOnly, priceRange, sortBy]);

  const clearAllFilters = () => {
    setSelectedCategoryId(initialCategorySlug || 'all');
    setSelectedSubcategory('all');
    setSearchQuery('');
    setInStockOnly(false);
    setPriceRange('all');
    setSortBy('relevance');
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

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) => 
        p.name.toLowerCase().includes(q) || 
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.brandName && p.brandName.toLowerCase().includes(q)) ||
        (p.brandId && p.brandId.toLowerCase().includes(q))
      );
    }

    // Filter by In-Stock
    if (inStockOnly) {
      list = list.filter((product) => product.status !== 'out_of_stock' && product.stock !== 0);
    }

    // Filter by Price Range
    if (priceRange === 'under-100') {
      list = list.filter((p) => p.sellingPrice < 100);
    } else if (priceRange === '100-300') {
      list = list.filter((p) => p.sellingPrice >= 100 && p.sellingPrice <= 300);
    } else if (priceRange === '300-plus') {
      list = list.filter((p) => p.sellingPrice > 300);
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
  }, [allProducts, selectedCategoryId, currentCategory, selectedSubcategory, searchQuery, inStockOnly, priceRange, sortBy]);

  const pageTitle = currentCategory ? currentCategory.name : 'Categories';

  const handleOpenDetail = (product: Product) => {
    router.push(`/product/${product.id || product.slug}`);
  };

  if (!mounted) {
    return (
      <CustomerShell title="Categories" hideBottomNav={false} noPadding>
        <div role="status" aria-label="Loading categories and products" aria-busy="true" className="min-h-screen animate-pulse space-y-4 bg-background p-4 text-foreground">
          <span className="sr-only">Loading categories and products</span>
          <div className="h-11 w-full rounded-2xl bg-muted" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card p-3">
                <div className="aspect-square rounded-xl bg-muted" />
                <div className="mt-3 h-4 w-4/5 rounded bg-muted" />
                <div className="mt-2 h-4 w-2/5 rounded bg-muted" />
                <div className="mt-3 h-10 rounded-xl bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </CustomerShell>
    );
  }

  return (
    <CustomerShell title={pageTitle} showBack backUrl="/home" hideBottomNav={false} noPadding fixedViewport>
      <div
        className="flex-1 min-h-0 w-full bg-background text-foreground flex flex-col font-sans overflow-hidden"
        style={{ paddingBottom: 'calc(var(--bottom-stack-height, 64px) + env(safe-area-inset-bottom, 0px))' }}
      >
        
        {/* ── 1. TOP SEARCH & CONTROLS TOOLBAR ── */}
        <div className="shrink-0 bg-white dark:bg-[#111827] border-b border-[#E5E7EB] dark:border-[#263241] shadow-2xs">
          
          {/* Search + Filter + Sort Row */}
          <div className="flex items-center gap-2 p-3">
            {/* Search Input */}
            <label className="relative flex-1 min-w-0">
              <span className="sr-only">Search products</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" aria-hidden="true" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search products..."
                className="min-h-11 w-full rounded-2xl border border-input-border bg-input pl-9 pr-8 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/20"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </label>

            {/* Filter Button (Opens Bottom Sheet on Mobile) */}
            <button
              onClick={() => setIsFilterDrawerOpen(true)}
              type="button"
              aria-label="Open filter options"
              className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-2xl border px-3 text-xs sm:text-sm font-bold transition-all focus-visible:ring-4 focus-visible:ring-primary/20 active:scale-95 ${
                activeFilterCount > 0
                  ? 'bg-emerald-50 dark:bg-emerald-950/80 border-[#008F5A] text-[#008F5A] dark:text-emerald-300'
                  : 'border-border bg-secondary-bg text-secondary-foreground hover:bg-muted'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4 text-primary" aria-hidden="true" />
              <span>Filter</span>
              {activeFilterCount > 0 && (
                <span className="flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-[#008F5A] text-[10px] font-black text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Sort Button / Dropdown */}
            <div className="relative shrink-0" ref={sortMenuRef}>
              <button
                onClick={() => setShowSortMenu((v) => !v)}
                type="button"
                aria-expanded={showSortMenu}
                aria-label="Sort products"
                className={`flex min-h-11 items-center gap-1 rounded-2xl border px-2.5 sm:px-3 text-xs sm:text-sm font-bold transition-all focus-visible:ring-4 focus-visible:ring-primary/20 active:scale-95 ${
                  sortBy !== 'relevance'
                    ? 'bg-emerald-50 dark:bg-emerald-950/80 border-[#008F5A] text-[#008F5A] dark:text-emerald-400'
                    : 'bg-secondary-bg hover:bg-muted border-border text-secondary-foreground'
                }`}
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-[#008F5A] dark:text-emerald-400" />
                <span className="max-w-[70px] sm:max-w-none truncate">
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
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </button>

              {/* Sort Menu Floating Dropdown */}
              {showSortMenu && (
                <div role="group" aria-label="Sort options" className="absolute right-0 top-full z-50 mt-1.5 w-52 rounded-2xl border border-border bg-card p-1.5 shadow-popover animate-in fade-in zoom-in-95 duration-150">
                  {[
                    { id: 'relevance', label: 'Relevance' },
                    { id: 'price-low', label: 'Price: Low to High' },
                    { id: 'price-high', label: 'Price: High to Low' },
                    { id: 'discount', label: 'Biggest Discount' },
                    { id: 'rating', label: 'Customer Rating' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      aria-pressed={sortBy === opt.id}
                      onClick={() => {
                        setSortBy(opt.id as SortOption);
                        setShowSortMenu(false);
                      }}
                      className={`flex min-h-10 w-full items-center justify-between rounded-xl px-3 text-xs sm:text-sm font-semibold transition-colors ${
                        sortBy === opt.id
                          ? 'bg-[#008F5A] text-white'
                          : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {sortBy === opt.id && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── 2. MOBILE HORIZONTAL CATEGORY CHIPS (Visible only on mobile < md) ── */}
          <div className="flex md:hidden items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth px-3 py-2 border-t border-border/80 bg-background/95">
            <button
              onClick={() => handleSelectCategory('all')}
              type="button"
              className={`flex items-center gap-1.5 shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                selectedCategoryId === 'all'
                  ? 'bg-[#008F5A] text-white shadow-xs'
                  : 'bg-secondary-bg text-secondary-foreground border border-border hover:bg-muted'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>All</span>
            </button>
            {allCategories.map((cat) => {
              const isSelected = selectedCategoryId === cat.id || selectedCategoryId === cat.slug;
              return (
                <button
                  key={cat.id}
                  onClick={() => handleSelectCategory(cat.slug || cat.id)}
                  type="button"
                  className={`flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                    isSelected
                      ? 'bg-[#008F5A] text-white shadow-xs'
                      : 'bg-secondary-bg text-secondary-foreground border border-border hover:bg-muted'
                  }`}
                >
                  {cat.image && (
                    <img
                      src={cat.image}
                      alt=""
                      className="w-4 h-4 rounded-full object-contain"
                    />
                  )}
                  <span className="whitespace-nowrap">{cat.name}</span>
                </button>
              );
            })}
          </div>

          {/* ── 3. SUBCATEGORY CHIPS ROW (Horizontally Scrollable) ── */}
          {subcategories.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/40 border-t border-border overflow-x-auto no-scrollbar">
              <button
                onClick={() => setSelectedSubcategory('all')}
                type="button"
                className={`min-h-8 shrink-0 rounded-lg px-2.5 text-xs font-bold transition-all focus-visible:ring-4 focus-visible:ring-primary/20 ${
                  selectedSubcategory === 'all'
                    ? 'bg-[#008F5A] text-white shadow-xs'
                    : 'bg-card text-muted-foreground hover:text-foreground border border-border'
                }`}
              >
                All {currentCategory?.name || ''}
              </button>
              {subcategories.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setSelectedSubcategory(sub.id)}
                  type="button"
                  className={`min-h-8 shrink-0 rounded-lg px-2.5 text-xs font-semibold transition-all focus-visible:ring-4 focus-visible:ring-primary/20 ${
                    selectedSubcategory === sub.id
                      ? 'bg-[#008F5A] text-white shadow-xs'
                      : 'bg-card text-muted-foreground hover:text-foreground border border-border'
                  }`}
                >
                  {sub.name}
                </button>
              ))}
            </div>
          )}

          {/* ── 4. ACTIVE FILTER CHIPS (Removable Chips) ── */}
          {activeFilterCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto no-scrollbar bg-background border-t border-border/60">
              <span className="text-[11px] font-bold text-muted-foreground shrink-0">Filters:</span>
              
              {currentCategory && (
                <button
                  type="button"
                  onClick={() => handleSelectCategory('all')}
                  className="flex items-center gap-1 shrink-0 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100"
                >
                  <span>{currentCategory.name}</span>
                  <X className="w-3 h-3" />
                </button>
              )}

              {selectedSubcategory !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedSubcategory('all')}
                  className="flex items-center gap-1 shrink-0 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100"
                >
                  <span>{subcategories.find((s) => s.id === selectedSubcategory)?.name || selectedSubcategory}</span>
                  <X className="w-3 h-3" />
                </button>
              )}

              {inStockOnly && (
                <button
                  type="button"
                  onClick={() => setInStockOnly(false)}
                  className="flex items-center gap-1 shrink-0 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100"
                >
                  <span>In stock</span>
                  <X className="w-3 h-3" />
                </button>
              )}

              {priceRange !== 'all' && (
                <button
                  type="button"
                  onClick={() => setPriceRange('all')}
                  className="flex items-center gap-1 shrink-0 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100"
                >
                  <span>{priceRange === 'under-100' ? 'Under ₹100' : priceRange === '100-300' ? '₹100–₹300' : 'Above ₹300'}</span>
                  <X className="w-3 h-3" />
                </button>
              )}

              <button
                type="button"
                onClick={clearAllFilters}
                className="shrink-0 text-[11px] font-bold text-[#008F5A] dark:text-emerald-400 hover:underline pl-1"
              >
                Clear all
              </button>
            </div>
          )}

        </div>

        {/* ── 5. RESPONSIVE CATALOG LAYOUT ── */}
        <div className="flex-1 min-h-0 flex w-full overflow-hidden">
          
          {/* ── DESKTOP/TABLET SIDEBAR (Hidden on mobile < md) ── */}
          <nav aria-label="Browse product categories" className="hidden md:flex w-24 shrink-0 border-r border-border bg-secondary-bg lg:w-32 flex-col h-full overflow-y-auto no-scrollbar pb-3">
            
            {/* 1. "ALL" BUTTON */}
            <button
              type="button"
              aria-pressed={selectedCategoryId === 'all'}
              onClick={() => handleSelectCategory('all')}
              className={`relative min-h-24 w-full border-b border-border px-1.5 py-3.5 flex flex-col items-center gap-1.5 text-center transition-all group focus-visible:z-10 focus-visible:ring-4 focus-visible:ring-primary/20 ${
                selectedCategoryId === 'all'
                  ? 'bg-white dark:bg-[#182130] text-[#008F5A] dark:text-emerald-400 font-black'
                  : 'hover:bg-slate-100 dark:hover:bg-[#141924] text-muted-foreground font-semibold'
              }`}
            >
              {selectedCategoryId === 'all' && (
                <span className="absolute left-0 top-2 bottom-2 w-1 bg-[#008F5A] rounded-r-full shadow-md shadow-emerald-500/50" />
              )}
              <span
                className={`w-12 h-12 rounded-2xl p-2 flex items-center justify-center transition-all ${
                  selectedCategoryId === 'all'
                    ? 'bg-emerald-50 dark:bg-emerald-950/80 border-2 border-[#008F5A] dark:border-emerald-500 shadow-md shadow-emerald-500/20 scale-105'
                    : 'bg-white dark:bg-[#1a202c] border border-border'
                }`}
              >
                <Grid className={`w-6 h-6 ${selectedCategoryId === 'all' ? 'text-[#008F5A] dark:text-emerald-400' : 'text-muted-foreground'}`} />
              </span>
              <span className="text-xs leading-tight line-clamp-2 px-0.5">All</span>
            </button>

            {/* 2. CATEGORY ITEMS LIST */}
            {allCategories.map((cat) => {
              const isSelected = selectedCategoryId === cat.id || selectedCategoryId === cat.slug;

              return (
                <button
                  key={cat.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => handleSelectCategory(cat.slug || cat.id)}
                  className={`relative min-h-24 w-full border-b border-border px-1 py-3 flex flex-col items-center gap-1.5 text-center transition-all group focus-visible:z-10 focus-visible:ring-4 focus-visible:ring-primary/20 ${
                    isSelected
                      ? 'bg-white dark:bg-[#182130] text-[#008F5A] dark:text-emerald-400 font-black'
                      : 'hover:bg-slate-100 dark:hover:bg-[#141924] text-muted-foreground font-semibold'
                  }`}
                >
                  {isSelected && (
                    <span className="absolute left-0 top-2 bottom-2 w-1 bg-[#008F5A] rounded-r-full shadow-md shadow-emerald-500/50" />
                  )}
                  <span
                    className={`w-12 h-12 rounded-2xl p-1 flex items-center justify-center transition-all overflow-hidden ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/80 border-2 border-[#008F5A] dark:border-emerald-500 shadow-md shadow-emerald-500/20 scale-105'
                        : 'bg-white dark:bg-[#1a202c] border border-border'
                    }`}
                  >
                    <img
                      src={cat.image || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=100&q=80'}
                      alt={cat.name}
                      loading="lazy"
                      className="w-full h-full object-contain rounded-xl"
                    />
                  </span>
                  <span className="text-xs leading-tight line-clamp-2 px-0.5">{cat.name}</span>
                </button>
              );
            })}

          </nav>

          {/* ── PRODUCT GRID (Full width on mobile, 2-column density) ── */}
          <section aria-labelledby="category-product-heading" className="min-w-0 flex-1 h-full overflow-y-auto bg-background p-2.5 sm:p-4 lg:p-6 pb-28">
            
            {/* Header / Product Count Row */}
            <div className="flex items-center justify-between px-1 pb-3 pt-1">
              <div>
                <h2 id="category-product-heading" className="text-sm sm:text-base font-extrabold tracking-tight text-foreground">
                  {currentCategory ? currentCategory.name : 'All Products'}
                </h2>
                <span className="text-xs font-medium text-muted-foreground" aria-live="polite">
                  {filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'items'} available
                </span>
              </div>
            </div>

            {/* Empty State */}
            {filteredProducts.length === 0 && (
              <div className="my-6 space-y-3 rounded-2xl border border-border bg-card p-8 text-center shadow-card">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden="true">
                  <ShoppingBag className="h-7 w-7" />
                </div>
                <h3 className="text-base font-bold text-card-foreground">
                  {searchQuery.trim() ? 'No matching products' : 'No products found'}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto">
                  {searchQuery.trim()
                    ? `We couldn't find anything matching “${searchQuery.trim()}”. Try another search term or clear filters.`
                    : 'Try selecting another category or resetting the active filters.'}
                </p>
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="min-h-11 rounded-xl bg-primary-700 px-5 text-xs sm:text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-800 focus-visible:ring-4 focus-visible:ring-primary/20"
                >
                  Clear all filters
                </button>
              </div>
            )}

            {/* 2-Column Grid on Mobile, 3 on Tablet, 4 on Desktop */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 xl:grid-cols-4">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onOpenDetail={handleOpenDetail}
                />
              ))}
            </div>

          </section>

        </div>

        {/* ── 6. MOBILE FILTER BOTTOM SHEET / DRAWER ── */}
        {isFilterDrawerOpen && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            <button
              aria-label="Close filters"
              type="button"
              className="absolute inset-0 cursor-default"
              onClick={() => setIsFilterDrawerOpen(false)}
            />

            <div className="relative max-h-[85vh] w-full overflow-hidden rounded-t-[28px] bg-card border-t border-border shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-250">
              
              {/* Sheet Drag Handle */}
              <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-muted-foreground/30" />

              {/* Sheet Header */}
              <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-primary" />
                  <h3 className="text-base font-bold text-card-foreground">Filters</h3>
                </div>
                <div className="flex items-center gap-3">
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      Clear All
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsFilterDrawerOpen(false)}
                    aria-label="Close filter drawer"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Sheet Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                
                {/* 1. Category Selector */}
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground mb-3">
                    Category
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectCategory('all')}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all text-left ${
                        selectedCategoryId === 'all'
                          ? 'border-[#008F5A] bg-emerald-50 dark:bg-emerald-950/60 text-[#008F5A] dark:text-emerald-300'
                          : 'border-border bg-secondary-bg text-secondary-foreground hover:bg-muted'
                      }`}
                    >
                      <Grid className="w-4 h-4 shrink-0" />
                      <span className="truncate">All Categories</span>
                    </button>
                    {allCategories.map((cat) => {
                      const isSelected = selectedCategoryId === cat.id || selectedCategoryId === cat.slug;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => handleSelectCategory(cat.slug || cat.id)}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all text-left ${
                            isSelected
                              ? 'border-[#008F5A] bg-emerald-50 dark:bg-emerald-950/60 text-[#008F5A] dark:text-emerald-300'
                              : 'border-border bg-secondary-bg text-secondary-foreground hover:bg-muted'
                          }`}
                        >
                          {cat.image ? (
                            <img src={cat.image} alt="" className="w-4 h-4 rounded-full object-contain shrink-0" />
                          ) : (
                            <ShoppingBag className="w-4 h-4 shrink-0" />
                          )}
                          <span className="truncate">{cat.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Subcategory Selector (If active category has subcategories) */}
                {subcategories.length > 0 && (
                  <div>
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground mb-3">
                      Subcategory
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedSubcategory('all')}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                          selectedSubcategory === 'all'
                            ? 'border-[#008F5A] bg-emerald-50 dark:bg-emerald-950/60 text-[#008F5A] dark:text-emerald-300'
                            : 'border-border bg-secondary-bg text-secondary-foreground hover:bg-muted'
                        }`}
                      >
                        All
                      </button>
                      {subcategories.map((sub) => (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => setSelectedSubcategory(sub.id)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                            selectedSubcategory === sub.id
                              ? 'border-[#008F5A] bg-emerald-50 dark:bg-emerald-950/60 text-[#008F5A] dark:text-emerald-300'
                              : 'border-border bg-secondary-bg text-secondary-foreground hover:bg-muted'
                          }`}
                        >
                          {sub.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Availability Toggle */}
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground mb-3">
                    Availability
                  </h4>
                  <label className="flex items-center justify-between p-3 rounded-2xl border border-border bg-secondary-bg cursor-pointer">
                    <span className="text-xs font-bold text-foreground">In Stock Only</span>
                    <input
                      type="checkbox"
                      checked={inStockOnly}
                      onChange={(e) => setInStockOnly(e.target.checked)}
                      className="h-5 w-5 rounded-md border-border text-[#008F5A] focus:ring-primary/20 accent-[#008F5A]"
                    />
                  </label>
                </div>

                {/* 4. Price Range */}
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground mb-3">
                    Price Range
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'all', label: 'All Prices' },
                      { id: 'under-100', label: 'Under ₹100' },
                      { id: '100-300', label: '₹100 to ₹300' },
                      { id: '300-plus', label: 'Above ₹300' },
                    ].map((pr) => (
                      <button
                        key={pr.id}
                        type="button"
                        onClick={() => setPriceRange(pr.id as PriceRangeOption)}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                          priceRange === pr.id
                            ? 'border-[#008F5A] bg-emerald-50 dark:bg-emerald-950/60 text-[#008F5A] dark:text-emerald-300'
                            : 'border-border bg-secondary-bg text-secondary-foreground hover:bg-muted'
                        }`}
                      >
                        {pr.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 5. Sort By */}
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground mb-3">
                    Sort By
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'relevance', label: 'Relevance' },
                      { id: 'price-low', label: 'Price: Low to High' },
                      { id: 'price-high', label: 'Price: High to Low' },
                      { id: 'discount', label: 'Discount' },
                      { id: 'rating', label: 'Customer Rating' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSortBy(opt.id as SortOption)}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                          sortBy === opt.id
                            ? 'border-[#008F5A] bg-emerald-50 dark:bg-emerald-950/60 text-[#008F5A] dark:text-emerald-300'
                            : 'border-border bg-secondary-bg text-secondary-foreground hover:bg-muted'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              {/* Sheet Sticky Footer Action */}
              <div className="border-t border-border bg-card p-4">
                <button
                  type="button"
                  onClick={() => setIsFilterDrawerOpen(false)}
                  className="min-h-12 w-full rounded-2xl bg-primary-700 text-sm font-black text-white shadow-md hover:bg-primary-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <span>Show {filteredProducts.length} {filteredProducts.length === 1 ? 'Product' : 'Products'}</span>
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </CustomerShell>
  );
}
