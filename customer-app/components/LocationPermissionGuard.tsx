'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Navigation, ShieldCheck, AlertCircle, Settings, X } from 'lucide-react';
import {
  locationManager,
  LocationManagerState,
} from '@/lib/locationManager';

interface Props {
  children: React.ReactNode;
}

export function CustomerLocationPermissionGuard({ children }: Props) {
  const router = useRouter();
  const [locState, setLocState] = useState<LocationManagerState>(() => locationManager.getState());
  const [dismissed, setDismissed] = useState(false);
  const [requesting, setRequesting] = useState(false);

  // ── Reactive subscription to Central Location Manager ──────────────────
  useEffect(() => {
    const unsubscribe = locationManager.subscribe((nextState) => {
      setLocState(nextState);
      // Auto-continue if GPS is enabled and permission is ready
      if (nextState.status === 'READY' || nextState.coords) {
        setDismissed(true);
        if (typeof window !== 'undefined') {
          localStorage.setItem('pk_location_granted', 'true');
        }
      }
    });

    // Check on mount
    locationManager.checkState();

    return () => unsubscribe();
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────
  const handleTurnOnLocation = useCallback(async () => {
    if (locState.permission === 'DENIED') {
      locationManager.openAppSettings();
      return;
    }

    if (locState.gps === 'DISABLED' || locState.status === 'GPS_DISABLED') {
      locationManager.openLocationSettings();
      return;
    }

    setRequesting(true);
    try {
      const granted = await locationManager.requestPermission();
      if (granted) {
        await locationManager.getCurrentCoordinates();
        setDismissed(true);
      } else {
        await locationManager.checkState({ forceFresh: true });
      }
    } catch (err) {
      console.warn('handleTurnOnLocation error:', err);
    } finally {
      setRequesting(false);
    }
  }, [locState]);

  const handleContinueWithoutLocation = () => {
    setDismissed(true);
  };

  // ── Render Guard conditions ───────────────────────────────────────────
  const isAlreadyGranted = typeof window !== 'undefined' && localStorage.getItem('pk_location_granted') === 'true';
  if (locState.status === 'READY' || locState.status === 'IDLE' || isAlreadyGranted || dismissed) {
    return <>{children}</>;
  }

  const isHardDenied = locState.permission === 'DENIED';
  const isGpsOff = locState.gps === 'DISABLED' || locState.status === 'GPS_DISABLED';

  return (
    <>
      {children}

      {/* ── Location Permission Bottom-Sheet Modal ── */}
      <div
        className="fixed inset-0 z-[9999] flex items-end justify-center"
        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      >
        <div className="w-full max-w-sm mx-auto bg-white dark:bg-[#181d27] rounded-t-[28px] shadow-2xl px-5 pt-5 pb-8 space-y-4 animate-in slide-in-from-bottom-6 duration-300 border-t border-slate-200 dark:border-slate-800">

          {/* Close button */}
          <button
            onClick={handleContinueWithoutLocation}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Icon */}
          <div className="flex justify-center pt-1">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
              isHardDenied
                ? 'bg-red-50 dark:bg-red-950/40 border-2 border-red-200 dark:border-red-800'
                : isGpsOff
                ? 'bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-200 dark:border-amber-800'
                : 'bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-200 dark:border-emerald-800'
            }`}>
              <MapPin className={`w-8 h-8 stroke-[2.5] ${
                isHardDenied ? 'text-red-500' : isGpsOff ? 'text-amber-500' : 'text-[#006E2F] dark:text-emerald-400'
              }`} />
            </div>
          </div>

          {/* Title + description */}
          <div className="text-center space-y-1.5">
            <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
              {isHardDenied
                ? 'Location Permission Blocked'
                : isGpsOff
                ? 'Location is turned off'
                : 'Allow Location Access'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
              {isHardDenied
                ? 'Location permission is blocked. Please open device settings and allow Location for Pocket Kirana.'
                : isGpsOff
                ? 'Turn on Location to check delivery availability and set your delivery address.'
                : 'Pocket Kirana needs your device location to check 10-minute delivery availability and set your delivery address.'}
            </p>
          </div>

          {/* Settings hint banner for hard denied state */}
          {isHardDenied && (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl p-3 flex items-start gap-2.5">
              <Settings className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-900 dark:text-red-200 font-medium leading-snug">
                Go to <strong>Phone Settings → Apps → Pocket Kirana → Permissions → Location</strong> and select <strong>"Allow"</strong>.
              </p>
            </div>
          )}

          {/* Alert banner for prompt state */}
          {locState.permission === 'PROMPT' && !isHardDenied && !isGpsOff && (
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-3 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-emerald-900 dark:text-emerald-200 font-medium leading-snug">
                Tap <strong>Turn On Location</strong> below and choose <strong>"Allow while using app"</strong>.
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-2 pt-1">
            <button
              onClick={handleTurnOnLocation}
              disabled={requesting}
              className="w-full py-3.5 bg-[#006E2F] hover:bg-[#005a26] text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-[#006E2F]/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-70"
            >
              {requesting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Checking Location…
                </>
              ) : isHardDenied ? (
                <>
                  <Settings className="w-4 h-4" />
                  Open App Settings
                </>
              ) : (
                <>
                  <Navigation className="w-4 h-4 stroke-[2.5]" />
                  Turn On Location
                </>
              )}
            </button>
            <button
              onClick={handleContinueWithoutLocation}
              className="w-full py-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Continue Without Location
            </button>
          </div>

          {/* Privacy note */}
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-medium border-t border-slate-100 dark:border-slate-800 pt-3">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Used only for 10-min delivery address verification</span>
          </div>

        </div>
      </div>
    </>
  );
}
