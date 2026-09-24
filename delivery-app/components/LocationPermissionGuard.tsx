'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import {
  MapPin,
  Navigation,
  ShieldCheck,
  AlertCircle,
  Settings,
  RefreshCw,
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';
import {
  locationManager,
  LocationManagerState,
} from '@/lib/locationManager';

interface LocationPermissionGuardProps {
  children?: React.ReactNode;
}

export function LocationPermissionGuard({ children }: LocationPermissionGuardProps) {
  const pathname = usePathname();
  const [locState, setLocState] = useState<LocationManagerState>(() => locationManager.getState());
  const [requesting, setRequesting] = useState(false);

  // Skip guard on login route
  const isLoginRoute = pathname === '/login' || pathname === '/';

  // ── Reactive subscription to Central Location Manager ──────────────────
  useEffect(() => {
    if (isLoginRoute) return;

    const unsubscribe = locationManager.subscribe((nextState) => {
      setLocState(nextState);
    });

    // Check silently on mount — never flashes prompt if already granted
    locationManager.checkState({ silent: true });

    return () => unsubscribe();
  }, [isLoginRoute]);

  // ── Handle Action ──────────────────────────────────────────────────────
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
        showToast('📍 Location access enabled for delivery tracking!', 'success');
      } else {
        await locationManager.checkState({ forceFresh: true, silent: true });
      }
    } catch (err) {
      console.warn('handleTurnOnLocation error:', err);
    } finally {
      setRequesting(false);
    }
  }, [locState]);

  // ── Render Conditions ──────────────────────────────────────────────────
  if (isLoginRoute) return <>{children}</>;
  
  // If location is ready, idle, or checking in background, don't show prompt
  const isHardDenied = locState.permission === 'DENIED';
  const isGpsOff = locState.gps === 'DISABLED' || locState.status === 'GPS_DISABLED';
  const isPermissionRequired = locState.status === 'PERMISSION_REQUIRED';

  const shouldShowPrompt = isHardDenied || isGpsOff || isPermissionRequired;

  if (!shouldShowPrompt) return <>{children}</>;

  return (
    <>
      {children}

      {/* ── Full-screen overlay for delivery partner ── */}
      <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4 animate-in fade-in slide-in-from-bottom-6 duration-300">

          {/* Icon */}
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto ${
            isHardDenied
              ? 'bg-red-50 border border-red-200'
              : isGpsOff
              ? 'bg-amber-50 border border-amber-200'
              : 'bg-emerald-50 border border-emerald-200'
          }`}>
            <MapPin className={`w-7 h-7 stroke-[2.5] ${
              isHardDenied ? 'text-red-500' : isGpsOff ? 'text-amber-500' : 'text-[#0F532B]'
            }`} />
          </div>

          {/* Title + description */}
          <div className="text-center space-y-1.5">
            <h3 className="text-lg font-black text-slate-900 tracking-tight">
              {isHardDenied
                ? 'Location Permission Blocked'
                : isGpsOff
                ? 'Device Location is Turned Off'
                : 'Enable Location for Deliveries'}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {isHardDenied
                ? 'Location is blocked in Android settings. Open Settings to enable Location for Pocket Kirana Delivery.'
                : isGpsOff
                ? 'Location is required while you are online and delivering orders.'
                : 'Pocket Kirana Delivery requires GPS access to enable live delivery navigation and route tracking.'}
            </p>
          </div>

          {/* Guidance Banner */}
          {isGpsOff && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-2.5 text-left">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-900 font-medium leading-snug">
                Tap <strong>Turn On Location</strong> to open device quick settings. The app will automatically resume once enabled.
              </p>
            </div>
          )}

          {isHardDenied && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 flex items-start gap-2.5 text-left">
              <Settings className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
              <p className="text-[11px] text-rose-900 font-medium leading-snug">
                Go to <strong>Settings → Apps → Pocket Kirana Delivery → Permissions → Location → Allow</strong>.
              </p>
            </div>
          )}

          {/* Action button */}
          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={handleTurnOnLocation}
              disabled={requesting}
              className={`w-full py-3.5 text-white font-black text-xs rounded-2xl flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all cursor-pointer disabled:opacity-70 ${
                isHardDenied
                  ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
                  : isGpsOff
                  ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'
                  : 'bg-[#0F532B] hover:bg-[#0c4323] shadow-emerald-900/20'
              }`}
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
              ) : isGpsOff ? (
                <>
                  <Navigation className="w-4 h-4" />
                  Turn On Location
                </>
              ) : (
                <>
                  <Navigation className="w-4 h-4 stroke-[2.5]" />
                  Allow Location Access
                </>
              )}
            </button>
          </div>

          {/* Privacy notice */}
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-medium pt-1 border-t border-slate-100">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Active foreground delivery tracking · Protected</span>
          </div>

        </div>
      </div>
    </>
  );
}
