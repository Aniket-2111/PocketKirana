'use client';

import React from 'react';
import { Picker } from '@/types';
import {
  Award,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Zap,
  TrendingUp,
  ShieldCheck,
  Calendar,
  Layers,
  User,
  Star
} from 'lucide-react';

interface PickerPerformanceViewProps {
  picker: Picker;
}

export const PickerPerformanceView: React.FC<PickerPerformanceViewProps> = ({ picker }) => {
  const stats = picker.statistics || {
    ordersPickedToday: 15,
    itemsPickedToday: 118,
    averagePickTimeSeconds: 261,
    accuracyPercent: 99.1,
    missingItemsCount: 3,
    wrongItemsScanned: 1,
    rating: 4.9,
  };

  const avgMins = Math.floor(stats.averagePickTimeSeconds / 60);
  const avgSecs = stats.averagePickTimeSeconds % 60;
  const formattedAvgTime = `0${avgMins}:${avgSecs < 10 ? '0' : ''}${avgSecs}`;

  return (
    <div className="space-y-5 text-slate-900">
      {/* ── HERO PROFILE & SHIFT CARD ── */}
      <div className="bg-gradient-to-br from-white via-white to-emerald-50/70 border border-slate-200/90 rounded-3xl p-6 shadow-sm space-y-4 text-slate-900">
        <div className="flex items-center gap-4">
          <img
            src={picker.photo}
            alt={picker.name}
            className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-600 shadow-xs"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-black text-base text-slate-900 truncate">{picker.name}</h3>
              <span className="bg-emerald-600 text-white font-black text-[9px] px-2 py-0.5 rounded-full uppercase">
                {picker.employeeId}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{picker.storeName}</p>
            <span className="inline-block mt-1 text-[11px] text-emerald-700 font-bold">
              Shift: {picker.currentShift}
            </span>
          </div>
        </div>

        {/* Rating Banner */}
        <div className="bg-white border border-slate-200 p-3 rounded-2xl flex items-center justify-between text-xs shadow-xs">
          <span className="text-slate-500 font-bold">Picker Scorecard:</span>
          <div className="flex items-center gap-1.5 font-bold text-amber-600">
            <Star className="w-4 h-4 fill-amber-400" />
            <strong className="text-sm text-slate-900 font-mono">{stats.rating}</strong>
            <span className="text-slate-500">/ 5.0 (Top 5%)</span>
          </div>
        </div>
      </div>

      {/* ── KEY PERFORMANCE METRICS GRID ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-bold">
            <Layers className="w-4 h-4 text-emerald-600" />
            <span>Orders Picked</span>
          </div>
          <strong className="text-2xl font-black text-slate-900 font-mono block">
            {stats.ordersPickedToday}
          </strong>
          <span className="text-[10px] text-emerald-700 font-bold block">+100% On-Time</span>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-bold">
            <Zap className="w-4 h-4 text-amber-600" />
            <span>Items Picked</span>
          </div>
          <strong className="text-2xl font-black text-slate-900 font-mono block">
            {stats.itemsPickedToday}
          </strong>
          <span className="text-[10px] text-slate-400 font-bold block">Avg 7.8 items/order</span>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-bold">
            <Clock className="w-4 h-4 text-sky-600" />
            <span>Avg Pick Time</span>
          </div>
          <strong className="text-2xl font-black text-emerald-700 font-mono block">
            {formattedAvgTime}
          </strong>
          <span className="text-[10px] text-emerald-700 font-bold block">Target: &lt; 05:00</span>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-bold">
            <ShieldCheck className="w-4 h-4 text-purple-600" />
            <span>Accuracy Rate</span>
          </div>
          <strong className="text-2xl font-black text-purple-700 font-mono block">
            {stats.accuracyPercent}%
          </strong>
          <span className="text-[10px] text-slate-400 font-bold block">1 wrong scan reported</span>
        </div>
      </div>

      {/* ── SHIFT ATTENDANCE & DETAILS ── */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-3 shadow-xs text-xs">
        <h4 className="font-black text-sm text-slate-900 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-emerald-600" />
          Shift &amp; Store Assignment
        </h4>

        <div className="space-y-2 divide-y divide-slate-100">
          <div className="pt-2 first:pt-0 flex justify-between">
            <span className="text-slate-500">Assigned Dark Store</span>
            <strong className="text-slate-900">PocketKirana Neral Hub (STORE001)</strong>
          </div>
          <div className="pt-2 flex justify-between">
            <span className="text-slate-500">Current Shift</span>
            <strong className="text-slate-900">Morning (06:00 - 14:00)</strong>
          </div>
          <div className="pt-2 flex justify-between">
            <span className="text-slate-500">Joining Date</span>
            <strong className="text-slate-900">March 15, 2024</strong>
          </div>
          <div className="pt-2 flex justify-between">
            <span className="text-slate-500">Role Status</span>
            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
              Active / On Duty
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
