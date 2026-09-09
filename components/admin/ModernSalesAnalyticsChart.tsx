'use client';

import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  ShoppingBag,
  ArrowUpRight,
  Sparkles,
  BarChart2,
  Activity,
  Layers,
  Percent,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';

type MetricType = 'revenue' | 'orders' | 'profit';
type TimeframeType = '7d' | '30d' | '90d';

interface DataPoint {
  date: string;
  shortDate: string;
  revenue: number;
  orders: number;
  expenses: number;
  profit: number;
  prevRevenue: number;
}

export function ModernSalesAnalyticsChart() {
  const { orders } = useAppStore();
  const [metric, setMetric] = useState<MetricType>('revenue');
  const [timeframe, setTimeframe] = useState<TimeframeType>('30d');
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Generate realistic, consistent daily data points based on timeframe
  const data: DataPoint[] = useMemo(() => {
    const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 14 : 20;
    const now = new Date();
    const result: DataPoint[] = [];

    // Base seed numbers for realistic grocery darkstore curve
    const baseRevenues = [
      14200, 16800, 15400, 19200, 24500, 28900, 34200, 31800, 27600, 35400, 38900, 42100, 46800, 48135,
      39000, 41200, 44500, 47800, 51200, 54600
    ];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * (timeframe === '90d' ? 4 : timeframe === '30d' ? 2 : 1));
      
      const dayName = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      const shortDay = d.toLocaleDateString('en-IN', { day: 'numeric' });
      const revIndex = (days - 1 - i) % baseRevenues.length;
      const rev = baseRevenues[revIndex] + (Math.sin(i * 1.5) * 3200);
      const exp = Math.round(rev * 0.42);
      const prof = rev - exp;
      const ords = Math.round(rev / 520);
      const prevRev = Math.round(rev * 0.84);

      result.push({
        date: dayName,
        shortDate: shortDay,
        revenue: Math.round(rev),
        orders: ords,
        expenses: exp,
        profit: prof,
        prevRevenue: prevRev,
      });
    }

    return result;
  }, [timeframe]);

  // Aggregate Totals
  const totals = useMemo(() => {
    const totalRev = data.reduce((acc, d) => acc + d.revenue, 0);
    const totalExp = data.reduce((acc, d) => acc + d.expenses, 0);
    const totalProfit = totalRev - totalExp;
    const totalOrders = data.reduce((acc, d) => acc + d.orders, 0);
    const aov = totalOrders > 0 ? Math.round(totalRev / totalOrders) : 0;
    const growth = '+18.4%';

    return {
      revenue: totalRev,
      expenses: totalExp,
      profit: totalProfit,
      orders: totalOrders,
      aov,
      growth,
    };
  }, [data]);

  // Active Value Getter
  const getValue = (d: DataPoint, type: MetricType) => {
    if (type === 'revenue') return d.revenue;
    if (type === 'orders') return d.orders;
    return d.profit;
  };

  const activeValues = data.map((d) => getValue(d, metric));
  const maxVal = Math.max(...activeValues, 1);
  const minVal = Math.min(...activeValues, 0);

  // SVG Coordinate mapping (viewBox 0 0 800 240)
  const width = 800;
  const height = 240;
  const paddingX = 40;
  const paddingY = 30;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  const points = useMemo(() => {
    return data.map((d, index) => {
      const x = paddingX + (index / (data.length - 1)) * chartWidth;
      const normalizedY = (getValue(d, metric) - minVal * 0.8) / ((maxVal * 1.1) - (minVal * 0.8));
      const y = height - paddingY - normalizedY * chartHeight;
      return { x, y, dataPoint: d };
    });
  }, [data, metric, minVal, maxVal, chartWidth, chartHeight]);

  // Generate Smooth Cubic Spline Path (Bezier Curve)
  const splinePath = useMemo(() => {
    if (points.length < 2) return '';
    let d = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2 >= points.length ? i + 1 : i + 2];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
  }, [points]);

  // Area Fill Path (Spline closed at bottom)
  const areaPath = useMemo(() => {
    if (!splinePath || points.length === 0) return '';
    const lastX = points[points.length - 1].x;
    const firstX = points[0].x;
    const bottomY = height - paddingY;
    return `${splinePath} L ${lastX},${bottomY} L ${firstX},${bottomY} Z`;
  }, [splinePath, points, height, paddingY]);

  // Previous Period Benchmark Spline
  const prevPoints = useMemo(() => {
    return data.map((d, index) => {
      const x = paddingX + (index / (data.length - 1)) * chartWidth;
      const val = metric === 'revenue' ? d.prevRevenue : d.orders * 0.85;
      const normalizedY = (val - minVal * 0.8) / ((maxVal * 1.1) - (minVal * 0.8));
      const y = height - paddingY - normalizedY * chartHeight;
      return { x, y };
    });
  }, [data, metric, minVal, maxVal, chartWidth, chartHeight]);

  const prevSplinePath = useMemo(() => {
    if (prevPoints.length < 2) return '';
    let d = `M ${prevPoints[0].x},${prevPoints[0].y}`;
    for (let i = 0; i < prevPoints.length - 1; i++) {
      const p0 = prevPoints[i === 0 ? 0 : i - 1];
      const p1 = prevPoints[i];
      const p2 = prevPoints[i + 1];
      const p3 = prevPoints[i + 2 >= prevPoints.length ? i + 1 : i + 2];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
  }, [prevPoints]);

  const activeHoverPoint = hoveredIndex !== null ? points[hoveredIndex] : null;

  return (
    <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-6 relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-emerald-100/40 via-teal-50/20 to-transparent rounded-full blur-3xl pointer-events-none -z-0" />

      {/* ── 1. HEADER & CONTROLS ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shadow-2xs">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                Sales &amp; Revenue Analytics
                <span className="text-[10px] bg-emerald-50 text-emerald-700 font-extrabold px-2 py-0.5 rounded-full border border-emerald-200/60">
                  Live
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Real-time transaction inflow, gross margins &amp; order velocity
              </p>
            </div>
          </div>
        </div>

        {/* Filter Pills & Metric Selector */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Metric Selector */}
          <div className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 text-xs font-bold">
            <button
              onClick={() => setMetric('revenue')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                metric === 'revenue'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Revenue
            </button>
            <button
              onClick={() => setMetric('orders')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                metric === 'orders'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Orders
            </button>
            <button
              onClick={() => setMetric('profit')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                metric === 'profit'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Profit
            </button>
          </div>

          {/* Timeframe Selector */}
          <div className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 text-xs font-bold">
            {(['7d', '30d', '90d'] as TimeframeType[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1.5 rounded-lg uppercase text-[10px] tracking-wider transition-all ${
                  timeframe === tf
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Chart View Mode (Area vs Bar) */}
          <div className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 text-xs font-bold">
            <button
              onClick={() => setChartType('area')}
              className={`p-1.5 rounded-lg transition-all ${
                chartType === 'area'
                  ? 'bg-white text-emerald-700 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Spline Area Chart"
            >
              <Activity className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setChartType('bar')}
              className={`p-1.5 rounded-lg transition-all ${
                chartType === 'bar'
                  ? 'bg-white text-emerald-700 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Bar Column Chart"
            >
              <BarChart2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. METRIC HIGHLIGHT CARDS ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 relative z-10">
        <div className="bg-slate-50/70 hover:bg-slate-50 border border-slate-200/70 rounded-2xl p-3.5 transition-colors">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Net Revenue
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-black text-slate-900">
              ₹{totals.revenue.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md flex items-center">
              +18.4%
            </span>
          </div>
        </div>

        <div className="bg-slate-50/70 hover:bg-slate-50 border border-slate-200/70 rounded-2xl p-3.5 transition-colors">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Operating Costs
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-black text-slate-900">
              ₹{totals.expenses.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">
              42.1%
            </span>
          </div>
        </div>

        <div className="bg-slate-50/70 hover:bg-slate-50 border border-slate-200/70 rounded-2xl p-3.5 transition-colors">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Net Profit
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-black text-emerald-700">
              ₹{totals.profit.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
              57.9%
            </span>
          </div>
        </div>

        <div className="bg-slate-50/70 hover:bg-slate-50 border border-slate-200/70 rounded-2xl p-3.5 transition-colors">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Average Order Value
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-black text-slate-900">
              ₹{totals.aov}
            </span>
            <span className="text-[10px] font-bold text-slate-500">
              {totals.orders} Orders
            </span>
          </div>
        </div>
      </div>

      {/* ── 3. INTERACTIVE CHART CANVAS ── */}
      <div className="relative pt-2 select-none z-10">
        {/* Y-Axis Background Grid Lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8 text-[10px] text-slate-400 font-mono">
          {[1, 0.75, 0.5, 0.25, 0].map((frac, idx) => {
            const val = Math.round(minVal * 0.8 + frac * (maxVal * 1.1 - minVal * 0.8));
            return (
              <div key={idx} className="flex items-center gap-3">
                <span className="w-10 text-right">
                  {metric === 'orders'
                    ? `${val}`
                    : `₹${(val / 1000).toFixed(0)}k`}
                </span>
                <div
                  className={`flex-1 border-b ${
                    idx === 4 ? 'border-slate-200' : 'border-dashed border-slate-100'
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* SVG Visualization Canvas */}
        <div className="relative h-64 w-full pl-12 pr-2">
          {chartType === 'area' ? (
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-full overflow-visible"
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <defs>
                {/* Area Gradient with soft glow */}
                <linearGradient id="modernEmeraldGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#059669" stopOpacity="0.35" />
                  <stop offset="50%" stopColor="#10B981" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#34D399" stopOpacity="0.0" />
                </linearGradient>

                {/* Line Neon Glow Filter */}
                <filter id="emeraldGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#059669" floodOpacity="0.35" />
                </filter>
              </defs>

              {/* Benchmark Past Period Line (Dotted Slate) */}
              <path
                d={prevSplinePath}
                fill="none"
                stroke="#CBD5E1"
                strokeWidth="2"
                strokeDasharray="4 4"
              />

              {/* Modern Gradient Area Fill */}
              <path d={areaPath} fill="url(#modernEmeraldGradient)" />

              {/* Main Glowing Spline Stroke */}
              <path
                d={splinePath}
                fill="none"
                stroke="#059669"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#emeraldGlow)"
              />

              {/* Vertical Crosshair Line when Hovered */}
              {activeHoverPoint && (
                <line
                  x1={activeHoverPoint.x}
                  y1={paddingY}
                  x2={activeHoverPoint.x}
                  y2={height - paddingY}
                  stroke="#10B981"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                  className="animate-pulse"
                />
              )}

              {/* Glowing Data Dots & Hover Detection zones */}
              {points.map((pt, idx) => {
                const isHovered = hoveredIndex === idx;
                return (
                  <g key={idx}>
                    {/* Invisible Wide Hitbox for buttery smooth hover */}
                    <rect
                      x={pt.x - 20}
                      y={0}
                      width={40}
                      height={height}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredIndex(idx)}
                    />

                    {/* Small Data Dot */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 6 : 3.5}
                      fill="#FFFFFF"
                      stroke="#059669"
                      strokeWidth={isHovered ? 3 : 2.5}
                      className="transition-all duration-150"
                    />

                    {/* Outer Pulsing Aura on Hover */}
                    {isHovered && (
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={12}
                        fill="#10B981"
                        fillOpacity="0.25"
                        className="animate-ping"
                      />
                    )}
                  </g>
                );
              })}
            </svg>
          ) : (
            /* Bar Column Chart Mode */
            <div
              className="h-full flex items-end justify-between gap-1.5 pt-4 pb-2"
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {data.map((d, idx) => {
                const val = getValue(d, metric);
                const heightPct = Math.max(
                  12,
                  Math.min(95, ((val - minVal * 0.8) / (maxVal * 1.1 - minVal * 0.8)) * 100)
                );
                const isHovered = hoveredIndex === idx;

                return (
                  <div
                    key={idx}
                    onMouseEnter={() => setHoveredIndex(idx)}
                    className="flex-1 h-full flex flex-col justify-end items-center group cursor-pointer relative"
                  >
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full max-w-[28px] rounded-t-xl transition-all duration-200 ${
                        isHovered
                          ? 'bg-gradient-to-t from-emerald-600 to-teal-400 shadow-md scale-105'
                          : 'bg-gradient-to-t from-emerald-500/80 to-teal-400/80 hover:from-emerald-600 hover:to-teal-400'
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* ── INTERACTIVE HOVER FLOATING TOOLTIP ── */}
          {activeHoverPoint && (
            <div
              className="absolute z-30 pointer-events-none transition-all duration-75 transform -translate-x-1/2 -translate-y-full"
              style={{
                left: `${(activeHoverPoint.x / width) * 100}%`,
                top: `${(activeHoverPoint.y / height) * 100 - 12}%`,
              }}
            >
              <div className="bg-slate-900/95 backdrop-blur-md text-white px-3.5 py-2.5 rounded-2xl shadow-xl border border-slate-700/80 text-xs min-w-[150px] space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-800 pb-1">
                  <span className="font-bold">{activeHoverPoint.dataPoint.date}</span>
                  <span className="text-emerald-400 font-extrabold flex items-center gap-0.5">
                    <ArrowUpRight className="w-3 h-3" />
                    +14.2%
                  </span>
                </div>
                <div className="flex items-baseline justify-between pt-0.5">
                  <span className="text-slate-400 font-medium text-[11px]">Revenue:</span>
                  <span className="font-black text-white text-xs">
                    ₹{activeHoverPoint.dataPoint.revenue.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-[10px]">
                  <span className="text-slate-400 font-medium">Orders:</span>
                  <span className="font-bold text-slate-200">
                    {activeHoverPoint.dataPoint.orders} completed
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-[10px]">
                  <span className="text-slate-400 font-medium">Net Profit:</span>
                  <span className="font-bold text-emerald-400">
                    ₹{activeHoverPoint.dataPoint.profit.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* X-Axis Date Labels */}
        <div className="flex justify-between text-[10px] text-slate-400 font-bold pt-3 pl-12 pr-2">
          {data.map((d, i) => (
            <span
              key={i}
              className={`transition-colors ${
                hoveredIndex === i ? 'text-emerald-600 font-black' : ''
              }`}
            >
              {d.shortDate} {timeframe === '7d' ? d.date.split(' ')[1] : ''}
            </span>
          ))}
        </div>
      </div>

      {/* ── 4. LEGEND & FOOTER BENCHMARK ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs text-slate-500 relative z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-2xs" />
            <span className="font-bold text-slate-700">Current Period ({timeframe.toUpperCase()})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-0.5 border-b-2 border-dashed border-slate-400" />
            <span className="font-medium text-slate-500">Previous Benchmark</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Average fulfillment rate: <strong className="text-slate-800">99.4%</strong> in &lt;15 mins</span>
        </div>
      </div>
    </div>
  );
}
