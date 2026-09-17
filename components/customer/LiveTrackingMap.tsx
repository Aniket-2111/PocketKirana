'use client';

import 'leaflet/dist/leaflet.css';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import {
  subscribeDeliveryTrackingFS,
  subscribeSingleOrderFS,
  fetchLatestTrackingFS
} from '@/lib/firebaseServices';
import {
  calculateDistanceKm,
  getRoadRoute,
  isDeviatedFromRoute,
  RoadRouteResult
} from '@/lib/locationServices';
import { soundAlerts } from '@/lib/audioAlerts';
import { showToast } from '@/components/ui/Toast';
import { Order, DeliveryPartner } from '@/types';
import {
  MapPin,
  Store,
  Navigation,
  Phone,
  PhoneCall,
  ShieldCheck,
  Clock,
  CheckCircle2,
  PackageCheck,
  Bike,
  Sparkles,
  Lock,
  Unlock,
  Crosshair,
  Volume2,
  AlertCircle,
  Truck,
  Zap,
  RotateCcw
} from 'lucide-react';

interface LiveTrackingMapProps {
  orderId: string;
}

// Default Store Hub Coordinates (PocketKirana Central Dark Store Hub: Neral, Maharashtra)
const DEFAULT_STORE_LAT = 19.0224536;
const DEFAULT_STORE_LNG = 73.3210018;

// Default Customer Destination Coordinates (Fallback in Neral service zone)
const DEFAULT_DEST_LAT = 19.0278;
const DEFAULT_DEST_LNG = 73.3265;

