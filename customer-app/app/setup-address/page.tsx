'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { validateDeliveryZoneServerSide } from '@/lib/locationServices';
import {
  MapPin,
  Navigation,
  Search,
  CheckCircle,
  ArrowRight,
  AlertCircle,
  Home,
  Building2,
  Briefcase,
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

type AddressType = 'Home' | 'Work' | 'Other';

interface SuggestedPlace {
  display_name: string;
  lat: string;
  lon: string;
}

export default function SetupAddressPage() {
  const router = useRouter();
  const { isLoggedIn, addresses, addAddress } = useAppStore();

  // ── redirect if not logged in ──
  useEffect(() => {
    if (!isLoggedIn) {
      router.replace('/login');
    }
  }, [isLoggedIn, router]);

  // ── if user already has addresses, skip to home ──
  useEffect(() => {
    if (addresses.length > 0) {
      router.replace('/home');
    }
  }, [addresses.length, router]);

  const [step, setStep] = useState<'INPUT' | 'CHECKING' | 'CONFIRM'>('INPUT');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestedPlace[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  const [pickedLat, setPickedLat] = useState<number | null>(null);
  const [pickedLon, setPickedLon] = useState<number | null>(null);
  const [pickedDisplay, setPickedDisplay] = useState('');
  const [houseFlat, setHouseFlat] = useState('');
  const [landmark, setLandmark] = useState('');
  const [addressType, setAddressType] = useState<AddressType>('Home');
  const [serviceCheck, setServiceCheck] = useState<{ isServiceable: boolean; message: string } | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Debounced place search (Nominatim) ──
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
          { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json();
        setSuggestions(data as SuggestedPlace[]);
      } catch {
        // ignore network errors
      } finally {
        setLoadingSuggestions(false);
      }
    }, 500);
  };

  const pickSuggestion = (place: SuggestedPlace) => {
    setPickedLat(parseFloat(place.lat));
    setPickedLon(parseFloat(place.lon));
    setPickedDisplay(place.display_name);
    setQuery(place.display_name);
    setSuggestions([]);
  };

  // ── GPS detection ──
  const handleGps = () => {
    if (!navigator.geolocation) {
      showToast('GPS not supported on this device', 'error');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setPickedLat(latitude);
        setPickedLon(longitude);
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { 'Accept-Language': 'en' } }
          );
          const data = await res.json();
          const display = data.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          setPickedDisplay(display);
          setQuery(display);
        } catch {
          setPickedDisplay(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          setQuery(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === 1) {
          showToast('Location permission denied. Please allow access or type your address.', 'error');
        } else {
          showToast('Could not get your location. Please type your address.', 'error');
        }
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  };

  // ── Check serviceability ──
  const handleCheck = async () => {
    if (!pickedLat || !pickedLon) {
      showToast('Please select a location from suggestions or use GPS', 'error');
      return;
    }
    setStep('CHECKING');
    try {
      const zone = await validateDeliveryZoneServerSide(pickedLat, pickedLon);
      setServiceCheck({ isServiceable: zone.isServiceable, message: zone.message });
      setStep('CONFIRM');
    } catch {
      setStep('CONFIRM');
      setServiceCheck({ isServiceable: false, message: 'Could not check serviceability. Please try again.' });
    }
  };

  // ── Save address and navigate ──
  const handleSave = async () => {
    if (!serviceCheck?.isServiceable) {
      router.replace('/not-serviceable');
      return;
    }
    const parts = pickedDisplay.split(',');
    const line1 = parts.slice(0, 2).join(',').trim();
    const city = parts[2]?.trim() || 'Neral';
    const postal = parts.find((p) => /\d{6}/.test(p.trim()))?.trim() || '';

    const { currentUser } = useAppStore.getState();

    await addAddress({
      addressType: addressType,
      fullName: currentUser?.name || currentUser?.mobile || 'Customer',
      phone: currentUser?.mobile || '',
      addressLine1: houseFlat ? `${houseFlat}, ${line1}` : line1,
      addressLine2: landmark || undefined,
      city,
      state: 'Maharashtra',
      country: 'India',
      postalCode: postal,
      isDefault: true,
      latitude: pickedLat!,
      longitude: pickedLon!,
    });

    showToast('Address saved! Welcome to Pocket Kirana 🎉', 'success');
    router.replace('/home');
  };

  // ── Type icon ──
  const typeIcon = (t: AddressType) => {
    if (t === 'Home') return <Home className="w-4 h-4" />;
    if (t === 'Work') return <Briefcase className="w-4 h-4" />;
    return <Building2 className="w-4 h-4" />;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-5 pt-safe-top pb-4 pt-10 shadow-sm">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-base shadow-md shadow-emerald-600/25">
              PK
            </div>
            <div>
              <h1 className="text-base font-black text-slate-900 tracking-tight">Set Your Delivery Location</h1>
              <p className="text-[11px] text-slate-500 font-medium">We'll check if we deliver to your area</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-md mx-auto w-full px-5 py-6 space-y-5">

        {/* ── STEP: INPUT ── */}
        {(step === 'INPUT' || step === 'CHECKING') && (
          <>
            {/* GPS Button */}
            <button
              onClick={handleGps}
              disabled={gpsLoading}
              className="w-full flex items-center gap-3 bg-emerald-50 border-2 border-emerald-200 hover:border-emerald-400 rounded-2xl px-4 py-3.5 text-left transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0 shadow-sm">
                <Navigation className={`w-5 h-5 text-white ${gpsLoading ? 'animate-spin' : ''}`} />
              </div>
              <div>
                <div className="text-sm font-black text-emerald-800 tracking-tight">
                  {gpsLoading ? 'Detecting location…' : 'Use my current location'}
                </div>
                <div className="text-[11px] text-emerald-600 font-medium">Fastest & most accurate</div>
              </div>
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">or type your address</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {/* Search Box */}
            <div className="relative">
              <div className="flex items-center gap-2 bg-white border-2 border-slate-200 focus-within:border-emerald-500 rounded-2xl px-4 py-3 transition-colors shadow-sm">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search area, street, landmark…"
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  className="flex-1 text-sm font-medium text-slate-900 placeholder-slate-400 bg-transparent focus:outline-none"
                />
                {loadingSuggestions && (
                  <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                )}
              </div>

              {/* Suggestions dropdown */}
              {suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 overflow-hidden">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => pickSuggestion(s)}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-emerald-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                    >
                      <MapPin className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                      <span className="text-xs text-slate-700 font-medium leading-relaxed line-clamp-2">
                        {s.display_name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected location pill */}
            {pickedLat && pickedDisplay && (
              <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-black text-emerald-800">Location selected</div>
                  <div className="text-[11px] text-emerald-700 font-medium mt-0.5 leading-relaxed line-clamp-2">
                    {pickedDisplay}
                  </div>
                </div>
              </div>
            )}

            {/* Check Button */}
            <button
              onClick={handleCheck}
              disabled={!pickedLat || step === 'CHECKING'}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed uppercase tracking-wider"
            >
              {step === 'CHECKING' ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Checking Serviceability…</span>
                </>
              ) : (
                <>
                  <span>Check Delivery Availability</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </>
        )}

        {/* ── STEP: CONFIRM ── */}
        {step === 'CONFIRM' && serviceCheck && (
          <>
            {/* Serviceability result */}
            {serviceCheck.isServiceable ? (
              <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl px-5 py-4 flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-black text-emerald-800">🎉 Delivery Available!</div>
                  <div className="text-xs text-emerald-700 font-medium mt-0.5">{serviceCheck.message}</div>
                </div>
              </div>
            ) : (
              <div className="bg-red-50 border-2 border-red-200 rounded-2xl px-5 py-4 flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-black text-red-700">Not Serviceable Yet</div>
                  <div className="text-xs text-red-600 font-medium mt-0.5">{serviceCheck.message}</div>
                </div>
              </div>
            )}

            {/* Address details form (only if serviceable) */}
            {serviceCheck.isServiceable && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="text-xs font-black text-slate-700 uppercase tracking-wider">Complete your address</div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
                    House / Flat / Block No.
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Flat 3B, Krishna Niwas"
                    value={houseFlat}
                    onChange={(e) => setHouseFlat(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-sm font-medium text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
                    Nearby Landmark (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Near Railway Station"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-sm font-medium text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                    Address Type
                  </label>
                  <div className="flex gap-2">
                    {(['Home', 'Work', 'Other'] as AddressType[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => setAddressType(t)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black border-2 transition-all cursor-pointer ${
                          addressType === t
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {typeIcon(t)}
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col gap-3">
              {serviceCheck.isServiceable ? (
                <button
                  onClick={handleSave}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all active:scale-95 cursor-pointer uppercase tracking-wider"
                >
                  <CheckCircle className="w-4 h-4" />
                  Save Address & Go to Home
                </button>
              ) : (
                <button
                  onClick={() => router.replace('/not-serviceable')}
                  className="w-full py-4 bg-slate-800 hover:bg-slate-900 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer uppercase tracking-wider"
                >
                  Continue Anyway
                </button>
              )}

              <button
                onClick={() => {
                  setStep('INPUT');
                  setServiceCheck(null);
                  setPickedLat(null);
                  setPickedLon(null);
                  setPickedDisplay('');
                  setQuery('');
                }}
                className="w-full py-3 bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-700 font-black text-xs rounded-2xl transition-all active:scale-95 cursor-pointer uppercase tracking-wider"
              >
                Try a Different Location
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
