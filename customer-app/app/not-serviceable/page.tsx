'use client';

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  MapPin,
  ArrowLeft,
  HelpCircle,
  Info,
  ChevronRight,
  User,
  AlertCircle,
  Compass,
  Navigation
} from 'lucide-react';
import { useAppStore } from '@/lib/store';

function NotServiceableContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser, addresses } = useAppStore();
  const defaultAddr = addresses.find((a) => a.isDefault) || addresses[0];

  const distParam = searchParams.get('dist');
  const distanceKm = distParam ? parseFloat(distParam) : null;

  return (
    <div className="min-h-screen bg-[#FFF8F0] dark:bg-slate-950 flex flex-col font-sans select-none pb-10 transition-colors">
      {/* Top Bar with Location Header */}
      <div className="bg-[#004D21] text-white px-5 pt-12 pb-5 rounded-b-[28px] shadow-md">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex-1 min-w-0 pr-3">
            <h1 className="text-lg font-black text-[#FFB4A2] tracking-tight">
              Outside Delivery Area
            </h1>
            <div className="flex items-center gap-1.5 text-xs text-white/80 font-medium truncate mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-[#acf847] shrink-0" />
              <span className="truncate">
                {defaultAddr ? defaultAddr.addressLine1 : 'Your selected location'}
              </span>
            </div>
          </div>
          <button
            onClick={() => router.push('/profile')}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
          >
            <User className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Main Card Content */}
      <div className="flex-1 max-w-md mx-auto w-full px-5 py-6 flex flex-col justify-between space-y-6">
        <div className="space-y-5">
          
          {/* Dedicated Out-of-Area Notice */}
          <div className="text-center space-y-2 pt-1">
            <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/60 border border-red-200 dark:border-red-900/60 flex items-center justify-center mx-auto text-red-600 dark:text-red-400 shadow-xs">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              You&apos;re outside our delivery area
            </h2>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 max-w-xs mx-auto leading-relaxed">
              PocketKirana currently delivers within <span className="font-black text-[#004D21] dark:text-emerald-400">3 KM</span> of our Neral store.
            </p>
          </div>

          {/* Delivery Zone Metrics Card */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <span className="font-bold text-slate-500 dark:text-slate-400">Service Center</span>
              <span className="font-black text-slate-900 dark:text-white">Maule Kirana Shop (Neral)</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Your Distance</span>
                <span className="font-mono font-black text-red-600 dark:text-red-400 text-sm">
                  {distanceKm !== null ? `${distanceKm} KM` : 'Outside'}
                </span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Max Radius</span>
                <span className="font-mono font-black text-[#004D21] dark:text-emerald-400 text-sm">
                  3.0 KM
                </span>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-amber-50/70 dark:bg-amber-950/20 p-2.5 rounded-xl border border-amber-200/60 dark:border-amber-900/40 leading-snug">
              📍 Orders and checkout are restricted to addresses within 3 KM of Maule Kirana.
            </div>
          </div>

          {/* Action Buttons: Change Location & Try Another Location */}
          <div className="space-y-2.5">
            <button
              onClick={() => router.replace('/setup-address')}
              className="w-full py-3.5 bg-[#006E2F] hover:bg-[#005a26] text-white font-black text-xs rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-[#006E2F]/20 transition-all active:scale-95 cursor-pointer uppercase tracking-wider"
            >
              <MapPin className="w-4 h-4" />
              Change Location
            </button>

            <button
              onClick={() => router.replace('/setup-address')}
              className="w-full py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <Compass className="w-4 h-4 text-emerald-600" />
              Try Another Location
            </button>
          </div>

          {/* Service Links Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 divide-y divide-gray-100 dark:divide-slate-800 overflow-hidden shadow-xs">
            <button
              onClick={() => router.push('/orders')}
              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[#FFF8F0] dark:hover:bg-slate-800 transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#FFF3E6] dark:bg-amber-950/40 flex items-center justify-center shrink-0">
                  <HelpCircle className="w-4 h-4 text-[#E88B00]" />
                </div>
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Need help with your previous orders?
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>

            <button
              onClick={() => router.push('/about')}
              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[#FFF8F0] dark:hover:bg-slate-800 transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#E8F5E9] dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
                  <Info className="w-4 h-4 text-[#006E2F]" />
                </div>
                <span className="text-xs font-bold text-slate-900 dark:text-white">About Maule Kirana · PocketKirana</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Footer / Back */}
        <div className="pt-4 text-center space-y-2">
          <button
            onClick={() => router.replace('/login')}
            className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-[#006E2F] inline-flex items-center gap-1 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Login
          </button>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 font-bold">
            Pocket Kirana · Neral Express Delivery (3 KM Zone)
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NotServiceablePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FFF8F0] dark:bg-slate-950 flex items-center justify-center text-xs font-bold text-slate-500">Checking location serviceability...</div>}>
      <NotServiceableContent />
    </Suspense>
  );
}
