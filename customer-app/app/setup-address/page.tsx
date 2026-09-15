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
  Plus,
  X,
  Crosshair,
  MapPinOff,
  Home,
  Briefcase,
  Building2,
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

interface SuggestedPlace {
  display_name: string;
  lat: string;
  lon: string;
}

export default function SetupAddressPage() {
  const router = useRouter();
  const { isLoggedIn, addresses, addAddress, updateAddress, currentUser } = useAppStore();

  const [status, setStatus] = useState<'CHECKING' | 'PERMISSION_DENIED' | 'MANUAL'>('CHECKING');
  const [statusMessage, setStatusMessage] = useState('Detecting your delivery location…');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestedPlace[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [manualGpsLoading, setManualGpsLoading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProcessingRef = useRef(false);

  // ── Redirect if not logged in ──
  useEffect(() => {
    if (!isLoggedIn) {
      router.replace('/login');
    }
  }, [isLoggedIn, router]);

  // ── Helper: Save or Update Default Address (Prevents Duplicates) ──
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
        // Update existing address to avoid creating duplicates
        await updateAddress(existingDefault.id, {
          latitude: lat,
          longitude: lon,
          addressLine1: line1,
          city,
          postalCode: postal,
          isDefault: true,
        });
      } else {
        // Create only if no address exists yet
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
        // Run serviceability check & geocoding in parallel for speed
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

        if (zoneResult.isServiceable) {
          setStatusMessage('Location verified! Taking you to Pocket Kirana…');
          await saveOrUpdateAddress(latitude, longitude, geoDisplay);
          router.replace('/home');
        } else {
          // Unserviceable: Save coordinates for not-serviceable header reference
          await saveOrUpdateAddress(latitude, longitude, geoDisplay);
          router.replace('/not-serviceable');
        }
      } catch (err) {
        console.error('Service check error:', err);
        // Fallback: If network check fails, route to not-serviceable or home safely
        router.replace('/not-serviceable');
      } finally {
        isProcessingRef.current = false;
      }
    },
    [router, saveOrUpdateAddress]
  );

  // ── Auto-Detect Location on Mount ──
  const requestDeviceLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('PERMISSION_DENIED');
      return;
    }

    setStatus('CHECKING');
    setStatusMessage('Detecting your delivery location…');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        verifyAndNavigate(latitude, longitude);
      },
      (err) => {
        console.warn('Geolocation denied or error:', err.message);
        setStatus('PERMISSION_DENIED');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  }, [verifyAndNavigate]);

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

  const handleGpsFromManual = () => {
    if (!navigator.geolocation) {
      showToast('GPS is not available on this device', 'error');
      return;
    }
    setManualGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setManualGpsLoading(false);
        verifyAndNavigate(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setManualGpsLoading(false);
        showToast('Location access denied. Please type your location above.', 'error');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // ── 1. AUTOMATIC BACKGROUND CHECKING STATE ──
  if (status === 'CHECKING') {
    return (
      <div className="min-h-screen bg-[#FFF8F0] flex flex-col items-center justify-center px-6 font-sans select-none">
        {/* Animated Brand Pulse */}
        <div className="relative w-28 h-28 mx-auto mb-6 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-[#006E2F]/15 animate-ping" />
          <div className="absolute inset-2 rounded-full bg-[#006E2F]/20 animate-pulse" />
          <div className="relative w-20 h-20 rounded-3xl bg-[#006E2F] flex items-center justify-center shadow-xl shadow-[#006E2F]/30">
            <Navigation className="w-10 h-10 text-[#acf847] animate-bounce" />
          </div>
        </div>

        <div className="text-center space-y-2 max-w-xs">
          <h2 className="text-xl font-black text-[#004D21] tracking-tight">
            Pocket<span className="text-[#006E2F]">Kirana</span>
          </h2>
          <p className="text-sm font-bold text-[#2d3748]">{statusMessage}</p>
          <p className="text-xs text-[#718096] font-medium">10-minute grocery delivery at your doorstep</p>
        </div>
      </div>
    );
  }

  // ── 2. PERMISSION DENIED POPUP (Screenshot 2) ──
  if (status === 'PERMISSION_DENIED') {
    return (
      <div className="min-h-screen bg-[#0e1217]/80 backdrop-blur-md flex flex-col items-center justify-center px-5 font-sans select-none">
        <div className="bg-[#1c222c] border border-white/10 rounded-3xl shadow-2xl p-6 w-full max-w-sm text-center space-y-5 animate-in fade-in zoom-in duration-200">
          {/* Crossed Out Pin Icon */}
          <div className="w-20 h-20 mx-auto rounded-full bg-red-500/10 border-2 border-red-500/20 flex items-center justify-center">
            <div className="relative">
              <MapPinOff className="w-10 h-10 text-red-400" strokeWidth={2} />
            </div>
          </div>

          <div className="space-y-1.5">
            <h2 className="text-lg font-black text-white tracking-tight">
              Location permission not enabled
            </h2>
            <p className="text-xs text-slate-400 font-medium leading-relaxed px-2">
              Please enable location permission for a faster 10-minute delivery experience
            </p>
          </div>

          <div className="space-y-2.5 pt-2">
            <button
              onClick={requestDeviceLocation}
              className="w-full py-3.5 bg-[#006E2F] hover:bg-[#005a26] text-white font-black text-sm rounded-2xl transition-all active:scale-95 shadow-lg shadow-[#006E2F]/20 cursor-pointer"
            >
              Enable device location
            </button>

            <button
              onClick={() => setStatus('MANUAL')}
              className="w-full py-3 text-slate-300 hover:text-white font-bold text-sm transition-colors cursor-pointer"
            >
              Select location manually
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 3. MANUAL LOCATION SELECTION (Screenshot 3 Style) ──
  return (
    <div className="min-h-screen bg-[#FFF8F0] flex flex-col font-sans select-none">
      {/* Header */}
      <div className="bg-[#004D21] text-white px-5 pt-12 pb-4 shadow-md">
        <div className="max-w-md mx-auto">
          <h1 className="text-lg font-black tracking-tight">Select delivery location</h1>
        </div>
      </div>

      {/* Device Location Banner */}
      <div className="bg-[#FFF3E6] border-b border-[#FFE0B2] px-5 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#006E2F]/10 flex items-center justify-center shrink-0">
              <MapPinOff className="w-4 h-4 text-[#006E2F]" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#1a1a1a]">Device location not enabled</div>
              <div className="text-[11px] text-[#666] font-medium">Enable for accurate delivery times</div>
            </div>
          </div>
          <button
            onClick={requestDeviceLocation}
            className="bg-[#006E2F] hover:bg-[#005a26] text-white text-xs font-bold px-3.5 py-1.5 rounded-xl transition-all active:scale-95 cursor-pointer shrink-0"
          >
            Enable
          </button>
        </div>
      </div>

      <div className="flex-1 max-w-md mx-auto w-full px-5 py-4 space-y-3">
        {/* Search input */}
        <div className="relative">
          <div className="flex items-center gap-2.5 bg-white border-2 border-gray-200 focus-within:border-[#006E2F] rounded-2xl px-4 py-3.5 shadow-sm transition-all">
            <Search className="w-5 h-5 text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Search for area, street name..."
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              autoFocus
              className="flex-1 text-sm font-medium text-[#1a1a1a] placeholder-gray-400 bg-transparent focus:outline-none"
            />
            {loadingSuggestions && (
              <div className="w-4 h-4 border-2 border-[#006E2F] border-t-transparent rounded-full animate-spin shrink-0" />
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-xl z-20 overflow-hidden divide-y divide-gray-100">
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => handlePickPlace(s)}
                  className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-[#006E2F]/5 transition-colors cursor-pointer"
                >
                  <MapPin className="w-4 h-4 text-[#006E2F] mt-0.5 shrink-0" />
                  <span className="text-xs text-[#333] font-medium leading-relaxed line-clamp-2">
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
            className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl bg-white border border-gray-200 hover:bg-[#006E2F]/5 transition-colors cursor-pointer text-left shadow-sm"
          >
            <div className="w-9 h-9 rounded-full bg-[#006E2F]/10 flex items-center justify-center shrink-0">
              <Crosshair className={`w-5 h-5 text-[#006E2F] ${manualGpsLoading ? 'animate-spin' : ''}`} />
            </div>
            <span className="text-sm font-bold text-[#006E2F]">
              {manualGpsLoading ? 'Detecting GPS…' : 'Use current location'}
            </span>
            <ChevronRight className="w-4 h-4 text-gray-300 ml-auto" />
          </button>
        </div>

        {/* Saved Addresses (if any) */}
        {addresses.length > 0 && (
          <div className="pt-3">
            <h3 className="text-xs font-bold text-[#999] uppercase tracking-wider px-1 mb-2">
              Your saved addresses
            </h3>
            <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden shadow-sm">
              {addresses.map((addr, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (addr.latitude && addr.longitude) {
                      verifyAndNavigate(addr.latitude, addr.longitude, addr.addressLine1);
                    }
                  }}
                  className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-[#FFF3E6] flex items-center justify-center shrink-0 mt-0.5">
                    {addr.addressType === 'Home' ? (
                      <Home className="w-4 h-4 text-[#E88B00]" />
                    ) : addr.addressType === 'Work' ? (
                      <Briefcase className="w-4 h-4 text-[#E88B00]" />
                    ) : (
                      <Building2 className="w-4 h-4 text-[#E88B00]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-[#1a1a1a]">{addr.addressType || 'Saved'}</div>
                    <div className="text-xs text-[#666] font-medium mt-0.5 line-clamp-2">
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
