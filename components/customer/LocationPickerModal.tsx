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
      <div className="bg-white w-full max-w-5xl h-[88vh] max-h-[720px] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 relative">

        {/* ── HEADER ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <MapPin className="w-5 h-5 fill-amber-400 text-emerald-900" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 leading-tight">Select Delivery Location</h2>
              <p className="text-[11px] font-semibold text-slate-500">Pin your exact spot on Google Maps</p>
            </div>
          </div>

          {/* Tabs + Close */}
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-1">
              <button
                type="button"
                onClick={() => setPanel('saved')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
                  panel === 'saved' ? 'bg-white text-emerald-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Saved ({addresses.length})
              </button>
              <button
                type="button"
                onClick={handleAddNewClick}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1 ${
                  panel === 'new' ? 'bg-white text-emerald-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Plus className="w-3 h-3" /> Add New
              </button>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── SPLIT BODY ── */}
        <div className="flex flex-1 overflow-hidden">

          {/* ══ LEFT: MAP PANEL (sticky) ══ */}
          <div className="w-[55%] shrink-0 flex flex-col bg-slate-50 border-r border-slate-200 overflow-hidden">

            {/* Search bar */}
            <div className="p-3 border-b border-slate-200 bg-white relative">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search area, street or landmark..."
                  className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl py-2.5 pl-9 pr-8 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 transition-all"
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
                <div className="absolute left-3 right-3 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200 max-h-48 overflow-y-auto z-40 divide-y divide-slate-100">
                  {searchResults.map((r, i) => (
                    <button
                      key={`${r.placeId}-${i}`}
                      type="button"
                      onClick={() => handleSelectSearchResult(r)}
                      className="w-full text-left p-3 hover:bg-emerald-50 transition-colors flex items-start gap-2.5"
                    >
                      <MapPin className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-slate-900">{r.addressLine}</p>
                        <p className="text-[11px] text-slate-500 line-clamp-1">{r.displayName}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Map canvas (fills remaining height) */}
            <div className="flex-1 relative overflow-hidden min-h-[360px] h-full">
              <InteractiveMapCanvas
                lat={lat}
                lng={lng}
                onPositionChange={handlePositionChange}
                isServiceable={isServiceable}
                etaText={zoneInfo ? `${zoneInfo.estimatedDeliveryMinutes}-${zoneInfo.estimatedDeliveryMinutes + 5} mins` : '15-20 mins'}
                radiusKm={zoneInfo?.radiusKm || 3.0}
                storeLat={zoneInfo?.storeLatitude ?? 19.033}
                storeLng={zoneInfo?.storeLongitude ?? 73.317}
                storeName={zoneInfo?.storeName || 'PocketKirana Store'}
                showStoreCircle={true}
                isAdminView={false}
                hintText="Move map to place pin at your exact delivery address"
              />
            </div>

            {/* Use current location + serviceability bar */}
            <div className="shrink-0 bg-white border-t border-slate-200">
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 transition-colors"
              >
                <Navigation2 className="w-3.5 h-3.5" />
                Use my current location
              </button>

              {zoneInfo && (
                <div className={`px-4 py-2.5 flex items-center justify-between border-t ${
                  isServiceable ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50/70 border-amber-200'
                }`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${isServiceable ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                    <p className="text-[11px] font-bold text-slate-800 truncate max-w-[220px]">
                      {zoneInfo.storeName} • {zoneInfo.roadDistanceKm || zoneInfo.distanceKm} KM
                    </p>
                  </div>
                  <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                    isServiceable ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-slate-950 font-extrabold'
                  }`}>
                    {isServiceable ? `${zoneInfo.estimatedDeliveryMinutes} MIN EXPRESS` : 'SERVICE COMING SOON'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ══ RIGHT: DETAILS PANEL (scrollable) ══ */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {panel === 'saved' ? (
              /* SAVED ADDRESSES */
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">Your Saved Locations</h3>

                {addresses.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                      <MapPin className="w-7 h-7 text-slate-300" />
                    </div>
                    <p className="text-sm font-bold text-slate-500">No saved addresses</p>
                    <button
                      type="button"
                      onClick={handleAddNewClick}
                      className="flex items-center gap-1.5 bg-emerald-700 text-white font-black text-xs px-4 py-2.5 rounded-xl hover:bg-emerald-800 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" /> Pin on Google Map
                    </button>
                  </div>
                ) : (
                  addresses.map((addr) => {
                    const isSelected = addr.id === activeAddressId;
                    return (
                      <div
                        key={addr.id}
                        onClick={() => handleSelectSaved(addr)}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-400/25 shadow-sm'
                            : 'bg-white border-slate-200 hover:border-emerald-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {addr.addressType === 'Home' ? <Home className="w-4 h-4" /> :
                               addr.addressType === 'Work' || addr.addressType === 'Office' ? <Briefcase className="w-4 h-4" /> :
                               <MapPin className="w-4 h-4" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-sm font-black text-slate-900">{addr.addressType}</span>
                                {isSelected && <span className="bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">ACTIVE</span>}
                                {addr.isDefault && !isSelected && <span className="bg-slate-200 text-slate-600 text-[9px] font-black px-1.5 py-0.5 rounded-full">DEFAULT</span>}
                              </div>
                              <p className="text-xs text-slate-600 leading-snug">{addr.fullName} • {addr.phone}</p>
                              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                                {addr.houseNumber ? `${addr.houseNumber}, ` : ''}{addr.addressLine1}
                              </p>
                              <p className="text-[11px] text-slate-400">{addr.city} {addr.postalCode}</p>
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-1" />}
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
                            <Zap className="w-3 h-3" />
                            <span>15-20 mins express delivery</span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleSelectSaved(addr); }}
                            className="bg-amber-400 hover:bg-amber-500 text-emerald-950 font-black text-[11px] px-3 py-1.5 rounded-lg transition-all active:scale-95"
                          >
                            Deliver here
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}

                <button
                  type="button"
                  onClick={handleAddNewClick}
                  className="w-full flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs py-3 rounded-xl transition-colors mt-2"
                >
                  <Plus className="w-4 h-4 text-emerald-600" />
                  Pin a new location on Google Maps
                </button>
              </div>

            ) : (
              /* NEW LOCATION FORM */
              <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 space-y-4">

                {/* Geocoded preview & Serviceability Indicator */}
                {loadingGeocode ? (
                  <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                    <span className="text-xs font-semibold text-slate-500">Detecting address from Google Maps pin...</span>
                  </div>
                ) : geocoded && (
                  <div className={`p-3.5 rounded-2xl border ${
                    isServiceable ? 'bg-emerald-50/80 border-emerald-200' : 'bg-amber-50 border-amber-200'
                  }`}>
                    <div className="flex items-start gap-2.5">
                      <MapPin className={`w-4 h-4 mt-0.5 shrink-0 ${isServiceable ? 'text-emerald-700' : 'text-amber-600'}`} />
                      <div className="flex-1">
                        <p className="text-xs font-black text-slate-900 leading-snug">{geocoded.displayName}</p>
                        
                        {isServiceable ? (
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-[11px] font-bold text-emerald-800">
                              🟢 Delivery Available · {zoneInfo?.estimatedDeliveryMinutes || 15} Min Express Drop
                            </span>
                          </div>
                        ) : (
                          <div className="mt-2 space-y-2">
                            <div className="p-2.5 bg-white/80 rounded-xl border border-amber-200/80">
                              <div className="flex items-center gap-1.5 text-amber-800 font-extrabold text-xs">
                                <span>📍 We&apos;re Coming Soon!</span>
                              </div>
                              <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                                PocketKirana is not delivering to your location yet ({zoneInfo?.distanceKm} KM away vs {zoneInfo?.radiusKm} KM radius). We&apos;re expanding fast!
                              </p>
                            </div>

                            {/* Notify Me Button */}
                            {!notifySubmitted ? (
                              <button
                                type="button"
                                onClick={() => handleSendNotifyRequest()}
                                disabled={notifySubmitting}
                                className="w-full bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs py-2 px-3 rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 active:scale-95"
                              >
                                {notifySubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BellRing className="w-3.5 h-3.5" />}
                                <span>Notify Me When Available in My Area</span>
                              </button>
                            ) : (
                              <div className="bg-emerald-100 text-emerald-800 text-[11px] font-bold py-1.5 px-3 rounded-xl flex items-center gap-1.5">
                                <Check className="w-3.5 h-3.5" />
                                <span>Thanks! We&apos;ll notify you when we launch here.</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Address label */}
                <div>
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block mb-2">Save as</label>
                  <div className="flex gap-2">
                    {(['Home', 'Work', 'Other'] as const).map((lbl) => (
                      <button
                        key={lbl}
                        type="button"
                        onClick={() => setAddressLabel(lbl)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                          addressLabel === lbl
                            ? 'bg-emerald-700 text-white border-emerald-800 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
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
                    <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1"><User className="w-3 h-3" /> Receiver Name *</label>
                    <input type="text" required value={receiverName} onChange={(e) => setReceiverName(e.target.value)} placeholder="e.g. Rahul Sharma"
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all" />
                  </div>

                  {/* Phone */}
                  <div className="col-span-2 space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3" /> Mobile Number</label>
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +91 98765 43210"
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all" />
                  </div>

                  {/* Flat/House No */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1"><Hash className="w-3 h-3" /> Flat / House No. *</label>
                    <input type="text" required value={houseNumber} onChange={(e) => setHouseNumber(e.target.value)} placeholder="e.g. Flat 302, B Wing"
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all" />
                  </div>

                  {/* Building */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1"><Building2 className="w-3 h-3" /> Building / Apt</label>
                    <input type="text" value={buildingName} onChange={(e) => setBuildingName(e.target.value)} placeholder="e.g. Sai Residency (Optional)"
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all" />
                  </div>

                  {/* Area */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> Area / Street *</label>
                    <input type="text" required value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Station Road"
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all" />
                  </div>

                  {/* Landmark */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1"><Landmark className="w-3 h-3" /> Landmark</label>
                    <input type="text" value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="e.g. Near HDFC Bank (Optional)"
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all" />
                  </div>

                  {/* City */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500">City *</label>
                    <input type="text" required value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Neral / Karjat"
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all" />
                  </div>

                  {/* Pincode */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500">Pincode *</label>
                    <input type="text" required value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="e.g. 410101"
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all" />
                  </div>
                </div>

                {/* Primary CTA (Never blocks user from saving address & continuing browsing) */}
                <div className="pt-2 pb-1">
                  <button
                    type="submit"
                    className="w-full bg-[#006E2F] hover:bg-emerald-800 text-white font-black text-sm py-3.5 rounded-2xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>{isServiceable ? 'Save & Deliver to this Location' : 'Save Address & Browse Products'}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  {!isServiceable && (
                    <p className="text-[10px] text-center text-slate-500 mt-1.5">
                      You can explore products and save items to your wishlist. Delivery checkout will unlock when your area becomes serviceable.
                    </p>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
