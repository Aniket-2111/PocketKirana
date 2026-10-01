'use client';

import React, { useMemo, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import CustomerShell from '../../components/CustomerShell';
import { DynamicHomepageRenderer } from '@/components/customer/DynamicHomepageRenderer';
import { FestivalCampaignRenderer } from '@/components/customer/festival/FestivalCampaignRenderer';
import { Product } from '@/types';
import { Search, Zap } from 'lucide-react';
import { trackPerformanceEvent, PostHogEvents } from '@/lib/analytics';
import { BannerSkeleton, ProductGridSkeleton } from '@/components/ui/Skeleton';

export default function CustomerHome() {
  const router = useRouter();
  const { isLoggedIn, getActiveFestivalCampaign, isFestivalEmergencyDisabled, activeHomepageLayout } = useAppStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    trackPerformanceEvent(PostHogEvents.HOME_LOAD_COMPLETED, 150, {
      screen: 'customer_home',
    });
  }, []);

  const activeFestivalCampaign = useMemo(() => {
    if (!mounted || isFestivalEmergencyDisabled) return null;
    return getActiveFestivalCampaign ? getActiveFestivalCampaign() : null;
  }, [mounted, getActiveFestivalCampaign, isFestivalEmergencyDisabled]);

  const handleNavigateToProduct = (product: Product) => {
    router.push(`/product/${product.id || product.slug}`);
  };

  if (!mounted) {
    return (
      <CustomerShell>
        <div className="space-y-4 animate-pulse">
          <div className="h-12 w-full rounded-2xl bg-slate-100 dark:bg-slate-800" />
          <BannerSkeleton />
          <ProductGridSkeleton count={4} />
        </div>
      </CustomerShell>
    );
  }

  return (
    <CustomerShell>
      <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-200">
        
        {/* ── SEARCH BAR PROMPT ── */}
        <div 
          onClick={() => router.push('/search')}
          className="bg-white dark:bg-[#151B23] border border-[#E5E7EB] dark:border-[#263241] rounded-2xl p-3 flex items-center gap-3 shadow-2xs cursor-pointer hover:border-emerald-500 transition-colors"
        >
          <Search className="w-5 h-5 text-[#008F5A] dark:text-[#22C55E] shrink-0" />
          <span className="text-xs font-bold text-[#6B7280] dark:text-[#9CA3AF]">
            Search "Milk, Atta, Bread, Chips, Paneer"...
          </span>
        </div>

        {/* ── DELIVERY PROMISE REASSURANCE ── */}
        <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/40 text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
          <div className="flex items-center gap-1.5 min-w-0 truncate">
            <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 fill-current shrink-0" />
            <span className="truncate">Delivering in <strong>30 mins</strong> to your location</span>
          </div>
          <span className="shrink-0 text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold pl-2">₹0 fee above ₹500</span>
        </div>

        {/* ── 1. ACTIVE FESTIVAL CAMPAIGN HEADER (IF ACTIVE) ── */}
        {activeFestivalCampaign && (
          <FestivalCampaignRenderer
            campaign={activeFestivalCampaign}
            onOpenProductDetail={handleNavigateToProduct}
          />
        )}

        {/* ── 2. CANONICAL DYNAMIC HOMEPAGE CMS RENDERER ── */}
        {/* Directly consumes the published layout from the canonical Admin CMS */}
        <DynamicHomepageRenderer
          layout={activeHomepageLayout}
          onOpenProductDetail={handleNavigateToProduct}
        />

      </div>
    </CustomerShell>
  );
}
