'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { FestivalCampaign, FestivalSectionConfig, FestivalTheme } from '@/types/festival';
import { Product } from '@/types';
import { ProductCard } from '@/components/customer/ProductCard';
import {
  Sparkles,
  ArrowRight,
  Clock,
  Flame,
  ShieldCheck,
  Gift,
  Tag,
  ChevronRight,
  Truck,
  Percent,
} from 'lucide-react';

interface FestivalCampaignRendererProps {
  campaign: FestivalCampaign;
  onOpenProductDetail?: (product: Product) => void;
  isMobilePreview?: boolean;
}

export function FestivalCampaignRenderer({
  campaign,
  onOpenProductDetail,
  isMobilePreview = false,
}: FestivalCampaignRendererProps) {
  const router = useRouter();
  const { products, categories, isFestivalEmergencyDisabled } = useAppStore();

  if (isFestivalEmergencyDisabled || !campaign || !campaign.configurationSnapshot) {
    return null;
  }

  const { theme, sections } = campaign.configurationSnapshot;
  const activeSections = (sections || []).filter((s) => s.active !== false);

  // Authoritative store products
  const allProducts = useMemo(() => {
    return (products || []).filter((p) => p.status !== 'discontinued');
  }, [products]);

  // Authoritative categories
  const allCategories = useMemo(() => {
    return categories || [];
  }, [categories]);

  const handleProductClick = (product: Product) => {
    if (onOpenProductDetail) {
      onOpenProductDetail(product);
    } else {
      router.push(`/product/${product.slug || product.id}`);
    }
  };

  return (
    <div
      className="space-y-6 sm:space-y-8 rounded-3xl p-2 sm:p-4 transition-all duration-300 animate-in fade-in"
      style={{
        background: theme?.bgGradient || theme?.bgColor || '#FFFBEB',
        color: theme?.textColor || '#7C2D12',
      }}
    >
      {activeSections.map((section) => (
        <React.Fragment key={section.id}>
          {renderSection(section, theme, allProducts, allCategories, handleProductClick, isMobilePreview)}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── SECTION DISPATCHER ──
function renderSection(
  section: FestivalSectionConfig,
  theme: FestivalTheme,
  allProducts: Product[],
  allCategories: any[],
  onProductClick: (p: Product) => void,
  isMobilePreview: boolean
) {
  switch (section.type) {
    case 'Hero':
      return <HeroSection section={section} theme={theme} isMobilePreview={isMobilePreview} />;
    case 'Countdown':
      return <CountdownSection section={section} theme={theme} />;
    case 'CategoryGrid':
      return <CategoryGridSection section={section} theme={theme} categories={allCategories} />;
    case 'ProductCarousel':
      return <ProductCarouselSection section={section} theme={theme} products={allProducts} onProductClick={onProductClick} />;
    case 'ProductGrid':
      return <ProductGridSection section={section} theme={theme} products={allProducts} onProductClick={onProductClick} />;
    case 'Collection':
      return <CollectionSection section={section} theme={theme} products={allProducts} onProductClick={onProductClick} />;
    case 'OfferBanner':
      return <OfferBannerSection section={section} theme={theme} />;
    case 'PromoStrip':
      return <PromoStripSection section={section} theme={theme} />;
    case 'FestivalDivider':
      return <FestivalDividerSection section={section} theme={theme} />;
    case 'ImageText':
      return <ImageTextSection section={section} theme={theme} />;
    case 'FreeDeliveryBanner':
      return <FreeDeliveryBannerSection section={section} theme={theme} />;
    case 'TrustBanner':
      return <TrustBannerSection section={section} theme={theme} />;
    default:
      // Gracefully ignore unsupported components
      return null;
  }
}

// ── 1. HERO BANNER SECTION ──
function HeroSection({
  section,
  theme,
  isMobilePreview,
}: {
  section: FestivalSectionConfig;
  theme: FestivalTheme;
  isMobilePreview: boolean;
}) {
  const imgSrc =
    (isMobilePreview ? section.mobileImage : section.desktopImage) ||
    section.image ||
    section.mobileImage ||
    'https://images.unsplash.com/photo-1567591414240-e2b26056cf9e?auto=format&fit=crop&w=1200&q=80';

  return (
    <div className="relative overflow-hidden rounded-3xl shadow-xl border border-white/40 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white min-h-[220px] sm:min-h-[300px] flex items-center">
      {/* Background Hero Image */}
      <img
        src={imgSrc}
        alt={section.title || 'Festival Banner'}
        className="absolute inset-0 w-full h-full object-cover opacity-35 mix-blend-luminosity scale-105 transition-transform duration-700 hover:scale-100"
      />
      {/* Dynamic Overlay Gradient */}
      <div
        className="absolute inset-0 bg-gradient-to-r opacity-90"
        style={{
          background: `linear-gradient(90deg, ${theme.secondaryColor || '#78350F'}F2 0%, ${theme.primaryColor || '#EA580C'}B3 60%, transparent 100%)`,
        }}
      />

      <div className="relative z-10 p-5 sm:p-8 md:p-10 max-w-2xl space-y-3">
        {section.badge && (
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] sm:text-xs font-black tracking-wider uppercase shadow-sm"
            style={{
              backgroundColor: theme.accentColor || '#FEF3C7',
              color: theme.textColor || '#7C2D12',
            }}
          >
            <Sparkles className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '4s' }} />
            <span>{section.badge}</span>
          </div>
        )}

        <h1
          className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight drop-shadow-md"
          style={{ color: '#FFFFFF' }}
        >
          {section.title}
        </h1>

        {section.subtitle && (
          <p className="text-xs sm:text-base text-amber-100/90 font-medium leading-relaxed line-clamp-2">
            {section.subtitle}
          </p>
        )}

        {section.ctaText && (
          <div className="pt-2">
            <Link
              href={section.ctaLink || '/categories'}
              className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-2xl text-xs sm:text-sm font-black transition-all transform hover:scale-105 active:scale-95 shadow-lg"
              style={{
                backgroundColor: theme.accentColor || '#FEF3C7',
                color: theme.textColor || '#7C2D12',
              }}
            >
              <span>{section.ctaText}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 2. COUNTDOWN TIMER SECTION ──
function CountdownSection({ section, theme }: { section: FestivalSectionConfig; theme: FestivalTheme }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const target = new Date(section.targetDate || Date.now() + 86400000 * 3).getTime();

    const updateTimer = () => {
      const now = new Date().getTime();
      const diff = Math.max(0, target - now);

      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [section.targetDate]);

  return (
    <div
      className="p-4 sm:p-5 rounded-3xl border shadow-sm flex flex-col md:flex-row items-center justify-between gap-4"
      style={{
        backgroundColor: theme.cardBg || '#FFFFFF',
        borderColor: `${theme.primaryColor || '#EA580C'}30`,
      }}
    >
      <div className="flex items-center gap-3 text-center md:text-left">
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs"
          style={{
            backgroundColor: `${theme.primaryColor || '#EA580C'}15`,
            color: theme.primaryColor || '#EA580C',
          }}
        >
          <Clock className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          {section.badge && (
            <span
              className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-full inline-block mb-0.5"
              style={{
                backgroundColor: `${theme.primaryColor || '#EA580C'}15`,
                color: theme.primaryColor || '#EA580C',
              }}
            >
              {section.badge}
            </span>
          )}
          <h3 className="text-sm sm:text-base font-black text-slate-900">{section.title || 'Limited Time Festive Window'}</h3>
        </div>
      </div>

      {/* Timer Digits */}
      <div className="flex items-center gap-2">
        {[
          { label: 'DAYS', val: timeLeft.days },
          { label: 'HRS', val: timeLeft.hours },
          { label: 'MINS', val: timeLeft.minutes },
          { label: 'SECS', val: timeLeft.seconds },
        ].map((unit, i) => (
          <div
            key={i}
            className="flex flex-col items-center justify-center w-13 sm:w-16 py-1.5 sm:py-2 rounded-2xl shadow-xs"
            style={{
              backgroundColor: theme.primaryColor || '#EA580C',
              color: '#FFFFFF',
            }}
          >
            <span className="text-base sm:text-xl font-black tracking-tight">
              {String(unit.val).padStart(2, '0')}
            </span>
            <span className="text-[8px] sm:text-[9px] font-bold opacity-80">{unit.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 3. FESTIVAL CATEGORY GRID ──
function CategoryGridSection({
  section,
  theme,
  categories,
}: {
  section: FestivalSectionConfig;
  theme: FestivalTheme;
  categories: any[];
}) {
  const targetCategoryIds = section.categoryIds || [];
  const displayCats = targetCategoryIds.length > 0
    ? categories.filter((c) => targetCategoryIds.includes(c.id))
    : categories.slice(0, 6);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ backgroundColor: theme.primaryColor || '#EA580C' }}
            />
            {section.title || 'Festival Specials'}
          </h2>
          {section.subtitle && (
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium">{section.subtitle}</p>
          )}
        </div>
        <Link
          href="/categories"
          className="text-xs sm:text-sm font-bold flex items-center gap-1 hover:underline transition-colors"
          style={{ color: theme.primaryColor || '#EA580C' }}
        >
          <span>View All</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5 sm:gap-4">
        {displayCats.map((cat) => (
          <Link
            key={cat.id}
            href={`/category/${cat.slug || cat.id}`}
            className="group flex flex-col items-center gap-2 p-2.5 sm:p-3 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/80 hover:border-amber-500 transition-all shadow-2xs hover:shadow-md text-center"
          >
            <div
              className="w-14 h-14 sm:w-18 sm:h-18 rounded-2xl flex items-center justify-center p-2 overflow-hidden group-hover:scale-105 transition-transform"
              style={{ backgroundColor: `${theme.accentColor || '#FEF3C7'}40` }}
            >
              {cat.image ? (
                <img src={cat.image} alt={cat.name} className="w-full h-full object-contain" />
              ) : (
                <span className="text-2xl">{cat.icon || '🛍️'}</span>
              )}
            </div>
            <span className="text-[11px] sm:text-xs font-bold text-slate-800 line-clamp-1 group-hover:text-amber-600">
              {cat.name}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── 4. PRODUCT CAROUSEL SECTION ──
function ProductCarouselSection({
  section,
  theme,
  products,
  onProductClick,
}: {
  section: FestivalSectionConfig;
  theme: FestivalTheme;
  products: Product[];
  onProductClick: (p: Product) => void;
}) {
  const filtered = useMemo(() => {
    if (section.productIds && section.productIds.length > 0) {
      return products.filter((p) => section.productIds?.includes(p.id));
    }
    if (section.categoryId) {
      return products.filter((p) => p.categoryId === section.categoryId || (p as any).category?.toLowerCase().includes(section.categoryId?.toLowerCase()));
    }
    return products.filter((p) => p.isFeatured || p.isPopular || p.rating >= 4.5);
  }, [products, section]);

  const displayList = filtered.slice(0, section.maxItems || 8);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {section.badge && (
            <span
              className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: theme.primaryColor || '#EA580C',
                color: '#FFFFFF',
              }}
            >
              {section.badge}
            </span>
          )}
          <div>
            <h2 className="text-base sm:text-xl font-black text-slate-900 tracking-tight">
              {section.title || 'Featured Festive Products'}
            </h2>
            {section.subtitle && (
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium">{section.subtitle}</p>
            )}
          </div>
        </div>

        <Link
          href="/categories"
          className="text-xs sm:text-sm font-bold flex items-center gap-1 hover:underline"
          style={{ color: theme.primaryColor || '#EA580C' }}
        >
          <span>Explore</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="flex gap-3 sm:gap-4 overflow-x-auto no-scrollbar scrollbar-none pb-2 pt-1">
        {displayList.map((product) => (
          <div key={product.id} className="shrink-0 w-44 sm:w-56">
            <ProductCard product={product} onOpenDetail={() => onProductClick(product)} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 5. PRODUCT GRID SECTION ──
function ProductGridSection({
  section,
  theme,
  products,
  onProductClick,
}: {
  section: FestivalSectionConfig;
  theme: FestivalTheme;
  products: Product[];
  onProductClick: (p: Product) => void;
}) {
  const filtered = (products || []).slice(0, section.maxItems || 6);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base sm:text-xl font-black text-slate-900 tracking-tight">{section.title}</h2>
        {section.badge && (
          <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full">
            {section.badge}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
        {filtered.map((product) => (
          <ProductCard key={product.id} product={product} onOpenDetail={() => onProductClick(product)} />
        ))}
      </div>
    </div>
  );
}

// ── 6. COLLECTION SECTION ──
function CollectionSection({
  section,
  theme,
  products,
  onProductClick,
}: {
  section: FestivalSectionConfig;
  theme: FestivalTheme;
  products: Product[];
  onProductClick: (p: Product) => void;
}) {
  const displayProducts = products.slice(0, 4);

  return (
    <div
      className="p-4 sm:p-6 rounded-3xl border shadow-sm space-y-4"
      style={{
        backgroundColor: theme.cardBg || '#FFFFFF',
        borderColor: `${theme.primaryColor || '#EA580C'}25`,
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          {section.badge && (
            <span
              className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md mb-1 inline-block"
              style={{
                backgroundColor: `${theme.primaryColor || '#EA580C'}15`,
                color: theme.primaryColor || '#EA580C',
              }}
            >
              {section.badge}
            </span>
          )}
          <h3 className="text-base sm:text-xl font-black text-slate-900 tracking-tight">{section.title}</h3>
          {section.subtitle && <p className="text-xs text-slate-500 font-medium">{section.subtitle}</p>}
        </div>

        <Link
          href="/categories"
          className="text-xs sm:text-sm font-bold flex items-center gap-1 hover:underline"
          style={{ color: theme.primaryColor || '#EA580C' }}
        >
          <span>View Kit</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {displayProducts.map((p) => (
          <div
            key={p.id}
            onClick={() => onProductClick(p)}
            className="group cursor-pointer rounded-2xl border border-slate-100 bg-slate-50/50 p-2.5 flex flex-col items-center text-center hover:border-amber-400 transition-all hover:bg-white shadow-2xs"
          >
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-white p-1 mb-2">
              <img src={p.image} alt={p.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform" />
            </div>
            <span className="text-xs font-bold text-slate-800 line-clamp-1 group-hover:text-amber-600">{p.name}</span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-xs font-black text-slate-900">₹{p.sellingPrice}</span>
              {p.mrp > p.sellingPrice && <span className="text-[10px] text-slate-400 line-through">₹{p.mrp}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 7. OFFER BANNER SECTION ──
function OfferBannerSection({ section, theme }: { section: FestivalSectionConfig; theme: FestivalTheme }) {
  return (
    <div
      className="relative overflow-hidden rounded-3xl p-5 sm:p-8 text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4"
      style={{
        background: `linear-gradient(135deg, ${theme.secondaryColor || '#78350F'} 0%, ${theme.primaryColor || '#EA580C'} 100%)`,
      }}
    >
      <div className="space-y-1.5 z-10 text-center sm:text-left">
        {section.badge && (
          <span
            className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-xs inline-block"
            style={{
              backgroundColor: theme.accentColor || '#FEF3C7',
              color: theme.textColor || '#7C2D12',
            }}
          >
            {section.badge}
          </span>
        )}
        <h3 className="text-lg sm:text-2xl font-black tracking-tight">{section.title}</h3>
        {section.subtitle && <p className="text-xs sm:text-sm text-amber-100 font-medium">{section.subtitle}</p>}
      </div>

      <Link
        href={section.ctaLink || '/categories'}
        className="z-10 shrink-0 px-5 sm:px-6 py-2.5 rounded-2xl text-xs sm:text-sm font-black shadow-md hover:scale-105 active:scale-95 transition-all"
        style={{
          backgroundColor: theme.accentColor || '#FEF3C7',
          color: theme.textColor || '#7C2D12',
        }}
      >
        {section.ctaText || 'REDEEM NOW'}
      </Link>
    </div>
  );
}

// ── 8. PROMO STRIP SECTION ──
function PromoStripSection({ section, theme }: { section: FestivalSectionConfig; theme: FestivalTheme }) {
  return (
    <div
      className="py-2.5 px-4 rounded-2xl text-center font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs"
      style={{
        backgroundColor: `${theme.primaryColor || '#EA580C'}15`,
        color: theme.textColor || '#7C2D12',
        border: `1px dashed ${theme.primaryColor || '#EA580C'}40`,
      }}
    >
      <Gift className="w-4 h-4 text-amber-600 shrink-0" />
      <span>{section.title}</span>
    </div>
  );
}

// ── 9. FESTIVAL DIVIDER SECTION ──
function FestivalDividerSection({ section, theme }: { section: FestivalSectionConfig; theme: FestivalTheme }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-300 to-amber-500 opacity-60" />
      <span
        className="text-[11px] sm:text-xs font-black tracking-wider uppercase px-3 py-1 rounded-full border shadow-2xs"
        style={{
          backgroundColor: theme.cardBg || '#FFFFFF',
          borderColor: `${theme.primaryColor || '#EA580C'}30`,
          color: theme.primaryColor || '#EA580C',
        }}
      >
        ✦ {section.title || 'Auspicious Delights'} ✦
      </span>
      <div className="flex-1 h-px bg-gradient-to-r from-amber-500 via-amber-300 to-transparent opacity-60" />
    </div>
  );
}

// ── 10. IMAGE TEXT SECTION ──
function ImageTextSection({ section, theme }: { section: FestivalSectionConfig; theme: FestivalTheme }) {
  return (
    <div className="p-4 rounded-2xl bg-white border border-slate-200 flex items-center gap-4">
      {section.image && (
        <img src={section.image} alt={section.title} className="w-16 h-16 rounded-xl object-cover shrink-0" />
      )}
      <div>
        <h4 className="text-sm font-bold text-slate-900">{section.title}</h4>
        {section.subtitle && <p className="text-xs text-slate-500">{section.subtitle}</p>}
      </div>
    </div>
  );
}

// ── 11. FREE DELIVERY BANNER SECTION ──
function FreeDeliveryBannerSection({ section, theme }: { section: FestivalSectionConfig; theme: FestivalTheme }) {
  return (
    <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-3">
      <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
        <Truck className="w-4 h-4" />
      </div>
      <div>
        <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-sm">
          {section.badge || 'FREE DELIVERY'}
        </span>
        <p className="text-xs font-bold text-slate-800 mt-0.5">{section.title}</p>
      </div>
    </div>
  );
}

// ── 12. TRUST BANNER SECTION ──
function TrustBannerSection({ section, theme }: { section: FestivalSectionConfig; theme: FestivalTheme }) {
  return (
    <div className="p-3 rounded-2xl bg-white/80 border border-slate-200/80 flex items-center justify-center gap-2 text-center text-xs font-bold text-slate-600">
      <ShieldCheck className="w-4 h-4 text-emerald-600" />
      <span>{section.title || 'Guaranteed Pure Ingredients & 10-Minute Delivery by Pocket Kirana'}</span>
    </div>
  );
}
