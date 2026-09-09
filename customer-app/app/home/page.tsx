'use client';

import React, { useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import CustomerShell from '../../components/CustomerShell';
import { HeroBanner } from '@/components/customer/HeroBanner';
import { CategoryGrid } from '@/components/customer/CategoryGrid';
import { ProductCarouselSection } from '@/components/customer/ProductCarouselSection';
import { DualPromoBanner } from '@/components/customer/DualPromoBanner';
import { ServiceBenefits } from '@/components/customer/ServiceBenefits';
import { INITIAL_PRODUCTS, INITIAL_CATEGORIES, INITIAL_BRANDS } from '@/lib/mockData';
import { Product } from '@/types';
import { Search, Sparkles, Building2, Flame, ArrowRight } from 'lucide-react';

export default function CustomerHome() {
  const router = useRouter();
  const { products, categories, brands, isLoggedIn } = useAppStore();

  // Guard: if not logged in, redirect to login
  useEffect(() => {
    if (!isLoggedIn) {
      router.replace('/login');
    }
  }, [isLoggedIn, router]);

  const handleNavigateToProduct = (product: Product) => {
    router.push(`/product/${product.id || product.slug}`);
  };

  // Combine store products with fallback mock data to ensure rich presentation
  const allProducts = useMemo(() => {
    const map = new Map<string, Product>();
    INITIAL_PRODUCTS.forEach((p) => map.set(p.id, p));
    (products || []).forEach((p) => {
      const existing = map.get(p.id);
      map.set(p.id, { ...existing, ...p });
    });
    return Array.from(map.values()).filter((p) => p.status !== 'discontinued');
  }, [products]);

  // Active brands
  const activeBrands = useMemo(() => {
    const list = brands && brands.length > 0 ? brands : INITIAL_BRANDS;
    return list.filter((b) => b.isActive !== false).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  }, [brands]);

  // 1. Top Savers Today (High discount products)
  const topSaversProducts = useMemo(() => {
    return [...allProducts]
      .filter((p) => p.mrp > p.sellingPrice)
      .sort((a, b) => {
        const discA = (a.mrp - a.sellingPrice) / a.mrp;
        const discB = (b.mrp - b.sellingPrice) / b.mrp;
        return discB - discA;
      })
      .slice(0, 10);
  }, [allProducts]);

  // 2. Best Offers & Deals
  const bestOffersProducts = useMemo(() => {
    return [...allProducts]
      .filter((p) => p.isPopular || p.isFeatured || (p.rating || 0) >= 4.5)
      .slice(0, 10);
  }, [allProducts]);

  // 3. Daily Fresh Essentials & Bakery
  const freshEssentialsProducts = useMemo(() => {
    return allProducts
      .filter(
        (p) =>
          p.categoryId === 'cat-veg' ||
          p.categoryId === 'cat-dairy' ||
          p.categoryId === 'cat-bakery' ||
          p.categoryId === 'cat-staples' ||
          ((p as any).category && ['fruits & vegetables', 'dairy & breakfast', 'staples', 'bakery'].includes((p as any).category.toLowerCase()))
      )
      .slice(0, 10);
  }, [allProducts]);

  return (
    <CustomerShell>
      <div className="space-y-6 animate-in fade-in duration-200">
        
        {/* ── SEARCH BAR PROMPT ── */}
        <div 
          onClick={() => router.push('/search')}
          className="bg-white border border-slate-200 rounded-2xl p-3 flex items-center gap-3 shadow-2xs cursor-pointer hover:border-emerald-500 transition-colors"
        >
          <Search className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="text-xs font-bold text-slate-400">
            Search "Milk, Atta, Bread, Chips, Paneer"...
          </span>
        </div>

        {/* ── 1. PROMOTIONAL HERO BANNER ── */}
        <HeroBanner />

        {/* ── 2. CIRCULAR CATEGORY NAVIGATION ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0B8F5A]" />
              <h2 className="text-base sm:text-lg font-black text-[#075C3C] tracking-tight">
                Shop By Category
              </h2>
            </div>
            <Link
              href="/categories"
              className="text-xs font-bold text-[#0B8F5A] hover:text-[#075C3C] flex items-center gap-1 hover:underline transition-colors"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <CategoryGrid />
        </div>

        {/* ── 3. TOP SAVERS TODAY CAROUSEL ── */}
        {topSaversProducts.length > 0 && (
          <ProductCarouselSection
            title="Top Savers Today"
            badge="BIG DISCOUNTS"
            viewAllHref="/categories"
            products={topSaversProducts}
            onOpenDetail={handleNavigateToProduct}
          />
        )}

        {/* ── 4. MID-PAGE DUAL PROMO BANNER ── */}
        <DualPromoBanner />

        {/* ── 5. BEST OFFERS & DEALS ── */}
        {bestOffersProducts.length > 0 && (
          <ProductCarouselSection
            title="Best Offers & Deals"
            badge="TRENDING"
            viewAllHref="/categories"
            products={bestOffersProducts}
            onOpenDetail={handleNavigateToProduct}
          />
        )}

        {/* ── 6. FEATURED BRANDS SECTION ── */}
        {activeBrands.length > 0 && (
          <div className="space-y-3 my-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#0B8F5A]" />
                <h2 className="text-base sm:text-lg font-black text-[#075C3C] tracking-tight">
                  Featured Brands
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-3 overflow-x-auto scrollbar-none no-scrollbar py-2 px-1 scroll-smooth">
              {activeBrands.map((brand) => (
                <Link
                  key={brand.id}
                  href={`/categories`}
                  className="group flex flex-col items-center gap-1.5 shrink-0 bg-white border border-slate-200/80 hover:border-[#0B8F5A] p-3 rounded-2xl shadow-2xs hover:shadow-md transition-all w-24 sm:w-28 text-center"
                >
                  <div className="w-12 h-12 flex items-center justify-center p-1">
                    <img
                      src={brand.logo || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=100&q=80'}
                      alt={brand.name}
                      className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <span className="text-[11px] font-bold text-slate-800 group-hover:text-[#0B8F5A] truncate w-full">
                    {brand.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── 7. DAILY FRESH ESSENTIALS ── */}
        {freshEssentialsProducts.length > 0 && (
          <ProductCarouselSection
            title="Daily Fresh Essentials"
            badge="10-MIN EXPRESS"
            viewAllHref="/category/fruits-vegetables"
            products={freshEssentialsProducts}
            onOpenDetail={handleNavigateToProduct}
          />
        )}

        {/* ── 8. VALUE TRUST & SPEED BENEFITS ── */}
        <ServiceBenefits />

      </div>
    </CustomerShell>
  );
}
