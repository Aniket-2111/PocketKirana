'use client';

import React, { useMemo, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import CustomerShell from '../../components/CustomerShell';
import { DynamicHomepageRenderer } from '@/components/customer/DynamicHomepageRenderer';
import { FestivalCampaignRenderer } from '@/components/customer/festival/FestivalCampaignRenderer';
import { Product } from '@/types';
import { Search } from 'lucide-react';

export default function CustomerHome() {
  const router = useRouter();
  const { isLoggedIn, getActiveFestivalCampaign, isFestivalEmergencyDisabled, activeHomepageLayout } = useAppStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Guard: if not logged in, redirect to login
  useEffect(() => {
    if (!isLoggedIn) {
      router.replace('/login');
    }
  }, [isLoggedIn, router]);

  const activeFestivalCampaign = useMemo(() => {
    if (!mounted || isFestivalEmergencyDisabled) return null;
    return getActiveFestivalCampaign ? getActiveFestivalCampaign() : null;
  }, [mounted, getActiveFestivalCampaign, isFestivalEmergencyDisabled]);

  const handleNavigateToProduct = (product: Product) => {
    router.push(`/product/${product.id || product.slug}`);
  };

  return (
    <CustomerShell>
      <div className="space-y-5 sm:space-y-6 animate-in fade-in duration-200">
        
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
