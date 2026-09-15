'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  MapPin, 
  Navigation, 
  Compass, 
  Maximize2, 
  Locate, 
  Store, 
  Bike, 
  CheckCircle2, 
  Sparkles,
  Phone,
  Package,
  ChevronUp,
  ChevronDown,
  KeyRound,
  XCircle
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { updatePartnerLocationFS, updateDeliveryTrackingFS } from '@/lib/firebaseServices';
import { validateGpsUpdate, getAdaptiveIntervalMs, getRoadRoute, GpsFix } from '@/lib/locationServices';
import { Order } from '@/types';
import { resolveCustomerName, resolveCustomerPhone } from '../lib/customerUtils';

interface DeliveryRealtimeMapProps {
  order: Order;
  partnerId: string;
  isArrived?: boolean;
  onMarkArrived: () => void;
  onCompleteDelivery: () => void;
  isCompleting?: boolean;
}

// Calculate distance between two coordinates in Kilometers (Haversine formula)
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

export default function DeliveryRealtimeMap({
  order,
  partnerId,
  isArrived = false,
  onMarkArrived,
  onCompleteDelivery,
  isCompleting = false,
}: DeliveryRealtimeMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const riderMarkerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const watchIdRef = useRef<number | null>(null);

  const destinationAddress = order.address || order.deliveryAddress;
  const customerName = resolveCustomerName(order);
  const customerPhone = resolveCustomerPhone(order);
  const orderNumber = order.orderNumber || order.id;

  const [showItemsDrawer, setShowItemsDrawer] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const { verifyDeliveryOtp } = useAppStore();

  // Store / DarkStore Hub coordinates (Neral Express DarkStore)
  const storeCoords = {
    lat: 19.0224536,
    lng: 73.3210018,
    name: 'PocketKirana Express Hub (Neral)',
  };

  // Customer Coordinates (fallback if not provided in order)
  const customerCoords = {
    lat: destinationAddress?.latitude || 19.0298,
    lng: destinationAddress?.longitude || 73.3245,
    address: destinationAddress?.addressLine1 || 'Karjat Road, Mangaon',
    city: destinationAddress?.city || 'Neral',
  };

  // Live Rider Coordinates (initial state around hub / route)
  const [riderCoords, setRiderCoords] = useState<{ lat: number; lng: number }>({
    lat: storeCoords.lat + 0.0015,
    lng: storeCoords.lng + 0.0012,
  });

  const [speedKmh, setSpeedKmh] = useState<number>(0);
  const [distanceKm, setDistanceKm] = useState<number>(0.36);
  const [etaMins, setEtaMins] = useState<number>(1);
  const [isFollowingRider, setIsFollowingRider] = useState<boolean>(true);
  const [mapLoaded, setMapLoaded] = useState<boolean>(false);
  // GPS status: 'acquiring' | 'active:{accuracy}m' | 'poor:{accuracy}m' | 'unavailable' | 'stopped'
  const [gpsStatus, setGpsStatus] = useState<string>('Acquiring GPS...');

  // Refs for adaptive GPS management
  const lastGpsFix = useRef<GpsFix | null>(null);
  const lastFirestoreWrite = useRef<number>(0);
  const nextAllowedWriteAt = useRef<number>(0);
  const lastWrittenLat = useRef<number>(storeCoords.lat);
  const lastWrittenLng = useRef<number>(storeCoords.lng);

  // Recalculate Distance and ETA whenever coordinates update
  const updateMetrics = useCallback((rLat: number, rLng: number, cLat: number, cLng: number) => {
    const dist = calculateDistanceKm(rLat, rLng, cLat, cLng);
    setDistanceKm(dist);
    const eta = Math.max(1, Math.ceil((dist / 22) * 60));
    setEtaMins(eta);
  }, []);

  // Update Polyline Path on Map using real road routing engine
  const updateRoutePath = (L: any, rLat: number, rLng: number, cLat: number, cLng: number) => {
    if (!mapInstanceRef.current) return;

    getRoadRoute(rLat, rLng, cLat, cLng).then((res) => {
      if (!mapInstanceRef.current) return;

      if (res.distanceKm) setDistanceKm(res.distanceKm);
      if (res.durationMin) setEtaMins(res.durationMin);

      const pathPoints = res.geometry && res.geometry.length > 0
        ? res.geometry
        : [];

      if (pathPoints.length === 0) return;

      if (polylineRef.current) {
        polylineRef.current.setLatLngs(pathPoints);
      } else {
        polylineRef.current = L.polyline(pathPoints, {
          color: '#10B981',
          weight: 6,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(mapInstanceRef.current);
      }
    }).catch((e) => console.warn('Error fetching road route in delivery app:', e));
  };

  // Center / Fit Map Bounds
  const handleFitRouteBounds = () => {
    if (!mapInstanceRef.current) return;
    setIsFollowingRider(false);
    const bounds = [
      [riderCoords.lat, riderCoords.lng],
      [customerCoords.lat, customerCoords.lng],
      [storeCoords.lat, storeCoords.lng],
    ];
    mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60] });
  };

  // Recenter on Rider
  const handleCenterRider = () => {
    if (!mapInstanceRef.current) return;
    setIsFollowingRider(true);
    mapInstanceRef.current.setView([riderCoords.lat, riderCoords.lng], 16, { animate: true });
  };

  // Initialize Leaflet Map
  useEffect(() => {
    let isSubscribed = true;

    const initMap = async () => {
      if (typeof window === 'undefined') return;

      try {
        const leafletModule = await import('leaflet');
        const L = leafletModule.default || leafletModule;

        if (!mapContainerRef.current || !isSubscribed) return;

        // Clean up previous instance if any
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }

        const map = L.map(mapContainerRef.current, {
          center: [riderCoords.lat, riderCoords.lng],
          zoom: 16,
          zoomControl: false,
          attributionControl: false,
        });

        // OpenStreetMap Standard Tiles (No API key required, 100% free, no watermark)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          subdomains: ['a', 'b', 'c'],
        }).addTo(map);

        // 1. STORE HUB PIN
        const storeDiv = document.createElement('div');
        storeDiv.className = 'w-9 h-9 rounded-2xl bg-emerald-700 text-white flex items-center justify-center font-bold text-base shadow-lg border-2 border-white ring-2 ring-emerald-500/30';
        storeDiv.innerHTML = '🏪';
        const storeIcon = L.divIcon({
          className: '',
          html: storeDiv.outerHTML,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });
        L.marker([storeCoords.lat, storeCoords.lng], { icon: storeIcon })
          .addTo(map)
          .bindPopup(`<b>${storeCoords.name}</b><br/>Pickup Hub`);

        // 2. CUSTOMER DESTINATION PIN
        const customerDiv = document.createElement('div');
        customerDiv.className = 'w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center font-bold text-lg shadow-xl border-2 border-white ring-4 ring-rose-500/20';
        customerDiv.innerHTML = '📍';
        const customerIcon = L.divIcon({
          className: '',
          html: customerDiv.outerHTML,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });
        L.marker([customerCoords.lat, customerCoords.lng], { icon: customerIcon })
          .addTo(map)
          .bindPopup(`<b>${customerName}</b><br/>${customerCoords.address}`);

        // 3. RIDER LIVE GPS PIN
        const riderDiv = document.createElement('div');
        riderDiv.className = 'w-11 h-11 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xl shadow-2xl border-3 border-white rider-radar-pulse';
        riderDiv.innerHTML = '🚴';
        const riderIcon = L.divIcon({
          className: '',
          html: riderDiv.outerHTML,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        });
        const rMarker = L.marker([riderCoords.lat, riderCoords.lng], { icon: riderIcon, zIndexOffset: 1000 })
          .addTo(map)
          .bindPopup('<b>Your Live Position</b><br/>Active Delivery Partner');

        riderMarkerRef.current = rMarker;
        mapInstanceRef.current = map;

        // Draw initial Route
        updateRoutePath(L, riderCoords.lat, riderCoords.lng, customerCoords.lat, customerCoords.lng);
        updateMetrics(riderCoords.lat, riderCoords.lng, customerCoords.lat, customerCoords.lng);

        setMapLoaded(true);
      } catch (err) {
        console.error('Error initializing Leaflet live map:', err);
      }
    };

    initMap();

    return () => {
      isSubscribed = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // ── Adaptive GPS Watcher with accuracy validation & lifecycle management ──
  useEffect(() => {
    // Stop tracking immediately once arrived or delivery complete
    if (isArrived) {
      if (watchIdRef.current !== null) {
        navigator.geolocation?.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setGpsStatus('stopped');
      return;
    }

    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGpsStatus('GPS unavailable');
      return;
    }

    const handleGeoSuccess = (position: GeolocationPosition) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const accuracy = position.coords.accuracy ?? 999;
      const rawSpeed = position.coords.speed; // m/s from browser
      const speedKmhRaw = rawSpeed != null ? rawSpeed * 3.6 : 0;
      const heading = position.coords.heading ?? 0;
      const altitude = position.coords.altitude ?? undefined;
      const now = Date.now();

      // ── 1. Validate incoming fix ──
      const incoming: GpsFix = { latitude: lat, longitude: lng, accuracy, timestamp: now };
      const validation = validateGpsUpdate(incoming, lastGpsFix.current);

      if (!validation.valid) {
        console.warn('[GPS] Rejected fix:', validation.reason);
        setGpsStatus(`Poor GPS ±${Math.round(accuracy)}m`);
        return;
      }

      // ── 2. Update UI speed/accuracy label ──
      const effectiveSpeed = validation.impliedSpeedKmh ?? speedKmhRaw;
      setSpeedKmh(effectiveSpeed);
      setGpsStatus(accuracy <= 20 ? `GPS ±${Math.round(accuracy)}m` : `GPS ±${Math.round(accuracy)}m (fair)`);

      // ── 3. Determine adaptive write interval ──
      const intervalMs = getAdaptiveIntervalMs(effectiveSpeed, accuracy);
      const writeAllowed = now >= nextAllowedWriteAt.current;

      // ── 4. Minimum displacement filter: only broadcast if moved > 15m since last write ──
      const movedEnough = (() => {
        const dLat = Math.abs(lat - lastWrittenLat.current);
        const dLng = Math.abs(lng - lastWrittenLng.current);
        const approxMeters = Math.sqrt(dLat * dLat + dLng * dLng) * 111_000;
        return approxMeters > 15;
      })();

      if (writeAllowed || movedEnough) {
        // ── 5. Update map marker ──
        setRiderCoords({ lat, lng });
        if (riderMarkerRef.current) riderMarkerRef.current.setLatLng([lat, lng]);
        if (mapInstanceRef.current && isFollowingRider) {
          mapInstanceRef.current.panTo([lat, lng], { animate: true, duration: 0.8 });
        }
        import('leaflet').then((leafletModule) => {
          const L = leafletModule.default || leafletModule;
          updateRoutePath(L, lat, lng, customerCoords.lat, customerCoords.lng);
        });
        updateMetrics(lat, lng, customerCoords.lat, customerCoords.lng);

        // ── 6. Push to Firestore with full telemetry ──
        if (partnerId) updatePartnerLocationFS(partnerId, lat, lng);
        if (order.id) {
          updateDeliveryTrackingFS(
            `assign-${order.id}`,
            partnerId,
            order.id,
            lat,
            lng,
            true,
            {
              accuracy,
              speed: effectiveSpeed,
              heading,
              altitude,
              deviceTimestamp: new Date(now).toISOString(),
              partnerId,
              orderId: order.id,
              latitude: lat,
              longitude: lng,
            }
          );
        }

        // ── 7. Advance the adaptive write window ──
        nextAllowedWriteAt.current = now + intervalMs;
        lastWrittenLat.current = lat;
        lastWrittenLng.current = lng;
        lastGpsFix.current = incoming;
      }
    };

    const handleGeoError = (err: GeolocationPositionError) => {
      console.warn('[GPS] watchPosition error:', err.message);
      setGpsStatus('GPS unavailable – check permissions');
    };

    watchIdRef.current = navigator.geolocation.watchPosition(handleGeoSuccess, handleGeoError, {
      enableHighAccuracy: true,
      maximumAge: 5_000,
      timeout: 15_000,
    });

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  // isFollowingRider deliberately omitted — map pan is handled inside effect without re-registering watchPosition
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerCoords.lat, customerCoords.lng, order.id, partnerId, isArrived, updateMetrics]);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-slate-950 select-none overscroll-none touch-none">
      
      {/* ── 1. FULL-SCREEN LEAFLET MAP CANVAS (FIXED IN BACKGROUND) ── */}
      <div 
        ref={mapContainerRef} 
        className="absolute inset-0 w-full h-full z-0 touch-auto"
        style={{ touchAction: 'pan-x pan-y pinch-zoom' }}
      />

      {/* ── 2. TOP FLOATING NAVIGATION HUD ── */}
      <div className="absolute top-3 left-3 right-3 z-30 pointer-events-auto">
        <div className="bg-[#0F532B]/95 backdrop-blur-md text-white p-3.5 rounded-3xl shadow-2xl border border-emerald-600/40 space-y-2">
          
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full">
              {isArrived ? '📍 Arrived' : '🚴 Out for Delivery'}
            </span>
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                gpsStatus.startsWith('GPS ±') ? 'bg-emerald-300 animate-pulse' :
                gpsStatus.startsWith('Poor') ? 'bg-amber-300' :
                gpsStatus === 'stopped' ? 'bg-gray-400' : 'bg-amber-300 animate-ping'
              }`} />
              <span className="text-[10px] font-mono font-bold text-emerald-100/90">{gpsStatus}</span>
              <span className="text-[10px] font-mono font-bold bg-black/25 px-2 py-0.5 rounded-lg ml-1">#{orderNumber}</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-sm font-black text-white leading-tight truncate">
                {isArrived ? 'You Have Arrived at Doorstep' : `Heading to ${customerCoords.address}`}
              </h2>
              <span className="text-[11px] text-emerald-100/90 font-medium block truncate mt-0.5">
                {destinationAddress?.landmark ? `Near ${destinationAddress.landmark}, ` : ''}{customerCoords.city} - {destinationAddress?.postalCode || '410101'}
              </span>
            </div>

            {/* Live Distance & ETA Pill */}
            <div className="text-right shrink-0 bg-black/25 px-3 py-1.5 rounded-2xl border border-white/10">
              <span className="text-sm font-black text-emerald-300 font-mono block leading-tight">
                {distanceKm} km
              </span>
              <span className="text-[10px] text-emerald-100 font-bold block mt-0.5">
                ~{etaMins} mins
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* ── 3. FLOATING MAP ACTION BUTTONS (TOP RIGHT) ── */}
      <div className="absolute top-28 right-3 z-30 flex flex-col gap-2.5 pointer-events-auto">
        {/* Recenter / Lock on Rider */}
        <button
          type="button"
          onClick={handleCenterRider}
          title="Lock view on live rider location"
          className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-xl transition-transform active:scale-95 cursor-pointer ${
            isFollowingRider
              ? 'bg-emerald-600 text-white shadow-emerald-600/40 ring-2 ring-white'
              : 'bg-white/95 text-slate-800 border border-slate-200'
          }`}
        >
          <Locate className="w-5 h-5" />
        </button>

        {/* Fit Full Route Bounds */}
        <button
          type="button"
          onClick={handleFitRouteBounds}
          title="View entire route"
          className="w-11 h-11 rounded-2xl bg-white/95 hover:bg-white text-slate-800 border border-slate-200 flex items-center justify-center shadow-xl transition-transform active:scale-95 cursor-pointer"
        >
          <Maximize2 className="w-4.5 h-4.5" />
        </button>

        {/* Direct Call Customer Button */}
        <a
          href={`tel:${customerPhone}`}
          title="Call Customer"
          className="w-11 h-11 rounded-2xl bg-white/95 hover:bg-white text-emerald-700 border border-emerald-300 flex items-center justify-center shadow-xl transition-transform active:scale-95 cursor-pointer"
        >
          <Phone className="w-5 h-5 fill-emerald-600" />
        </a>
      </div>

      {/* ── 4. FLOATING BOTTOM ACTION SHEET ── */}
      <div className="absolute bottom-3 left-3 right-3 z-30 pointer-events-auto space-y-2.5">
        
        {/* Customer & Bag Summary Collapsible Bar */}
        <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-3xl p-3.5 shadow-2xl space-y-2">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <strong className="text-xs font-black text-slate-900 block truncate">
                  {customerName} • {customerPhone}
                </strong>
                <span className="text-[11px] text-slate-500 font-medium block truncate">
                  {customerCoords.address}, {customerCoords.city}
                </span>
              </div>
            </div>

            {/* Toggle Grocery Bag Checklist */}
            <button
              type="button"
              onClick={() => setShowItemsDrawer(!showItemsDrawer)}
              className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black flex items-center gap-1 shrink-0 transition-colors"
            >
              <Package className="w-3.5 h-3.5 text-emerald-600" />
              <span>{order.items?.length || 1} Items</span>
              {showItemsDrawer ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
            </button>
          </div>

          {/* Expanded Item List */}
          {showItemsDrawer && (
            <div className="pt-2 border-t border-slate-100 max-h-32 overflow-y-auto space-y-1 text-xs">
              {(order.items || []).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-[11px] font-bold py-1 px-2 rounded-lg bg-slate-50">
                  <span className="text-slate-800 truncate">{item.product?.name || (item as any).productName || 'Grocery Item'}</span>
                  <span className="font-mono text-emerald-800 shrink-0">Qty: {item.quantity}</span>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* OTP Verification Panel – shown when rider has arrived */}
        {isArrived && (
          <div className={`rounded-3xl p-4 shadow-2xl border backdrop-blur-md space-y-3 ${
            otpSuccess
              ? 'bg-[#0F532B]/95 border-emerald-400/60'
              : 'bg-white/95 border-slate-200'
          }`}>
            {otpSuccess ? (
              <div className="flex flex-col items-center gap-2 py-1">
                <CheckCircle2 className="w-10 h-10 text-white" />
                <span className="text-white font-black text-sm">OTP Verified! Completing delivery...</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[#0F532B]" />
                  <span className="text-xs font-black text-slate-900 uppercase tracking-wider">Enter Customer OTP</span>
                </div>

                <p className="text-[11px] text-slate-500 font-medium">
                  Ask the customer for their 4-digit delivery OTP to complete this order.
                </p>

                {/* 4-digit OTP boxes */}
                <div className="flex items-center justify-center gap-3">
                  {otpDigits.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => { otpRefs.current[i] = el; }}
                      type="tel"
                      inputMode="numeric"
                      maxLength={1}
                      value={d}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(-1);
                        const next = [...otpDigits];
                        next[i] = val;
                        setOtpDigits(next);
                        setOtpError('');
                        if (val && i < 3) otpRefs.current[i + 1]?.focus();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !otpDigits[i] && i > 0) {
                          otpRefs.current[i - 1]?.focus();
                        }
                      }}
                      className={`w-14 h-16 text-center text-2xl font-black rounded-2xl border-2 outline-none transition-colors ${
                        otpError
                          ? 'border-red-400 bg-red-50 text-red-700'
                          : d
                          ? 'border-[#0F532B] bg-emerald-50 text-emerald-900'
                          : 'border-slate-300 bg-slate-50 text-slate-900'
                      }`}
                    />
                  ))}
                </div>

                {otpError && (
                  <div className="flex items-center gap-1.5 justify-center">
                    <XCircle className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-xs text-red-600 font-bold">{otpError}</span>
                  </div>
                )}

                <button
                  type="button"
                  disabled={otpDigits.join('').length < 4 || isVerifying}
                  onClick={() => {
                    const enteredOtp = otpDigits.join('');
                    setIsVerifying(true);
                    const success = verifyDeliveryOtp(order.id, enteredOtp);
                    setIsVerifying(false);
                    if (success) {
                      setOtpSuccess(true);
                      setOtpError('');
                      setTimeout(() => onCompleteDelivery(), 800);
                    } else {
                      setOtpError('Wrong OTP. Please ask the customer again.');
                      setOtpDigits(['', '', '', '']);
                      otpRefs.current[0]?.focus();
                    }
                  }}
                  className="w-full py-3.5 bg-[#0F532B] hover:bg-[#006E2F] disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-900/30 flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider transition-all active:scale-98"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>{isVerifying ? 'Verifying...' : 'Verify & Complete Delivery'}</span>
                </button>
              </>
            )}
          </div>
        )}

        {/* Arrive button – shown before arrival */}
        {!isArrived && (
          <button
            type="button"
            onClick={onMarkArrived}
            className="w-full py-4 bg-[#0F532B] hover:bg-[#006E2F] active:scale-98 text-white font-black text-sm rounded-2xl shadow-2xl shadow-emerald-900/40 flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider transition-transform"
          >
            <MapPin className="w-5 h-5" />
            <span>I HAVE ARRIVED AT CUSTOMER</span>
          </button>
        )}

      </div>

    </div>
  );
}
