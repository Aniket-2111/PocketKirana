'use client';

import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Navigation,
  Compass,
  Settings,
  X,
  ShieldCheck,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  locationFlowService,
  LocationFlowState,
} from '@/lib/locationFlowService';
import ManualLocationPickerModal from './customer/ManualLocationPickerModal';
import UnserviceableAreaModal from './customer/UnserviceableAreaModal';

interface Props {
  children: React.ReactNode;
}

export function CustomerLocationPermissionGuard({ children }: Props) {
  const [state, setState] = useState<LocationFlowState>(() => locationFlowService.getState());
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    const unsub = locationFlowService.subscribe((next) => {
      setState(next);
    });
    return () => unsub();
  }, []);

  const handleUseMyLocation = async () => {
    setRequesting(true);
    try {
      await locationFlowService.requestDeviceLocation();
    } finally {
      setRequesting(false);
    }
  };

  const handleChooseManually = () => {
    locationFlowService.openManualPicker();
  };

  const handleDismissExplanation = () => {
    locationFlowService.closeExplanation();
  };

  const isHardDenied =
    state.status === 'LOCATION_PERMISSION_DENIED_PERMANENTLY' ||
    state.status === 'LOCATION_PERMISSION_DENIED';

  const isFetching = state.status === 'LOCATION_FETCHING' || state.status === 'SERVICEABILITY_CHECKING';

  return (
    <>
      {children}

      {/* ── 1. PRE-LOGIN LOCATION EXPLANATION MODAL (Blinkit-inspired UX pattern) ── */}
      {state.isExplanationOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
        >
          <div className="w-full max-w-sm bg-white dark:bg-[#181d27] rounded-t-[28px] sm:rounded-3xl shadow-2xl p-6 space-y-4 animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 border-t sm:border border-slate-200 dark:border-slate-800">
            
            {/* Close / Dismiss */}
            <div className="flex justify-end">
              <button
                onClick={handleDismissExplanation}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Icon */}
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border-2 border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-[#006E2F] dark:text-emerald-400 shadow-md">
                <MapPin className="w-8 h-8 stroke-[2.2]" />
              </div>
            </div>

            {/* Title & Description */}
            <div className="text-center space-y-1.5">
              <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Find PocketKirana near you
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
                Allow location access to check delivery availability and show products available in your area.
              </p>
            </div>

            {/* Denied Warning Note if permission was blocked */}
            {isHardDenied && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl p-3 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-900 dark:text-amber-200 font-medium leading-snug">
                  Location permission is currently blocked. You can pick your location manually below, or allow location in App Settings.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                onClick={handleUseMyLocation}
                disabled={requesting || isFetching}
                className="w-full py-3.5 bg-[#006E2F] hover:bg-[#005a26] text-white font-black text-xs rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-[#006E2F]/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-70"
              >
                {requesting || isFetching ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Finding Your Location…
                  </>
                ) : (
                  <>
                    <Navigation className="w-4 h-4" />
                    Use my location
                  </>
                )}
              </button>

              <button
                onClick={handleChooseManually}
                className="w-full py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Compass className="w-4 h-4 text-emerald-600" />
                Choose location manually
              </button>
            </div>

            {/* Privacy Note */}
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-medium border-t border-slate-100 dark:border-slate-800 pt-3">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Used only to verify delivery area &amp; show nearby store</span>
            </div>

          </div>
        </div>
      )}

      {/* ── 2. MANUAL LOCATION PICKER MODAL ── */}
      <ManualLocationPickerModal
        isOpen={state.isManualPickerOpen}
        onClose={() => locationFlowService.closeManualPicker()}
      />

      {/* ── 3. UNSERVICEABLE AREA / STORE CLOSED / NETWORK RETRY MODAL ── */}
      <UnserviceableAreaModal state={state} />
    </>
  );
}
