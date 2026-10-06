'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { Brand, Product, ProductVariant } from '@/types';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';
import { ProductCard } from '@/components/customer/ProductCard';
import { showToast } from '@/components/ui/Toast';
import {
  ArrowLeft,
  Building2,
  Package,
  ChevronRight,
  Tag,
  SlidersHorizontal,
  Search,
  Grid3X3,
  List,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

type SortOption = 'default' | 'price-asc' | 'price-desc' | 'name-asc' | 'rating-desc';

export default function BrandLandingPage() {
  const params = useParams();
  const router = useRouter();
  const slug = typeof params?.slug === 'string' ? params.slug : '';

  const { brands, products, categories, cart, addToCart } = useAppStore();

  const [mounted, setMounted] = useState(false);
  const [apiProducts, setApiProducts] = useState<Product[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Find the brand by slug from authoritative store brands
  const brand = useMemo<Brand | undefined>(() => {
    return (brands || []).find((b) => b.slug === slug || b.id === slug);
  }, [brands, slug]);

  // Fetch live products for this brand from API
  useEffect(() => {
    if (!brand?.id) return;
    fetch(`/api/brands/${brand.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.products && Array.isArray(data.products) && data.products.length > 0) {
          setApiProducts(data.products);
        }
      })
      .catch(() => {});
  }, [brand?.id]);

  // Combined product pool (Store + API)
  const allProductsPool = useMemo(() => {
    const map = new Map<string, Product>();
    // 1. Overlay store products
    (products || []).forEach((p) => {
      const existing = map.get(p.id);
      map.set(p.id, { ...existing, ...p });
    });
    // 2. Overlay API products
    apiProducts.forEach((p) => {
      const existing = map.get(p.id);
      map.set(p.id, { ...existing, ...p });
    });
    return Array.from(map.values());
  }, [products, apiProducts]);

  // All products under this brand (with multiple robust matching layers)
  const brandProducts = useMemo<Product[]>(() => {
    if (!brand) return [];
    const bName = brand.name.toLowerCase();
    const bSlug = brand.slug.toLowerCase();
    const bKeyword = bName.split(' ')[0].replace(/[^a-z0-9]/g, '');

    return allProductsPool.filter((p) => {
      // Exclude discontinued products
      if (p.status === 'discontinued' || (p as any).status === 'inactive' || (p as any).status === false) {
        return false;
      }

      // 1. Direct brandId match (by ID or Slug)
      if (
        p.brandId &&
        (p.brandId === brand.id ||
          p.brandId.toLowerCase() === bSlug ||
          p.brandId.toLowerCase() === `brand-${bSlug}` ||
          p.brandId.toLowerCase() === `b-${bSlug}`)
      ) {
        return true;
      }

      // 2. Direct brandName match
      if (p.brandName && p.brandName.toLowerCase() === bName) {
        return true;
      }

      // 3. Match product name / slug containing brand keyword (e.g. "Britannia Bread", "amul-gold")
      const pName = (p.name || '').toLowerCase();
      const pSlug = (p.slug || '').toLowerCase();
      if (bKeyword && bKeyword.length >= 3) {
        if (pName.includes(bKeyword) || pSlug.includes(bKeyword)) {
          return true;
        }
      }

      return false;
    });
  }, [allProductsPool, brand]);

  // Category tabs from products
  const categoryTabs = useMemo(() => {
    const catIds = [...new Set(brandProducts.map((p) => p.categoryId).filter(Boolean))];
    const cats = catIds
      .map((id) => (categories || []).find((c) => c.id === id))
      .filter(Boolean) as typeof categories;
    return cats;
  }, [brandProducts, categories]);

  // Filtered & sorted products
  const displayProducts = useMemo(() => {
    let list = brandProducts;

    if (selectedCategoryFilter !== 'all') {
      list = list.filter(
        (p) => p.categoryId === selectedCategoryFilter || p.subcategoryId === selectedCategoryFilter
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.unit?.toLowerCase().includes(q)
      );
    }

    switch (sortBy) {
      case 'price-asc':
        list = [...list].sort((a, b) => a.sellingPrice - b.sellingPrice);
        break;
      case 'price-desc':
        list = [...list].sort((a, b) => b.sellingPrice - a.sellingPrice);
        break;
      case 'name-asc':
        list = [...list].sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'rating-desc':
        list = [...list].sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
    }

    return list;
  }, [brandProducts, selectedCategoryFilter, searchQuery, sortBy]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-xs text-slate-500 font-bold">Loading brand...</div>
      </div>
    );
  }

  if (!brand) {
    return (
      <>
        <RoleSwitcher />
        <CustomerLayout>
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Building2 className="w-8 h-8 text-slate-400" />
            </div>
            <h2 className="font-black text-slate-900 text-xl">Brand Not Found</h2>
            <p className="text-sm text-slate-500 max-w-xs">
              The brand <span className="font-bold text-slate-800">&ldquo;{slug}&rdquo;</span> could not be found.
            </p>
            <button
              onClick={() => router.back()}
              className="bg-emerald-600 text-white font-bold text-xs px-5 py-2.5 rounded-xl"
            >
              Go Back
            </button>
          </div>
        </CustomerLayout>
      </>
    );
  }

  const brandLogoUrl = brand.logoUrl || brand.logo || '';
  const brandBannerUrl = brand.bannerUrl || brand.banner || '';

  return (
    <>
      <RoleSwitcher />
      <CustomerLayout>

      {/* ── HERO BANNER ── */}
      <div className="relative overflow-hidden">
        {/* Background Banner */}
        <div
          className="h-44 sm:h-56 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative"
          style={
            brandBannerUrl
              ? { backgroundImage: `url(${brandBannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : {}
          }
        >
          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/40 to-transparent" />

          {/* Back Button */}
          <button
            onClick={() => router.back()}
            className="absolute top-4 left-4 z-10 w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Brand Info Card (overlapping banner) */}
        <div className="max-w-5xl mx-auto px-4 relative -mt-10 z-10 pb-2">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-5 flex items-center gap-5">
            {/* Logo */}
            <div className="w-20 h-20 rounded-2xl bg-slate-50 border-2 border-slate-200 flex items-center justify-center overflow-hidden shadow-sm shrink-0">
              {brandLogoUrl ? (
                <img src={brandLogoUrl} alt={brand.name} className="w-full h-full object-contain p-2" />
              ) : (
                <span className="font-black text-slate-500 text-2xl uppercase">
                  {brand.name.slice(0, 2)}
                </span>
              )}
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-black text-slate-900 text-xl leading-tight">{brand.name}</h1>
                {brand.isActive !== false ? (
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black px-2 py-0.5 rounded-full">
                    Official Brand
                  </span>
                ) : (
                  <span className="bg-red-50 text-red-700 border border-red-200 text-[10px] font-black px-2 py-0.5 rounded-full">
                    Inactive
                  </span>
                )}
              </div>

              {brand.description && (
                <p className="text-xs text-slate-600 mt-1 leading-relaxed line-clamp-2">
                  {brand.description}
                </p>
              )}

              {/* Meta info */}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="text-[11px] text-slate-500 font-bold flex items-center gap-1">
                  <Package className="w-3 h-3 text-emerald-600" />
                  {brandProducts.length} Products Available
                </span>
                {categoryTabs.length > 0 && (
                  <span className="text-[11px] text-slate-500 font-bold flex items-center gap-1">
                    <Tag className="w-3 h-3 text-emerald-600" />
                    {categoryTabs.length} {categoryTabs.length === 1 ? 'Category' : 'Categories'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="max-w-5xl mx-auto w-full px-4 mt-5 space-y-5">

        {/* ── CATEGORY FILTER TABS ── */}
        {categoryTabs.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setSelectedCategoryFilter('all')}
              className={`px-4 py-1.5 rounded-full font-bold text-xs whitespace-nowrap transition-all shrink-0 ${
                selectedCategoryFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              All Products ({brandProducts.length})
            </button>
            {categoryTabs.map((cat) => {
              const catCount = brandProducts.filter(
                (p) => p.categoryId === cat.id || p.subcategoryId === cat.id
              ).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryFilter(cat.id)}
                  className={`px-4 py-1.5 rounded-full font-bold text-xs whitespace-nowrap transition-all shrink-0 ${
                    selectedCategoryFilter === cat.id
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200'
                  }`}
                >
                  {cat.name} ({catCount})
                </button>
              );
            })}
          </div>
        )}

        {/* ── SEARCH + SORT BAR ── */}
        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={`Search ${brand.name} products...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600"
            />
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-600 shrink-0"
          >
            <option value="default">Relevance</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="name-asc">Name: A to Z</option>
            <option value="rating-desc">Top Rated</option>
          </select>

          {/* View Toggle */}
          <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2.5 transition-colors ${viewMode === 'grid' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2.5 transition-colors ${viewMode === 'list' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── RESULTS COUNT ── */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500 font-bold">
            {displayProducts.length} {displayProducts.length === 1 ? 'product' : 'products'} found
          </span>
          {(searchQuery || selectedCategoryFilter !== 'all') && (
            <button
              onClick={() => { setSearchQuery(''); setSelectedCategoryFilter('all'); }}
              className="text-xs text-emerald-700 font-bold hover:underline"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* ── PRODUCTS GRID / LIST ── */}
        {displayProducts.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto">
              <Package className="w-7 h-7 text-slate-300" />
            </div>
            <h4 className="font-black text-slate-700 text-base">No Products Found</h4>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              {searchQuery
                ? `No ${brand.name} products match "${searchQuery}".`
                : `No products available in this category from ${brand.name}.`}
            </p>
            {(searchQuery || selectedCategoryFilter !== 'all') && (
              <button
                onClick={() => { setSearchQuery(''); setSelectedCategoryFilter('all'); }}
                className="bg-emerald-600 text-white text-xs font-bold px-5 py-2.5 rounded-xl"
              >
                Show All {brand.name} Products
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {displayProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          /* List View */
          <div className="space-y-2">
            {displayProducts.map((product) => {
              const cartItem = cart.find((c) => c.productId === product.id);
              return (
                <div
                  key={product.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-3.5 flex items-center gap-4 hover:shadow-md transition-shadow"
                >
                  <img
                    src={product.thumbnail}
                    alt={product.name}
                    className="w-16 h-16 rounded-xl object-contain bg-slate-50 border border-slate-100 p-1 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="font-extrabold text-slate-900 text-sm block truncate">{product.name}</span>
                    <span className="text-xs text-slate-500 block">{product.unit}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-black text-emerald-700 text-sm">₹{product.sellingPrice}</span>
                      {product.mrp > product.sellingPrice && (
                        <span className="text-xs text-slate-400 line-through">₹{product.mrp}</span>
                      )}
                      {product.mrp > product.sellingPrice && (
                        <span className="text-[10px] text-emerald-700 font-black bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-md">
                          {Math.round(((product.mrp - product.sellingPrice) / product.mrp) * 100)}% OFF
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      addToCart(product, 1);
                      showToast(`${product.name} added to cart!`, 'success');
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-2 rounded-xl transition-colors shrink-0"
                  >
                    {cartItem ? `In Cart (${cartItem.quantity})` : 'Add'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      </CustomerLayout>
    </>
  );
}
