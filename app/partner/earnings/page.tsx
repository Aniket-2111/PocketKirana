'use client';

import React from 'react';
import Link from 'next/link';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';
import { useAppStore } from '@/lib/store';
import { ArrowLeft, Wallet, TrendingUp, Calendar, Award, CheckCircle2, IndianRupee } from 'lucide-react';

export default function EarningsPage() {
  const { deliveryPartners, activePartnerId } = useAppStore();
  const partner = deliveryPartners.find((p) => p.id === activePartnerId) || deliveryPartners[0] || {
    id: 'partner-placeholder',
    name: 'Loading Partner...',
    phone: '',
    currentStatus: 'offline',
    walletBalance: 0,
    todayEarnings: 0,
    completedDeliveries: 0,
    activeOrderId: null,
    activeDeliveryStage: null,
  };

  const weeklyBreakdown = [
    { day: 'Mon', trips: 14, earnings: 840 },
    { day: 'Tue', trips: 18, earnings: 1080 },
    { day: 'Wed', trips: 16, earnings: 960 },
    { day: 'Thu', trips: 22, earnings: 1320 },
    { day: 'Fri', trips: 20, earnings: 1200 },
    { day: 'Sat', trips: 26, earnings: 1560 },
    { day: 'Sun (Today)', trips: 19, earnings: partner.todayEarnings },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans pb-12">
      <RoleSwitcher />

      <header className="bg-slate-900 border-b border-slate-800 p-4 sticky top-[37px] z-40">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Link href="/delivery" className="flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <span className="text-xs font-extrabold text-emerald-400">Earnings &amp; Payouts</span>
        </div>
      </header>

      <main className="flex-1 max-w-md w-full mx-auto p-4 space-y-5">
        
        {/* Wallet Overview Card */}
        <div className="bg-gradient-to-br from-emerald-900 via-slate-900 to-slate-950 rounded-3xl p-6 border border-emerald-800/50 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Total Weekly Earnings</span>
            <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black px-2.5 py-1 rounded-full">
              Payout Every Mon
            </span>
          </div>

          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-white">₹7,920</span>
            <span className="text-xs text-emerald-400 font-bold ml-2">135 Deliveries</span>
          </div>

          <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-800/80">
            <div>
              <span className="text-[10px] text-slate-400 block">Base Pay</span>
              <span className="font-bold text-slate-200">₹6,200</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Surge &amp; Tips</span>
              <span className="font-bold text-amber-400">₹1,220</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Weekly Bonus</span>
              <span className="font-bold text-emerald-400">₹500</span>
            </div>
          </div>
        </div>

        {/* Daily Breakdown List */}
        <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider">This Week&apos;s Trip Log</h3>
            <span className="text-[10px] text-slate-500 font-medium">Aug 08 – Aug 14</span>
          </div>

          <div className="divide-y divide-slate-800">
            {weeklyBreakdown.map((item) => (
              <div key={item.day} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-extrabold text-white block">{item.day}</span>
                  <span className="text-[10px] text-slate-400">{item.trips} orders completed</span>
                </div>
                <span className="font-black text-emerald-400 text-sm">₹{item.earnings}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bonus Goals */}
        <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-amber-400 font-extrabold text-xs uppercase tracking-wider">
            <Award className="w-4 h-4" /> Weekly Incentive Target
          </div>
          <p className="text-xs text-slate-300">
            Complete 150 orders this week to unlock an extra <strong className="text-amber-300">₹1,000 Bonus</strong>!
          </p>
          <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full w-[90%]" />
          </div>
          <div className="flex justify-between text-[11px] text-slate-400 font-bold">
            <span>135 / 150 Orders</span>
            <span>15 Left</span>
          </div>
        </div>

      </main>
    </div>
  );
}
