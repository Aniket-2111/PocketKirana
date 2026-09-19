'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { HeroBanner } from '@/components/customer/HeroBanner';
import { CategoryGrid } from '@/components/customer/CategoryGrid';
import { ProductCarouselSection } from '@/components/customer/ProductCarouselSection';
import { DualPromoBanner } from '@/components/customer/DualPromoBanner';
import { FestivalCampaignRenderer } from '@/components/customer/festival/FestivalCampaignRenderer';
import { Product } from '@/types';
import { Sparkles, Building2, Flame, ArrowRight } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { products, categories, brands, getActiveFestivalCampaign, isFestivalEmergencyDisabled } = useAppStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeFestivalCampaign = useMemo(() => {
    if (!mounted || isFestivalEmergencyDisabled) return null;
    return getActiveFestivalCampaign ? getActiveFestivalCampaign() : null;
  }, [mounted, getActiveFestivalCampaign, isFestivalEmergencyDisabled]);

  const handleNavigateToProduct = (product: Product) => {
    router.push(`/product/${product.slug}`);
  };

  // Authoritative store products
  const allProducts = useMemo(() => {
    return (products || []).filter((p) => p.status !== 'discontinued');
  }, [products]);

  // Authoritative active brands
  const activeBrands = useMemo(() => {
    return (brands || []).filter((b) => b.isActive !== false).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  }, [brands]);

  // 1. Top Savers Today (Products sorted by discount amount or high discount percentage)
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

  // 2. Best Offers & Deals (Popular / Featured pantry products)
  const bestOffersProducts = useMemo(() => {
    return [...allProducts]
      .filter((p) => p.isPopular || p.isFeatured || p.rating >= 4.7)
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
          p.categoryId === 'cat-staples'
      )
      .slice(0, 10);
  }, [allProducts]);

  return (
    <>
      <RoleSwitcher />
      <CustomerLayout>
        <div suppressHydrationWarning className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-6 space-y-6 sm:space-y-8 font-sans">
          
          {/* ── 1. ACTIVE FESTIVAL CAMPAIGN OR PROMOTIONAL HERO BANNER ── */}
          {activeFestivalCampaign ? (
            <FestivalCampaignRenderer
              campaign={activeFestivalCampaign}
              onOpenProductDetail={handleNavigateToProduct}
            />
          ) : (
            <HeroBanner />
          )}

          {/* ── 2. CIRCULAR CATEGORY NAVIGATION (Matching Reference Layout) ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0B8F5A]" />
                <h2 className="text-base sm:text-xl font-black text-[#075C3C] tracking-tight">
                  Shop By Category
                </h2>
              </div>
              <Link
                href="/categories"
                className="text-xs sm:text-sm font-bold text-[#0B8F5A] hover:text-[#075C3C] flex items-center gap-1 hover:underline transition-colors"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            
            <CategoryGrid />
          </div>

          {/* ── 3. TOP SAVERS TODAY CAROUSEL (Matching Reference) ── */}
          <ProductCarouselSection
            title="Top Savers Today"
            badge="20% OFF"
            viewAllHref="/category/fruits-vegetables"
            products={topSaversProducts.length > 0 ? topSaversProducts : allProducts.slice(0, 8)}
            onOpenDetail={handleNavigateToProduct}
          />

          {/* ── 4. DUAL MID-PAGE PROMOTIONAL BANNERS (Matching Reference) ── */}
          <DualPromoBanner />

          {/* ── 5. BEST OFFERS & DEALS CAROUSEL ── */}
          <ProductCarouselSection
            title="Best Offers &amp; Deals"
            badge="UP TO 40% OFF"
            viewAllHref="/categories"
            products={bestOffersProducts.length > 0 ? bestOffersProducts : allProducts.slice(0, 8)}
            onOpenDetail={handleNavigateToProduct}
          />

          {/* ── 6. SHOP BY BRAND SHOWCASE (Dynamic Brand System) ── */}
          {activeBrands.length > 0 && (
            <section id="brands-section" className="space-y-3 sm:space-y-4 my-6 sm:my-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-2.5">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-50 text-[#0B8F5A] flex items-center justify-center font-bold">
                    <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-xl md:text-2xl font-black text-[#075C3C] tracking-tight">
                      Shop by Official Brands
                    </h2>
                    <p className="text-[11px] sm:text-xs text-slate-500 font-medium line-clamp-1">
                      Authentic pantry staples, dairy, and snacks from trusted brands
                    </p>
                  </div>
                </div>

                <span className="text-[11px] sm:text-xs font-bold text-slate-400 shrink-0">
                  {activeBrands.length} Brands
                </span>
              </div>

              {/* Brand Cards Carousel */}
              <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto scrollbar-none no-scrollbar py-2">
                {activeBrands.map((brand) => {
                  const logoSrc = brand.logoUrl || brand.logo || '';
                  const brandProdCount = allProducts.filter(
                    (p) =>
                      p.brandId === brand.id ||
                      p.brandName?.toLowerCase() === brand.name.toLowerCase() ||
                      p.name.toLowerCase().includes(brand.name.toLowerCase().split(' ')[0])
                  ).length;

                  return (
                    <Link
                      key={brand.id}
                      href={`/brand/${brand.slug}`}
                      className="group flex flex-col items-center gap-2 shrink-0 bg-white border border-slate-200/80 hover:border-[#0B8F5A] p-3 sm:p-4 rounded-2xl sm:rounded-3xl transition-all shadow-2xs hover:shadow-md w-24 sm:w-32 text-center"
                    >
                      <div className="w-14 h-14 sm:w-18 sm:h-18 rounded-xl sm:rounded-2xl bg-[#FFFDF5] border border-slate-100 flex items-center justify-center overflow-hidden group-hover:scale-105 transition-transform p-1.5 sm:p-2">
                        {logoSrc ? (
                          <img
                            src={logoSrc}
                            alt={brand.name}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <span className="font-black text-slate-500 text-lg sm:text-xl uppercase">
                            {brand.name.slice(0, 2)}
                          </span>
                        )}
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[11px] sm:text-xs font-black text-slate-900 group-hover:text-[#0B8F5A] line-clamp-1">
                          {brand.name}
                        </span>
                        <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold block">
                          {brandProdCount > 0 ? `${brandProdCount} items` : 'Explore'}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── 7. DAILY FRESH ESSENTIALS & BAKERY CAROUSEL ── */}
          <ProductCarouselSection
            title="Fresh Bakery, Dairy &amp; Staples"
            badge="DAILY RESTOCK"
            viewAllHref="/category/dairy-breakfast"
            products={freshEssentialsProducts.length > 0 ? freshEssentialsProducts : allProducts.slice(0, 8)}
            onOpenDetail={handleNavigateToProduct}
          />

        </div>
      </CustomerLayout>
    </>
  );
}
