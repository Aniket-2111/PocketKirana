'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';
import { useAppStore } from '@/lib/store';
import { ServiceRequest } from '@/types';
import { showToast } from '@/components/ui/Toast';
import {
  fetchServiceRequestsFS,
  updateServiceRequestStatusFS,
} from '@/lib/firebaseServices';

const InteractiveMapCanvas = dynamic(
  () => import('@/components/common/InteractiveMapCanvas').then((m) => m.InteractiveMapCanvas),
  { ssr: false, loading: () => <div className="w-full h-[340px] bg-slate-900 rounded-xl animate-pulse" /> }
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
  ShieldCheck,
  Database,
  Gift,
  RefreshCw,
  Plus,
  X,
} from 'lucide-react';
import { StoreAdminTeamPanel } from '@/components/admin/StoreAdminTeamPanel';

interface AuthorizedStoreItem {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  deliveryRadiusKm?: number;
  deliveryFee?: number;
}

export default function AdminServiceAreaPage() {
  const { addAuditLog } = useAppStore();

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Multi-Store Selection State (Canonical PostgreSQL Authority)
  const [authorizedStores, setAuthorizedStores] = useState<AuthorizedStoreItem[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('store_primary');
  const [selectedStoreCode, setSelectedStoreCode] = useState<string>('STORE-001');

  // Form State (Canonical PostgreSQL Authority)
  const [storeName, setStoreName] = useState<string>('');
  const [storeAddress, setStoreAddress] = useState<string>('');
  const [lat, setLat] = useState<number>(19.0224536);
  const [lng, setLng] = useState<number>(73.3210018);
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState<number>(3.0);
  const [deliveryFee, setDeliveryFee] = useState<number>(29);
  const [freeDeliveryEnabled, setFreeDeliveryEnabled] = useState<boolean>(true);
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState<number>(499);
  const [openingTime, setOpeningTime] = useState<string>('06:00');
  const [closingTime, setClosingTime] = useState<string>('23:00');
  const [serviceStatus, setServiceStatus] = useState<'active' | 'inactive' | 'maintenance'>('active');

  // Service Requests state (transitional customer waitlist inquiries)
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);

  // 1. Load canonical store operational settings from PostgreSQL API
  async function loadData(targetStoreId?: string) {
    setLoading(true);
    setErrorMessage(null);
    try {
      const url = targetStoreId
        ? `/api/admin/store/operations?storeId=${encodeURIComponent(targetStoreId)}`
        : '/api/admin/store/operations';
      const res = await fetch(url);
      const json = await res.json();

      if (res.ok && json.success && json.data) {
        const data = json.data;
        const currentStoreId = data.storeId || targetStoreId || 'store_primary';
        setSelectedStoreId(currentStoreId);
        setSelectedStoreCode(data.storeCode || data.code || 'STORE-001');

        if (Array.isArray(data.authorizedStores) && data.authorizedStores.length > 0) {
          setAuthorizedStores(data.authorizedStores);
        }

        setStoreName(data.storeName || '');
        setStoreAddress(data.address || '');
        setLat(typeof data.latitude === 'number' ? data.latitude : parseFloat(data.latitude) || 19.0224536);
        setLng(typeof data.longitude === 'number' ? data.longitude : parseFloat(data.longitude) || 73.3210018);

        // Ensure radius strictly conforms to canonical 3.0, 4.0, or 5.0
        const rad = Number(data.deliveryRadiusKm);
        setDeliveryRadiusKm([3.0, 4.0, 5.0].includes(rad) ? rad : 3.0);
        setDeliveryFee(typeof data.deliveryFee === 'number' ? data.deliveryFee : 29);
        setFreeDeliveryEnabled(data.freeDeliveryEnabled !== false);
        setFreeDeliveryThreshold(typeof data.freeDeliveryThreshold === 'number' ? data.freeDeliveryThreshold : 499);
        setOpeningTime(data.openingTime ? String(data.openingTime).substring(0, 5) : '06:00');
        setClosingTime(data.closingTime ? String(data.closingTime).substring(0, 5) : '23:00');
        setServiceStatus(data.status === 'OPEN' || data.status === 'HIGH_DEMAND' ? 'active' : 'inactive');
      } else {
        const err = json.error || 'Failed to load canonical store operations from PostgreSQL authority.';
        setErrorMessage(err);
        showToast(err, 'error');
      }

      // Load waitlist inquiries from Firestore (advisory projection)
      const reqs = await fetchServiceRequestsFS().catch(() => []);
      setServiceRequests(reqs);
    } catch (err: any) {
      const errText = err?.message || 'Network error connecting to canonical store operations API.';
      setErrorMessage(errText);
      console.warn('Error loading admin service area:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setMounted(true);
    loadData();
  }, []);

  const handleStoreSelect = (newStoreId: string) => {
    if (newStoreId === selectedStoreId || loading) return;
    loadData(newStoreId);
  };

  // 2. Save handler writing to canonical PostgreSQL API
  const handleSaveServiceArea = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);

    const payload = {
      storeId: selectedStoreId,
      name: storeName,
      address: storeAddress,
      status: serviceStatus === 'active' ? 'OPEN' : 'CLOSED',
      openingTime,
      closingTime,
      deliveryRadiusKm: Number(deliveryRadiusKm),
      deliveryFee: Number(deliveryFee),
      freeDeliveryEnabled: Boolean(freeDeliveryEnabled),
      freeDeliveryThreshold: Number(freeDeliveryThreshold),
    };

    try {
      const res = await fetch('/api/admin/store/operations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        addAuditLog('UPDATE_SERVICE_AREA', 'Store', selectedStoreId);
        showToast(`Store settings & ${deliveryRadiusKm} KM service area saved to PostgreSQL!`, 'success');
      } else {
        showToast(data.error || 'Failed to save service area settings', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Network error saving service area settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateReqStatus = async (id: string, status: 'waiting' | 'notified' | 'converted') => {
    await updateServiceRequestStatusFS(id, status);
    setServiceRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    showToast(`Request status marked as ${status.toUpperCase()}`, 'success');
  };

  // 3. Main Admin Store Registration State & Handler
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [regName, setRegName] = useState('');
  const [regCode, setRegCode] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regCity, setRegCity] = useState('Neral');
  const [regState, setRegState] = useState('Maharashtra');
  const [regPincode, setRegPincode] = useState('410101');
  const [regLat, setRegLat] = useState('19.0224536');
  const [regLng, setRegLng] = useState('73.3210018');
  const [regRadius, setRegRadius] = useState<number>(3.0);
  const [regFee, setRegFee] = useState<number>(29);
  const [regFreeEnabled, setRegFreeEnabled] = useState(true);
  const [regFreeThreshold, setRegFreeThreshold] = useState<number>(499);
  const [regOpening, setRegOpening] = useState('06:00');
  const [regClosing, setRegClosing] = useState('23:00');
  const [registering, setRegistering] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  const handleRegisterStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registering) return;
    setRegistering(true);
    setRegError(null);

    if (!regName.trim()) {
      setRegError('Store name is required.');
      setRegistering(false);
      return;
    }
    if (!regCode.trim()) {
      setRegError('Store code is required.');
      setRegistering(false);
      return;
    }
    const lat = parseFloat(regLat);
    const lng = parseFloat(regLng);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setRegError('Valid GPS coordinates (latitude between -90 and 90, longitude between -180 and 180) are required.');
      setRegistering(false);
      return;
    }

    try {
      const res = await fetch('/api/admin/store/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName.trim(),
          code: regCode.trim().toUpperCase(),
          phone: regPhone.trim() || undefined,
          address: regAddress.trim() || undefined,
          city: regCity.trim() || undefined,
          state: regState.trim() || undefined,
          pincode: regPincode.trim() || undefined,
          latitude: lat,
          longitude: lng,
          deliveryRadiusKm: Number(regRadius),
          deliveryFee: Number(regFee),
          freeDeliveryEnabled: Boolean(regFreeEnabled),
          freeDeliveryThreshold: Number(regFreeThreshold),
          openingTime: regOpening.trim(),
          closingTime: regClosing.trim(),
        }),
      });

      const data = await res.json();

      if (res.status === 201 && data.success) {
        showToast(`Store '${data.store.name}' registered successfully! (Currently Inactive)`, 'success');
        addAuditLog('STORE_REGISTERED', 'Store', data.store.id);
        setShowRegisterModal(false);
        // Reset form fields
        setRegName('');
        setRegCode('');
        setRegPhone('');
        setRegAddress('');
        // Reload data and automatically focus new store
        await loadData(data.store.id);
      } else {
        setRegError(data.error || 'Failed to register store.');
      }
    } catch (err: any) {
      setRegError(err.message || 'Network error communicating with store registration API.');
    } finally {
      setRegistering(false);
    }
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
                <span className="flex items-center gap-1 text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  <Database className="w-3 h-3 text-emerald-400" /> Canonical PostgreSQL
                </span>
              </div>
              <p className="text-xs text-slate-400 font-semibold">
                Manage darkstore operational parameters, canonical delivery radius, and pricing
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Coordinate Protection Indicator */}
            <div className="flex items-center gap-1.5 font-bold text-xs px-3.5 py-2 rounded-xl border bg-slate-800/80 border-slate-700 text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Coordinates Protected</span>
            </div>

            <button
              type="button"
              onClick={() => handleSaveServiceArea()}
              disabled={saving || loading || !storeName}
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

        {/* CANONICAL POSTGRESQL MULTI-STORE SELECTOR */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400">
              <StoreIcon className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Active Darkstore (PostgreSQL Canonical)
              </span>
              {authorizedStores.length > 0 ? (
                <div className="flex items-center gap-2 mt-0.5">
                  <select
                    id="admin-store-select"
                    value={selectedStoreId}
                    onChange={(e) => handleStoreSelect(e.target.value)}
                    disabled={loading || saving}
                    className="bg-slate-950 border border-slate-700 text-white font-black text-sm rounded-xl px-3 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer disabled:opacity-50"
                  >
                    {authorizedStores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code}) — {s.isActive ? '🟢 Active' : '🔴 Disabled'}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <span className="text-sm font-black text-slate-300">
                  {loading ? 'Connecting to PostgreSQL...' : storeName || selectedStoreId}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="bg-slate-800 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-xl">
              Store ID: <span className="font-mono text-emerald-400">{selectedStoreId}</span>
            </span>
            <span className="bg-slate-800 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-xl">
              Code: <span className="font-mono text-emerald-400">{selectedStoreCode}</span>
            </span>
            {loading && (
              <span className="bg-amber-950/60 border border-amber-800/80 text-amber-300 px-3 py-1.5 rounded-xl flex items-center gap-1.5 animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Syncing...
              </span>
            )}
            <button
              type="button"
              id="btn-register-new-store"
              onClick={() => {
                setRegError(null);
                setShowRegisterModal(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-3.5 py-1.5 rounded-xl shadow transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer ml-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Register New Store</span>
            </button>
          </div>
        </div>

        {/* ERROR STATE BANNER */}
        {errorMessage && (
          <div className="bg-red-950/80 border border-red-800 rounded-2xl p-4 text-red-200 flex items-center justify-between gap-4 shadow-lg">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-red-300">Authority Connection Error</p>
                <p className="text-xs font-semibold">{errorMessage}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => loadData(selectedStoreId)}
              className="bg-red-900 hover:bg-red-800 text-white font-bold text-xs px-4 py-2 rounded-xl border border-red-700 transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* INACTIVE STORE NOTICE BANNER */}
        {serviceStatus === 'inactive' && !errorMessage && !loading && (
          <div className="bg-amber-950/60 border border-amber-800 rounded-2xl p-4 text-amber-200 flex items-center gap-3 shadow-md">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-amber-300">Store Inactive Notice</p>
              <p className="text-xs font-medium">This store is currently inactive and hidden from customer checkout. Activate it using the status control below when ready for live operations.</p>
            </div>
          </div>
        )}

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
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Protected GPS Hub</span>
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
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <StoreIcon className="w-5 h-5 text-emerald-400" />
                <h3 className="font-black text-sm text-white">Store Operational Parameters</h3>
              </div>
              <span className="text-[10px] font-bold text-slate-400 font-mono">
                {selectedStoreId}
              </span>
            </div>

            <form onSubmit={handleSaveServiceArea} className="space-y-4">
              {/* Store Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">Shop / Darkstore Name *</label>
                <input
                  type="text"
                  required
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="e.g. PocketKirana Central Darkstore"
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

              {/* Operating Hours */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-emerald-400" /> Opening Time
                  </label>
                  <input
                    type="time"
                    required
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
                    required
                    value={closingTime}
                    onChange={(e) => setClosingTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              {/* Pricing & Free Delivery Controls */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-emerald-400" /> Standard Delivery Fee (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    required
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                    <Gift className="w-3 h-3 text-emerald-400" /> Free Delivery Above (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    required
                    value={freeDeliveryThreshold}
                    onChange={(e) => setFreeDeliveryThreshold(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              {/* Free Delivery Toggle & Minimum Order Status */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block">Free Delivery Promo</label>
                  <button
                    type="button"
                    onClick={() => setFreeDeliveryEnabled((prev) => !prev)}
                    className={`w-full py-2 rounded-xl text-xs font-bold border transition-all text-center ${
                      freeDeliveryEnabled
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    {freeDeliveryEnabled ? '✅ Enabled' : '❌ Disabled'}
                  </button>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block">Min. Order Requirement</label>
                  <div className="w-full py-2 px-3 rounded-xl text-xs font-bold border border-slate-800 bg-slate-950/60 text-slate-400 text-center">
                    ₹0 (Retired in v2.6)
                  </div>
                </div>
              </div>

              {/* Canonical Delivery Radius Selector (CHECK 3.0, 4.0, 5.0) */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 block">
                    Canonical Delivery Radius (PostgreSQL Constraint)
                  </label>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded-full">
                    CHECK (3.0, 4.0, 5.0)
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[3.0, 4.0, 5.0].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setDeliveryRadiusKm(r)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all text-center ${
                        deliveryRadiusKm === r
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {r.toFixed(1)} KM
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500">
                  Fixed database constraint to ensure reliable 30-min express fulfillment.
                </p>
              </div>

              {/* Protected Coordinates Grid (Read-Only) */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Protected GPS Coordinates</span>
                  </label>
                  <span className="text-[10px] text-slate-500 font-semibold">Fixed Store Hub</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 block font-mono">Latitude</span>
                    <input
                      type="text"
                      readOnly
                      value={typeof lat === 'number' ? lat.toFixed(7) : lat}
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-emerald-400 cursor-not-allowed opacity-90"
                      title="Coordinates are permanent and protected. Contact developer operations to relocate store hub."
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 block font-mono">Longitude</span>
                    <input
                      type="text"
                      readOnly
                      value={typeof lng === 'number' ? lng.toFixed(7) : lng}
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-emerald-400 cursor-not-allowed opacity-90"
                      title="Coordinates are permanent and protected. Contact developer operations to relocate store hub."
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 flex items-center gap-1 pt-0.5">
                  <ShieldCheck className="w-3 h-3 text-emerald-500 shrink-0" />
                  Hub relocation requires short-lived developer authorization to prevent order disruption.
                </p>
              </div>

              {/* Service Status */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <label className="text-xs font-bold text-slate-300 block">Service Status (PostgreSQL is_active)</label>
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
                  disabled={saving || loading || !storeName}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>Save Operational Parameters to PostgreSQL</span>
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

                <div className="flex items-center gap-1.5 font-bold text-[11px] px-3 py-1.5 rounded-lg border bg-slate-800/80 border-slate-700 text-slate-300">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Fixed Store Hub</span>
                </div>
              </div>

              {/* Google Maps Canvas with Radius Circle */}
              <div className="h-[400px] rounded-2xl overflow-hidden relative border-2 border-emerald-600/40">
                <InteractiveMapCanvas
                  lat={lat}
                  lng={lng}
                  onPositionChange={() => {}}
                  isServiceable={serviceStatus === 'active'}
                  radiusKm={deliveryRadiusKm}
                  showStoreCircle={true}
                  isAdminView={true}
                  locked={true}
                  hintText="Darkstore location coordinates are fixed and protected"
                />
              </div>

              {/* Service Boundary Legend */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 bg-emerald-950/40 border border-emerald-800/50 rounded-xl flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-emerald-400 shrink-0" />
                  <div>
                    <p className="text-xs font-black text-emerald-200">Inside Circle (≤ {deliveryRadiusKm} KM)</p>
                    <p className="text-[10px] text-emerald-400">Delivery Available • 30 Mins</p>
                  </div>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-amber-400 shrink-0" />
                  <div>
                    <p className="text-xs font-black text-slate-200">Outside Circle (&gt; {deliveryRadiusKm} KM)</p>
                    <p className="text-[10px] text-slate-400">Out of Service Area • Notify Me</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Demand & Service Requests Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" />
                <h3 className="font-black text-base text-white">Unserviceable Customer Demand</h3>
              </div>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">
                Potential customers outside active radius who requested expansion
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-300 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl">
                Total Requests: <strong className="text-amber-400">{serviceRequests.length}</strong>
              </span>
            </div>
          </div>

          {serviceRequests.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-slate-800 rounded-2xl">
              <BellRing className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-400">No pending expansion requests</p>
              <p className="text-xs text-slate-600">Requests from outside current delivery boundaries will appear here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/60 uppercase text-[10px] font-black tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Customer Phone</th>
                    <th className="py-3 px-4">Pincode</th>
                    <th className="py-3 px-4">Distance from Hub</th>
                    <th className="py-3 px-4">Requested At</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {serviceRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-white">{req.phone}</td>
                      <td className="py-3 px-4 font-mono">{req.pincode}</td>
                      <td className="py-3 px-4 font-bold text-amber-300">
                        {(req as any).distanceKm ? `${(req as any).distanceKm.toFixed(1)} KM` : 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : 'Recent'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            req.status === 'converted'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : req.status === 'notified'
                              ? 'bg-blue-950 text-blue-300 border border-blue-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {req.status === 'waiting' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateReqStatus(req.id, 'notified')}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-slate-700"
                          >
                            Mark Notified
                          </button>
                        )}
                        {req.status !== 'converted' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateReqStatus(req.id, 'converted')}
                            className="bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-emerald-700"
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

        {/* Store Admin Team Panel */}
        <StoreAdminTeamPanel
          userRole="admin"
          selectedStoreId={selectedStoreId}
          selectedStoreCode={selectedStoreCode}
          availableStores={authorizedStores}
        />

        {/* REGISTER NEW STORE MODAL */}
        {showRegisterModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl my-8 text-slate-100 max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400">
                    <StoreIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white">Register New Canonical Store</h2>
                    <p className="text-xs text-slate-400 font-semibold">
                      Provisions an authoritative store &amp; primary warehouse in PostgreSQL (Inactive by default)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Error Banner */}
              {regError && (
                <div className="bg-red-950/80 border border-red-800 rounded-xl p-3 text-red-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{regError}</span>
                </div>
              )}

              {/* Registration Form */}
              <form onSubmit={handleRegisterStore} className="space-y-4">
                {/* Store Identity */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      Store Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      id="reg-store-name"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="e.g. PocketKirana Neral West Darkstore"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      Store Code <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      id="reg-store-code"
                      required
                      value={regCode}
                      onChange={(e) => setRegCode(e.target.value.toUpperCase())}
                      placeholder="e.g. PK-NERAL-02"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white uppercase font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* GPS Coordinates */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4" /> GPS Hub Location (Protected upon creation)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">
                        Latitude (-90 to 90) <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        id="reg-store-lat"
                        required
                        value={regLat}
                        onChange={(e) => setRegLat(e.target.value)}
                        placeholder="19.0224536"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">
                        Longitude (-180 to 180) <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        id="reg-store-lng"
                        required
                        value={regLng}
                        onChange={(e) => setRegLng(e.target.value)}
                        placeholder="73.3210018"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Address & Contact */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-slate-300 block mb-1">Street Address</label>
                    <input
                      type="text"
                      id="reg-store-address"
                      value={regAddress}
                      onChange={(e) => setRegAddress(e.target.value)}
                      placeholder="e.g. Shop No. 4, Market Road, Near Station"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Contact Phone</label>
                    <input
                      type="text"
                      id="reg-store-phone"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">City</label>
                    <input
                      type="text"
                      id="reg-store-city"
                      value={regCity}
                      onChange={(e) => setRegCity(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">State</label>
                    <input
                      type="text"
                      id="reg-store-state"
                      value={regState}
                      onChange={(e) => setRegState(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Pincode</label>
                    <input
                      type="text"
                      id="reg-store-pincode"
                      value={regPincode}
                      onChange={(e) => setRegPincode(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Operations & Delivery Configuration */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      Delivery Radius <span className="text-red-400">*</span>
                    </label>
                    <select
                      id="reg-store-radius"
                      value={regRadius}
                      onChange={(e) => setRegRadius(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value={3.0}>3.0 KM (Standard)</option>
                      <option value={4.0}>4.0 KM (Extended)</option>
                      <option value={5.0}>5.0 KM (Maximum)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Base Delivery Fee (₹)</label>
                    <input
                      type="number"
                      min={0}
                      id="reg-store-fee"
                      value={regFee}
                      onChange={(e) => setRegFee(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Free Delivery Above (₹)</label>
                    <input
                      type="number"
                      min={0}
                      id="reg-store-threshold"
                      value={regFreeThreshold}
                      onChange={(e) => setRegFreeThreshold(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Operating Hours */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Opening Time (HH:mm)</label>
                    <input
                      type="text"
                      id="reg-store-opening"
                      value={regOpening}
                      onChange={(e) => setRegOpening(e.target.value)}
                      placeholder="06:00"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Closing Time (HH:mm)</label>
                    <input
                      type="text"
                      id="reg-store-closing"
                      value={regClosing}
                      onChange={(e) => setRegClosing(e.target.value)}
                      placeholder="23:00"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Architectural Policy Notice */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-400 space-y-1">
                  <p className="flex items-center gap-1.5 font-bold text-slate-300">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Architectural Safeguards:
                  </p>
                  <p>• Store is registered as <strong className="text-amber-400">INACTIVE</strong> by default; activate it when physical fulfillment is ready.</p>
                  <p>• Minimum order value is permanently locked at <strong className="text-white">₹0.00</strong>.</p>
                  <p>• Primary warehouse and audit log are created atomically within the same PostgreSQL transaction.</p>
                </div>

                {/* Modal Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowRegisterModal(false)}
                    disabled={registering}
                    className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-bold text-xs bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    id="btn-submit-register-store"
                    disabled={registering}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs px-5 py-2.5 rounded-xl shadow-lg transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
                  >
                    {registering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span>{registering ? 'Registering in PostgreSQL...' : 'Register Store in PostgreSQL'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
