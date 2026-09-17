'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { validateDeliveryZoneServerSide } from '@/lib/locationServices';
import {
  MapPin,
  Navigation,
  Search,
  ChevronRight,
  Crosshair,
  MapPinOff,
  Home,
  Briefcase,
  Building2,
  CheckCircle2,
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';
import {
  getDeviceCoordinates,
  requestDeviceLocationPermission,
  openDeviceAppSettings,
  checkDeviceLocationPermission,
} from '../../lib/deviceLocation';

interface SuggestedPlace {
  display_name: string;
  lat: string;
  lon: string;
}

export default function SetupAddressPage() {
  const router = useRouter();
  const { isLoggedIn, addresses, addAddress, updateAddress, currentUser } = useAppStore();

  const [status, setStatus] = useState<'CHECKING' | 'PERMISSION_DENIED' | 'PERMISSION_HARD_DENIED' | 'MANUAL'>('CHECKING');
  const [statusMessage, setStatusMessage] = useState('Detecting your delivery location…');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestedPlace[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [manualGpsLoading, setManualGpsLoading] = useState(false);
  const [denialCount, setDenialCount] = useState(0);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProcessingRef = useRef(false);

  // ── Redirect if not logged in ──
  useEffect(() => {
    if (!isLoggedIn) {
      router.replace('/login');
    }
  }, [isLoggedIn, router]);

  // ── Helper: Save or Update Default Address ──
  const saveOrUpdateAddress = useCallback(
    async (lat: number, lon: number, displayName: string) => {
      const parts = displayName.split(',');
      const line1 = parts.slice(0, 2).join(',').trim() || 'Current Location';
      const city = parts[2]?.trim() || 'Neral';
      const postal = parts.find((p) => /\d{6}/.test(p.trim()))?.trim() || '410101';
      const userId = currentUser?.id || 'usr-cust-1';
      const fullName = (currentUser?.firstName ? `${currentUser.firstName} ${currentUser.lastName || ''}`.trim() : currentUser?.mobile) || 'Customer';
      const phone = currentUser?.mobile || '';

      const currentAddresses = useAppStore.getState().addresses;
      const existingDefault = currentAddresses.find((a) => a.isDefault) || currentAddresses[0];

      if (existingDefault) {
        await updateAddress(existingDefault.id, {
          latitude: lat,
          longitude: lon,
          addressLine1: line1,
          city,
          postalCode: postal,
          isDefault: true,
        });
      } else {
        await addAddress({
          userId,
          addressType: 'Home',
          fullName,
          phone,
          addressLine1: line1,
          city,
          state: 'Maharashtra',
          country: 'India',
          postalCode: postal,
          isDefault: true,
          latitude: lat,
          longitude: lon,
        });
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('pk_location_granted', 'true');
      }
    },
    [currentUser, addAddress, updateAddress]
  );

  // ── Core Location + Serviceability Verification Flow ──
  const verifyAndNavigate = useCallback(
    async (latitude: number, longitude: number, knownDisplay?: string) => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      setStatus('CHECKING');
      setStatusMessage('Checking 10-minute delivery availability…');

      try {
        const [zoneResult, geoDisplay] = await Promise.all([
          validateDeliveryZoneServerSide(latitude, longitude),
          (async () => {
            if (knownDisplay) return knownDisplay;
            try {
              const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
                { headers: { 'Accept-Language': 'en' }, signal: AbortSignal.timeout(3500) }
              );
              const data = await res.json();
              return data.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
            } catch {
              return `Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
            }
          })(),
        ]);

        await saveOrUpdateAddress(latitude, longitude, geoDisplay);

        if (!zoneResult.isServiceable) {
          setStatusMessage('Location is outside our 3 KM delivery radius in Neral.');
          setTimeout(() => {
            router.replace(`/not-serviceable?dist=${zoneResult.distanceKm}&lat=${latitude}&lon=${longitude}`);
          }, 300);
          return;
        }

        setStatusMessage('Location verified! Taking you to Pocket Kirana…');
        
        // Direct to home page smoothly
        setTimeout(() => {
          router.replace('/home');
        }, 300);
      } catch (err) {
        console.error('Service check error:', err);
        // Save address and recheck
        await saveOrUpdateAddress(latitude, longitude, knownDisplay || 'Neral');
        router.replace('/home');
      } finally {
        isProcessingRef.current = false;
      }
    },
    [router, saveOrUpdateAddress]
  );

  // ── Auto-Detect Location with Capacitor Geolocation ──
  const requestDeviceLocation = useCallback(async () => {
    setStatus('CHECKING');
    setStatusMessage('Detecting your delivery location…');

    try {
      const coords = await getDeviceCoordinates();
      if (coords && coords.latitude && coords.longitude) {
        await verifyAndNavigate(coords.latitude, coords.longitude);
      } else {
        setStatus('PERMISSION_DENIED');
      }
    } catch (err: any) {
      console.warn('Geolocation error:', err);
      const perm = await checkDeviceLocationPermission();
      if (perm.state === 'denied') {
        const next = denialCount + 1;
        setDenialCount(next);
        if (next >= 2) {
          setStatus('PERMISSION_HARD_DENIED');
        } else {
          setStatus('PERMISSION_DENIED');
        }
      } else {
        setStatus('PERMISSION_DENIED');
      }
    }
  }, [verifyAndNavigate, denialCount]);

  useEffect(() => {
    requestDeviceLocation();
  }, [requestDeviceLocation]);

  // ── Debounced Places Search for Manual Selection ──
  const handleQueryChange = (val: string) => {
    setQuery(val);
    setSuggestions([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 3) return;
    debounceRef.current = setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=5&countrycodes=in`,
          { headers: { 'Accept-Language': 'en' }, signal: AbortSignal.timeout(4000) }
        );
        const data = await res.json();
        setSuggestions(data as SuggestedPlace[]);
      } catch {
        // ignore network timeouts
      } finally {
        setLoadingSuggestions(false);
      }
    }, 400);
  };

  const handlePickPlace = (place: SuggestedPlace) => {
    const lat = parseFloat(place.lat);
    const lon = parseFloat(place.lon);
    verifyAndNavigate(lat, lon, place.display_name);
  };

  const handleGpsFromManual = async () => {
    setManualGpsLoading(true);
    try {
      const coords = await getDeviceCoordinates();
      setManualGpsLoading(false);
      if (coords && coords.latitude && coords.longitude) {
        verifyAndNavigate(coords.latitude, coords.longitude);
      } else {
        showToast('Location access not available. Please type your location above.', 'error');
      }
    } catch (e) {
      setManualGpsLoading(false);
      showToast('Could not fetch location. Please search your area above.', 'error');
    }
  };

  // ── 1. AUTOMATIC BACKGROUND CHECKING STATE ──
  if (status === 'CHECKING') {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0e1217] text-[#111827] dark:text-white flex flex-col items-center justify-center px-6 font-sans select-none transition-colors duration-200">
        {/* Animated Brand Pulse */}
        <div className="relative w-28 h-28 mx-auto mb-6 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-emerald-500/20 dark:bg-[#006E2F]/30 animate-ping" />
          <div className="absolute inset-2 rounded-full bg-emerald-500/30 dark:bg-[#006E2F]/40 animate-pulse" />
          <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500 to-[#006E2F] flex items-center justify-center shadow-xl shadow-[#006E2F]/40 border border-emerald-400/30">
            <Navigation className="w-10 h-10 text-white animate-bounce" />
          </div>
        </div>

        <div className="text-center space-y-2 max-w-xs">
          <h2 className="text-xl font-black text-[#111827] dark:text-white tracking-tight">
            Pocket<span className="text-emerald-500 dark:text-emerald-400">Kirana</span>
          </h2>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{statusMessage}</p>
          <p className="text-xs text-slate-500 dark:text-[#9CA3AF] font-medium">10-minute grocery delivery at your doorstep</p>
        </div>
      </div>
    );
  }

  // ── 2. PERMISSION DENIED POPUP ──
  if (status === 'PERMISSION_DENIED' || status === 'PERMISSION_HARD_DENIED') {
    const isHardDenied = status === 'PERMISSION_HARD_DENIED';
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0e1217] flex flex-col items-center justify-center px-5 font-sans select-none transition-colors duration-200">
        <div className="bg-white dark:bg-[#1c222c] border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl p-6 w-full max-w-sm text-center space-y-5 animate-in fade-in zoom-in duration-200">
          {/* Crossed Out Pin Icon */}
          <div className="w-20 h-20 mx-auto rounded-full bg-red-500/10 border-2 border-red-500/20 flex items-center justify-center">
            <div className="relative">
              <MapPinOff className="w-10 h-10 text-red-500 dark:text-red-400" strokeWidth={2} />
            </div>
          </div>

          <div className="space-y-1.5">
            <h2 className="text-lg font-black text-[#111827] dark:text-white tracking-tight">
              {isHardDenied ? 'Location Permission Blocked' : 'Location permission not enabled'}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed px-2">
              {isHardDenied
                ? 'Location is blocked in your device settings. Open Settings and allow location for Pocket Kirana.'
                : 'Please enable location access for a faster 10-minute delivery experience.'}
            </p>
          </div>

          {isHardDenied && (
            <div className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-700/40 rounded-2xl p-3 text-left">
              <p className="text-[11px] text-rose-800 dark:text-rose-300 font-medium leading-snug">
                Go to: <strong className="text-[#111827] dark:text-white">Phone Settings → Apps → Pocket Kirana → Permissions → Location → Allow</strong>
              </p>
            </div>
          )}

          <div className="space-y-2.5 pt-2">
            {isHardDenied ? (
              <button
                onClick={openDeviceAppSettings}
                className="w-full py-3.5 bg-[#006E2F] hover:bg-[#005a26] text-white font-black text-sm rounded-2xl transition-all active:scale-95 shadow-lg shadow-[#006E2F]/20 cursor-pointer flex items-center justify-center gap-2"
              >
                <Navigation className="w-4 h-4" />
                Open App Settings
              </button>
            ) : (
              <button
                onClick={requestDeviceLocation}
                className="w-full py-3.5 bg-[#006E2F] hover:bg-[#005a26] text-white font-black text-sm rounded-2xl transition-all active:scale-95 shadow-lg shadow-[#006E2F]/20 cursor-pointer flex items-center justify-center gap-2"
              >
                <Navigation className="w-4 h-4" />
                Enable Device Location
              </button>
            )}

            <button
              onClick={() => setStatus('MANUAL')}
              className="w-full py-3 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-bold text-sm transition-colors cursor-pointer"
            >
              Select location manually
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 3. MANUAL LOCATION SELECTION ──
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0e1217] text-[#111827] dark:text-white flex flex-col font-sans select-none transition-colors duration-200">
      {/* Header */}
      <div className="bg-white dark:bg-[#151923] border-b border-slate-200 dark:border-slate-800 text-[#111827] dark:text-white px-5 pt-12 pb-4 shadow-xs">
        <div className="max-w-md mx-auto">
          <h1 className="text-lg font-black tracking-tight">Select delivery location</h1>
        </div>
      </div>

      {/* Device Location Banner */}
      <div className={`border-b px-5 py-3 ${denialCount >= 2 ? 'bg-rose-50 dark:bg-red-950/40 border-rose-200 dark:border-red-800/40' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}>
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${denialCount >= 2 ? 'bg-red-500/20 text-red-500 dark:text-red-400' : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'}`}>
              <MapPinOff className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#111827] dark:text-white">
                {denialCount >= 2 ? 'Location Permission Blocked' : 'Device location not enabled'}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                {denialCount >= 2
                  ? 'Open Settings → Permissions → Location → Allow'
                  : 'Enable for automatic delivery setup'}
              </div>
            </div>
          </div>
          <button
            onClick={denialCount >= 2 ? openDeviceAppSettings : requestDeviceLocation}
            className="bg-[#006E2F] hover:bg-[#005a26] text-white text-xs font-bold px-3.5 py-1.5 rounded-xl transition-all active:scale-95 cursor-pointer shrink-0 shadow-md"
          >
            {denialCount >= 2 ? 'Settings' : 'Enable'}
          </button>
        </div>
      </div>

      <div className="flex-1 max-w-md mx-auto w-full px-5 py-4 space-y-3">
        {/* Search input */}
        <div className="relative">
          <div className="flex items-center gap-2.5 bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-white/10 focus-within:border-emerald-500 rounded-2xl px-4 py-3.5 shadow-sm transition-all">
            <Search className="w-5 h-5 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search area, society, street..."
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              autoFocus
              className="flex-1 text-sm font-medium text-[#111827] dark:text-white placeholder-slate-400 bg-transparent focus:outline-none"
            />
            {loadingSuggestions && (
              <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin shrink-0" />
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#1c222c] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl z-20 overflow-hidden divide-y divide-slate-100 dark:divide-white/5">
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => handlePickPlace(s)}
                  className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors cursor-pointer"
                >
                  <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                  <span className="text-xs text-slate-700 dark:text-slate-200 font-medium leading-relaxed line-clamp-2">
                    {s.display_name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Use Current Location Action */}
        <div className="space-y-1 pt-1">
          <button
            onClick={handleGpsFromManual}
            disabled={manualGpsLoading}
            className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-white/10 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer text-left shadow-xs"
          >
            <div className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
              <Crosshair className={`w-5 h-5 text-emerald-600 dark:text-emerald-400 ${manualGpsLoading ? 'animate-spin' : ''}`} />
            </div>
            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
              {manualGpsLoading ? 'Detecting GPS…' : 'Use current location'}
            </span>
            <ChevronRight className="w-4 h-4 text-slate-400 dark:text-gray-500 ml-auto" />
          </button>
        </div>

        {/* Saved Addresses (if any) */}
        {addresses.length > 0 && (
          <div className="pt-3">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1 mb-2">
              Your saved addresses
            </h3>
            <div className="bg-white dark:bg-[#1a202c] rounded-2xl border border-slate-200 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/5 overflow-hidden shadow-xs">
              {addresses.map((addr, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (addr.latitude && addr.longitude) {
                      verifyAndNavigate(addr.latitude, addr.longitude, addr.addressLine1);
                    } else {
                      router.replace('/home');
                    }
                  }}
                  className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                    {addr.addressType === 'Home' ? (
                      <Home className="w-4 h-4" />
                    ) : addr.addressType === 'Work' ? (
                      <Briefcase className="w-4 h-4" />
                    ) : (
                      <Building2 className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-[#111827] dark:text-white">{addr.addressType || 'Saved'}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5 line-clamp-2">
                      {addr.addressLine1}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
