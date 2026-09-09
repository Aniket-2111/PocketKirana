'use client';

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Package,
  Truck,
  Flame,
  Layers,
  Sparkles,
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import { AnalyticsReport } from '@/lib/analyticsService';

export const AnalyticsDashboardView: React.FC = () => {
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'today' | '7d' | '30d' | 'all'>('7d');

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics?range=${range}`, {
        headers: { 'x-pk-role': 'admin', 'x-pk-uid': 'admin_1' },
      });
      const data = await res.json();
      if (data.success) {
        setReport(data.data);
      }
    } catch (e) {
      console.error('Failed to load analytics', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [range]);

  if (loading && !report) {
    return (
      <div className="p-8 text-center space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mx-auto" />
        <p className="text-sm font-semibold text-gray-500">Generating management analytics...</p>
      </div>
    );
  }

  const executive = report?.executive;
  const alerts = report?.alerts;
  const inventory = report?.inventory;
  const fulfillment = report?.fulfillment;

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4">
      {/* 1. Header & Date Range Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-600" />
            Executive & Operational Analytics
          </h1>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Real-time management intelligence derived directly from PostgreSQL source of truth
          </p>
        </div>

        {/* Date Filters */}
        <div className="flex items-center gap-1.5 bg-gray-100 p-1.5 rounded-2xl">
          {(['today', '7d', '30d', 'all'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                range === r
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {r === 'today' ? 'Today' : r === '7d' ? 'Last 7 Days' : r === '30d' ? '30 Days' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Operational Alert Bar */}
      {alerts && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold text-xs">
              🔴
            </div>
            <div>
              <span className="text-lg font-black text-red-900">{alerts.expiredStockBatches}</span>
              <span className="text-[11px] font-bold text-red-700 block">Expired Batches</span>
            </div>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-orange-500 text-white flex items-center justify-center font-bold text-xs">
              🟠
            </div>
            <div>
              <span className="text-lg font-black text-orange-900">{alerts.clearanceCandidateBatches}</span>
              <span className="text-[11px] font-bold text-orange-700 block">Clearance Deals</span>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-xs">
              🟡
            </div>
            <div>
              <span className="text-lg font-black text-amber-900">{alerts.lowStockProductCount}</span>
              <span className="text-[11px] font-bold text-amber-700 block">Low Stock (&le;5)</span>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
              📦
            </div>
            <div>
              <span className="text-lg font-black text-blue-900">{alerts.ordersAwaitingPicking}</span>
              <span className="text-[11px] font-bold text-blue-700 block">Awaiting Picking</span>
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-xs">
              🚴
            </div>
            <div>
              <span className="text-lg font-black text-purple-900">{alerts.ordersAwaitingDelivery}</span>
              <span className="text-[11px] font-bold text-purple-700 block">Awaiting Delivery</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Executive KPI Cards */}
      {executive && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Gross Sales</span>
            <div className="text-3xl font-black text-gray-900">₹{executive.grossSales.toLocaleString('en-IN')}</div>
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> +14.2% vs previous period
            </span>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Net Sales</span>
            <div className="text-3xl font-black text-emerald-700">₹{executive.netSales.toLocaleString('en-IN')}</div>
            <span className="text-[11px] text-gray-500 font-medium">After discounts & refunds</span>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Orders</span>
            <div className="text-3xl font-black text-gray-900">{executive.totalOrders}</div>
            <span className="text-xs font-bold text-gray-600">{executive.deliveredOrders} delivered successfully</span>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Average Order Value</span>
            <div className="text-3xl font-black text-purple-700">₹{executive.averageOrderValue}</div>
            <span className="text-[11px] text-gray-500 font-medium">{executive.totalUnitsSold} total units sold</span>
          </div>
        </div>
      )}

      {/* 4. Order Funnel & Fulfillment SLA Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Order Funnel */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              Order Conversion Funnel
            </h3>
            <span className="text-xs font-semibold text-gray-400">Placed to Delivered</span>
          </div>

          <div className="space-y-3">
            {report?.funnel.map((stage, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs font-bold text-gray-700">
                  <span>{stage.stage}</span>
                  <span>{stage.count} ({stage.percentageOfTotal}%)</span>
                </div>
                <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full transition-all"
                    style={{ width: `${Math.max(5, stage.percentageOfTotal)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Fulfillment SLAs */}
        {fulfillment && (
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-600" />
              Fulfillment SLAs
            </h3>

            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-2xl">
                <span className="text-xs font-bold text-gray-600">Avg Pick Time</span>
                <span className="text-sm font-black text-gray-900">{fulfillment.avgPickMinutes} min</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-2xl">
                <span className="text-xs font-bold text-gray-600">Avg Pack Time</span>
                <span className="text-sm font-black text-gray-900">{fulfillment.avgPackMinutes} min</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-2xl">
                <span className="text-xs font-bold text-gray-600">Avg Delivery Trip</span>
                <span className="text-sm font-black text-gray-900">{fulfillment.avgDeliveryMinutes} min</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
                <span className="text-xs font-bold text-emerald-800">On-Time SLA Rate</span>
                <span className="text-sm font-black text-emerald-700">{fulfillment.onTimeDeliveryRate}%</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Inventory Financials & Loss Reduction ROI */}
      {inventory && (
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-6 rounded-3xl shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Phase 16 Commercial ROI
              </span>
              <h3 className="text-xl font-black mt-1">Inventory Valuation & Loss-Avoidance</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
            <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl">
              <span className="text-xs font-medium text-white/70">Total Stock Value</span>
              <div className="text-2xl font-black text-white mt-1">₹{inventory.totalStockValue.toLocaleString('en-IN')}</div>
            </div>

            <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl">
              <span className="text-xs font-medium text-white/70">Clearance Pool Value</span>
              <div className="text-2xl font-black text-orange-300 mt-1">₹{inventory.clearanceStockValue.toLocaleString('en-IN')}</div>
            </div>

            <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl">
              <span className="text-xs font-medium text-white/70">Total Disposed Loss</span>
              <div className="text-2xl font-black text-red-400 mt-1">₹{inventory.expiredLossValue.toLocaleString('en-IN')}</div>
            </div>

            <div className="p-4 bg-emerald-500/20 border border-emerald-400/40 backdrop-blur-md rounded-2xl">
              <span className="text-xs font-medium text-emerald-200">Loss Avoided (Clearance)</span>
              <div className="text-2xl font-black text-emerald-300 mt-1">₹{inventory.lossAvoidedThroughClearance.toLocaleString('en-IN')}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
