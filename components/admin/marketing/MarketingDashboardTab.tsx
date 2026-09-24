'use client';

import React from 'react';
import { PromotionOffer, CouponRule, LoyaltyMilestoneRule, FestivalName } from '@/lib/promotionsEngine';
import {
  Sparkles,
  TrendingUp,
  Tag,
  Gift,
  ShoppingBag,
  Percent,
  Calendar,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Pause,
  Play,
  Flame,
  Zap,
} from 'lucide-react';

interface MarketingDashboardTabProps {
  offers: PromotionOffer[];
  coupons: CouponRule[];
  loyaltyRules: LoyaltyMilestoneRule[];
  onOpenCreateOffer: () => void;
  onSelectSubTab: (tabId: string) => void;
}

export function MarketingDashboardTab({
  offers,
  coupons,
  loyaltyRules,
  onOpenCreateOffer,
  onSelectSubTab,
}: MarketingDashboardTabProps) {
  const activeOffersCount = offers.filter((o) => o.status === 'ACTIVE').length;
  const scheduledCount = offers.filter((o) => o.status === 'SCHEDULED').length;
  const pausedCount = offers.filter((o) => o.status === 'PAUSED').length;
  const expiredCount = offers.filter((o) => o.status === 'EXPIRED').length;
  const draftCount = offers.filter((o) => o.status === 'DRAFT').length;

  const upcomingFestivals: Array<{ name: FestivalName; date: string; tag: string; emoji: string }> = [
    { name: 'Holi', date: 'March 2026', tag: 'High Grocery Surge', emoji: '🎨' },
    { name: 'Diwali', date: 'October 2026', tag: 'Mega Festive Deals', emoji: '🪔' },
    { name: 'Eid', date: 'April 2026', tag: 'Feast & Dry Fruits', emoji: '🌙' },
    { name: 'Ganesh Chaturthi', date: 'September 2026', tag: 'Puja & Sweets', emoji: '🐘' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* ── KPI HEADER METRICS ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 block">
            Active Offers
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-slate-900">{activeOffersCount}</span>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
              Live
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 block">
            Scheduled
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-slate-900">{scheduledCount}</span>
            <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
              Upcoming
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 block">
            Paused / Draft
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-slate-900">{pausedCount + draftCount}</span>
            <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
              On Hold
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 block">
            Total Redemptions
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-slate-900">2,480</span>
            <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
              +18%
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-teal-600 block">
            Campaign Revenue
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-slate-900">₹4.82L</span>
            <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md">
              GMV
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 block">
            Discount Given
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-slate-900">₹38.4K</span>
            <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">
              7.9% of GMV
            </span>
          </div>
        </div>
      </div>

      {/* ── HERO BANNER & QUICK ACTIONS ── */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 rounded-3xl p-6 text-white relative overflow-hidden shadow-lg border border-emerald-500/20">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase px-3 py-1 rounded-full border border-emerald-500/30 inline-flex items-center gap-1">
              <Zap className="w-3 h-3 text-emerald-400" />
              PocketKirana Production Marketing Engine
            </span>
            <h2 className="text-2xl font-black tracking-tight leading-tight">
              Create and automate high-conversion marketing campaigns in seconds.
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Target customers with BOGO bundles, tiered order thresholds, inventory-aware free products, and loyalty milestones without writing code.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={onOpenCreateOffer}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs px-5 py-3 rounded-2xl shadow-lg transition-all active:scale-95 flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Create New Offer</span>
            </button>
            <button
              onClick={() => onSelectSubTab('festivals')}
              className="bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-4 py-3 rounded-2xl backdrop-blur-md border border-white/10 transition-colors"
            >
              Festival Campaigns
            </button>
          </div>
        </div>
      </div>

      {/* ── DUAL COLUMN: TOP PERFORMING OFFERS & UPCOMING FESTIVALS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Top Performing Offers */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500" />
                <span>Top Performing Offers</span>
              </h3>
              <p className="text-xs text-slate-500">Live campaigns driving the highest conversion rate</p>
            </div>
            <button
              onClick={() => onSelectSubTab('offers')}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {offers.slice(0, 4).map((off) => (
              <div
                key={off.id}
                className="p-4 rounded-2xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-all flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center font-black text-xs shrink-0">
                    {off.offerType === 'FREE_PRODUCT_ABOVE_X' ? '🎁' : off.offerType === 'BOGO' ? '2x' : '%'}
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-900 line-clamp-1">{off.customerTitle}</h4>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                      <span>Min: ₹{off.minCartValue || 0}</span>
                      <span>•</span>
                      <span>Priority: #{off.priority}</span>
                      <span>•</span>
                      <span className="text-emerald-700 font-bold">Stacking: {off.stackingRule}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-black text-slate-900 block">240 Orders</span>
                  <span className="text-[10px] text-emerald-600 font-bold">14.2% CVR</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Festivals */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>Upcoming Festivals</span>
            </h3>
            <span className="text-[11px] font-bold text-slate-400">2026 Calendar</span>
          </div>

          <div className="space-y-3">
            {upcomingFestivals.map((fest) => (
              <div
                key={fest.name}
                className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{fest.emoji}</span>
                  <div>
                    <h4 className="font-bold text-xs text-slate-900">{fest.name}</h4>
                    <span className="text-[10px] text-slate-500">{fest.tag}</span>
                  </div>
                </div>
                <button
                  onClick={() => onSelectSubTab('festivals')}
                  className="px-3 py-1 bg-white border border-slate-200 text-slate-800 text-[11px] font-bold rounded-lg hover:bg-slate-100 transition-colors shadow-2xs"
                >
                  Launch
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
