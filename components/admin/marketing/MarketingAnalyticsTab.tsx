'use client';

import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Users,
  Eye,
  ShoppingBag,
  Percent,
  Calendar,
  ArrowUpRight,
} from 'lucide-react';

export function MarketingAnalyticsTab() {
  const [dateRange, setDateRange] = useState<'today' | '7days' | '30days' | 'custom'>('7days');

  const funnelSteps = [
    { label: 'Campaign Impressions', value: '42,500', pct: '100%', sub: 'Targeted notifications & banners' },
    { label: 'Offer Views / Clicks', value: '18,200', pct: '42.8%', sub: 'CTR on customer feeds' },
    { label: 'Add to Cart with Offer', value: '8,450', pct: '19.8%', sub: 'Active engagement' },
    { label: 'Checkout Initiated', value: '5,120', pct: '12.0%', sub: 'Pre-payment validation' },
    { label: 'Orders Completed', value: '3,840', pct: '9.0%', sub: 'Converted paid orders' },
  ];

  const campaignPerformance = [
    { name: 'Holi Free Biscuit Celebration', redemptions: 1240, orders: 1120, gmv: '₹1,84,000', discountCost: '₹22,400', cvr: '14.8%' },
    { name: 'WELCOME100 First Order', redemptions: 890, orders: 890, gmv: '₹1,42,000', discountCost: '₹18,200', cvr: '18.2%' },
    { name: 'BOGO Coca-Cola 750ml', redemptions: 480, orders: 460, gmv: '₹58,400', discountCost: '₹9,600', cvr: '11.5%' },
    { name: 'Super Saver Tiered Savings', redemptions: 620, orders: 580, gmv: '₹96,000', discountCost: '₹11,400', cvr: '16.1%' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* ── HEADER ── */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-600" />
            <span>Marketing &amp; Campaign ROI Analytics</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Track real-time conversion funnels, redemption metrics, revenue generated, and discount costs.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl text-xs font-bold">
          <button
            onClick={() => setDateRange('today')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              dateRange === 'today' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setDateRange('7days')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              dateRange === '7days' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setDateRange('30days')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              dateRange === '30days' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Last 30 Days
          </button>
        </div>
      </div>

      {/* ── METRICS GRID ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 block">
            Campaign GMV
          </span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">₹4,80,400</span>
          <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
            <TrendingUp className="w-3.5 h-3.5" />
            +24.5% vs previous period
          </span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 block">
            Discount Investment
          </span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">₹61,600</span>
          <span className="text-[11px] text-slate-500 font-medium mt-1 block">
            12.8% discount margin
          </span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 block">
            Average Order Value (AOV)
          </span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">₹625</span>
          <span className="text-[11px] text-purple-600 font-bold mt-1 block">
            +₹85 with tiered offers
          </span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-teal-600 block">
            Campaign Conversion Rate
          </span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">9.0%</span>
          <span className="text-[11px] text-teal-600 font-bold mt-1 block">
            Top 5% FMCG benchmark
          </span>
        </div>
      </div>

      {/* ── CONVERSION FUNNEL ── */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-4">
        <h3 className="font-black text-slate-900 text-base">Campaign Conversion Funnel</h3>
        <div className="space-y-3">
          {funnelSteps.map((step, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex justify-between text-xs font-bold text-slate-800">
                <span>{step.label}</span>
                <span>{step.value} ({step.pct})</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: step.pct }}
                />
              </div>
              <span className="text-[10px] text-slate-400 block">{step.sub}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── CAMPAIGN BREAKDOWN TABLE ── */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="font-black text-slate-900 text-base">Campaign Performance Breakdown</h3>
        </div>
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-600 uppercase font-black text-[10px] border-b border-slate-200">
            <tr>
              <th className="p-4">Campaign</th>
              <th className="p-4">Redemptions</th>
              <th className="p-4">Orders Generated</th>
              <th className="p-4">GMV</th>
              <th className="p-4">Discount Cost</th>
              <th className="p-4 text-right">CVR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {campaignPerformance.map((c, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="p-4 font-bold text-slate-900">{c.name}</td>
                <td className="p-4 text-slate-600">{c.redemptions}</td>
                <td className="p-4 text-slate-600">{c.orders}</td>
                <td className="p-4 font-bold text-emerald-700">{c.gmv}</td>
                <td className="p-4 text-rose-600 font-bold">{c.discountCost}</td>
                <td className="p-4 text-right font-black text-slate-900">{c.cvr}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
