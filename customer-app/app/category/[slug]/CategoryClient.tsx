'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import CustomerShell from '../../../components/CustomerShell';
import { ProductCard } from '@/components/customer/ProductCard';
import { INITIAL_PRODUCTS, INITIAL_CATEGORIES } from '@/lib/mockData';
import { Product, Category } from '@/types';
import { SlidersHorizontal, ArrowUpDown, ChevronDown, Search } from 'lucide-react';

type SortOption = 'relevance' | 'price-low' | 'price-high' | 'rating';

export default function CategoryClient() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const params = useParams();
  const slug = (params?.slug as string) || '';

  const { categories, products } = useAppStore();
  const [activeSubTab, setActiveSubTab] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  // Merged Categories
  const allCategories = useMemo(() => {
    return categories && categories.length > 0 ? categories : INITIAL_CATEGORIES;
  }, [categories]);

  // Current category
  const currentCategory: Category = useMemo(() => {
    const found = allCategories.find((c) => c.slug === slug || c.id === slug);
    return found || allCategories[0] || {
      id: 'cat-default',
      name: 'Groceries',
      slug: 'groceries',
      image: '',
      sortOrder: 0,
      isActive: true,
    };
  }, [allCategories, slug]);

  // Subcategories
  const subcategories: Category[] = useMemo(() => {
    return allCategories
      .filter((c) => c.parentId === currentCategory.id && c.isActive !== false)
      .sort((a, b) => (a.displayOrder || a.sortOrder || 0) - (b.displayOrder || b.sortOrder || 0));
  }, [allCategories, currentCategory.id]);

  // Merged Products
  const allProducts = useMemo(() => {
    const map = new Map<string, Product>();
    INITIAL_PRODUCTS.forEach((p) => map.set(p.id, p));
    (products || []).forEach((p) => {
      const existing = map.get(p.id);
      map.set(p.id, { ...existing, ...p });
    });
    return Array.from(map.values()).filter((p) => p.status !== 'discontinued');
  }, [products]);

  // Filtered products for this category
  const catProducts = useMemo(() => {
    let list = allProducts.filter((p) => {
      if (p.categoryId === currentCategory.id || p.categoryId === currentCategory.slug) {
        if (activeSubTab === 'all') return true;
        if (p.subcategoryId === activeSubTab) return true;
        return true;
      }
      if (activeSubTab !== 'all' && p.subcategoryId === activeSubTab) return true;
      if ((p as any).category && currentCategory.name &&
        (p as any).category.toLowerCase() === currentCategory.name.toLowerCase()) {
        return true;
      }
      return false;
    });

    if (sortBy === 'price-low') {
      list = [...list].sort((a, b) => a.sellingPrice - b.sellingPrice);
    } else if (sortBy === 'price-high') {
      list = [...list].sort((a, b) => b.sellingPrice - a.sellingPrice);
    } else if (sortBy === 'rating') {
      list = [...list].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }

    return list;
  }, [allProducts, currentCategory, activeSubTab, sortBy]);

  const handleOpenDetail = (product: Product) => {
    router.push(`/product/${product.id || product.slug}`);
  };

  const sortLabels: Record<SortOption, string> = {
    relevance: 'Relevance',
    'price-low': 'Price: Low → High',
    'price-high': 'Price: High → Low',
    rating: 'Top Rated',
  };

  if (!mounted) {
    return (
      <CustomerShell title="Category">
        <div className="min-h-screen bg-[#121215] animate-pulse p-4 space-y-4">
          <div className="h-12 bg-slate-800 rounded-2xl" />
          <div className="flex gap-3">
            <div className="w-16 bg-slate-800 rounded-2xl min-h-[60vh]" />
            <div className="flex-1 grid grid-cols-2 gap-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-48 bg-slate-800 rounded-2xl" />
              ))}
            </div>
          </div>
        </div>
      </CustomerShell>
    );
  }

  return (
    <CustomerShell title={currentCategory?.name || 'Category'} showBack backUrl="/categories">
      {/* Full-bleed dark wrapper — overrides CustomerShell's default bg */}
      <div
        className="min-h-screen pb-24"
        style={{ background: '#121215', margin: '-16px', padding: '0' }}
      >

        {/* ── FILTER / SORT TOOLBAR ── */}
        <div className="sticky top-[68px] z-30 flex items-center gap-2 px-3 py-2.5 bg-[#121215] border-b border-slate-800/60 overflow-x-auto no-scrollbar">
          
          {/* Search Button */}
          <button
            onClick={() => router.push('/search')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1C1C22] border border-slate-700/60 text-slate-300 text-xs font-bold shrink-0 active:scale-95 transition-all cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
            Filters
          </button>

          {/* Sort Dropdown */}
          <div className="relative shrink-0" ref={sortMenuRef}>
            <button
              onClick={() => setShowSortMenu((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1C1C22] border border-slate-700/60 text-slate-300 text-xs font-bold active:scale-95 transition-all cursor-pointer"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-emerald-400" />
              Sort
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${showSortMenu ? 'rotate-180' : ''}`} />
            </button>
            {showSortMenu && (
              <div className="absolute left-0 top-full mt-1.5 w-48 bg-[#1C1C22] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-50">
                {(Object.entries(sortLabels) as [SortOption, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => { setSortBy(key); setShowSortMenu(false); }}
                    className={`w-full text-left px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
                      sortBy === key
                        ? 'bg-emerald-700/30 text-emerald-400'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product count chip */}
          <div className="ml-auto shrink-0 bg-[#1C1C22] border border-slate-800/60 px-3 py-1.5 rounded-xl">
            <span className="text-[11px] font-bold text-slate-400">{catProducts.length} items</span>
          </div>
        </div>

        {/* ── MAIN BODY: SIDEBAR + PRODUCTS ── */}
        <div className="flex" style={{ minHeight: 'calc(100vh - 130px)' }}>

          {/* ── LEFT SUBCATEGORY SIDEBAR ── */}
          {subcategories.length > 0 && (
            <div className="w-[72px] shrink-0 bg-[#0E0E12] border-r border-slate-800/60 sticky top-[117px] overflow-y-auto"
              style={{ maxHeight: 'calc(100vh - 117px)', alignSelf: 'flex-start' }}>

              {/* All tab */}
              <button
                onClick={() => setActiveSubTab('all')}
                className={`w-full flex flex-col items-center gap-1 py-3 px-1 transition-all cursor-pointer border-l-2 ${
                  activeSubTab === 'all'
                    ? 'border-l-emerald-500 bg-[#1C1C22]'
                    : 'border-l-transparent hover:bg-[#1a1a20]'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xs transition-colors ${
                  activeSubTab === 'all'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#2a2a32] text-slate-300'
                }`}>
                  All
                </div>
                <span className={`text-[9px] font-bold text-center leading-tight ${
                  activeSubTab === 'all' ? 'text-emerald-400' : 'text-slate-400'
                }`}>
                  All
                </span>
              </button>

              {subcategories.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setActiveSubTab(sub.id)}
                  className={`w-full flex flex-col items-center gap-1 py-3 px-1 transition-all cursor-pointer border-l-2 ${
                    activeSubTab === sub.id
                      ? 'border-l-emerald-500 bg-[#1C1C22]'
                      : 'border-l-transparent hover:bg-[#1a1a20]'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full overflow-hidden border transition-colors ${
                    activeSubTab === sub.id
                      ? 'border-emerald-500'
                      : 'border-slate-700'
                  }`}>
                    {sub.image ? (
                      <img
                        src={sub.image}
                        alt={sub.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center font-black text-[10px] ${
                        activeSubTab === sub.id
                          ? 'bg-emerald-700 text-white'
                          : 'bg-[#2a2a32] text-slate-300'
                      }`}>
                        {sub.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className={`text-[9px] font-bold text-center leading-tight line-clamp-2 px-0.5 ${
                    activeSubTab === sub.id ? 'text-emerald-400' : 'text-slate-400'
                  }`}>
                    {sub.name}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* ── RIGHT PRODUCT GRID ── */}
          <div className="flex-1 min-w-0 p-3">

            {/* Category name header */}
            <div className="mb-3 flex items-center gap-2">
              {currentCategory?.image && (
                <img
                  src={currentCategory.image}
                  alt={currentCategory.name}
                  className="w-7 h-7 rounded-full object-cover border border-slate-700"
                />
              )}
              <h1 className="text-sm font-black text-white truncate">
                {currentCategory?.name || 'Category'}
              </h1>
            </div>

            {catProducts.length === 0 ? (
              <div className="bg-[#1C1C22] border border-slate-800/60 rounded-3xl p-8 text-center space-y-3 mt-6">
                <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center mx-auto">
                  <Search className="w-6 h-6 text-slate-500" />
                </div>
                <p className="text-sm font-bold text-slate-300">No products found</p>
                <p className="text-xs text-slate-500">Try selecting a different subcategory</p>
                <button
                  onClick={() => setActiveSubTab('all')}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-all active:scale-95 cursor-pointer"
                >
                  View All Products
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {catProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onOpenDetail={handleOpenDetail}
                  />
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </CustomerShell>
  );
}
