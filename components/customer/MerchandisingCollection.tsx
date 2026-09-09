'use client';

import React from 'react';
import { Product } from '@/types';
import { ProductCard } from './ProductCard';
import { Sparkles, ArrowRight, Flame } from 'lucide-react';
import Link from 'next/link';

export interface MerchandisingTheme {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  bannerGradient: string;
  accentColor: string;
  linkText?: string;
  linkHref?: string;
  productIds?: string[];
}

export const ACTIVE_FESTIVAL_THEMES: MerchandisingTheme[] = [
  {
    id: 'monsoon_essentials',
    title: 'Monsoon Essentials & Hot Sips ☕',
    subtitle: 'Crispy snacks, premium tea, instant noodles & immunity boosters at up to 35% OFF',
    badge: 'Seasonal Special',
    bannerGradient: 'from-amber-700 via-orange-600 to-amber-900',
    accentColor: '#F59E0B',
    linkText: 'Explore Collection',
    linkHref: '/offers',
  },
  {
    id: 'daily_staples_fest',
    title: 'Kitchen Mega Savings 🌾',
    subtitle: 'Extra 10% instant discount on Pure Ghee, Atta, Basmati Rice & Cooking Oils',
    badge: 'Super Saver',
    bannerGradient: 'from-emerald-800 via-teal-700 to-green-900',
    accentColor: '#10B981',
    linkText: 'View Staples',
    linkHref: '/category/staples',
  },
];

interface MerchandisingCollectionProps {
  theme?: MerchandisingTheme;
  products: Product[];
  onOpenDetail?: (product: Product) => void;
}

export const MerchandisingCollection: React.FC<MerchandisingCollectionProps> = ({
  theme = ACTIVE_FESTIVAL_THEMES[0],
  products,
  onOpenDetail,
}) => {
  const displayProducts = products.slice(0, 4);

  return (
    <div className="space-y-4 my-8">
      {/* Visual Merchandising Header Banner */}
      <div
        className={`relative overflow-hidden rounded-3xl bg-gradient-to-r ${theme.bannerGradient} text-white p-6 sm:p-8 shadow-xl`}
      >
        <div className="relative z-10 max-w-2xl space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black tracking-wider uppercase bg-white/20 backdrop-blur-md text-amber-200">
            <Sparkles className="w-3.5 h-3.5" />
            {theme.badge}
          </span>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">{theme.title}</h2>
          <p className="text-white/80 text-xs sm:text-sm max-w-lg font-medium">{theme.subtitle}</p>
          {theme.linkText && (
            <div className="pt-2">
              <Link
                href={theme.linkHref || '/offers'}
                className="inline-flex items-center gap-2 bg-white text-gray-900 px-4 py-2 rounded-xl text-xs font-bold hover:bg-amber-100 transition-transform active:scale-95 shadow-md"
              >
                <span>{theme.linkText}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>

        {/* Subtle Decorative Pattern */}
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Merchandised Products Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
        {displayProducts.map((p) => (
          <ProductCard key={p.id} product={p} onOpenDetail={onOpenDetail} badge="Featured Deal" />
        ))}
      </div>
    </div>
  );
};
