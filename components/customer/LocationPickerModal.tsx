'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  MapPin, X, Search, CheckCircle2, Home, Briefcase,
  Plus, Loader2, Check, ChevronRight, Navigation2,
  Phone, User, Building2, Landmark, Hash, Zap,
  BellRing, Sparkles, AlertCircle
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { Address } from '@/types';
import {
  resolveLocationFromCoords,
  searchLocationsAutocomplete,
  checkZoneServiceability,
  setStoresState,
  GeocodedLocation,
  ZoneServiceability
} from '@/lib/locationServices';
import { fetchShopsFS } from '@/lib/firebaseServices';
import { showToast } from '@/components/ui/Toast';

// Dynamic import with ssr:false prevents Leaflet from running during
// Next.js static export pre-rendering, which would throw:
// "Cannot read properties of null (reading 'offsetWidth')"
const InteractiveMapCanvas = dynamic(
  () => import('@/components/common/InteractiveMapCanvas').then((m) => m.InteractiveMapCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-slate-100 rounded-xl flex items-center justify-center min-h-[220px]">
        <div className="flex flex-col items-center gap-2 text-slate-400">
          <svg className="animate-spin w-7 h-7" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-xs font-medium">Loading map…</span>
        </div>
      </div>
    ),
  }
);

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingAddress?: Address | null;
}

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({ isOpen, onClose, editingAddress }) => {
  const [mounted, setMounted] = useState(false);
  const { addresses, addAddress, updateAddress, setDefaultAddress, currentUser } = useAppStore();

  const defaultAddr = addresses.find((a) => a.isDefault) || addresses[0];
  const [activeAddressId, setActiveAddressId] = useState<string>(defaultAddr?.id || '');

  // Panel: 'saved' | 'new' | 'notify_modal'
  const [panel, setPanel] = useState<'saved' | 'new'>(addresses.length > 0 ? 'saved' : 'new');
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [notifySubmitting, setNotifySubmitting] = useState(false);
  const [notifySubmitted, setNotifySubmitted] = useState(false);

  // Map State
  const [lat, setLat] = useState<number>(defaultAddr?.latitude || 19.033);
  const [lng, setLng] = useState<number>(defaultAddr?.longitude || 73.317);
  const [geocoded, setGeocoded] = useState<GeocodedLocation | null>(null);
  const [zoneInfo, setZoneInfo] = useState<ZoneServiceability | null>(null);
  const [loadingGeocode, setLoadingGeocode] = useState(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodedLocation[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Form State — empty by default for new address manual/auto entry
  const [receiverName, setReceiverName] = useState(
    currentUser?.firstName
      ? `${currentUser.firstName} ${currentUser.lastName || ''}`.trim()
      : ''
  );
  const [phone, setPhone] = useState(currentUser?.mobile || '');
  const [houseNumber, setHouseNumber] = useState('');
  const [buildingName, setBuildingName] = useState('');
  const [area, setArea] = useState('');
  const [landmark, setLandmark] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [addressLabel, setAddressLabel] = useState<'Home' | 'Work' | 'Other'>('Home');

  useEffect(() => { setMounted(true); }, []);

  // ─── Pre-fill form fields when editing an existing address
  useEffect(() => {
    if (!isOpen) return;
    if (editingAddress) {
      // Populate all fields from the existing address
      setReceiverName(editingAddress.fullName || '');
      setPhone(editingAddress.phone || '');
      setHouseNumber((editingAddress as any).houseNumber || editingAddress.addressLine1 || '');
      setBuildingName((editingAddress as any).buildingName || '');
      setArea((editingAddress as any).area || editingAddress.addressLine2 || '');
      setLandmark((editingAddress as any).landmark || '');
      setPostalCode(editingAddress.postalCode || '');
      setCity(editingAddress.city || '');
      setState(editingAddress.state || '');
      setAddressLabel((editingAddress.addressType as any) || 'Home');
      // Move map pin to saved coordinates
      if (editingAddress.latitude && editingAddress.longitude) {
        setLat(editingAddress.latitude);
        setLng(editingAddress.longitude);
      }
      setPanel('new');
    } else {
      // Reset for new address
      setReceiverName(currentUser?.firstName ? `${currentUser.firstName} ${currentUser.lastName || ''}`.trim() : '');
      setPhone(currentUser?.mobile || '');
      setHouseNumber('');
      setBuildingName('');
      setArea('');
      setLandmark('');
      setPostalCode('');
      setCity('');
      setState('');
      setAddressLabel('Home');
      setPanel(addresses.length > 0 ? 'saved' : 'new');
    }
  }, [isOpen, editingAddress]);

  // ─── Load live store config from Firestore when modal opens
  // Syncs STORES_STATE so checkZoneServiceability uses admin-configured
  // lat/lng and radius instead of the hardcoded INITIAL_STORES fallback.
  const [storeConfigLoaded, setStoreConfigLoaded] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    async function loadStoreConfig() {
      try {
        const shops = await fetchShopsFS();
        if (!cancelled && shops && shops.length > 0) {
          setStoresState(shops);
        }
      } catch (e) {
        // Silently ignore — STORES_STATE may already be correct if admin page was visited
      } finally {
        if (!cancelled) setStoreConfigLoaded(true);
      }
    }
    loadStoreConfig();
    return () => { cancelled = true; };
  }, [isOpen]);

  // ─── Resolve coords → address + zone check
  // Auto-populates area, city, state, pincode from map/GPS geocoding.
  // House number, building name, and landmark remain empty for manual entry.
  useEffect(() => {
    if (!mounted || !isOpen) return;
    let isCurrent = true;
    setLoadingGeocode(true);

    const timer = setTimeout(async () => {
      try {
        const res = await resolveLocationFromCoords(lat, lng);
        if (!isCurrent) return;
        setGeocoded(res);
        setArea(res.suburb || res.road || res.addressLine || '');
        setCity(res.city || '');
        setState(res.state || '');
        setPostalCode(res.pincode || '');
        // Uses the live Firestore store config (admin lat/lng/radius)
        const zone = checkZoneServiceability(lat, lng, res.pincode);
        setZoneInfo(zone);
      } catch (err) {
        console.warn('Geocoding error:', err);
      } finally {
        if (isCurrent) setLoadingGeocode(false);
      }
    }, 80);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [lat, lng, mounted, isOpen, storeConfigLoaded]);

  // Autocomplete search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(async () => {
      const results = await searchLocationsAutocomplete(searchQuery);
      setSearchResults(results);
      setShowSearchResults(true);
      setIsSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleAddNewClick = () => {
    setHouseNumber('');
    setBuildingName('');
    setLandmark('');
    setSearchQuery('');
    setShowSearchResults(false);
    setPanel('new');
  };

  const handleSelectSearchResult = (location: GeocodedLocation) => {
    setLat(location.latitude);
    setLng(location.longitude);
    setSearchQuery(location.displayName);
    setShowSearchResults(false);
    setPanel('new');
  };

  const handlePositionChange = (newLat: number, newLng: number) => {
    setLat(newLat);
    setLng(newLng);
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser', 'error');
      return;
    }
    setLoadingGeocode(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setPanel('new');
        showToast('Current GPS location detected!', 'success');
      },
      () => {
        setLoadingGeocode(false);
        showToast('Unable to detect GPS location. You can pin on map or enter address manually.', 'error');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiverName || !houseNumber || !area || !postalCode) {
      showToast('Please fill all required fields', 'error');
      return;
    }
    const fullAddrLine = `${houseNumber}${buildingName ? ', ' + buildingName : ''}, ${area}`;

    if (editingAddress) {
      // Update existing address
      updateAddress(editingAddress.id, {
        addressType: addressLabel,
        fullName: receiverName,
        phone,
        houseNumber,
        buildingName,
        landmark,
        addressLine1: fullAddrLine,
        addressLine2: landmark,
        area,
        city,
        state,
        postalCode,
        latitude: lat,
        longitude: lng,
      } as any);
      showToast('Address updated successfully!', 'success');
    } else {
      // Add new address
      addAddress({
        userId: currentUser?.id || 'usr-cust-1',
        addressType: addressLabel,
        fullName: receiverName,
        phone,
        houseNumber,
        buildingName,
        landmark,
        addressLine1: fullAddrLine,
        addressLine2: landmark,
        area,
        city,
        state,
        country: 'India',
        postalCode,
        latitude: lat,
        longitude: lng,
        isDefault: addresses.length === 0,
      });
      if (isServiceable) {
        showToast('Address saved & selected for express delivery!', 'success');
      } else {
        showToast('Address saved to your profile! Note: Delivery is currently coming soon to this area.', 'info');
      }
    }
    onClose();
  };

  const handleSelectSaved = (addr: Address) => {
    setDefaultAddress(addr.id);
    setActiveAddressId(addr.id);
    showToast(`Delivering to ${addr.addressType}`, 'success');
    onClose();
  };

  // Submit Notify Me Request to Firebase API
  const handleSendNotifyRequest = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setNotifySubmitting(true);

    try {
      const res = await fetch('/api/service-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id || 'guest',
          name: receiverName || 'Valued Customer',
          phone: phone || '+91 8698893348',
          address: `${houseNumber ? houseNumber + ', ' : ''}${area}, ${city} - ${postalCode}`,
          latitude: lat,
          longitude: lng,
          pincode: postalCode,
          shopId: zoneInfo?.storeId || 'store-1',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setNotifySubmitted(true);
        showToast('Notification request submitted! We will alert you when delivery expands here.', 'success');
      } else {
        showToast(data.error || 'Failed to submit request', 'error');
      }
    } catch (err) {
      showToast('Request recorded!', 'success');
      setNotifySubmitted(true);
    } finally {
      setNotifySubmitting(false);
    }
  };

  const isServiceable = zoneInfo?.isServiceable !== false;

  if (!isOpen || !mounted) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm font-sans">
      {/* Wide split modal */}
      <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-5xl h-[88vh] max-h-[720px] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 relative">

        {/* ── HEADER ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center">
              <MapPin className="w-5 h-5 fill-amber-400 text-emerald-900 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white leading-tight">Select Delivery Location</h2>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Neral Express Delivery • Maule Kirana Hub (3 KM Radius)</p>
            </div>
          </div>

          {/* Tabs + Close */}
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1">
              <button
                type="button"
                onClick={() => setPanel('saved')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
                  panel === 'saved' ? 'bg-white dark:bg-slate-700 text-emerald-900 dark:text-emerald-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                Saved ({addresses.length})
              </button>
              <button
                type="button"
                onClick={handleAddNewClick}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1 ${
                  panel === 'new' ? 'bg-white dark:bg-slate-700 text-emerald-900 dark:text-emerald-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <Plus className="w-3 h-3" /> Add New
              </button>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── SPLIT BODY ── */}
        <div className="flex flex-1 overflow-hidden flex-col md:flex-row">

          {/* ══ LEFT: MAP PANEL (sticky) ══ */}
          <div className="w-full md:w-[55%] shrink-0 flex flex-col bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 overflow-hidden">

            {/* Search bar */}
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 relative">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Neral area, landmark or street..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 rounded-xl py-2.5 pl-9 pr-8 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 transition-all"
                />
                {isSearching && <Loader2 className="w-3.5 h-3.5 text-emerald-600 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />}
                {searchQuery && !isSearching && (
                  <button onClick={() => { setSearchQuery(''); setShowSearchResults(false); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Autocomplete dropdown */}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute left-3 right-3 top-full mt-1 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 max-h-48 overflow-y-auto z-40 divide-y divide-slate-100 dark:divide-slate-800">
                  {searchResults.map((r, i) => (
                    <button
                      key={`${r.placeId}-${i}`}
                      type="button"
                      onClick={() => handleSelectSearchResult(r)}
                      className="w-full text-left p-3 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors flex items-start gap-2.5"
                    >
                      <MapPin className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">{r.addressLine}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">{r.displayName}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Map canvas (fills remaining height) */}
            <div className="flex-1 relative overflow-hidden min-h-[300px] h-full">
              <InteractiveMapCanvas
                lat={lat}
                lng={lng}
                onPositionChange={handlePositionChange}
                isServiceable={isServiceable}
                etaText={zoneInfo ? `${zoneInfo.estimatedDeliveryMinutes}-${zoneInfo.estimatedDeliveryMinutes + 5} mins` : '15-20 mins'}
                radiusKm={zoneInfo?.radiusKm || 3.0}
                storeLat={zoneInfo?.storeLatitude ?? 19.0224536}
                storeLng={zoneInfo?.storeLongitude ?? 73.3210018}
                storeName="Maule Kirana (Neral Store)"
                showStoreCircle={true}
                isAdminView={false}
                hintText="Move map pin to check 3 KM delivery serviceability from Maule Kirana"
              />
            </div>

            {/* Use current location + serviceability bar */}
            <div className="shrink-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-800 transition-colors"
              >
                <Navigation2 className="w-3.5 h-3.5" />
                Detect My Current GPS Location
              </button>

              {zoneInfo && (
                <div className={`px-4 py-2.5 flex items-center justify-between border-t ${
                  isServiceable ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-800/40' : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/40'
                }`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${isServiceable ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                    <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate max-w-[220px]">
                      Maule Kirana • {zoneInfo.distanceKm} KM away
                    </p>
                  </div>
                  <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                    isServiceable ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                  }`}>
                    {isServiceable ? `✓ SERVICE AVAILABLE (≤ ${zoneInfo.radiusKm} KM)` : `OUT OF RANGE (> ${zoneInfo.radiusKm} KM)`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ══ RIGHT: DETAILS PANEL (scrollable) ══ */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-slate-900">

            {panel === 'saved' ? (
              /* SAVED ADDRESSES */
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">Your Saved Locations</h3>

                {addresses.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <MapPin className="w-7 h-7 text-slate-300 dark:text-slate-600" />
                    </div>
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400">No saved addresses</p>
                    <button
                      type="button"
                      onClick={handleAddNewClick}
                      className="flex items-center gap-1.5 bg-[#006E2F] text-white font-black text-xs px-4 py-2.5 rounded-xl hover:bg-emerald-800 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" /> Pin on Map
                    </button>
                  </div>
                ) : (
                  addresses.map((addr) => {
                    const isSelected = addr.id === activeAddressId;
                    const addrZone = checkZoneServiceability(addr.latitude, addr.longitude);
                    const addrServiceable = addrZone.isServiceable;

                    return (
                      <div
                        key={addr.id}
                        onClick={() => addrServiceable && handleSelectSaved(addr)}
                        className={`p-4 rounded-2xl border transition-all ${
                          !addrServiceable
                            ? 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40 opacity-80'
                            : isSelected
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-600 ring-2 ring-emerald-400/25 shadow-sm'
                            : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-emerald-300 hover:shadow-sm cursor-pointer'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              !addrServiceable
                                ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'
                                : isSelected
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                            }`}>
                              {addr.addressType === 'Home' ? <Home className="w-4 h-4" /> :
                               addr.addressType === 'Work' || addr.addressType === 'Office' ? <Briefcase className="w-4 h-4" /> :
                               <MapPin className="w-4 h-4" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-sm font-black text-slate-900 dark:text-white">{addr.addressType}</span>
                                {isSelected && <span className="bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">ACTIVE</span>}
                                {addr.isDefault && !isSelected && <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[9px] font-black px-1.5 py-0.5 rounded-full">DEFAULT</span>}
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug">{addr.fullName} • {addr.phone}</p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                                {addr.houseNumber ? `${addr.houseNumber}, ` : ''}{addr.addressLine1}
                              </p>
                              <p className="text-[11px] text-slate-400 dark:text-slate-500">{addr.city} {addr.postalCode}</p>
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-1" />}
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                          {addrServiceable ? (
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                              <Zap className="w-3 h-3" />
                              <span>✓ Within 3 KM Neral Delivery Zone</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-red-600 dark:text-red-400">
                              <AlertCircle className="w-3 h-3" />
                              <span>Outside 3 KM delivery zone ({addrZone.distanceKm} KM)</span>
                            </div>
                          )}

                          {addrServiceable ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleSelectSaved(addr); }}
                              className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-[11px] px-3 py-1.5 rounded-lg transition-all active:scale-95"
                            >
                              Deliver here
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLat(addr.latitude);
                                setLng(addr.longitude);
                                setPanel('new');
                              }}
                              className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-[11px] px-3 py-1.5 rounded-lg transition-all"
                            >
                              Change Pin
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

                <button
                  type="button"
                  onClick={handleAddNewClick}
                  className="w-full flex items-center justify-center gap-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs py-3 rounded-xl transition-colors mt-2"
                >
                  <Plus className="w-4 h-4 text-emerald-600" />
                  Pin a new location in Neral
                </button>
              </div>

            ) : (
              /* NEW LOCATION FORM OR DEDICATED OUT-OF-RANGE SCREEN */
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                
                {/* ── OUT-OF-RANGE DEDICATED BLOCK (Section 5) ── */}
                {!isServiceable && (
                  <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border-2 border-red-300 dark:border-red-800 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/60 flex items-center justify-center shrink-0">
                        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-red-900 dark:text-red-200">
                          You&apos;re outside our delivery area
                        </h4>
                        <p className="text-xs font-semibold text-red-700 dark:text-red-300 mt-0.5 leading-relaxed">
                          PocketKirana currently delivers within 3 KM of our Neral store (Maule Kirana).
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-white dark:bg-slate-900 p-3 rounded-xl border border-red-200 dark:border-red-900/40 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Your Distance</span>
                        <span className="font-mono font-black text-red-600 dark:text-red-400 text-sm">
                          {zoneInfo?.distanceKm} KM
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Max Delivery Radius</span>
                        <span className="font-mono font-black text-slate-800 dark:text-slate-200 text-sm">
                          3.0 KM
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setShowSearchResults(false);
                          // center back to Maule Kirana
                          setLat(19.0224536);
                          setLng(73.3210018);
                        }}
                        className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl transition-all text-center shadow-xs"
                      >
                        Change Location
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('Neral Station');
                          searchLocationsAutocomplete('Neral Station').then((res) => {
                            if (res[0]) {
                              setLat(res[0].latitude);
                              setLng(res[0].longitude);
                            }
                          });
                        }}
                        className="flex-1 py-2 px-3 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-all text-center"
                      >
                        Try Another Location
                      </button>
                    </div>
                  </div>
                )}

                {/* Geocoded preview & Service Available Indicator */}
                {loadingGeocode ? (
                  <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Detecting address from map coordinates...</span>
                  </div>
                ) : geocoded && isServiceable && (
                  <div className="p-3.5 rounded-2xl border bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800">
                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-400" />
                      <div className="flex-1">
                        <p className="text-xs font-black text-slate-900 dark:text-white leading-snug">{geocoded.displayName}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                            ✓ PocketKirana delivers to your location ({zoneInfo?.distanceKm} KM from Maule Kirana)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSave} className="space-y-4">
                  {/* Address label */}
                  <div>
                    <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">Save as</label>
                    <div className="flex gap-2">
                      {(['Home', 'Work', 'Other'] as const).map((lbl) => (
                        <button
                          key={lbl}
                          type="button"
                          onClick={() => setAddressLabel(lbl)}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                            addressLabel === lbl
                              ? 'bg-[#006E2F] text-white border-emerald-800 shadow-sm'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                          }`}
                        >
                          {lbl === 'Home' ? <Home className="w-3 h-3" /> : lbl === 'Work' ? <Briefcase className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Form fields grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Receiver Name */}
                    <div className="col-span-2 space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1"><User className="w-3 h-3" /> Receiver Name *</label>
                      <input type="text" required value={receiverName} onChange={(e) => setReceiverName(e.target.value)} placeholder="e.g. Rahul Sharma"
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all" />
                    </div>

                    {/* Phone */}
                    <div className="col-span-2 space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1"><Phone className="w-3 h-3" /> Mobile Number</label>
                      <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +91 98765 43210"
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all" />
                    </div>

                    {/* Flat/House No */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1"><Hash className="w-3 h-3" /> Flat / House No. *</label>
                      <input type="text" required value={houseNumber} onChange={(e) => setHouseNumber(e.target.value)} placeholder="e.g. Flat 302, B Wing"
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all" />
                    </div>

                    {/* Building */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1"><Building2 className="w-3 h-3" /> Building / Apt</label>
                      <input type="text" value={buildingName} onChange={(e) => setBuildingName(e.target.value)} placeholder="e.g. Sai Residency (Optional)"
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all" />
                    </div>

                    {/* Area */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1"><MapPin className="w-3 h-3" /> Area / Street *</label>
                      <input type="text" required value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Station Road"
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all" />
                    </div>

                    {/* Landmark */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1"><Landmark className="w-3 h-3" /> Landmark</label>
                      <input type="text" value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="e.g. Near HDFC Bank (Optional)"
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all" />
                    </div>

                    {/* City */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">City *</label>
                      <input type="text" required value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Neral"
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all" />
                    </div>

                    {/* Pincode */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Pincode *</label>
                      <input type="text" required value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="e.g. 410101"
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all" />
                    </div>
                  </div>

                  {/* Primary CTA */}
                  <div className="pt-2 pb-1">
                    <button
                      type="submit"
                      disabled={!isServiceable}
                      className={`w-full font-black text-sm py-3.5 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 ${
                        isServiceable
                          ? 'bg-[#006E2F] hover:bg-emerald-800 text-white cursor-pointer active:scale-95'
                          : 'bg-slate-300 dark:bg-slate-800 text-slate-500 dark:text-slate-500 cursor-not-allowed opacity-60'
                      }`}
                    >
                      <span>{isServiceable ? 'Save & Deliver to this Location' : 'Location Outside 3 KM Delivery Range'}</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    {!isServiceable && (
                      <p className="text-[11px] text-center text-red-600 dark:text-red-400 font-bold mt-2">
                        Orders cannot be delivered to locations outside the 3 KM Neral delivery zone.
                      </p>
                    )}
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

