'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { ProductCard } from '@/components/customer/ProductCard';
import { ProductDetailModal } from '@/components/customer/ProductDetailModal';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState } from '@/components/ui/EmptyState';
import { NoSearchResults } from '@/components/states/NoSearchResults';
import { ProductCardSkeleton } from '@/components/ui/Skeleton';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';
import { Product, Brand } from '@/types';
import { getProductBrand } from '@/lib/brandUtils';
import { INITIAL_BRANDS } from '@/lib/mockData';
import { Search, X, SlidersHorizontal, ChevronDown } from 'lucide-react';

type SortKey = 'relevance' | 'price_asc' | 'price_desc' | 'rating' | 'discount';

const SORT_OPTIONS: { label: string; value: SortKey }[] = [
  { label: 'Relevance', value: 'relevance' },
  { label: 'Price: Low to High', value: 'price_asc' },
  { label: 'Price: High to Low', value: 'price_desc' },
  { label: 'Rating', value: 'rating' },
  { label: 'Discount', value: 'discount' },
];

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get('q') || '';
  const { products, categories, brands, setSearchQuery } = useAppStore();

  const [localQ, setLocalQ] = useState(query);
  const [sort, setSort] = useState<SortKey>('relevance');
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  const availableBrands = brands && brands.length > 0 ? brands : INITIAL_BRANDS;

  // Reset brand/category filters when query changes
  useEffect(() => {
    setLocalQ(query);
    setSearchQuery(query);
    setSelectedCatId(null);
    setSelectedBrandId(null);
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Filter products by query (name + description only)
  const filtered = products.filter((p) => {
    const q = query.trim().toLowerCase();
    const inQuery =
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q);
    const inCat = !selectedCatId || p.categoryId === selectedCatId;
    return inQuery && inCat;
  });

  // Calculate brand counts dynamically for products in search results
  const brandCountMap = new Map<string, { brand: Brand; count: number }>();
  filtered.forEach((p) => {
    const b = getProductBrand(p, availableBrands);
    if (b) {
      const existing = brandCountMap.get(b.id);
      if (existing) {
        existing.count += 1;
      } else {
        brandCountMap.set(b.id, { brand: b, count: 1 });
      }
    }
  });

  const brandCounts = Array.from(brandCountMap.values())
    .map((item) => ({
      ...item.brand,
      count: item.count,
    }))
    .sort((a, b) => b.count - a.count);

  // Apply brand filter on top of category+query filtered list
  const brandFiltered = selectedBrandId
    ? filtered.filter((p) => {
        const b = getProductBrand(p, availableBrands);
        return b?.id === selectedBrandId;
      })
    : filtered;

  // Sort
  const sorted = [...brandFiltered].sort((a, b) => {
    switch (sort) {
      case 'price_asc': return a.sellingPrice - b.sellingPrice;
      case 'price_desc': return b.sellingPrice - a.sellingPrice;
      case 'rating': return b.rating - a.rating;
      case 'discount': return (b.mrp - b.sellingPrice) / b.mrp - (a.mrp - a.sellingPrice) / a.mrp;
      default: return b.reviewsCount - a.reviewsCount;
    }
  });

  // Category counts (from query filtered list)
  const catCounts = categories.map((c) => ({
    ...c,
    count: filtered.filter((p) => p.categoryId === c.id).length,
  })).filter((c) => c.count > 0);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (localQ.trim()) {
      router.push(`/search?q=${encodeURIComponent(localQ.trim())}`);
    }
  };

  return (
    <>
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-5 space-y-5">
        <Breadcrumb
          items={[{ label: query ? `Search: "${query}"` : 'Search' }]}
        />

        {/* Search Input */}
        <form onSubmit={handleSearch} className="relative max-w-2xl">
          <input
            suppressHydrationWarning
            type="text"
            value={localQ}
            onChange={(e) => setLocalQ(e.target.value)}
            placeholder='Search "milk", "atta", "banana"...'
            className="w-full bg-white border border-gray-300 focus:border-emerald-500 text-gray-900 placeholder-gray-400 rounded-xl py-3 pl-11 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-sm"
          />
          <Search className="w-4.5 h-4.5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none w-4 h-4" />
          {localQ && (
            <button
              suppressHydrationWarning
              type="button"
              onClick={() => setLocalQ('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </form>

        {query && (
          <p className="text-sm text-gray-600">
            {loading ? (
              <span className="text-gray-400">Searching…</span>
            ) : (
              <span>
                <span className="font-bold">{sorted.length}</span> result
                {sorted.length !== 1 ? 's' : ''} for{' '}
                <span className="font-bold text-gray-900">"{query}"</span>
              </span>
            )}
          </p>
        )}

        <div className="flex gap-5">
          {/* Sidebar Filter */}
          <aside className="hidden md:block w-56 shrink-0 space-y-6">
            {/* Sort */}
            <div>
              <h3 className="text-xs font-black text-gray-700 uppercase tracking-wider mb-3">Sort By</h3>
              <div className="space-y-1.5">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    suppressHydrationWarning
                    key={opt.value}
                    onClick={() => setSort(opt.value)}
                    className={`w-full text-left text-xs px-3 py-2 rounded-xl transition-colors font-medium ${
                      sort === opt.value
                        ? 'bg-emerald-600 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category Filter */}
            {catCounts.length > 0 && (
              <div>
                <h3 className="text-xs font-black text-gray-700 uppercase tracking-wider mb-3">
                  Category
                </h3>
                <div className="space-y-1.5">
                  <button
                    suppressHydrationWarning
                    onClick={() => setSelectedCatId(null)}
                    className={`w-full text-left text-xs px-3 py-2 rounded-xl transition-colors font-medium flex items-center justify-between ${
                      !selectedCatId ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <span>All Categories</span>
                    <span className="opacity-70">{filtered.length}</span>
                  </button>
                  {catCounts.map((c) => (
                    <button
                      suppressHydrationWarning
                      key={c.id}
                      onClick={() => setSelectedCatId(c.id === selectedCatId ? null : c.id)}
                      className={`w-full text-left text-xs px-3 py-2 rounded-xl transition-colors font-medium flex items-center justify-between ${
                        selectedCatId === c.id
                          ? 'bg-emerald-600 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <span className="truncate mr-2">{c.name}</span>
                      <span className="opacity-70 shrink-0">{c.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* Brand Filter */}
            {brandCounts.length > 0 && (
              <div>
                <h3 className="text-xs font-black text-gray-700 uppercase tracking-wider mb-3">
                  Brand
                </h3>
                <div className="space-y-1.5">
                  <button
                    suppressHydrationWarning
                    onClick={() => setSelectedBrandId(null)}
                    className={`w-full text-left text-xs px-3 py-2 rounded-xl transition-colors font-medium flex items-center justify-between ${
                      !selectedBrandId ? 'bg-emerald-600 text-white font-bold' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <span>All Brands</span>
                    <span className="opacity-70">{filtered.length}</span>
                  </button>
                  {brandCounts.map((b) => (
                    <button
                      suppressHydrationWarning
                      key={b.id}
                      onClick={() => setSelectedBrandId(b.id === selectedBrandId ? null : b.id)}
                      className={`w-full text-left text-xs px-3 py-2 rounded-xl transition-colors font-medium flex items-center justify-between gap-2 ${
                        selectedBrandId === b.id
                          ? 'bg-emerald-600 text-white font-bold'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <span className="truncate">{b.name}</span>
                      <span className="opacity-70 shrink-0">{b.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>

          {/* Results Grid */}
          <div className="flex-1 min-w-0">
            {/* Mobile sort bar */}
            <div className="md:hidden flex items-center gap-2 mb-3">
              <select
                suppressHydrationWarning
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500 bg-white"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Mobile brand pills */}
            {brandCounts.length > 0 && (
              <div className="md:hidden flex items-center gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
                <button
                  suppressHydrationWarning
                  onClick={() => setSelectedBrandId(null)}
                  className={`shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-full border transition-colors ${
                    !selectedBrandId
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  All Brands ({filtered.length})
                </button>
                {brandCounts.map((b) => (
                  <button
                    suppressHydrationWarning
                    key={b.id}
                    onClick={() => setSelectedBrandId(b.id === selectedBrandId ? null : b.id)}
                    className={`shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-full border transition-colors ${
                      selectedBrandId === b.id
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-gray-600 border-gray-200'
                    }`}
                  >
                    {b.name} <span className="opacity-60">({b.count})</span>
                  </button>
                ))}
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            ) : sorted.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
                <NoSearchResults
                  query={query}
                  onClearSearch={() => {
                    setLocalQ('');
                    router.push('/search');
                  }}
                  onSelectSuggestion={(suggestion) => {
                    setLocalQ(suggestion);
                    router.push(`/search?q=${encodeURIComponent(suggestion)}`);
                  }}
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {sorted.map((prod) => (
                  <ProductCard
                    key={prod.id}
                    product={prod}
                    onOpenDetail={setSelectedProduct}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ProductDetailModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
    </>
  );
}

export default function SearchPage() {
  return (
    <>
      <RoleSwitcher />
      <CustomerLayout>
        <Suspense fallback={
          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
            </div>
          </div>
        }>
          <SearchContent />
        </Suspense>
      </CustomerLayout>
    </>
  );
}
