'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { DynamicHomepageRenderer } from '@/components/customer/DynamicHomepageRenderer';
import { FestivalCampaignRenderer } from '@/components/customer/festival/FestivalCampaignRenderer';
import { Product } from '@/types';

export default function HomePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { getActiveFestivalCampaign, isFestivalEmergencyDisabled } = useAppStore();

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

  return (
    <>
      <RoleSwitcher />
      <CustomerLayout>
        <div suppressHydrationWarning className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-6 space-y-6 sm:space-y-8 font-sans">
          
          {/* Active Festival Overlay/Header if active festival campaign exists */}
          {activeFestivalCampaign && (
            <FestivalCampaignRenderer
              campaign={activeFestivalCampaign}
              onOpenProductDetail={handleNavigateToProduct}
            />
          )}

          {/* Dynamic Personalized CMS Homepage */}
          <DynamicHomepageRenderer
            onOpenProductDetail={handleNavigateToProduct}
          />

        </div>
      </CustomerLayout>
    </>
  );
}

