'use client';

import React from 'react';
import {
  MapPin,
  AlertTriangle,
  Clock,
  Compass,
  ArrowRight,
  WifiOff,
  RefreshCw,
  ShoppingBag,
  X,
} from 'lucide-react';
import {
  locationFlowService,
  LocationFlowState,
} from '@/lib/locationFlowService';

interface Props {
  state: LocationFlowState;
}

export default function UnserviceableAreaModal({ state }: Props) {
  if (!state.isUnserviceableModalOpen && !state.isNetworkError) return null;

  const isStoreClosed = state.status === 'STORE_CLOSED';
  const isNetworkErr = state.isNetworkError || state.status === 'SERVICEABILITY_NETWORK_ERROR';
  const distanceKm = state.serviceability?.straightLineDistanceKm ?? null;
  const maxRadiusKm = state.serviceability?.radiusKm ?? state.serviceability?.maximumDistanceKm ?? null;
  const storeName = state.serviceability?.storeName || 'Maule Kirana (Neral Hub)';
  const operatingHours = state.serviceability?.storeOperatingHours || '06:00 - 23:00';
  const currentAddress = state.selectedLocation?.addressLine || 'Selected Location';

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
    >
      <div className="w-full max-w-sm bg-white dark:bg-[#181d27] rounded-t-[28px] sm:rounded-3xl shadow-2xl p-6 space-y-4 animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 border-t sm:border border-slate-200 dark:border-slate-800">
        
        {/* Close / Dismiss */}
        <div className="flex justify-end">
          <button
            onClick={() => locationFlowService.continueBrowsing()}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Icon & Title based on state */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            {isNetworkErr ? (
              <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border-2 border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <WifiOff className="w-7 h-7" />
              </div>
            ) : isStoreClosed ? (
              <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border-2 border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Clock className="w-7 h-7" />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-950/60 border-2 border-red-200 dark:border-red-800 flex items-center justify-center text-red-500">
                <AlertTriangle className="w-7 h-7" />
              </div>
            )}
          </div>

          <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
            {isNetworkErr
              ? 'Unable to Check Availability'
              : isStoreClosed
              ? 'Store Currently Closed'
              : "Oops! We're not there yet"}
          </h3>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
            {isNetworkErr
              ? "Couldn't check delivery availability. Please check your connection and try again."
              : isStoreClosed
              ? `${storeName} is currently closed. Operating hours are ${operatingHours}. You can still explore the catalog.`
              : "We're currently not serving this area. You can still explore PocketKirana and we'll let you know when delivery becomes available."}
          </p>
        </div>

        {/* Location & Metrics Info Card */}
        <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-3.5 border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Selected Location
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">
                {currentAddress}
              </span>
            </div>
          </div>

          {!isNetworkErr && !isStoreClosed && (
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200 dark:border-slate-800/80">
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Your Distance</span>
                <span className="font-mono font-black text-red-500 text-xs">
                  {distanceKm !== null ? `${distanceKm} KM` : 'Outside'}
                </span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Delivery Zone</span>
                <span className="font-mono font-black text-[#006E2F] dark:text-emerald-400 text-xs">
                  {maxRadiusKm !== null ? `Max ${maxRadiusKm} KM` : 'Service Area'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-1">
          {isNetworkErr ? (
            <button
              onClick={() => locationFlowService.retryServiceability()}
              className="w-full py-3 bg-[#006E2F] hover:bg-[#005a26] text-white font-black text-xs rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-[#006E2F]/20 active:scale-[0.98] transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Retry Connection
            </button>
          ) : (
            <>
              <button
                onClick={() => locationFlowService.openManualPicker()}
                className="w-full py-3.5 bg-[#006E2F] hover:bg-[#005a26] text-white font-black text-xs rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-[#006E2F]/20 active:scale-[0.98] transition-all cursor-pointer"
              >
                <Compass className="w-4 h-4" />
                Change Location
              </button>

              <button
                onClick={() => locationFlowService.openManualPicker()}
                className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                Choose Another Location
              </button>
            </>
          )}

          <button
            onClick={() => locationFlowService.continueBrowsing()}
            className="w-full py-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            Continue Browsing
          </button>
        </div>

      </div>
    </div>
  );
}
