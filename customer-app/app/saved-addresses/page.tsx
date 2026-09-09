'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import CustomerShell from '../../components/CustomerShell';
import { MapPin, Plus, Trash2, Navigation, Loader2 } from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

export default function SavedAddressesPage() {
  const router = useRouter();
  const { addresses, addAddress, deleteAddress, setDefaultAddress, currentUser } = useAppStore();

  const [showAddForm, setShowAddForm] = useState(false);
  const [locating, setLocating] = useState(false);
  const [formData, setFormData] = useState({
    userId: currentUser?.id || 'cust-1',
    fullName: 'Customer',
    phone: '+91 8698893348',
    addressType: 'Home',
    addressLine1: '',
    houseNumber: '',
    landmark: '',
    city: 'Neral',
    state: 'Maharashtra',
    country: 'India',
    postalCode: '410101',
    latitude: 19.0224,
    longitude: 73.3210,
    isDefault: true,
  });

  // ── Geolocation + Reverse Geocoding ──────────────────────────────────────
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your device', 'error');
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          // Use OpenStreetMap Nominatim (free, no API key needed)
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' } }
          );
          const data = await res.json();
          const addr = data.address || {};

          // Build readable street address
          const road = addr.road || addr.pedestrian || addr.footway || '';
          const neighbourhood = addr.neighbourhood || addr.suburb || addr.village || '';
          const streetLine = [road, neighbourhood].filter(Boolean).join(', ');

          const city =
            addr.city ||
            addr.town ||
            addr.village ||
            addr.county ||
            'Neral';

          const postalCode = addr.postcode || '410101';
          const state = addr.state || 'Maharashtra';

          setFormData((prev) => ({
            ...prev,
            addressLine1: streetLine || data.display_name?.split(',').slice(0, 2).join(', ') || '',
            city,
            state,
            postalCode,
            latitude,
            longitude,
          }));

          showToast('Location detected! Please review and save.', 'success');
        } catch {
          // If reverse geocoding fails, at least fill coords
          setFormData((prev) => ({
            ...prev,
            latitude,
            longitude,
          }));
          showToast('Location detected. Please fill address details.', 'info');
        } finally {
          setLocating(false);
        }
      },
      (error) => {
        setLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          showToast('Location permission denied. Please allow access in device settings.', 'error');
        } else {
          showToast('Unable to detect location. Please enter manually.', 'error');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.addressLine1.trim()) {
      showToast('Please enter your street address / area', 'error');
      return;
    }
    addAddress(formData);
    showToast('New address saved successfully!', 'success');
    setShowAddForm(false);
    // Reset form
    setFormData((prev) => ({
      ...prev,
      addressLine1: '',
      houseNumber: '',
      landmark: '',
      city: 'Neral',
      postalCode: '410101',
    }));
  };

  return (
    <CustomerShell title="Saved Addresses" showBack backUrl="/profile">
      <div className="space-y-4 animate-in fade-in duration-200 pb-16">
        
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-900 tracking-tight dark:text-white">Delivery Addresses</h2>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add New</span>
          </button>
        </div>

        {/* Add Address Form */}
        {showAddForm && (
          <form onSubmit={handleSave} className="bg-white dark:bg-slate-800 border-2 border-emerald-500 rounded-3xl p-5 space-y-3 shadow-md animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-xs uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                New Delivery Address
              </h3>
            </div>

            {/* ── USE MY LOCATION BUTTON ── */}
            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={locating}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-60 text-white font-black text-xs rounded-2xl shadow-md shadow-emerald-500/30 cursor-pointer transition-all"
            >
              {locating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Detecting Location...</span>
                </>
              ) : (
                <>
                  <Navigation className="w-4 h-4" />
                  <span>Use My Current Location</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-600" />
              <span>or enter manually</span>
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-600" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="House / Flat No."
                value={formData.houseNumber}
                onChange={(e) => setFormData({ ...formData, houseNumber: e.target.value })}
                className="bg-slate-50 dark:bg-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-bold"
              />
              <select
                value={formData.addressType}
                onChange={(e) => setFormData({ ...formData, addressType: e.target.value })}
                className="bg-slate-50 dark:bg-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-bold"
              >
                <option value="Home">Home</option>
                <option value="Work">Work / Office</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <input
              type="text"
              placeholder="Street Address, Building, Area *"
              required
              value={formData.addressLine1}
              onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-bold"
            />

            <input
              type="text"
              placeholder="Nearby Landmark (Optional)"
              value={formData.landmark}
              onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-bold"
            />

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="City"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="bg-slate-50 dark:bg-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-bold"
              />
              <input
                type="text"
                placeholder="Pincode"
                value={formData.postalCode}
                onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                className="bg-slate-50 dark:bg-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-bold"
              />
            </div>

            {/* Show detected coordinates as a subtle hint */}
            {formData.latitude !== 19.0224 && (
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/30 rounded-xl px-3 py-2">
                <MapPin className="w-3 h-3 shrink-0" />
                <span>GPS: {formData.latitude.toFixed(5)}, {formData.longitude.toFixed(5)}</span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer"
              >
                Save Address
              </button>
            </div>
          </form>
        )}

        {/* Existing Address List */}
        <div className="space-y-3">
          {addresses.length === 0 && !showAddForm && (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-8 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
                <MapPin className="w-7 h-7 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-900 dark:text-white">No saved addresses</h3>
                <p className="text-[11px] text-slate-500 mt-1">Add your first delivery address to get started.</p>
              </div>
            </div>
          )}

          {addresses.map((addr) => (
            <div
              key={addr.id}
              className={`bg-white dark:bg-slate-800 border rounded-3xl p-4 space-y-3 shadow-xs transition-colors ${
                addr.isDefault
                  ? 'border-emerald-500 ring-2 ring-emerald-500/10'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="text-xs font-black text-slate-900 dark:text-white">{addr.addressType || 'Home'}</strong>
                    {addr.isDefault && (
                      <span className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-400 text-[9px] font-black px-1.5 py-0.2 rounded-md uppercase ml-2">
                        Default
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => deleteAddress(addr.id)}
                  className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-snug">
                {addr.houseNumber ? `${addr.houseNumber}, ` : ''}{addr.addressLine1}, {addr.city} - {addr.postalCode}
              </p>

              {addr.latitude && addr.latitude !== 19.0224 && (
                <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                  <Navigation className="w-3 h-3" />
                  <span>GPS-verified location</span>
                </div>
              )}

              {!addr.isDefault && (
                <button
                  onClick={() => {
                    setDefaultAddress(addr.id);
                    showToast('Default address updated', 'success');
                  }}
                  className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Set as Default Address
                </button>
              )}
            </div>
          ))}
        </div>

      </div>
    </CustomerShell>
  );
}
