'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';
import { useAppStore } from '@/lib/store';
import { Store, ServiceRequest } from '@/types';
import { INITIAL_STORES } from '@/lib/mockData';
import { showToast } from '@/components/ui/Toast';
import {
  fetchShopsFS,
  saveShopConfigFS,
  fetchServiceRequestsFS,
  updateServiceRequestStatusFS
} from '@/lib/firebaseServices';
import { setStoresState, updateStoreConfig, resolveLocationFromCoords } from '@/lib/locationServices';

const InteractiveMapCanvas = dynamic(
  () => import('@/components/common/InteractiveMapCanvas').then((m) => m.InteractiveMapCanvas),
  { ssr: false, loading: () => <div className="w-full h-[340px] bg-slate-100 rounded-xl animate-pulse" /> }
);
import {
  MapPin,
  Save,
  Navigation,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Store as StoreIcon,
  Users,
  BellRing,
  Check,
  ChevronRight,
  ArrowLeft,
  Loader2,
  Clock,
  DollarSign,
  Lock,
  LockOpen,
  ShieldCheck
} from 'lucide-react';

export default function AdminServiceAreaPage() {
  const { auditLogs, addAuditLog } = useAppStore();

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeStore, setActiveStore] = useState<Store>(INITIAL_STORES[0]);

  // Form State
  const [storeName, setStoreName] = useState(INITIAL_STORES[0].name);
  const [storeAddress, setStoreAddress] = useState(INITIAL_STORES[0].address);
  const [lat, setLat] = useState<number>(INITIAL_STORES[0].latitude);
  const [lng, setLng] = useState<number>(INITIAL_STORES[0].longitude);
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState<number>(INITIAL_STORES[0].deliveryRadiusKm || 3.0);
  const [minOrder, setMinOrder] = useState<number>(INITIAL_STORES[0].minimumOrderValue || 199);
  const [deliveryFee, setDeliveryFee] = useState<number>(INITIAL_STORES[0].deliveryFee || 15);
  const [openingTime, setOpeningTime] = useState<string>(INITIAL_STORES[0].openingTime || '06:00');
  const [closingTime, setClosingTime] = useState<string>(INITIAL_STORES[0].closingTime || '23:00');
  const [serviceStatus, setServiceStatus] = useState<'active' | 'inactive' | 'maintenance'>('active');

  // Lock toggle — ON by default to prevent accidental location changes
  const [isLocationLocked, setIsLocationLocked] = useState(true);

  // Service Requests state
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load from Firestore
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const shops = await fetchShopsFS();
        if (shops && shops.length > 0) {
          const shop = shops[0];
          setActiveStore(shop);
          setStoreName(shop.name);
          setStoreAddress(shop.address);
          setLat(shop.latitude);
          setLng(shop.longitude);
          setDeliveryRadiusKm(shop.deliveryRadiusKm || 3.0);
          setMinOrder(shop.minimumOrderValue || 199);
          setDeliveryFee(shop.deliveryFee || 15);
          setOpeningTime(shop.openingTime || '06:00');
          setClosingTime(shop.closingTime || '23:00');
          setServiceStatus(shop.status);
          setStoresState(shops);
        }

        const reqs = await fetchServiceRequestsFS();
        setServiceRequests(reqs);
      } catch (err) {
        console.warn('Error loading admin service area:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // When lat/lng changes from map — blocked when location is locked
  const handlePositionChange = async (newLat: number, newLng: number) => {
    if (isLocationLocked) return; // guard: locked = no position change
    setLat(newLat);
    setLng(newLng);
    try {
      const geo = await resolveLocationFromCoords(newLat, newLng);
      if (geo && geo.displayName) {
        setStoreAddress(geo.displayName);
      }
    } catch (e) {
      console.warn('Geocoding error:', e);
    }
  };

  const handleSaveServiceArea = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);

    const updatedStore: Store = {
      ...activeStore,
      name: storeName,
      address: storeAddress,
      latitude: lat,
      longitude: lng,
      deliveryRadiusKm: Number(deliveryRadiusKm),
      minimumOrderValue: Number(minOrder),
      deliveryFee: Number(deliveryFee),
      openingTime,
      closingTime,
      status: serviceStatus,
    };

    try {
      updateStoreConfig(updatedStore.id, updatedStore);
      setActiveStore(updatedStore);

      await saveShopConfigFS(updatedStore);

      addAuditLog('UPDATE_SERVICE_AREA', 'Store', updatedStore.id);
      showToast(`Store settings & ${deliveryRadiusKm} KM service area saved!`, 'success');
    } catch (err) {
      showToast('Failed to save service area settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateReqStatus = async (id: string, status: 'waiting' | 'notified' | 'converted') => {
    await updateServiceRequestStatusFS(id, status);
    setServiceRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    showToast(`Request status marked as ${status.toUpperCase()}`, 'success');
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col pb-16">
        <header className="bg-slate-900 border-b border-slate-800 h-16" />
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
          <div className="h-24 bg-slate-900 rounded-2xl border border-slate-800 animate-pulse" />
          <div className="h-96 bg-slate-900 rounded-3xl border border-slate-800 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div suppressHydrationWarning className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col pb-16">
      <RoleSwitcher />

      {/* Admin Top Navigation */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-[37px] z-40">
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
                <StoreIcon className="w-5 h-5 text-emerald-400" />
                <h1 className="text-lg font-black tracking-tight text-white">Store, Location &amp; Service Area</h1>
              </div>
              <p className="text-xs text-slate-400 font-semibold">
                Define shop details, GPS coordinates, and dynamic delivery radius boundary
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Location Lock Toggle */}
            <button
              type="button"
              onClick={() => setIsLocationLocked((v) => !v)}
              className={`flex items-center gap-2 font-black text-xs px-4 py-2.5 rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer border ${
                isLocationLocked
                  ? 'bg-red-600/90 hover:bg-red-500 text-white border-red-500'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-900 border-amber-400 animate-pulse'
              }`}
              title={isLocationLocked ? 'Click to unlock store location (allows map drag)' : 'Click to lock store location'}
            >
              {isLocationLocked ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}
              <span>{isLocationLocked ? 'Location Locked' : 'Location Unlocked'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSaveServiceArea()}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs px-5 py-2.5 rounded-xl shadow-lg transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        
        {/* Quick Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Active Radius</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-emerald-400">{deliveryRadiusKm} KM</span>
              <span className="text-xs text-slate-500">Coverage</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Service Status</span>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-2.5 h-2.5 rounded-full ${serviceStatus === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
              <span className="text-lg font-black text-white capitalize">{serviceStatus}</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Shop Location</span>
            <span className="text-xs font-mono font-bold text-emerald-400 block mt-2 truncate">
              {typeof lat === 'number' ? lat.toFixed(5) : lat}, {typeof lng === 'number' ? lng.toFixed(5) : lng}
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Waitlist Inquiries</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-amber-400">{serviceRequests.length}</span>
              <span className="text-xs text-slate-500">Outside Radius</span>
            </div>
          </div>
        </div>

        {/* Main 2-Column Split: Form + Google Maps Boundary Visualizer */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left: Configuration Form (5 Cols) */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl">
            <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
              <StoreIcon className="w-5 h-5 text-emerald-400" />
              <h3 className="font-black text-sm text-white">Store Location &amp; Service Radius</h3>
            </div>

            <form onSubmit={handleSaveServiceArea} className="space-y-4">
              {/* Store Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">Shop / Store Name *</label>
                <input
                  type="text"
                  required
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="e.g. PocketKirana Main Store"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none"
                />
              </div>

              {/* Shop Address */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">Shop Physical Address *</label>
                <textarea
                  rows={2}
                  required
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                  placeholder="Station Road, Neral, Maharashtra"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl p-3 text-xs text-white placeholder:text-slate-600 focus:outline-none resize-none"
                />
              </div>

              {/* Operating Hours & Order Rules */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-emerald-400" /> Opening Time
                  </label>
                  <input
                    type="time"
                    value={openingTime}
                    onChange={(e) => setOpeningTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-emerald-400" /> Closing Time
                  </label>
                  <input
                    type="time"
                    value={closingTime}
                    onChange={(e) => setClosingTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Min. Order (₹)</label>
                  <input
                    type="number"
                    value={minOrder}
                    onChange={(e) => setMinOrder(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Delivery Fee (₹)</label>
                  <input
                    type="number"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              {/* Coordinates Grid */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block">Latitude *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={lat}
                    onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-mono text-emerald-400 focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block">Longitude *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={lng}
                    onChange={(e) => setLng(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-mono text-emerald-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Delivery Radius Slider & Number Input */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">Delivery / Service Radius (KM) *</label>
                  <span className="text-sm font-black text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-2.5 py-0.5 rounded-lg">
                    {deliveryRadiusKm} KM
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={15}
                  step={0.5}
                  value={deliveryRadiusKm}
                  onChange={(e) => setDeliveryRadiusKm(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-bold text-slate-500">
                  <span>1 KM (Ultra Local)</span>
                  <span>3 KM (Standard)</span>
                  <span>5 KM</span>
                  <span>10 KM</span>
                  <span>15 KM</span>
                </div>
              </div>

              {/* Service Status */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <label className="text-xs font-bold text-slate-300 block">Service Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['active', 'inactive', 'maintenance'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setServiceStatus(st)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all uppercase text-center ${
                        serviceStatus === st
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {st === 'active' ? '🟢 Active' : st === 'inactive' ? '🔴 Disabled' : '🟡 Maint.'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Save CTA Button */}
              <div className="pt-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>Save Location &amp; Update Service Area</span>
                </button>
              </div>
            </form>
          </div>

          {/* Right: Interactive Google Map Service Boundary Canvas (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-xl space-y-3">

              {/* Map header row */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <h3 className="font-black text-xs uppercase tracking-wider text-white">
                    Live Delivery Area Preview ({deliveryRadiusKm} KM Circle)
                  </h3>
                </div>

                {/* Lock / Unlock map button — right of map header */}
                <button
                  type="button"
                  onClick={() => setIsLocationLocked((v) => !v)}
                  className={`flex items-center gap-1.5 font-black text-[11px] px-3 py-1.5 rounded-lg transition-all active:scale-95 cursor-pointer border ${
                    isLocationLocked
                      ? 'bg-red-700/80 hover:bg-red-600 text-white border-red-600'
                      : 'bg-amber-500/90 hover:bg-amber-400 text-slate-900 border-amber-400'
                  }`}
                  title={isLocationLocked ? 'Unlock to drag store pin' : 'Lock location to prevent accidental moves'}
                >
                  {isLocationLocked ? <Lock className="w-3.5 h-3.5" /> : <LockOpen className="w-3.5 h-3.5" />}
                  <span>{isLocationLocked ? '🔒 Locked' : '🔓 Unlocked — drag to move'}</span>
                </button>
              </div>

              {/* Warning banner when unlocked */}
              {!isLocationLocked && (
                <div className="flex items-center gap-2 bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-bold px-3 py-2 rounded-xl">
                  <LockOpen className="w-3.5 h-3.5 shrink-0" />
                  <span>Location unlocked — drag the map or click to reposition the store. Lock again after moving.</span>
                </div>
              )}

              {/* Google Maps Canvas with Radius Circle */}
              <div className={`h-[400px] rounded-2xl overflow-hidden relative transition-all ${
                isLocationLocked
                  ? 'border-2 border-red-600/50'
                  : 'border-2 border-amber-400/70'
              }`}>
                <InteractiveMapCanvas
                  lat={lat}
                  lng={lng}
                  onPositionChange={handlePositionChange}
                  isServiceable={serviceStatus === 'active'}
                  radiusKm={deliveryRadiusKm}
                  showStoreCircle={true}
                  isAdminView={true}
                  locked={isLocationLocked}
                  onToggleLock={() => setIsLocationLocked((v) => !v)}
                  hintText={isLocationLocked ? 'Location locked — click Unlock to move the pin' : `Drag map to reposition ${storeName}`}
                />
              </div>

              {/* Service Boundary Legend */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 bg-emerald-950/40 border border-emerald-800/50 rounded-xl flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-emerald-400 shrink-0" />
                  <div>
                    <p className="text-xs font-black text-emerald-200">Inside Circle (≤ {deliveryRadiusKm} KM)</p>
                    <p className="text-[10px] text-emerald-400">Delivery Available • 10-15 Mins</p>
                  </div>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-amber-400 shrink-0" />
                  <div>
                    <p className="text-xs font-black text-slate-200">Outside Circle (&gt; {deliveryRadiusKm} KM)</p>
                    <p className="text-[10px] text-slate-400">Coming Soon • Notify Me Prompt</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Demand & Service Requests Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <BellRing className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="font-black text-sm text-white">Out-of-Area Customer Service Requests ("Notify Me")</h3>
                <p className="text-xs text-slate-400">
                  Customers who requested delivery in unserviceable zones. Expand your radius to convert them!
                </p>
              </div>
            </div>
            <span className="text-xs font-bold bg-amber-950/60 text-amber-300 border border-amber-800/50 px-3 py-1 rounded-xl">
              {serviceRequests.length} Total Inquiries
            </span>
          </div>

          {serviceRequests.length === 0 ? (
            <div className="text-center py-10 text-slate-500 space-y-2">
              <Users className="w-10 h-10 mx-auto text-slate-700" />
              <p className="text-xs font-bold">No out-of-area requests yet</p>
              <p className="text-[11px] text-slate-600">
                When customers outside your radius click "Notify Me When Available", their details will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-400 uppercase text-[10px] font-black border-b border-slate-800">
                  <tr>
                    <th className="pb-3 px-3">Customer</th>
                    <th className="pb-3 px-3">Address &amp; Pincode</th>
                    <th className="pb-3 px-3">Coordinates</th>
                    <th className="pb-3 px-3">Requested Date</th>
                    <th className="pb-3 px-3">Status</th>
                    <th className="pb-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {serviceRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-3">
                        <p className="font-bold text-white">{req.name}</p>
                        <p className="text-[11px] text-slate-400">{req.phone}</p>
                      </td>
                      <td className="py-3 px-3 max-w-[200px]">
                        <p className="truncate text-slate-300">{req.address}</p>
                        <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">
                          PIN: {req.pincode}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                        {req.latitude.toFixed(4)}, {req.longitude.toFixed(4)}
                      </td>
                      <td className="py-3 px-3 text-slate-400 text-[11px]">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                            req.status === 'converted'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : req.status === 'notified'
                              ? 'bg-blue-950 text-blue-400 border border-blue-800'
                              : 'bg-amber-950 text-amber-400 border border-amber-800'
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right space-x-1.5">
                        {req.status === 'waiting' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateReqStatus(req.id, 'notified')}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg"
                          >
                            Mark Notified
                          </button>
                        )}
                        {req.status !== 'converted' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateReqStatus(req.id, 'converted')}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg"
                          >
                            Convert
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