export const LiveTrackingMap: React.FC<LiveTrackingMapProps> = ({ orderId }) => {
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);

  // Markers and Layers Refs
  const storeMarkerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const riderMarkerRef = useRef<any>(null);
  const roadRouteGlowRef = useRef<any>(null);
  const roadRouteRef = useRef<any>(null);

  const { orders, deliveryPartners } = useAppStore();

  // Local real-time states
  const [liveOrder, setLiveOrder] = useState<Order | null>(null);
  const [liveTracking, setLiveTracking] = useState<{
    currentLat: number;
    currentLng: number;
    speed?: number;
    updatedAt?: string;
    isActive?: boolean;
  } | null>(null);

  // Stale location tracking
  const [lastUpdateEpoch, setLastUpdateEpoch] = useState<number | null>(null);
  const [staleAgeSeconds, setStaleAgeSeconds] = useState<number>(0);
  const [isOffline, setIsOffline] = useState<boolean>(false);

  // Real road route geometry, distance & ETA
  const [roadGeometry, setRoadGeometry] = useState<[number, number][]>([]);
  const [roadDistanceKm, setRoadDistanceKm] = useState<number | null>(null);
  const [roadEtaMin, setRoadEtaMin] = useState<number | null>(null);
  const [routeSource, setRouteSource] = useState<'osrm' | 'fallback'>('osrm');
  const [isRouteUpdating, setIsRouteUpdating] = useState<boolean>(false);

  const lastRouteCalcAt = useRef<number>(0);
  const lastRouteRiderLat = useRef<number>(0);
  const lastRouteRiderLng = useRef<number>(0);

  const [hasNotifiedArrival, setHasNotifiedArrival] = useState(false);
  const [callingState, setCallingState] = useState<string | null>(null);

  // 1. Subscribe to order & tracking document in Firestore
  useEffect(() => {
    setMounted(true);
    if (!orderId) return;

    // Listen to real-time order updates
    const unsubOrder = subscribeSingleOrderFS(orderId, (updated) => {
      if (updated) setLiveOrder(updated);
    });

    // Listen to real-time rider tracking document
    const unsubTracking = subscribeDeliveryTrackingFS(`assign-${orderId}`, (trackingData) => {
      if (trackingData && trackingData.currentLat && trackingData.currentLng) {
        setIsOffline(false);
        setLiveTracking({
          currentLat: Number(trackingData.currentLat),
          currentLng: Number(trackingData.currentLng),
          speed: trackingData.speed ?? 0,
          updatedAt: trackingData.receivedAt || trackingData.updatedAt || new Date().toISOString(),
          isActive: trackingData.isActive !== false,
        });
        // Record epoch for stale detection
        setLastUpdateEpoch(Date.now());
      } else if (trackingData && trackingData.isActive === false) {
        // Tracking session explicitly ended — clear live position
        setLiveTracking(prev => prev ? { ...prev, isActive: false } : null);
      }
    });

    // On reconnect: fetch latest snapshot so we never show a frozen marker from an old session
    fetchLatestTrackingFS(orderId).then((snapshot) => {
      if (snapshot && snapshot.currentLat && snapshot.isActive !== false) {
        setLiveTracking({
          currentLat: Number(snapshot.currentLat),
          currentLng: Number(snapshot.currentLng),
          speed: snapshot.speed ?? 0,
          updatedAt: snapshot.receivedAt || snapshot.updatedAt,
          isActive: true,
        });
        setLastUpdateEpoch(Date.now());
      }
    });

    return () => {
      unsubOrder();
      unsubTracking();
    };
  }, [orderId]);

  // Resolve current active order
  const order = useMemo(() => {
    if (liveOrder) return liveOrder;
    const match = orders.find((o) => o.id === orderId || o.orderNumber === orderId);
    if (match) return match;
    return orders.length > 0 ? orders[0] : null;
  }, [liveOrder, orders, orderId]);

  // Order status logic
  const statusUpper = (order?.orderStatus || (order as any)?.status || (order as any)?.order_status || '').toString().toUpperCase();
  const isOutForDelivery = ['OUT_FOR_DELIVERY', 'PICKED_UP', 'ORDER_PICKED_UP', 'ARRIVED_AT_CUSTOMER', 'DELIVERED', 'COMPLETED'].includes(statusUpper);
  const isDelivered = ['DELIVERED', 'COMPLETED'].includes(statusUpper);

  // 1b. Stale-location ticker — updates staleAgeSeconds every second when out for delivery
  useEffect(() => {
    if (!isOutForDelivery || isDelivered) return;
    const ticker = setInterval(() => {
      if (lastUpdateEpoch) {
        const ageMs = Date.now() - lastUpdateEpoch;
        setStaleAgeSeconds(Math.floor(ageMs / 1000));
        // If no update for >20s in an active tracking session, flag offline
        setIsOffline(ageMs > 20_000);
      } else {
        setStaleAgeSeconds(0);
      }
    }, 1_000);
    return () => clearInterval(ticker);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastUpdateEpoch, isOutForDelivery, isDelivered]);

  // Resolve assigned delivery partner
  const assignedPartner = useMemo(() => {
    const targetId = order?.partnerId || (order as any)?.assignedPartnerId;
    const targetName = order?.partnerName || (order as any)?.assignedPartnerName;
    const targetPhone = order?.partnerPhone;

    if (targetId) {
      const matchById = deliveryPartners.find(p => p.id === targetId);
      if (matchById) return matchById;
    }
    if (targetName) {
      const matchByName = deliveryPartners.find(p => p.name.toLowerCase().trim() === targetName.toLowerCase().trim());
      if (matchByName) return matchByName;
    }
    if (targetPhone) {
      const matchByPhone = deliveryPartners.find(p => p.phone === targetPhone);
      if (matchByPhone) return matchByPhone;
    }

    if (targetName) {
      return {
        id: targetId || 'dp-assigned',
        name: targetName,
        phone: targetPhone || '+919876543210',
        vehicleType: (order as any)?.vehicleType || 'EV Scooter',
        vehicleNumber: (order as any)?.vehicleNumber || 'MH 14 EV 2026',
        rating: (order as any)?.rating || 4.9,
        isOnline: true,
        currentStatus: 'busy'
      } as unknown as DeliveryPartner;
    }

    return deliveryPartners.length > 0 ? deliveryPartners[0] : null;
  }, [order, deliveryPartners]);

  const partnerName = order?.partnerName || (order as any)?.assignedPartnerName || assignedPartner?.name || 'Sunil Kumar (Express Agent)';
  const partnerPhone = order?.partnerPhone || assignedPartner?.phone || '+919876543210';
  const partnerVehicle = (order as any)?.vehicleType || assignedPartner?.vehicleType || 'EV Scooter';
  const partnerVehicleNumber = (order as any)?.vehicleNumber || assignedPartner?.vehicleNumber || 'MH 14 EV 2026';
  const partnerRating = (order as any)?.rating || assignedPartner?.rating || '4.9';

  // Resolve coordinates
  const storeLat = DEFAULT_STORE_LAT;
  const storeLng = DEFAULT_STORE_LNG;

  const destLat = Number(order?.address?.latitude) || DEFAULT_DEST_LAT;
  const destLng = Number(order?.address?.longitude) || DEFAULT_DEST_LNG;

  // Resolve Live Rider Position (Priority: Firestore live tracking > partner GPS location > estimated road position)
  const riderLat = useMemo(() => {
    if (!isOutForDelivery) return storeLat;
    if (liveTracking?.currentLat) return liveTracking.currentLat;
    if (assignedPartner?.currentLocation?.latitude) return assignedPartner.currentLocation.latitude;

    if (statusUpper === 'OUT_FOR_DELIVERY' || statusUpper === 'PICKED_UP') {
      return storeLat + (destLat - storeLat) * 0.65;
    }
    if (statusUpper === 'ARRIVED_AT_CUSTOMER' || isDelivered) {
      return destLat;
    }
    return storeLat;
  }, [liveTracking, assignedPartner, isOutForDelivery, statusUpper, isDelivered, storeLat, destLat]);

  const riderLng = useMemo(() => {
    if (!isOutForDelivery) return storeLng;
    if (liveTracking?.currentLng) return liveTracking.currentLng;
    if (assignedPartner?.currentLocation?.longitude) return assignedPartner.currentLocation.longitude;

    if (statusUpper === 'OUT_FOR_DELIVERY' || statusUpper === 'PICKED_UP') {
      return storeLng + (destLng - storeLng) * 0.65;
    }
    if (statusUpper === 'ARRIVED_AT_CUSTOMER' || isDelivered) {
      return destLng;
    }
    return storeLng;
  }, [liveTracking, assignedPartner, isOutForDelivery, statusUpper, isDelivered, storeLng, destLng]);

  // Haversine fallback distance
  const remainingDistanceKm = useMemo(() => {
    if (!isOutForDelivery) {
      const totalDist = calculateDistanceKm(storeLat, storeLng, destLat, destLng);
      return Math.max(0.1, Math.round(totalDist * 10) / 10);
    }
    if (isDelivered) return 0;
    const d = calculateDistanceKm(riderLat, riderLng, destLat, destLng);
    return Math.max(0.05, Math.round(d * 10) / 10);
  }, [isOutForDelivery, isDelivered, riderLat, riderLng, storeLat, storeLng, destLat, destLng]);

  // ══════════════════════════════════════════════════════════════════
  // REAL ROAD ROUTING ENGINE: Fetch road geometry from routing service
  // Triggers when:
  //   1. Initial tracking start
  //   2. 30–45 seconds have passed
  //   3. Rider has moved >150 meters
  //   4. Rider has deviated >100m from the active road route
  // ══════════════════════════════════════════════════════════════════
  const ROUTE_RECALC_INTERVAL_MS = 30_000;
  const ROUTE_RECALC_DISTANCE_M = 150;
  const ROUTE_DEVIATION_THRESHOLD_M = 100;

  const fetchRoute = useCallback(async (originLat: number, originLng: number, targetLat: number, targetLng: number) => {
    setIsRouteUpdating(true);
    try {
      const result = await getRoadRoute(originLat, originLng, targetLat, targetLng);
      if (result.geometry && result.geometry.length > 0) {
        setRoadGeometry(result.geometry);
      }
      setRoadDistanceKm(result.distanceKm);
      setRoadEtaMin(result.durationMin);
      setRouteSource(result.source);
    } catch (e) {
      console.warn('Road routing error:', e);
    } finally {
      setIsRouteUpdating(false);
    }
  }, []);

  useEffect(() => {
    if (isDelivered) {
      setRoadDistanceKm(0);
      setRoadEtaMin(0);
      return;
    }

    const originLat = isOutForDelivery ? riderLat : storeLat;
    const originLng = isOutForDelivery ? riderLng : storeLng;

    const now = Date.now();
    const elapsedSinceLastCalc = now - lastRouteCalcAt.current;
    const distFromLastCalcLat = Math.abs(originLat - lastRouteRiderLat.current);
    const distFromLastCalcLng = Math.abs(originLng - lastRouteRiderLng.current);
    const movedMeters = Math.sqrt(distFromLastCalcLat ** 2 + distFromLastCalcLng ** 2) * 111_000;

    const hasDeviated =
      roadGeometry.length > 1 &&
      isDeviatedFromRoute(originLat, originLng, roadGeometry, ROUTE_DEVIATION_THRESHOLD_M);

    const shouldRecalc =
      lastRouteCalcAt.current === 0 || // first call
      elapsedSinceLastCalc > ROUTE_RECALC_INTERVAL_MS ||
      movedMeters > ROUTE_RECALC_DISTANCE_M ||
      hasDeviated;

    if (!shouldRecalc) return;

    lastRouteCalcAt.current = now;
    lastRouteRiderLat.current = originLat;
    lastRouteRiderLng.current = originLng;

    fetchRoute(originLat, originLng, destLat, destLng);
  }, [riderLat, riderLng, storeLat, storeLng, destLat, destLng, isOutForDelivery, isDelivered, roadGeometry, fetchRoute]);

  // Final display distance & ETA (From real road route, haversine as fallback)
  const displayDistanceKm = isDelivered ? 0 : (roadDistanceKm ?? remainingDistanceKm);
  const etaMinutes = useMemo(() => {
    if (isDelivered) return 0;
    if (statusUpper === 'ARRIVED_AT_CUSTOMER') return 1;
    if (!isOutForDelivery) return roadEtaMin ?? 12;
    if (roadEtaMin != null) return Math.max(1, roadEtaMin);
    return Math.max(2, Math.round((remainingDistanceKm / 22) * 60));
  }, [isDelivered, statusUpper, isOutForDelivery, roadEtaMin, remainingDistanceKm]);

  const isArrived = useMemo(() => {
    if (!isOutForDelivery) return false;
    // Only show "Arrived" when delivery partner explicitly marks ARRIVED_AT_CUSTOMER
    // Do NOT include DELIVERED/COMPLETED – those should show a delivered state, not "arrived"
    // Only use distance as a proxy if genuinely very close (<50m) AND not already delivered
    if (isDelivered) return false;
    return (
      statusUpper === 'ARRIVED_AT_CUSTOMER' ||
      (remainingDistanceKm <= 0.05 && liveTracking != null)
    );
  }, [isOutForDelivery, isDelivered, statusUpper, remainingDistanceKm, liveTracking]);

  // 2. Trigger Arrival Notification & Sound when Rider Arrives
  useEffect(() => {
    if (isArrived && !hasNotifiedArrival) {
      setHasNotifiedArrival(true);
      soundAlerts.playOrderChime();

      // Show arrival toast
      showToast('🎉 Your Delivery Partner has arrived at your location!', 'success');

      // Native Web Notification
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('PocketKirana: Rider Arrived! 🎉', {
            body: `Your delivery agent is at your doorstep. Please keep OTP: ${order?.deliveryOtp || '----'} ready!`,
            icon: '/logo-icon.png'
          });
        } catch (e) {
          console.warn('Native notification error:', e);
        }
      }

      // Vibrate if supported on mobile
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 400]);
      }
    }
  }, [isArrived, hasNotifiedArrival, order]);

  // 3. Initialize Leaflet Map
  useEffect(() => {
    if (!mounted || typeof window === 'undefined' || !containerRef.current) return;

    let isSubscribed = true;

    const initMap = async () => {
      const leafletModule = await import('leaflet');
      const L = leafletModule.default || leafletModule;
      leafletRef.current = L;

      if (!isSubscribed || !containerRef.current) return;

      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) { }
        mapRef.current = null;
      }

      // Create map with fixed scroll settings to prevent page hijacking
      const map = L.map(containerRef.current, {
        center: isOutForDelivery ? [riderLat, riderLng] : [storeLat, storeLng],
        zoom: 15,
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
        dragging: true,
        touchZoom: true,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
      });

      // Clean OpenStreetMap tiles
      L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          maxZoom: 19,
          subdomains: ['a', 'b', 'c'],
        }
      ).addTo(map);

      mapRef.current = map;

      // 🏬 1. Store Marker
      const storeIcon = L.divIcon({
        className: 'custom-store-pin',
        html: `
          <div style="width:140px; display:flex; flex-direction:column; align-items:center; margin-left:-70px; margin-top:-46px; pointer-events:none;">
            <div style="background:#0F532B; color:white; width:34px; height:34px; border-radius:10px; box-shadow:0 4px 12px rgba(0,0,0,0.3); border:2px solid #ffffff; display:flex; align-items:center; justify-content:center;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg>
            </div>
            <div style="background:#0F532B; color:white; font-size:10px; font-weight:900; padding:2px 8px; border-radius:99px; margin-top:3px; white-space:nowrap; box-shadow:0 2px 6px rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.35);">
              PocketKirana Store Hub
            </div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0]
      });

      storeMarkerRef.current = L.marker([storeLat, storeLng], { icon: storeIcon, zIndexOffset: 500 }).addTo(map);

      // 🏠 2. Customer Destination Marker
      const destIcon = L.divIcon({
        className: 'custom-dest-pin',
        html: `
          <div style="width:130px; display:flex; flex-direction:column; align-items:center; margin-left:-65px; margin-top:-46px; pointer-events:none;">
            <div style="background:#006E2F; color:white; width:34px; height:34px; border-radius:10px; box-shadow:0 4px 12px rgba(0,0,0,0.3); border:2px solid #ffffff; display:flex; align-items:center; justify-content:center;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            <div style="background:#006E2F; color:white; font-size:10px; font-weight:900; padding:2px 8px; border-radius:99px; margin-top:3px; white-space:nowrap; box-shadow:0 2px 6px rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.35);">
              Your Doorstep 🏠
            </div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0]
      });

      destMarkerRef.current = L.marker([destLat, destLng], { icon: destIcon, zIndexOffset: 500 }).addTo(map);

      // 🛵 3. Rider Marker (when Out for Delivery)
      if (isOutForDelivery) {
        const riderIcon = L.divIcon({
          className: 'custom-rider-pin',
          html: `
            <div style="width:120px; display:flex; flex-direction:column; align-items:center; margin-left:-60px; margin-top:-20px; pointer-events:none;">
              <div style="position:relative; width:40px; height:40px; display:flex; align-items:center; justify-content:center;">
                <div style="position:absolute; inset:-4px; border-radius:50%; background:rgba(225,29,72,0.3); animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
                <div style="position:relative; width:40px; height:40px; background:#E11D48; color:white; border-radius:50%; box-shadow:0 4px 16px rgba(225,29,72,0.55); border:2.5px solid #ffffff; z-index:10; display:flex; align-items:center; justify-content:center;">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>
                </div>
              </div>
              <div style="background:#111827; color:#ffffff; font-size:9px; font-weight:900; padding:2px 8px; border-radius:99px; margin-top:3px; white-space:nowrap; border:1px solid rgba(255,255,255,0.25); box-shadow:0 3px 8px rgba(0,0,0,0.35); z-index:10;">
                🛵 ${partnerName ? partnerName.split(' ')[0] : 'Express Rider'}
              </div>
            </div>
          `,
          iconSize: [0, 0],
          iconAnchor: [0, 0]
        });

        riderMarkerRef.current = L.marker([riderLat, riderLng], { icon: riderIcon, zIndexOffset: 1000 }).addTo(map);
      }

      // 🛣️ 4. REAL ROAD ROUTE POLYLINE (No straight/dashed line!)
      const initialPoints: [number, number][] = roadGeometry.length > 0
        ? [
          ...(isOutForDelivery ? [[riderLat, riderLng] as [number, number]] : []),
          ...roadGeometry,
          [destLat, destLng] as [number, number]
        ]
        : [];

      // Casing / Glow underlay
      roadRouteGlowRef.current = L.polyline(initialPoints, {
        color: '#064E3B',
        weight: 8,
        opacity: 0.35,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      // Core Pocket Kirana Green Road Polyline
      roadRouteRef.current = L.polyline(initialPoints, {
        color: '#0F532B',
        weight: 5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      // Fit map viewport with padding
      const fitPoints: [number, number][] = [
        [isOutForDelivery ? riderLat : storeLat, isOutForDelivery ? riderLng : storeLng],
        [destLat, destLng],
        ...roadGeometry
      ];
      const bounds = L.latLngBounds(fitPoints);
      map.fitBounds(bounds, { padding: [55, 55], maxZoom: 16 });

      // Invalidate size immediately and after layout rendering
      map.invalidateSize();
      const t1 = setTimeout(() => {
        if (mapRef.current) mapRef.current.invalidateSize();
      }, 150);
      const t2 = setTimeout(() => {
        if (mapRef.current) mapRef.current.invalidateSize();
      }, 500);
      const t3 = setTimeout(() => {
        if (mapRef.current) mapRef.current.invalidateSize();
      }, 1000);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    };

    let cancelTimer: any;
    initMap().then((cleanFn) => {
      cancelTimer = cleanFn;
    });

    // ResizeObserver to handle layout/container dimension shifts
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      });
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      isSubscribed = false;
      if (cancelTimer) cancelTimer();
      if (resizeObserver) resizeObserver.disconnect();
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) { }
        mapRef.current = null;
      }
    };
  }, [mounted, isOutForDelivery]);

  // 4. Update Rider Marker and Road Polyline on position / route update
  useEffect(() => {
    if (!mapRef.current || !leafletRef.current) return;
    const L = leafletRef.current;

    // Move Rider Marker
    if (riderMarkerRef.current && isOutForDelivery) {
      riderMarkerRef.current.setLatLng([riderLat, riderLng]);
    }

    // Update Road Route Polyline connected directly from rider to destination
    if (roadGeometry && roadGeometry.length > 0) {
      const activePoints: [number, number][] = [
        ...(isOutForDelivery ? [[riderLat, riderLng] as [number, number]] : []),
        ...roadGeometry,
        [destLat, destLng] as [number, number]
      ];

      if (roadRouteGlowRef.current) {
        roadRouteGlowRef.current.setLatLngs(activePoints);
      }
      if (roadRouteRef.current) {
        roadRouteRef.current.setLatLngs(activePoints);
      }
    }
  }, [riderLat, riderLng, destLat, destLng, roadGeometry, isOutForDelivery]);

  // Recenter / Fit active route and rider
  const handleRecenter = useCallback(() => {
    if (!mapRef.current || !leafletRef.current) return;
    const L = leafletRef.current;
    const fitPoints: [number, number][] = [
      [isOutForDelivery ? riderLat : storeLat, isOutForDelivery ? riderLng : storeLng],
      [destLat, destLng],
      ...roadGeometry
    ];
    const bounds = L.latLngBounds(fitPoints);
    mapRef.current.fitBounds(bounds, { padding: [55, 55], maxZoom: 16, animate: true, duration: 0.8 });
  }, [riderLat, riderLng, storeLat, storeLng, destLat, destLng, roadGeometry, isOutForDelivery]);

  // Handle Initiating Masked Proxy Call
  const handleInitiateCall = () => {
    setCallingState(`Connecting call to ${partnerName}...`);
    window.location.href = `tel:${partnerPhone}`;
    setTimeout(() => {
      setCallingState(null);
    }, 4000);
  };

  if (!mounted) {
    return (
      <div className="w-full h-[420px] sm:h-[460px] lg:h-full lg:min-h-[440px] rounded-3xl bg-slate-100 animate-pulse flex flex-col items-center justify-center gap-3 text-slate-400 border border-slate-200">
        <Bike className="w-10 h-10 text-emerald-600 animate-bounce" />
        <span className="text-sm font-bold text-slate-600">Loading live road delivery map…</span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[420px] sm:h-[460px] lg:h-full lg:min-h-[440px] rounded-3xl overflow-hidden shadow-sm border border-slate-200/90 bg-slate-100 select-none">

      {/* ── 1. HORIZONTAL FULL-WIDTH STATUS BAR (Top Glassmorphism HUD) ── */}
      <div className="absolute top-3.5 left-3.5 right-3.5 z-20 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl px-3.5 sm:px-4 py-2.5 shadow-md flex items-center justify-between gap-3">
        
        {/* Left: Icon, Status Headline & Badge */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
            isArrived ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
          }`}>
            {isOutForDelivery ? (
              <Bike className={`w-4 h-4 ${isArrived ? 'text-amber-700' : 'text-emerald-700'}`} />
            ) : (
              <Store className="w-4 h-4 text-emerald-700" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xs text-slate-900 truncate">
                {isArrived
                  ? 'Rider has arrived'
                  : isOutForDelivery
                    ? 'Rider on the way'
                    : 'Packing at Store Hub'}
              </span>
              {isArrived ? (
                <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase shrink-0">
                  Arrived
                </span>
              ) : isOutForDelivery ? (
                <span className="bg-emerald-100 text-[#0F532B] text-[10px] font-black px-2 py-0.5 rounded-full uppercase shrink-0">
                  Live
                </span>
              ) : null}
            </div>
            <div className="text-[11px] font-bold text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                isArrived
                  ? 'bg-amber-500'
                  : isOffline
                  ? 'bg-amber-400 animate-pulse'
                  : isOutForDelivery
                  ? 'bg-emerald-500 animate-ping'
                  : 'bg-emerald-400'
              }`} />
              <span>
                {isArrived
                  ? 'At your doorstep'
                  : isOffline
                  ? `Reconnecting GPS… (${staleAgeSeconds}s ago)`
                  : isOutForDelivery
                  ? lastUpdateEpoch
                    ? `Updated ${staleAgeSeconds <= 3 ? 'just now' : `${staleAgeSeconds}s ago`}`
                    : 'Live GPS active'
                  : 'Dispatch Hub preparing'}
              </span>
            </div>
          </div>
        </div>

        {/* Center: ETA & Distance Highlight */}
        <div className="hidden sm:flex items-baseline gap-2 shrink-0 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
          <span className="text-base sm:text-lg font-black text-slate-900 tracking-tight font-mono">
            {isArrived
              ? 'Arrived'
              : isOutForDelivery
                ? `${etaMinutes} min`
                : '30 min'}
          </span>
          <span className="text-xs font-bold text-slate-500 font-mono">
            {isArrived
              ? '· Please collect'
              : isOutForDelivery
                ? `· ${displayDistanceKm} km away`
                : '· Order packed'}
          </span>
        </div>

        {/* Right: Road Route & Recenter Button */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden md:flex items-center gap-1.5 bg-slate-900/85 text-white px-2.5 py-1.5 rounded-xl text-[10px] font-black shadow-xs">
            <span className={`w-1.5 h-1.5 rounded-full ${isRouteUpdating ? 'bg-amber-400 animate-spin' : 'bg-emerald-400 animate-pulse'}`} />
            <span>{isRouteUpdating ? 'Updating…' : 'Road Route'}</span>
          </div>

          <button
            type="button"
            onClick={handleRecenter}
            aria-label="Recenter delivery map"
            title="Recenter Route & Rider"
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-90 text-slate-800 hover:text-emerald-700 border border-slate-200 shadow-xs flex items-center justify-center transition-all cursor-pointer"
          >
            <Crosshair className="w-4 h-4 text-emerald-700" />
          </button>
        </div>
      </div>

      {/* ── 4. THE HERO LEAFLET MAP CANVAS ── */}
      <div
        ref={containerRef}
        className="w-full h-full z-0 outline-none"
        tabIndex={-1}
      />

      {/* ── 5. BOTTOM LOCATION OVERLAYS ── */}
      <div className="absolute bottom-3.5 left-3.5 right-3.5 z-20 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pointer-events-none">
        <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200/90 text-[11px] font-bold text-slate-800 shadow-md flex items-center gap-2">
          <Store className="w-3.5 h-3.5 text-[#0F532B] shrink-0" />
          <span className="truncate max-w-[200px] sm:max-w-[240px]">PocketKirana Store Hub</span>
        </div>

        <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200/90 text-[11px] font-bold text-slate-800 shadow-md flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-[#006E2F] shrink-0" />
          <span className="truncate max-w-[200px] sm:max-w-[240px]">
            {order?.address ? `${order.address.addressLine1}, ${order.address.city}` : 'Your Delivery Location'}
          </span>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .leaflet-container {
          width: 100% !important;
          height: 100% !important;
          background: #f8fafc !important;
          font-family: inherit !important;
        }
        .leaflet-pane {
          z-index: 10 !important;
        }
        .leaflet-top, .leaflet-bottom {
          z-index: 20 !important;
        }
        .leaflet-tile {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          max-width: none !important;
          max-height: none !important;
          visibility: visible !important;
        }
        .leaflet-tile-container img {
          max-width: none !important;
          max-height: none !important;
        }
      `}} />
    </div>
  );
};
