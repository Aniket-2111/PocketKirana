'use client';

import React, { useState } from 'react';
import { DeliveryPartner, PartnerPricingRules, Order } from '@/types';
import {
  IndianRupee,
  TrendingUp,
  Wallet,
  ArrowUpRight,
  Sparkles,
  ShieldCheck,
  Clock,
  Award,
  ChevronRight,
  CheckCircle2,
  Calendar,
  Layers,
  CloudRain,
  Zap,
  X
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

interface PartnerEarningsViewProps {
  partner: DeliveryPartner;
  pricingRules: PartnerPricingRules;
  orders: Order[];
  onRequestWithdrawal: (partnerId: string, amount: number, upiId: string) => Promise<{ success: boolean; message: string }>;
}

export const PartnerEarningsView: React.FC<PartnerEarningsViewProps> = ({
  partner,
  pricingRules,
  orders,
  onRequestWithdrawal,
}) => {
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [upiAddress, setUpiAddress] = useState(partner.upiId || 'aniket@oksbi');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      showToast('Please enter a valid withdrawal amount', 'error');
      return;
    }
    if (amount > partner.walletBalance) {
      showToast('Amount exceeds available wallet balance', 'error');
      return;
    }

    setIsProcessing(true);
    const result = await onRequestWithdrawal(partner.id, amount, upiAddress);
    setIsProcessing(false);

    if (result.success) {
      showToast(result.message, 'success');
      setShowWithdrawModal(false);
      setWithdrawAmount('');
    } else {
      showToast(result.message, 'error');
    }
  };

  const completedOrders = orders.filter((o) => o.orderStatus === 'delivered');

  return (
    <div className="space-y-5 text-white">
      {/* ── MAIN EARNINGS HERO CARD ── */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/80 border border-slate-700/80 rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Earnings (This Month)
            </span>
            <strong className="text-3xl sm:text-4xl font-black text-white font-mono block mt-0.5">
              ₹{partner.monthEarnings?.toLocaleString('en-IN') || '12,840'}
            </strong>
          </div>

          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Daily & Weekly Stats Split */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">Today's Earnings</span>
            <strong className="text-xl font-black text-emerald-400 font-mono block mt-0.5">
              ₹{partner.todayEarnings || 540}
            </strong>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {partner.statistics?.deliveriesToday || 12} Deliveries
            </span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">This Week</span>
            <strong className="text-xl font-black text-white font-mono block mt-0.5">
              ₹{partner.weekEarnings?.toLocaleString('en-IN') || '2,860'}
            </strong>
            <span className="text-[10px] text-emerald-400 font-bold block mt-0.5">+14% vs last week</span>
          </div>
        </div>

        {/* Wallet Balance & Instant Payout Bar */}
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-emerald-300 uppercase block">Available Wallet Balance</span>
              <strong className="text-lg font-black text-white font-mono">
                ₹{partner.walletBalance?.toLocaleString('en-IN') || '2,860'}
              </strong>
            </div>
          </div>

          <button
            onClick={() => setShowWithdrawModal(true)}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg transition-transform active:scale-95 cursor-pointer"
          >
            Withdraw UPI
          </button>
        </div>
      </div>

      {/* ── EARNINGS CALCULATION RATE CARD ── */}
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-5 space-y-3 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <h4 className="font-black text-sm text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            Active Delivery Rate Card
          </h4>
          <span className="text-[10px] font-bold text-slate-400 uppercase">Per Order Matrix</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
          <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Base Pickup Fee</span>
            <strong className="font-mono text-white text-sm font-bold mt-0.5 block">
              ₹{pricingRules.baseFee || 25}
            </strong>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Distance Rate</span>
            <strong className="font-mono text-emerald-400 text-sm font-bold mt-0.5 block">
              ₹{pricingRules.perKmRate || 5} / km
            </strong>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
            <span className="text-slate-400 block text-[11px] flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" /> Peak Surge
            </span>
            <strong className="font-mono text-amber-300 text-sm font-bold mt-0.5 block">
              +₹{pricingRules.peakHoursBonus || 10}
            </strong>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
            <span className="text-slate-400 block text-[11px] flex items-center gap-1">
              <CloudRain className="w-3 h-3 text-blue-400" /> Rain Bonus
            </span>
            <strong className="font-mono text-blue-300 text-sm font-bold mt-0.5 block">
              +₹{pricingRules.rainSurgeBonus || 15}
            </strong>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 col-span-2 sm:col-span-2">
            <span className="text-slate-400 block text-[11px]">Multi-Order Bonus</span>
            <strong className="font-mono text-emerald-400 text-sm font-bold mt-0.5 block">
              +₹{pricingRules.extraOrderBonus || 5} per extra bag
            </strong>
          </div>
        </div>
      </div>

      {/* ── PERFORMANCE SCORECARD ── */}
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-5 space-y-3.5 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <h4 className="font-black text-sm text-white flex items-center gap-2">
            <Award className="w-4 h-4 text-emerald-400" />
            Performance &amp; Incentives
          </h4>
          <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
            Tier: Platinum ⭐
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
          <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block uppercase font-bold">Acceptance</span>
            <strong className="text-base font-black text-emerald-400 mt-0.5 block font-mono">
              {partner.statistics?.acceptanceRate || 96}%
            </strong>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block uppercase font-bold">Completion</span>
            <strong className="text-base font-black text-emerald-400 mt-0.5 block font-mono">
              {partner.statistics?.completionRate || 98}%
            </strong>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block uppercase font-bold">On-Time</span>
            <strong className="text-base font-black text-emerald-400 mt-0.5 block font-mono">
              {partner.statistics?.onTimeRate || 94}%
            </strong>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block uppercase font-bold">Customer Rating</span>
            <strong className="text-base font-black text-amber-400 mt-0.5 block font-mono">
              {partner.statistics?.customerRating || 4.8} ⭐
            </strong>
          </div>
        </div>
      </div>

      {/* ── RECENT COMPLETED DELIVERIES LIST ── */}
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-5 space-y-3.5 shadow-xl">
        <h4 className="font-black text-sm text-white">Recent Delivery Payouts</h4>

        <div className="space-y-2 divide-y divide-slate-800">
          <div className="pt-2 first:pt-0 flex items-center justify-between text-xs">
            <div>
              <strong className="font-bold text-white block">#PK10245 • 8 items</strong>
              <span className="text-[11px] text-slate-400">2.4 km • PocketKirana Store $\rightarrow$ Indiranagar</span>
            </div>
            <span className="font-mono font-black text-emerald-400 text-sm">+₹42</span>
          </div>

          <div className="pt-2 flex items-center justify-between text-xs">
            <div>
              <strong className="font-bold text-white block">#PK10239 • 4 items</strong>
              <span className="text-[11px] text-slate-400">1.6 km • PocketKirana Store $\rightarrow$ Green Valley</span>
            </div>
            <span className="font-mono font-black text-emerald-400 text-sm">+₹38</span>
          </div>

          <div className="pt-2 flex items-center justify-between text-xs">
            <div>
              <strong className="font-bold text-white block">#PK10231 • 12 items (Heavy Bag)</strong>
              <span className="text-[11px] text-slate-400">3.1 km • Rain Surge Applied</span>
            </div>
            <span className="font-mono font-black text-emerald-400 text-sm">+₹45</span>
          </div>
        </div>
      </div>

      {/* ── WITHDRAWAL MODAL ── */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 space-y-4 text-white shadow-2xl animate-in slide-in-from-bottom-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="font-black text-base">Withdraw to UPI</h4>
                <p className="text-xs text-slate-400">Instant payout to your bank account</p>
              </div>
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleWithdrawSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-400 mb-1 block uppercase">
                  Withdraw Amount (Max ₹{partner.walletBalance})
                </label>
                <input
                  type="number"
                  placeholder="e.g. 500"
                  max={partner.walletBalance}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono font-black text-lg focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 mb-1 block uppercase">
                  UPI VPA Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. yourname@oksbi"
                  value={upiAddress}
                  onChange={(e) => setUpiAddress(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono font-bold focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm shadow-xl flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>{isProcessing ? 'Processing Transfer...' : 'Initiate UPI Transfer'}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
