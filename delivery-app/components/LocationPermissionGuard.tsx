'use client';

import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, ShieldCheck, AlertCircle, Settings, CheckCircle2 } from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

interface LocationPermissionGuardProps {
  children?: React.ReactNode;
}

export function LocationPermissionGuard({ children }: LocationPermissionGuardProps) {
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'permanently_denied'>('granted');
  const [checking, setChecking] = useState(true);
  const [denialCount, setDenialCount] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedGranted = localStorage.getItem('pk_delivery_location_granted');
    const storedDenials = parseInt(localStorage.getItem('pk_delivery_loc_denials') || '0', 10);
    setDenialCount(storedDenials);

    if (storedGranted === 'true') {
      setPermissionState('granted');
      setChecking(false);
      return;
    }

    // Check navigator permissions if supported
    if ('permissions' in navigator && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((result) => {
          if (result.state === 'granted') {
            localStorage.setItem('pk_delivery_location_granted', 'true');
            setPermissionState('granted');
          } else if (result.state === 'denied') {
            setPermissionState(storedDenials >= 2 ? 'permanently_denied' : 'denied');
          } else {
            setPermissionState('prompt');
          }
        })
        .catch(() => {
          setPermissionState('prompt');
        })
        .finally(() => {
          setChecking(false);
        });
    } else {
      setPermissionState('prompt');
      setChecking(false);
    }
  }, []);

  const handleRequestLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      showToast('Geolocation is not supported on this device.', 'error');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        localStorage.setItem('pk_delivery_location_granted', 'true');
        localStorage.removeItem('pk_delivery_loc_denials');
        setPermissionState('granted');
        showToast('📍 Location access enabled for delivery tracking!', 'success');
      },
      (err) => {
        const nextDenials = denialCount + 1;
        setDenialCount(nextDenials);
        localStorage.setItem('pk_delivery_loc_denials', String(nextDenials));

        if (err.code === err.PERMISSION_DENIED) {
          if (nextDenials >= 2) {
            setPermissionState('permanently_denied');
          } else {
            setPermissionState('denied');
          }
          showToast('Location permission is required for delivery navigation.', 'error');
        } else {
          showToast('Unable to acquire GPS signal. Please ensure device Location is ON.', 'error');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleOpenSettings = () => {
    showToast('Please enable Location permission in Device Settings > Apps > Pocket Kirana Delivery.', 'info');
    // If running in Capacitor, we can also dispatch standard app settings intent if available
    try {
      if ((window as any).Capacitor?.Plugins?.App?.openUrl) {
        (window as any).Capacitor.Plugins.App.openUrl({ url: 'package:com.pocketkirana.delivery' });
      }
    } catch (_) {}
  };

  if (checking) return <>{children}</>;

  if (permissionState === 'granted') {
    return <>{children}</>;
  }

  return (
    <>
      {children}

      {/* Location Permission Modal Overlay */}
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4 animate-in fade-in slide-in-from-bottom-6 duration-300">
          
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-[#0F532B]">
            <MapPin className="w-7 h-7 stroke-[2.5]" />
          </div>

          <div className="text-center space-y-1.5">
            <h3 className="text-lg font-black text-slate-900 tracking-tight">
              {permissionState === 'permanently_denied'
                ? 'Location Permission Required'
                : 'Enable Location for Deliveries'}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Pocket Kirana Delivery requires foreground location access to enable live GPS navigation, route tracking, and accurate grocery drop-offs.
            </p>
          </div>

          {permissionState === 'denied' && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-2.5 text-left">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-900 font-medium leading-snug">
                Location permission was denied. Location is required to navigate to stores and customer addresses.
              </p>
            </div>
          )}

          {permissionState === 'permanently_denied' && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 flex items-start gap-2.5 text-left">
              <Settings className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
              <p className="text-[11px] text-rose-900 font-medium leading-snug">
                Location access is blocked in Android settings. Please tap <strong>Open Settings</strong> and enable Location permissions.
              </p>
            </div>
          )}

          <div className="space-y-2 pt-2">
            {permissionState === 'permanently_denied' ? (
              <button
                type="button"
                onClick={handleOpenSettings}
                className="w-full py-3.5 bg-[#0F532B] hover:bg-[#0c4323] text-white font-black text-xs rounded-2xl flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all cursor-pointer"
              >
                <Settings className="w-4 h-4" />
                <span>Open App Settings</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRequestLocation}
                className="w-full py-3.5 bg-[#0F532B] hover:bg-[#0c4323] text-white font-black text-xs rounded-2xl flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all cursor-pointer"
              >
                <Navigation className="w-4 h-4 stroke-[2.5]" />
                <span>Allow Location Access</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setPermissionState('granted');
                showToast('Continuing with limited offline features.', 'info');
              }}
              className="w-full py-2.5 text-slate-500 hover:text-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Continue Anyway
            </button>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-medium pt-1 border-t border-slate-100">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Foreground location only • Privacy protected</span>
          </div>

        </div>
      </div>
    </>
  );
}
