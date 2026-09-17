'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { ProductCard } from '@/components/customer/ProductCard';
import { Product, Category } from '@/types';
import {
  ChevronRight,
  Filter,
  Sparkles,
  Layers,
  SlidersHorizontal,
  FolderOpen,
  ArrowRight,
  ShoppingBag,
  Building2,
} from 'lucide-react';

type SortKey = 'relevance' | 'price-low' | 'price-high' | 'rating' | 'discount';

export default function DedicatedCategoryPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slugParam = (params?.slug as string) || 'fruits-vegetables';
  const subQuery = searchParams.get('sub');

  const [mounted, setMounted] = useState(false);
  const { categories, products, brands } = useAppStore();
  const [activeSubTab, setActiveSubTab] = useState<string>(subQuery || 'all');
  const [activeBrandId, setActiveBrandId] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortKey>('relevance');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Top-level active categories
  const activeTopCategories = useMemo(() => {
    return categories
      .filter((c) => !c.parentId && c.isActive !== false)
      .sort((a, b) => (a.displayOrder || a.sortOrder || 0) - (b.displayOrder || b.sortOrder || 0));
  }, [categories]);

  // Current category from database
  const currentCategory: Category = useMemo(() => {
    const found = activeTopCategories.find(
      (c) => c.slug === slugParam || c.id === slugParam
    );
    return (
      found ||
      activeTopCategories[0] || {
        id: 'cat-default',
        name: 'All Groceries',
        slug: 'all-groceries',
        image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=200&q=80',
        sortOrder: 1,
        displayOrder: 1,
        isActive: true,
      }
    );
  }, [activeTopCategories, slugParam]);

  // Dynamic subcategories loaded strictly from Database/Store for the active category
  const dynamicSubcategories: Category[] = useMemo(() => {
    return categories
      .filter((c) => c.parentId === currentCategory.id && c.isActive !== false)
      .sort((a, b) => (a.displayOrder || a.sortOrder || 0) - (b.displayOrder || b.sortOrder || 0));
  }, [categories, currentCategory.id]);

  // Reset subtab selection to 'all' or URL query when category changes
  useEffect(() => {
    setActiveSubTab(subQuery || 'all');
    setActiveBrandId('all');
  }, [slugParam, subQuery]);

  // Active subcategory object
  const activeSubcategory = useMemo(() => {
    if (activeSubTab === 'all') return null;
    return dynamicSubcategories.find((s) => s.id === activeSubTab || s.slug === activeSubTab);
  }, [dynamicSubcategories, activeSubTab]);

  // Dynamically filter products for this category & active subcategory
  const filteredProducts = useMemo(() => {
    const subIds = new Set(dynamicSubcategories.map((s) => s.id));

    let list = products.filter((p) => {
      // 1. Direct category match
      if (p.categoryId === currentCategory.id) {
        if (activeSubTab === 'all') return true;
        if (activeSubcategory && (p.subcategoryId === activeSubcategory.id || p.subcategoryId === activeSubcategory.slug)) {
          return true;
        }
        // Match by subcategory name in product name/description
        if (activeSubcategory) {
          const sName = activeSubcategory.name.toLowerCase();
          const pName = p.name.toLowerCase();
          const pDesc = (p.description || '').toLowerCase();
          return pName.includes(sName) || pDesc.includes(sName);
        }
        return true;
      }

      // 2. Product has subcategory belonging to this category
      if (p.subcategoryId && subIds.has(p.subcategoryId)) {
        if (activeSubTab === 'all') return true;
        return activeSubcategory ? p.subcategoryId === activeSubcategory.id : false;
      }

      // 3. Fallback name/slug match for legacy products
      const catNameLower = currentCategory.name.toLowerCase();
      const pNameLower = p.name.toLowerCase();
      const isMatchingCat = pNameLower.includes(catNameLower.split(' ')[0]);

      if (isMatchingCat) {
        if (activeSubTab === 'all') return true;
        if (activeSubcategory) {
          const sName = activeSubcategory.name.toLowerCase();
          return pNameLower.includes(sName);
        }
      }

      return false;
    });

    // Fallback if no products yet in this newly created category
    if (list.length === 0 && activeSubTab === 'all') {
      list = products.filter((p) => p.categoryId === currentCategory.id);
    }

    // Apply Sorting
    switch (sortBy) {
      case 'price-low':
        return [...list].sort((a, b) => a.sellingPrice - b.sellingPrice);
      case 'price-high':
        return [...list].sort((a, b) => b.sellingPrice - a.sellingPrice);
      case 'rating':
        return [...list].sort((a, b) => b.rating - a.rating);
      case 'discount':
        return [...list].sort((a, b) => {
          const discA = a.mrp > a.sellingPrice ? (a.mrp - a.sellingPrice) / a.mrp : 0;
          const discB = b.mrp > b.sellingPrice ? (b.mrp - b.sellingPrice) / b.mrp : 0;
          return discB - discA;
        });
      default:
        return [...list].sort((a, b) => (b.reviewsCount || 0) - (a.reviewsCount || 0));
    }
  }, [products, currentCategory, dynamicSubcategories, activeSubTab, activeSubcategory, sortBy]);

  // Brands available in this category (computed dynamically from actual products)
  const categoryBrands = useMemo(() => {
    // Get all products in current category (before brand filtering)
    const subIds = new Set(dynamicSubcategories.map((s) => s.id));
    const catProducts = products.filter((p) => {
      if (p.categoryId === currentCategory.id) return true;
      if (p.subcategoryId && subIds.has(p.subcategoryId)) return true;
      return false;
    });

    // Count per brand
    const brandCounts = new Map<string, number>();
    catProducts.forEach((p) => {
      if (p.brandId) {
        brandCounts.set(p.brandId, (brandCounts.get(p.brandId) || 0) + 1);
      }
    });

    // Return only active brands that have products in this category
    return brands
      .filter((b) => b.isActive !== false && brandCounts.has(b.id))
      .map((b) => ({ brand: b, count: brandCounts.get(b.id) || 0 }))
      .sort((a, b) => b.count - a.count);
  }, [brands, products, currentCategory, dynamicSubcategories]);

  // Apply brand filter on top of existing filtered products
  const displayProducts = useMemo(() => {
    if (activeBrandId === 'all') return filteredProducts;
    return filteredProducts.filter((p) => p.brandId === activeBrandId);
  }, [filteredProducts, activeBrandId]);

  const handleNavigateToProduct = (product: Product) => {
    router.push(`/product/${product.slug}`);
  };

  return (
    <>
      <RoleSwitcher />
      <CustomerLayout>
        <div suppressHydrationWarning className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-5 space-y-4 sm:space-y-5 font-sans">
          {/* ── 1. DYNAMIC BREADCRUMB PATH ── */}
          <nav className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-bold text-slate-500 overflow-x-auto no-scrollbar scrollbar-none">
            <Link href="/" className="hover:text-emerald-700 transition-colors shrink-0">
              Home
            </Link>
            <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
            <Link href="/categories" className="hover:text-emerald-700 transition-colors shrink-0">
              Categories
            </Link>
            <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="text-slate-700 font-extrabold shrink-0 truncate max-w-[120px] sm:max-w-none">
              {currentCategory.name}
            </span>
            {activeSubcategory && (
              <>
                <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="text-emerald-700 font-black shrink-0 truncate max-w-[120px] sm:max-w-none">
                  {activeSubcategory.name}
                </span>
              </>
            )}
          </nav>

          {/* ── 2. TOP HORIZONTAL CATEGORY NAVIGATION BAR ── */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-2 sm:p-2.5 shadow-2xs">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-0.5 px-0.5">
              {activeTopCategories.map((cat) => {
                const isSelected = cat.id === currentCategory.id || cat.slug === currentCategory.slug;
                return (
                  <Link
                    key={cat.id}
                    href={`/category/${cat.slug}`}
                    className={`px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-black transition-all flex items-center gap-2 shrink-0 border ${
                      isSelected
                        ? 'bg-[#0B8F5A] text-white border-[#0B8F5A] shadow-2xs scale-[1.02]'
                        : 'bg-slate-50 hover:bg-white text-slate-700 hover:text-slate-900 border-slate-200/70 hover:border-slate-300'
                    }`}
                  >
                    <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-lg overflow-hidden bg-white/80 p-0.5 shrink-0 flex items-center justify-center">
                      <img
                        src={cat.image || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=100&q=80'}
                        alt={cat.name}
                        className="w-full h-full object-contain rounded"
                      />
                    </div>
                    <span>{cat.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* ── 3. MAIN CONTENT AREA ── */}
          <main className="w-full space-y-4 sm:space-y-6" suppressHydrationWarning>
            {/* Category Page Title, Subtitle & Sort Selector */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-[#075C3C] tracking-tight">
                    {activeSubcategory ? activeSubcategory.name : currentCategory.name}
                  </h1>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                    {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'} available in{' '}
                    {currentCategory.name}
                  </p>
                </div>

                {/* Sort Selector */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-[11px] sm:text-xs font-bold text-slate-600">Sort:</span>
                  <select
                    suppressHydrationWarning
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortKey)}
                    className="bg-white border border-slate-200 rounded-xl text-[11px] sm:text-xs font-bold px-2.5 py-1 sm:py-1.5 text-slate-800 focus:outline-none focus:border-[#0B8F5A] shadow-2xs"
                  >
                    <option value="relevance">Popularity</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                    <option value="rating">Highest Rated</option>
                    <option value="discount">Highest Savings</option>
                  </select>
                </div>
              </div>

              {/* ── 4. DYNAMIC SUBCATEGORIES HORIZONTAL FILTER CHIPS ── */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pb-1 pt-1">
                {/* Chip 1: All in Category */}
                <button
                  type="button"
                  onClick={() => setActiveSubTab('all')}
                  className={`px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-black transition-all flex items-center gap-1.5 sm:gap-2 shrink-0 border ${
                    activeSubTab === 'all'
                      ? 'bg-[#075C3C] text-white border-[#075C3C] shadow-2xs'
                      : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>All {currentCategory.name}</span>
                </button>

                {/* Dynamic Subcategories from DB */}
                {dynamicSubcategories.map((sub) => {
                  const isSelected = activeSubTab === sub.id || activeSubTab === sub.slug;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setActiveSubTab(sub.id)}
                      className={`px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-black transition-all flex items-center gap-1.5 sm:gap-2 shrink-0 border ${
                        isSelected
                          ? 'bg-[#0B8F5A] text-white border-[#0B8F5A] shadow-2xs'
                          : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
                      }`}
                    >
                      {sub.image && (
                        <img
                          src={sub.image}
                          alt={sub.name}
                          className="w-3.5 h-3.5 object-contain rounded-xs"
                        />
                      )}
                      <span>{sub.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── 4.5 DYNAMIC BRAND FILTER PILLS ── */}
            {categoryBrands.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-[#0B8F5A]" />
                  <span className="text-[10px] sm:text-[11px] font-black text-slate-600 uppercase tracking-wider">
                    Filter by Brand
                  </span>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pb-1">
                  <button
                    type="button"
                    onClick={() => setActiveBrandId('all')}
                    className={`px-3 py-1.5 rounded-full text-[10px] sm:text-[11px] font-bold whitespace-nowrap transition-all shrink-0 border ${
                      activeBrandId === 'all'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    All Brands
                  </button>
                  {categoryBrands.map(({ brand, count }) => (
                    <button
                      key={brand.id}
                      type="button"
                      onClick={() => setActiveBrandId(brand.id === activeBrandId ? 'all' : brand.id)}
                      className={`px-3 py-1.5 rounded-full text-[10px] sm:text-[11px] font-bold whitespace-nowrap transition-all shrink-0 border flex items-center gap-1.5 ${
                        activeBrandId === brand.id
                          ? 'bg-[#0B8F5A] text-white border-[#0B8F5A]'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200'
                      }`}
                    >
                      {(brand.logoUrl || brand.logo) && (
                        <img
                          src={brand.logoUrl || brand.logo}
                          alt={brand.name}
                          className="w-3.5 h-3.5 object-contain rounded"
                        />
                      )}
                      <span>{brand.name}</span>
                      <span className={`text-[9px] px-1 rounded font-black ${
                        activeBrandId === brand.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── 5. DYNAMIC PRODUCT GRID ── */}
            {displayProducts.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 text-center space-y-4 shadow-2xs">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-50 text-slate-400 mx-auto flex items-center justify-center">
                  <FolderOpen className="w-7 h-7 sm:w-8 sm:h-8" />
                </div>
                <h3 className="text-sm sm:text-base font-black text-slate-900">No products found in this section</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {activeSubcategory
                    ? `There are currently no items under "${activeSubcategory.name}". Switch to "All ${currentCategory.name}" or explore other categories.`
                    : `No products are currently assigned to "${currentCategory.name}". Products will appear once added by admin.`}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('all')}
                  className="bg-[#0B8F5A] hover:bg-[#075C3C] text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors shadow-2xs inline-flex items-center gap-1.5"
                >
                  <Layers className="w-4 h-4" />
                  <span>View All {currentCategory.name}</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-4">
                {displayProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onOpenDetail={handleNavigateToProduct}
                  />
                ))}
              </div>
            )}
          </main>
        </div>
      </CustomerLayout>
    </>
  );
}
