'use client';

import React, { useState } from 'react';
import { PromotionOffer, FestivalName } from '@/lib/promotionsEngine';
import { showToast } from '@/components/ui/Toast';
import {
  Sparkles,
  Calendar,
  Zap,
  CheckCircle2,
  ArrowRight,
  Gift,
  Tag,
  Clock,
  Plus,
} from 'lucide-react';

interface FestivalPreset {
  name: FestivalName;
  title: string;
  description: string;
  emoji: string;
  bannerImage: string;
  discountType: 'PERCENTAGE' | 'FIXED' | 'FREE_PRODUCT_ABOVE_X';
  discountValue?: number;
  minCartValue: number;
  couponCode: string;
  suggestedReward?: string;
  defaultDurationDays: number;
}

const FESTIVAL_PRESETS: FestivalPreset[] = [
  {
    name: 'Holi',
    title: '🎨 Holi Grocery Celebration: Free Biscuit Pack Above ₹500',
    description: 'Special festive grocery discounts & complimentary biscuit packs on all Holi celebration orders.',
    emoji: '🎨',
    bannerImage: 'https://images.unsplash.com/photo-1576618148400-f54bed99fcfd?auto=format&fit=crop&w=800&q=80',
    discountType: 'FREE_PRODUCT_ABOVE_X',
    minCartValue: 500,
    couponCode: 'HOLI500',
    suggestedReward: 'Parle Hide & Seek Biscuit Pack',
    defaultDurationDays: 7,
  },
  {
    name: 'Diwali',
    title: '🪔 Diwali Mega Grocery Sale: ₹150 OFF on ₹999+',
    description: 'Festive lights, sweets, dry fruits, and bulk grocery savings for Diwali celebrations.',
    emoji: '🪔',
    bannerImage: 'https://images.unsplash.com/photo-1512418490979-92798cec1380?auto=format&fit=crop&w=800&q=80',
    discountType: 'FIXED',
    discountValue: 150,
    minCartValue: 999,
    couponCode: 'DIWALI150',
    defaultDurationDays: 10,
  },
  {
    name: 'Ganesh Chaturthi',
    title: '🐘 Ganesh Utsav Specials: 20% OFF Puja & Sweets',
    description: 'Modaks, ghee, coconuts, flowers, and festive grocery essentials delivered in 10 minutes.',
    emoji: '🐘',
    bannerImage: 'https://images.unsplash.com/photo-1567591414240-e18e8ce12053?auto=format&fit=crop&w=800&q=80',
    discountType: 'PERCENTAGE',
    discountValue: 20,
    minCartValue: 399,
    couponCode: 'GANESHA20',
    defaultDurationDays: 10,
  },
  {
    name: 'Navratri',
    title: '🌸 Navratri Fasting Specials: 15% OFF Vrat Essentials',
    description: 'Singhare ka atta, sabudana, sendha namak, and fresh dairy items.',
    emoji: '🌸',
    bannerImage: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80',
    discountType: 'PERCENTAGE',
    discountValue: 15,
    minCartValue: 299,
    couponCode: 'NAVRATRI15',
    defaultDurationDays: 9,
  },
  {
    name: 'Eid',
    title: '🌙 Eid Mubarak Grocery Feast: ₹100 OFF on ₹799+',
    description: 'Premium basmati rice, vermicelli (seviyan), dates, and dry fruit hampers.',
    emoji: '🌙',
    bannerImage: 'https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?auto=format&fit=crop&w=800&q=80',
    discountType: 'FIXED',
    discountValue: 100,
    minCartValue: 799,
    couponCode: 'EID100',
    defaultDurationDays: 5,
  },
  {
    name: 'Christmas',
    title: '🎄 Christmas Baking & Grocery Gala: Buy 1 Get 1 Free',
    description: 'Baking essentials, chocolates, cookies, and beverages for festive joy.',
    emoji: '🎄',
    bannerImage: 'https://images.unsplash.com/photo-1543258103-a62bdc069871?auto=format&fit=crop&w=800&q=80',
    discountType: 'PERCENTAGE',
    discountValue: 25,
    minCartValue: 499,
    couponCode: 'XMAS25',
    defaultDurationDays: 7,
  },
  {
    name: 'Independence Day',
    title: '🇮🇳 Freedom Grocery Sale: Tiered Savings Up to ₹200 OFF',
    description: 'Big national grocery festival discounts across staples, snacks, and personal care.',
    emoji: '🇮🇳',
    bannerImage: 'https://images.unsplash.com/photo-1532375810709-75b1da00537c?auto=format&fit=crop&w=800&q=80',
    discountType: 'FIXED',
    discountValue: 200,
    minCartValue: 1499,
    couponCode: 'FREEDOM200',
    defaultDurationDays: 6,
  },
  {
    name: 'Makar Sankranti',
    title: '🪁 Makar Sankranti & Pongal Specials: Sesame & Jaggery Deals',
    description: 'Til, gud, chikki, sugarcane, and fresh harvest pulses.',
    emoji: '🪁',
    bannerImage: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    minCartValue: 349,
    couponCode: 'PONGAL10',
    defaultDurationDays: 4,
  },
];

