'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  MapPin,
  Save,
  Sliders,
  Store as StoreIcon,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  DollarSign,
  ArrowLeft,
  Navigation,
  ShieldCheck,
  History,
  Info
} from 'lucide-react';
import { INITIAL_STORES } from '@/lib/mockData';
import { Store } from '@/types';
import { searchLocationsAutocomplete, GeocodedLocation, updateStoreConfig } from '@/lib/locationServices';
import { showToast } from '@/components/ui/Toast';

const InteractiveMapCanvas = dynamic(
  () => import('@/components/common/InteractiveMapCanvas').then((m) => m.InteractiveMapCanvas),
  { ssr: false, loading: () => <div className="w-full h-[340px] bg-slate-100 rounded-xl animate-pulse" /> }
);

interface AuditEntry {
  id: string;
  timestamp: string;
  storeName: string;
  action: string;
  oldValue: string;
  newValue: string;
  reason: string;
}

export default function AdminStoresPage() {
  const [stores, setStores] = useState<Store[]>([...INITIAL_STORES]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>(INITIAL_STORES[0].id);

  const activeStore = stores.find((s) => s.id === selectedStoreId) || stores[0];

  // Store Settings Form State
  const [storeName, setStoreName] = useState(activeStore.name);
  const [address, setAddress] = useState(activeStore.address);
  const [lat, setLat] = useState<number>(activeStore.latitude);
  const [lng, setLng] = useState<number>(activeStore.longitude);
  const [radiusKm, setRadiusKm] = useState<number>(activeStore.deliveryRadiusKm || 3.0);
  const [minOrder, setMinOrder] = useState<number>(activeStore.minimumOrderValue || 199);
  const [deliveryFee, setDeliveryFee] = useState<number>(activeStore.deliveryFee || 15);
  const [expressEnabled, setExpressEnabled] = useState<boolean>(activeStore.expressDeliveryEnabled ?? true);
  const [status, setStatus] = useState<'active' | 'inactive' | 'maintenance'>(activeStore.status);
  const [openingTime, setOpeningTime] = useState<string>(activeStore.openingTime || '06:00');
  const [closingTime, setClosingTime] = useState<string>(activeStore.closingTime || '23:00');
  const [deliveryStatus, setDeliveryStatus] = useState<'ACTIVE' | 'INACTIVE' | 'HIGH_DEMAND'>(activeStore.deliveryStatus || 'ACTIVE');
  const [roadMultiplier, setRoadMultiplier] = useState<number>(activeStore.roadDistanceMultiplier || 1.35);

  // Search Location Autocomplete State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodedLocation[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Audit Log State
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([
    {
      id: 'log-1',
      timestamp: 'Today, 09:15 AM',
      storeName: 'PocketKirana Store - Neral Hub',
      action: 'Delivery Radius Change',
      oldValue: '2.5 KM',
      newValue: '3.0 KM',
      reason: 'Expanded delivery coverage to Matoshree Nagar East',
    },
  ]);

  // Sync state when selected store changes
  const handleSelectStore = (id: string) => {
    const st = stores.find((s) => s.id === id);
    if (!st) return;
    setSelectedStoreId(id);
    setStoreName(st.name);
    setAddress(st.address);
    setLat(st.latitude);
    setLng(st.longitude);
    setRadiusKm(st.deliveryRadiusKm || 3.0);
    setMinOrder(st.minimumOrderValue || 199);
    setDeliveryFee(st.deliveryFee || 15);
    setExpressEnabled(st.expressDeliveryEnabled ?? true);
    setStatus(st.status);
    setOpeningTime(st.openingTime || '06:00');
    setClosingTime(st.closingTime || '23:00');
    setDeliveryStatus(st.deliveryStatus || 'ACTIVE');
    setRoadMultiplier(st.roadDistanceMultiplier || 1.35);
  };

  const handleSearchLocation = async (q: string) => {
    setSearchQuery(q);
    if (!q.trim() || q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const results = await searchLocationsAutocomplete(q);
    setSearchResults(results);
    setIsSearching(false);
  };

  const handleSelectSearchResult = (loc: GeocodedLocation) => {
    setLat(loc.latitude);
    setLng(loc.longitude);
    setAddress(loc.displayName);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSaveStoreSettings = (e: React.FormEvent) => {
    e.preventDefault();

    const oldRadius = activeStore.deliveryRadiusKm;

    const updated = updateStoreConfig(selectedStoreId, {
      name: storeName,
      address,
      latitude: lat,
      longitude: lng,
      deliveryRadiusKm: radiusKm,
      minimumOrderValue: minOrder,
      deliveryFee,
      expressDeliveryEnabled: expressEnabled,
      status,
      openingTime,
      closingTime,
      deliveryStatus,
      roadDistanceMultiplier: roadMultiplier,
      maxRoadDistanceKm: Number((radiusKm * roadMultiplier).toFixed(1)),
    });

    if (updated) {
      setStores((prev) => prev.map((s) => (s.id === selectedStoreId ? updated : s)));

      if (oldRadius !== radiusKm) {
        setAuditLogs((prev) => [
          {
            id: `log-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            storeName: updated.name,
            action: 'Delivery Radius Change',
            oldValue: `${oldRadius} KM`,
            newValue: `${radiusKm} KM`,
            reason: 'Admin updated delivery radius boundary',
          },
          ...prev,
        ]);
      }

      showToast(`Store settings & ${radiusKm} KM delivery boundary saved!`, 'success');
    }
  };

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-100 font-sans text-slate-900 pb-16">
        <header className="bg-slate-900 text-white sticky top-0 z-40 border-b border-slate-800 shadow-md h-16" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          <div className="h-12 bg-white rounded-2xl animate-pulse" />
          <div className="h-96 bg-white rounded-3xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div suppressHydrationWarning className="min-h-screen bg-slate-100 font-sans text-slate-900 pb-16">
      {/* ADMIN TOP HEADER NAV */}
      <header className="bg-slate-900 text-white sticky top-0 z-40 border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <StoreIcon className="w-5 h-5 text-amber-400" />
                <h1 className="text-lg font-black tracking-tight">Store &amp; Delivery Area Controls</h1>
              </div>
              <p className="text-xs text-slate-400 font-semibold">
                Define store center coordinates and max serviceability radius
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="bg-emerald-950 text-emerald-300 border border-emerald-700/60 font-black text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Admin Authoritative</span>
            </span>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        
        {/* STORE SELECTION BAR */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <StoreIcon className="w-5 h-5" />
            </div>
            <div>
              <label className="text-[11px] font-black uppercase text-slate-400 block">Select Store / Dark Store</label>
              <select
                value={selectedStoreId}
                onChange={(e) => handleSelectStore(e.target.value)}
                className="bg-slate-50 border border-slate-300 font-extrabold text-sm text-slate-900 rounded-xl px-3 py-1.5 focus:outline-none focus:border-emerald-600"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.deliveryRadiusKm} KM Radius)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
            <div className="bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <Navigation className="w-4 h-4 text-amber-600" />
              <span>Center: {lat.toFixed(4)}, {lng.toFixed(4)}</span>
            </div>

            <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Max Radius: {radiusKm} KM</span>
            </div>
          </div>
        </div>

        {/* TWO COLUMN LAYOUT: Form Settings Left vs Interactive Map Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT COLUMN: STORE DETAILS & RADIUS SLIDER FORM */}
          <div className="lg:col-span-6 space-y-6">
            <form onSubmit={handleSaveStoreSettings} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-emerald-600" />
                  <span>Store Delivery Settings</span>
                </h2>

                <button
                  type="submit"
                  className="bg-amber-400 hover:bg-amber-500 text-emerald-950 font-black text-xs px-4 py-2 rounded-xl shadow-xs transition-transform active:scale-95 flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Configuration</span>
                </button>
              </div>

              {/* 1. DYNAMIC DELIVERY RADIUS SLIDER (Matching Master Prompt Spec) */}
              <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-black text-emerald-950 uppercase tracking-wider block">
                      Maximum Delivery Radius
                    </label>
                    <p className="text-[11px] font-semibold text-emerald-800">
                      Customers within this radius can place orders
                    </p>
                  </div>

                  <div className="bg-emerald-700 text-amber-300 font-black text-sm px-3.5 py-1 rounded-xl shadow-xs border border-emerald-800 flex items-center gap-1">
                    <span>{radiusKm}</span>
                    <span className="text-xs text-white">KM</span>
                  </div>
                </div>

                {/* SLIDER CONTROL: 0.5 KM to 25.0 KM */}
                <div className="space-y-1.5 pt-1">
                  <input
                    type="range"
                    min="0.5"
                    max="25.0"
                    step="0.5"
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(parseFloat(e.target.value))}
                    className="w-full h-2.5 bg-emerald-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />

                  <div className="flex justify-between text-[10px] font-bold text-emerald-800">
                    <span>0.5 KM (Min)</span>
                    <span>3.0 KM (Default)</span>
                    <span>10.0 KM</span>
                    <span>25.0 KM (Max)</span>
                  </div>
                </div>

                {/* Direct Numeric Input */}
                <div className="flex items-center gap-2 pt-2 border-t border-emerald-200/50">
                  <span className="text-xs font-bold text-slate-700">Numeric Override:</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="25.0"
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(parseFloat(e.target.value) || 0.5)}
                    className="w-24 bg-white border border-emerald-300 rounded-xl px-2.5 py-1 text-xs font-extrabold text-slate-900 focus:outline-none"
                  />
                  <span className="text-xs font-bold text-slate-500">KM</span>
                </div>
              </div>

              {/* 2. STORE LOCATION FIELDS */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Store Coordinates & Address
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Search Store Location</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => handleSearchLocation(e.target.value)}
                        placeholder="Search area, landmark or street (e.g. Neral Station)..."
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 pl-10 pr-4 text-xs font-semibold focus:outline-none focus:border-emerald-600"
                      />
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    </div>

                    {searchResults.length > 0 && (
                      <div className="mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100 z-30">
                        {searchResults.map((r, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handleSelectSearchResult(r)}
                            className="w-full text-left p-2.5 hover:bg-emerald-50 text-xs font-bold text-slate-800"
                          >
                            {r.displayName}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Store Name</label>
                    <input
                      type="text"
                      required
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Store Full Address</label>
                    <textarea
                      rows={2}
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-900"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Latitude</label>
                      <input
                        type="number"
                        step="0.000001"
                        required
                        value={lat}
                        onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Longitude</label>
                      <input
                        type="number"
                        step="0.000001"
                        required
                        value={lng}
                        onChange={(e) => setLng(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. LOGISTICS & OPERATIONAL RULES (Blinkit-Style 3-Layer Hyperlocal Engine) */}
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Logistics &amp; 3-Layer Operational Rules
                  </h3>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-300">
                    3-LAYER ENGINE
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Minimum Order (₹)</label>
                    <input
                      type="number"
                      value={minOrder}
                      onChange={(e) => setMinOrder(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Delivery Fee (₹)</label>
                    <input
                      type="number"
                      value={deliveryFee}
                      onChange={(e) => setDeliveryFee(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Store Opening Time</label>
                    <input
                      type="time"
                      value={openingTime}
                      onChange={(e) => setOpeningTime(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Store Closing Time</label>
                    <input
                      type="time"
                      value={closingTime}
                      onChange={(e) => setClosingTime(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Road Detour Multiplier</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.05"
                        min="1.0"
                        max="2.5"
                        value={roadMultiplier}
                        onChange={(e) => setRoadMultiplier(parseFloat(e.target.value) || 1.35)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold pr-12"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-extrabold text-slate-400">
                        x straight
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Delivery Dispatch Status</label>
                    <select
                      value={deliveryStatus}
                      onChange={(e) => setDeliveryStatus(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold"
                    >
                      <option value="ACTIVE">ACTIVE (Normal Dispatch)</option>
                      <option value="HIGH_DEMAND">HIGH DEMAND (Surge Protection)</option>
                      <option value="INACTIVE">INACTIVE (Deliveries Paused)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Store Operational Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold"
                    >
                      <option value="active">Active (Store Open)</option>
                      <option value="inactive">Inactive (Closed)</option>
                      <option value="maintenance">Maintenance Mode</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200 mt-5">
                    <span className="text-xs font-bold text-slate-800">Express 10-Min Delivery</span>
                    <button
                      type="button"
                      onClick={() => setExpressEnabled(!expressEnabled)}
                      className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                        expressEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                          expressEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* 3-LAYER VERIFICATION BADGE SUMMARY */}
                <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-2 border border-slate-800 text-xs">
                  <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider block">
                    ⚡ 3-Layer Serviceability Summary
                  </span>
                  <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                    <div className="bg-slate-800 p-2 rounded-xl border border-slate-700">
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Layer 1 (Radius)</span>
                      <span className="font-extrabold text-emerald-400">{radiusKm} KM Circle</span>
                    </div>
                    <div className="bg-slate-800 p-2 rounded-xl border border-slate-700">
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Layer 2 (Road Limit)</span>
                      <span className="font-extrabold text-amber-300">~{(radiusKm * roadMultiplier).toFixed(1)} KM Road</span>
                    </div>
                    <div className="bg-slate-800 p-2 rounded-xl border border-slate-700">
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Layer 3 (Status)</span>
                      <span className="font-extrabold text-white">{openingTime}-{closingTime}</span>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-amber-400 hover:bg-amber-500 text-emerald-950 font-black text-sm py-3.5 rounded-2xl shadow-md transition-transform active:scale-95 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>Save Store Delivery Area</span>
              </button>
            </form>
          </div>

          {/* RIGHT COLUMN: INTERACTIVE MAP & LIVE BOUNDARY PREVIEW */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-emerald-600" />
                    <span>Live Delivery Boundary Preview</span>
                  </h2>
                  <p className="text-xs text-slate-500 font-semibold">
                    Dashed green circle represents the exact {radiusKm} KM delivery boundary
                  </p>
                </div>

                <span className="bg-emerald-100 text-emerald-800 font-black text-[10px] px-2.5 py-1 rounded-full border border-emerald-300">
                  {radiusKm} KM CIRCLE
                </span>
              </div>

              {/* LIVE TILE MAP WITH DYNAMIC CIRCLE OVERLAY */}
              <InteractiveMapCanvas
                lat={lat}
                lng={lng}
                onPositionChange={(nLat, nLng) => {
                  setLat(nLat);
                  setLng(nLng);
                }}
                radiusKm={radiusKm}
                showStoreCircle={true}
                isAdminView={true}
                hintText={`Drag map to reposition ${storeName}`}
              />

              {/* MAP VISUAL LEGEND */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs font-semibold">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-600 border border-white shadow-xs" />
                    <span className="font-bold text-slate-900">📍 Store Center</span>
                  </div>
                  <span className="font-mono text-slate-600">{lat.toFixed(4)}, {lng.toFixed(4)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500/30 border border-emerald-600" />
                    <span className="font-bold text-slate-900">⭕ Delivery Boundary ({radiusKm} KM)</span>
                  </div>
                  <span className="font-extrabold text-emerald-700">
                    ~{(Math.PI * radiusKm * radiusKm).toFixed(1)} sq km coverage
                  </span>
                </div>
              </div>
            </div>

            {/* AUDIT LOG TRAIL */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-600" />
                  <span>Radius Change Audit Trail</span>
                </h3>
              </div>

              <div className="space-y-2.5">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-slate-900">{log.action}</span>
                      <span className="text-slate-500">{log.timestamp}</span>
                    </div>
                    <p className="text-slate-700">
                      Changed from <strong className="text-slate-900">{log.oldValue}</strong> → <strong className="text-emerald-700">{log.newValue}</strong>
                    </p>
                    <p className="text-[11px] text-slate-500 italic">{log.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
