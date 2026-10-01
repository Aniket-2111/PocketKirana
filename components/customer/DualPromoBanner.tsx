'use client';

import React from 'react';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { INITIAL_BANNERS } from '@/lib/mockData';
import { ArrowRight } from 'lucide-react';
import { Banner } from '@/types';

export const DualPromoBanner: React.FC = () => {
  const { banners } = useAppStore();

  const allBanners = banners && banners.length > 0 ? banners : INITIAL_BANNERS;
  
  // Filter active dual promo banners
  const promoBanners = allBanners
    .filter(
      (b) =>
        b.active !== false &&
        (b.placement === 'promo_dual' || b.id.startsWith('promo-'))
    )
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

  // If no promo_dual banners exist, don't show empty block
  if (promoBanners.length === 0) return null;

  // Default color schemes for cards if not custom specified by admin
  const defaultStyles = [
    {
      bg: 'bg-gradient-to-r from-[#FFF8E7] via-[#FFF3D6] to-[#FFE7B3]',
      border: 'border-amber-200/80',
      badgeBg: 'bg-[#075C3C]',
      btnBg: 'bg-[#075C3C] hover:bg-[#0B8F5A]',
      tagText: '100% NATURAL',
    },
    {
      bg: 'bg-gradient-to-r from-[#EBF6EE] via-[#E1F3E7] to-[#D4EDE0]',
      border: 'border-emerald-200/80',
      badgeBg: 'bg-[#0B8F5A]',
      btnBg: 'bg-[#075C3C] hover:bg-[#0B8F5A]',
      tagText: 'FARM DIRECT',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 my-8">
      {promoBanners.slice(0, 2).map((banner: Banner, idx: number) => {
        const style = defaultStyles[idx % defaultStyles.length];
        const cardBg = banner.bgColor || style.bg;
        const badgeColor = banner.badgeBg || style.badgeBg;
        const tagLabel = banner.badge || banner.tag || style.tagText;
        const btnLabel = banner.buttonText || 'SHOP NOW';

        return (
          <div
            key={banner.id}
            className={`relative rounded-3xl overflow-hidden ${cardBg} dark:bg-[#151B23] border ${style.border} dark:border-[#263241] p-6 sm:p-8 flex items-center justify-between shadow-2xs hover:shadow-md transition-all group`}
          >
            {/* Left Content */}
            <div className="space-y-3 z-10 max-w-[62%]">
              {tagLabel && (
                <span
                  className={`${badgeColor} text-white font-black text-[10px] uppercase px-3 py-1 rounded-full shadow-2xs inline-block`}
                >
                  {tagLabel}
                </span>
              )}

              <h3 className="text-xl sm:text-2xl font-black text-[#075C3C] dark:text-emerald-400 leading-tight">
                {banner.title}
              </h3>

              {banner.subtitle && (
                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                  {banner.subtitle}
                </p>
              )}

              <Link
                href={banner.redirectUrl || '/category/fruits-vegetables'}
                className="inline-flex items-center gap-1.5 bg-[#075C3C] hover:bg-[#0B8F5A] active:bg-[#05442C] text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-2xs group/btn focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#075C3C]"
              >
                <span>{btnLabel}</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" aria-hidden="true" />
              </Link>
            </div>

            {/* Right Graphic Image */}
            <div className="w-28 sm:w-36 h-28 sm:h-36 relative shrink-0 group-hover:scale-105 transition-transform duration-300">
              <img
                src={
                  banner.image ||
                  'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=400&q=80'
                }
                alt={banner.title}
                className="w-full h-full object-cover rounded-2xl drop-shadow-md border-2 border-white dark:border-[#1A2232]"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