interface FestivalOffersTabProps {
  onLaunchPreset: (preset: FestivalPreset) => void;
  activeOffers: PromotionOffer[];
}

export function FestivalOffersTab({ onLaunchPreset, activeOffers }: FestivalOffersTabProps) {
  const [selectedFestival, setSelectedFestival] = useState<FestivalPreset | null>(null);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* ── HEADER ── */}
      <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-emerald-700 text-white p-6 rounded-3xl shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <span className="bg-white/20 text-white text-[10px] font-black uppercase px-3 py-1 rounded-full backdrop-blur-md inline-flex items-center gap-1 mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              1-Click Festive Campaign Launcher
            </span>
            <h2 className="text-2xl font-black tracking-tight">
              Pre-Configured Indian &amp; Global Festival Campaigns
            </h2>
            <p className="text-xs text-amber-100 mt-1 max-w-xl">
              Launch pre-curated offers for Holi, Diwali, Eid, Ganesh Chaturthi, Christmas, Navratri, and more with instant customer app banner targeting.
            </p>
          </div>
        </div>
      </div>

      {/* ── FESTIVAL PRESETS GRID ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {FESTIVAL_PRESETS.map((preset) => {
          const isCurrentlyActive = activeOffers.some(
            (o) => o.festivalName === preset.name && o.status === 'ACTIVE'
          );

          return (
            <div
              key={preset.name}
              className="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-2xs hover:border-emerald-400 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="h-32 w-full relative overflow-hidden bg-slate-100">
                  <img
                    src={preset.bannerImage}
                    alt={preset.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex items-end p-3">
                    <div className="flex items-center justify-between w-full">
                      <span className="text-white font-black text-sm flex items-center gap-1.5">
                        <span className="text-lg">{preset.emoji}</span>
                        {preset.name}
                      </span>
                      {isCurrentlyActive ? (
                        <span className="bg-emerald-500 text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                          Live Now
                        </span>
                      ) : (
                        <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-md">
                          Preset
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-4 space-y-2">
                  <h4 className="font-bold text-xs text-slate-900 line-clamp-2">
                    {preset.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 line-clamp-2">
                    {preset.description}
                  </p>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-600 font-medium">
                      Min Order: <strong className="text-slate-900 font-bold">₹{preset.minCartValue}</strong>
                    </span>
                    <span className="font-mono font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      {preset.couponCode}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 pt-0">
                <button
                  onClick={() => {
                    onLaunchPreset(preset);
                    showToast(`Launched ${preset.name} festival campaign!`, 'success');
                  }}
                  className="w-full bg-slate-900 hover:bg-emerald-600 text-white font-black text-xs py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Launch Campaign</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
