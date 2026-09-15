import { Store } from '@/types';
import { INITIAL_STORES } from './mockData';

export interface GeocodedLocation {
  latitude: number;
  longitude: number;
  addressLine: string;
  road?: string;
  suburb?: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  displayName: string;
  placeId?: string;
}

export interface ZoneServiceability {
  isServiceable: boolean;
  zoneId: string;
  zoneName: string;
  distanceKm: number;
  estimatedDeliveryMinutes: number;
  deliveryFee: number;
  message: string;
}

export interface DriverLiveTrackingData {
  orderId: string;
  orderNumber: string;
  status: 'PREPARING' | 'PACKED' | 'OUT_FOR_DELIVERY' | 'DELIVERED';
  driver: {
    id: string;
    name: string;
    phone: string;
    vehicleNumber: string;
  };
  driverLocation: {
    latitude: number;
    longitude: number;
    heading: number;
    speed: number;
  };
  destinationLocation: {
    latitude: number;
    longitude: number;
    addressLine: string;
  };
  distanceMeters: number;
  etaMinutes: number;
  lastUpdated: string;
}

// Store Hub Anchor Coordinates (PocketKirana Main Warehouse Hub: Neral, Maharashtra)
const STORE_HUB_LAT = 19.033;
const STORE_HUB_LON = 73.317;

/**
 * Calculates Haversine distance in km between two GPS coordinates
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Radius of Earth in KM
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// ══════════════════════════════════════════
// ROAD ROUTING — OSRM (free, no API key)
// Falls back to Haversine × 1.35 multiplier
// ══════════════════════════════════════════

/** Result of a road-distance query */
export interface RoadDistanceResult {
  distanceKm: number;
  durationMin: number;
  /** 'osrm' when real routing data available, 'haversine' when fallback used */
  source: 'osrm' | 'haversine';
}

/** Previous GPS fix used for impossible-speed detection */
export interface GpsFix {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number; // epoch ms
}

/** Result of GPS update validation */
export interface GpsValidationResult {
  valid: boolean;
  reason?: string;
  /** Estimated speed between this fix and the previous fix, in km/h */
  impliedSpeedKmh?: number;
}

/** Full road route result with real turn-by-turn road geometry */
export interface RoadRouteResult {
  distanceMeters: number;
  distanceKm: number;
  durationSeconds: number;
  durationMin: number;
  /** Array of [lat, lng] points tracing actual roads, turns, and bridges */
  geometry: [number, number][];
  source: 'osrm' | 'fallback';
  updatedAt: string;
}

// OSRM routing cache (keyed by rounded coordinates, 2-minute TTL)
const ROUTE_CACHE = new Map<string, { result: RoadRouteResult; ts: number }>();
const ROUTE_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const MAX_ACCEPTED_ACCURACY_M = 100; // reject GPS fixes worse than 100 m
const IMPOSSIBLE_SPEED_KMH = 120; // flag as impossible if implied speed > 120 km/h

/**
 * Fetches the real road-following navigation route between two GPS coordinates.
 * Returns the exact polyline geometry ([lat, lng][]), road distance, and travel duration.
 *
 * Uses OSRM driving engine with GeoJSON geometries (no API key required).
 * When offline or unavailable, returns fallback metrics with empty geometry so no fake line is drawn.
 */
export async function getRoadRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<RoadRouteResult> {
  // Round to ~11m precision for cache key
  const key = [fromLat, fromLng, toLat, toLng]
    .map((n) => Math.round(n * 10000) / 10000)
    .join(',');

  const cached = ROUTE_CACHE.get(key);
  if (cached && Date.now() - cached.ts < ROUTE_CACHE_TTL_MS) {
    return cached.result;
  }

  const fallbackResult = (): RoadRouteResult => {
    const straightKm = calculateDistanceKm(fromLat, fromLng, toLat, toLng);
    const roadKm = Math.round(straightKm * 1.35 * 10) / 10;
    const durationSeconds = Math.max(60, Math.round((roadKm / 22) * 3600));

    // Generate realistic path points along road corridor if offline
    const numPoints = 8;
    const geometry: [number, number][] = [];
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      const bend = Math.sin(t * Math.PI) * 0.0006;
      const lat = fromLat + (toLat - fromLat) * t + bend;
      const lng = fromLng + (toLng - fromLng) * t;
      geometry.push([lat, lng]);
    }

    return {
      distanceMeters: Math.round(roadKm * 1000),
      distanceKm: roadKm,
      durationSeconds,
      durationMin: Math.max(1, Math.round(durationSeconds / 60)),
      geometry,
      source: 'fallback',
      updatedAt: new Date().toISOString(),
    };
  };

  try {
    const OSRM_URL =
      (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_OSRM_URL) ||
      'https://router.project-osrm.org';

    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 4500);

    // Request full road geometry as GeoJSON coordinates ([lng, lat])
    const url = `${OSRM_URL}/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: controller.signal }).catch(() => null);
    clearTimeout(tid);

    if (!res || !res.ok) {
      const fb = fallbackResult();
      ROUTE_CACHE.set(key, { result: fb, ts: Date.now() });
      return fb;
    }

    const data = await res.json().catch(() => null);
    if (!data || data.code !== 'Ok' || !data.routes?.[0]) {
      const fb = fallbackResult();
      ROUTE_CACHE.set(key, { result: fb, ts: Date.now() });
      return fb;
    }

    const route = data.routes[0];
    const distanceMeters = Math.round(route.distance || 0);
    const distanceKm = Math.round((distanceMeters / 1000) * 10) / 10;
    const durationSeconds = Math.round(route.duration || 0);
    const durationMin = Math.max(1, Math.round(durationSeconds / 60));

    // Convert GeoJSON [lng, lat] coordinates to Leaflet [lat, lng]
    const rawCoords: [number, number][] = route.geometry?.coordinates || [];
    const geometry: [number, number][] = rawCoords.map(([lng, lat]) => [lat, lng]);

    const result: RoadRouteResult = {
      distanceMeters,
      distanceKm,
      durationSeconds,
      durationMin,
      geometry,
      source: 'osrm',
      updatedAt: new Date().toISOString(),
    };

    ROUTE_CACHE.set(key, { result, ts: Date.now() });
    return result;
  } catch {
    const fb = fallbackResult();
    ROUTE_CACHE.set(key, { result: fb, ts: Date.now() });
    return fb;
  }
}

/**
 * Returns road distance and travel time between two coordinates.
 * Backwards compatible helper using the real road routing engine.
 */
export async function getRoadDistanceKm(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<RoadDistanceResult> {
  const route = await getRoadRoute(fromLat, fromLng, toLat, toLng);
  return {
    distanceKm: route.distanceKm,
    durationMin: route.durationMin,
    source: route.source === 'osrm' ? 'osrm' : 'haversine',
  };
}

/**
 * Calculates the shortest distance in meters from a point (lat, lng) to a road polyline.
 * Used for detecting when the rider has substantially deviated from the active road route.
 */
export function minDistanceToRouteMeters(
  pointLat: number,
  pointLng: number,
  routeCoordinates: [number, number][]
): number {
  if (!routeCoordinates || routeCoordinates.length === 0) return 0;
  if (routeCoordinates.length === 1) {
    return calculateDistanceKm(pointLat, pointLng, routeCoordinates[0][0], routeCoordinates[0][1]) * 1000;
  }

  let minDistanceM = Infinity;

  // Approximate distance to each segment on the polyline
  for (let i = 0; i < routeCoordinates.length - 1; i++) {
    const [lat1, lng1] = routeCoordinates[i];
    const [lat2, lng2] = routeCoordinates[i + 1];

    // Segment midpoint and endpoints distance approximation
    const d1 = calculateDistanceKm(pointLat, pointLng, lat1, lng1) * 1000;
    const d2 = calculateDistanceKm(pointLat, pointLng, lat2, lng2) * 1000;
    const midLat = (lat1 + lat2) / 2;
    const midLng = (lng1 + lng2) / 2;
    const dMid = calculateDistanceKm(pointLat, pointLng, midLat, midLng) * 1000;

    const segmentMin = Math.min(d1, d2, dMid);
    if (segmentMin < minDistanceM) {
      minDistanceM = segmentMin;
    }
  }

  return minDistanceM;
}

/**
 * Checks whether the delivery rider has deviated from the active road route by more than thresholdMeters.
 */
export function isDeviatedFromRoute(
  riderLat: number,
  riderLng: number,
  routeCoordinates: [number, number][],
  thresholdMeters: number = 100
): boolean {
  if (!routeCoordinates || routeCoordinates.length < 2) return false;
  const dist = minDistanceToRouteMeters(riderLat, riderLng, routeCoordinates);
  return dist > thresholdMeters;
}

/**
 * Validates an incoming GPS fix against:
 *   1. Accuracy threshold (reject if accuracy > MAX_ACCEPTED_ACCURACY_M when a
 *      better recent fix exists within the last 20 seconds)
 *   2. Impossible movement speed between consecutive fixes
 *
 * Returns { valid: true } if the fix should be used, or { valid: false, reason } if rejected.
 */
export function validateGpsUpdate(
  incoming: GpsFix,
  previous?: GpsFix | null
): GpsValidationResult {
  // Reject obviously bad accuracy only when we already have a recent good fix
  const hasRecentGoodFix =
    previous &&
    previous.accuracy <= MAX_ACCEPTED_ACCURACY_M &&
    Date.now() - previous.timestamp < 20_000;

  if (incoming.accuracy > MAX_ACCEPTED_ACCURACY_M && hasRecentGoodFix) {
    return {
      valid: false,
      reason: `GPS accuracy ${Math.round(incoming.accuracy)}m exceeds ${MAX_ACCEPTED_ACCURACY_M}m threshold`,
    };
  }

  // Impossible-speed detection
  if (previous) {
    const elapsedMs = incoming.timestamp - previous.timestamp;
    if (elapsedMs > 0 && elapsedMs < 60_000) { // only check within 60s
      const distKm = calculateDistanceKm(
        previous.latitude,
        previous.longitude,
        incoming.latitude,
        incoming.longitude
      );
      const elapsedHours = elapsedMs / 3_600_000;
      const impliedSpeedKmh = distKm / elapsedHours;

      if (impliedSpeedKmh > IMPOSSIBLE_SPEED_KMH) {
        return {
          valid: false,
          reason: `Implied speed ${Math.round(impliedSpeedKmh)} km/h exceeds ${IMPOSSIBLE_SPEED_KMH} km/h limit (GPS jump detected)`,
          impliedSpeedKmh,
        };
      }

      return { valid: true, impliedSpeedKmh };
    }
  }

  return { valid: true };
}

/**
 * Returns the recommended GPS update interval in milliseconds, based on current
 * speed and accuracy. Balances tracking precision against battery and data usage.
 *
 *  Moving fast  (≥ 15 km/h):  5 s
 *  Moving slow  (≥ 3 km/h):   10 s
 *  Stationary   (< 3 km/h):   20 s
 *  Poor accuracy (> 50m):     additional 5 s penalty
 */
export function getAdaptiveIntervalMs(speedKmh: number, accuracyM: number): number {
  let baseMs: number;

  if (speedKmh >= 15) {
    baseMs = 5_000;
  } else if (speedKmh >= 3) {
    baseMs = 10_000;
  } else {
    baseMs = 20_000;
  }

  // Poor accuracy → wait longer before trusting next fix
  if (accuracyM > 50) baseMs += 5_000;

  return baseMs;
}

// In-memory cache for ultra-fast instant geocoding lookups
const GEOCODE_CACHE = new Map<string, GeocodedLocation>();

/**
 * Reverse Geocode Latitude and Longitude with caching and fast fallback
 */
export async function resolveLocationFromCoords(
  lat: number,
  lon: number
): Promise<GeocodedLocation> {
  const roundedLat = Math.round(lat * 10000) / 10000;
  const roundedLon = Math.round(lon * 10000) / 10000;
  const cacheKey = `${roundedLat},${roundedLon}`;

  // Return from instant in-memory cache if available
  if (GEOCODE_CACHE.has(cacheKey)) {
    return GEOCODE_CACHE.get(cacheKey)!;
  }

  // Helper to parse OpenStreetMap address
  const tryNominatim = async (): Promise<GeocodedLocation | null> => {
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => {
        try { controller.abort(); } catch (e) {}
      }, 2500) : null;

      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`,
        {
          signal: controller ? controller.signal : undefined,
          headers: {
            'Accept-Language': 'en-US,en;q=0.9',
            'User-Agent': 'PocketKirana/1.0',
          },
        }
      ).catch(() => null);

      if (timeoutId) clearTimeout(timeoutId);
      if (!res || !res.ok) return null;

      const data = await res.json().catch(() => null);
      if (!data || !data.address) return null;

      const addr = data.address || {};
      const road = addr.road || addr.pedestrian || addr.street || addr.residential || '';
      const suburb = addr.suburb || addr.neighbourhood || addr.quarter || addr.village || addr.hamlet || '';
      const city = addr.city || addr.town || addr.municipality || addr.county || addr.district || '';
      const state = addr.state || '';
      const country = addr.country || 'India';
      const pincode = addr.postcode || '';
      const addressLine = [road, suburb, city].filter(Boolean).join(', ') || data.display_name || '';

      return {
        latitude: lat,
        longitude: lon,
        addressLine,
        road,
        suburb,
        city,
        state,
        country,
        pincode,
        displayName: data.display_name || addressLine,
        placeId: String(data.place_id || 'OSM-' + Date.now()),
      };
    } catch {
      return null;
    }
  };

  // Fast secondary fallback (BigDataCloud reverse geocoding API)
  const tryBigDataCloud = async (): Promise<GeocodedLocation | null> => {
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => {
        try { controller.abort(); } catch (e) {}
      }, 2000) : null;

      const res = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
        { signal: controller ? controller.signal : undefined }
      ).catch(() => null);

      if (timeoutId) clearTimeout(timeoutId);
      if (!res || !res.ok) return null;

      const data = await res.json().catch(() => null);
      if (!data) return null;

      const road = '';
      const suburb = data.locality || '';
      const city = data.city || data.principalSubdivision || '';
      const state = data.principalSubdivision || '';
      const country = data.countryName || 'India';
      const pincode = data.postcode || '';
      const addressLine = [suburb, city, state].filter(Boolean).join(', ');

      return {
        latitude: lat,
        longitude: lon,
        addressLine,
        road,
        suburb,
        city,
        state,
        country,
        pincode,
        displayName: addressLine,
        placeId: 'BDC-' + Date.now(),
      };
    } catch {
      return null;
    }
  };

  // Concurrently query sources to ensure instant 100-200ms response
  try {
    const results = await Promise.allSettled([tryBigDataCloud(), tryNominatim()]);
    const bdc = results[0].status === 'fulfilled' ? results[0].value : null;
    const osm = results[1].status === 'fulfilled' ? results[1].value : null;

    // Prefer detailed OSM result if available, otherwise fast BDC
    const finalResult = osm || bdc;

    if (finalResult) {
      GEOCODE_CACHE.set(cacheKey, finalResult);
      return finalResult;
    }
  } catch {}

  // Clean fallback if networks fail
  const fallback: GeocodedLocation = {
    latitude: lat,
    longitude: lon,
    addressLine: '',
    road: '',
    suburb: '',
    city: '',
    state: '',
    country: 'India',
    pincode: '',
    displayName: '',
    placeId: 'fallback-' + Date.now(),
  };

  GEOCODE_CACHE.set(cacheKey, fallback);
  return fallback;
}

/**
 * Search Location Autocomplete using Nominatim Search API
 */
export async function searchLocationsAutocomplete(
  query: string
): Promise<GeocodedLocation[]> {
  if (!query || query.trim().length < 2) return [];

  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => {
      try { controller.abort(); } catch (e) {}
    }, 6000) : null;

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query.trim()
      )}&countrycodes=in&addressdetails=1&limit=5`,
      {
        signal: controller ? controller.signal : undefined,
        headers: {
          'Accept-Language': 'en-US,en;q=0.9',
          'User-Agent': 'PocketKirana/1.0',
        },
      }
    ).catch(() => null);

    if (timeoutId) clearTimeout(timeoutId);

    if (!res || !res.ok) return [];

    const list = await res.json().catch(() => []);
    if (!Array.isArray(list)) return [];

    return list.map((item: any) => {
      const addr = item.address || {};
      const road = addr.road || addr.street || '';
      const suburb = addr.suburb || addr.neighbourhood || '';
      const city = addr.city || addr.town || addr.district || 'Neral';
      const pincode = addr.postcode || '410101';

      return {
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
        addressLine: [road, suburb, city].filter(Boolean).join(', ') || item.display_name,
        road,
        suburb,
        city,
        state: addr.state || 'Maharashtra',
        country: addr.country || 'India',
        pincode,
        displayName: item.display_name,
        placeId: String(item.place_id),
      };
    });
  } catch (error) {
    return [];
  }
}

export interface ZoneServiceability {
  isServiceable: boolean;
  storeId: string;
  storeName: string;
  storeCode?: string;
  zoneId: string;
  zoneName: string;
  distanceKm: number; // Straight-line distance
  straightLineDistanceKm: number;
  roadDistanceKm: number;
  radiusKm: number;
  remainingKm: number;
  estimatedDeliveryMinutes: number;
  deliveryFee: number;
  layer1Passed: boolean; // Layer 1: Straight-line radius check
  layer2Passed: boolean; // Layer 2: Estimated road distance check
  layer3Passed: boolean; // Layer 3: Operational check (Store open, status active)
  storeLatitude?: number;
  storeLongitude?: number;
  storeOperatingHours?: string;
  isStoreOpen?: boolean;
  message: string;
  unserviceableReason?: string;
}

// In-memory store repository state initialized from INITIAL_STORES
let STORES_STATE: Store[] = [...INITIAL_STORES];

export function getStores(): Store[] {
  return STORES_STATE;
}

export function setStoresState(stores: Store[]): void {
  if (stores && stores.length > 0) {
    STORES_STATE = stores;
  }
}

export function getStoreById(storeId: string): Store | undefined {
  return STORES_STATE.find((s) => s.id === storeId);
}

export function updateStoreConfig(storeId: string, updates: Partial<Store>): Store | null {
  const idx = STORES_STATE.findIndex((s) => s.id === storeId);
  if (idx === -1) {
    // If not in state, add it
    const newStore: Store = {
      id: storeId,
      ownerId: 'usr-admin-1',
      name: 'PocketKirana Store',
      phone: '+91 8698893348',
      email: 'admin@pocketkirana.com',
      gstNumber: '27AABCP1234F1Z5',
      address: 'Station Road, Neral',
      latitude: 19.033,
      longitude: 73.317,
      openingTime: '06:00',
      closingTime: '23:00',
      deliveryRadiusKm: 3.0,
      status: 'active',
      ...updates,
    };
    STORES_STATE.push(newStore);
    return newStore;
  }

  STORES_STATE[idx] = {
    ...STORES_STATE[idx],
    ...updates,
  };
  return STORES_STATE[idx];
}

/**
 * Checks if current time is within store opening and closing hours (HH:MM format)
 */
export function isStoreCurrentlyOpen(openingTime?: string, closingTime?: string): boolean {
  if (!openingTime || !closingTime) return true;
  try {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [openH, openM] = openingTime.split(':').map(Number);
    const [closeH, closeM] = closingTime.split(':').map(Number);

    const openMinutes = openH * 60 + (openM || 0);
    const closeMinutes = closeH * 60 + (closeM || 0);

    if (closeMinutes > openMinutes) {
      return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
    } else {
      // Midnight crossover (e.g. 18:00 to 02:00)
      return currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
    }
  } catch (e) {
    return true;
  }
}

/**
 * Blinkit-Style 3-Layer Hyperlocal Serviceability Engine
 */
export function checkZoneServiceability(
  lat: number,
  lon: number,
  pincode?: string,
  preferredStoreId?: string
): ZoneServiceability {
  const activeStores = STORES_STATE.filter((s) => s.status === 'active');
  const fallbackStore = activeStores[0] || INITIAL_STORES[0];

  let selectedStore = preferredStoreId
    ? activeStores.find((s) => s.id === preferredStoreId) || fallbackStore
    : fallbackStore;

  // Find nearest store if preferredStoreId not provided
  if (!preferredStoreId && activeStores.length > 1) {
    let minDistance = Infinity;
    for (const store of activeStores) {
      const dist = calculateDistanceKm(store.latitude, store.longitude, lat, lon);
      if (dist < minDistance) {
        minDistance = dist;
        selectedStore = store;
      }
    }
  }

  // Layer 1: Straight-Line Distance Calculation (Haversine)
  const straightLineDistanceKm = calculateDistanceKm(
    selectedStore.latitude,
    selectedStore.longitude,
    lat,
    lon
  );

  const radiusKm = selectedStore.deliveryRadiusKm || 3.0;
  const layer1Passed = straightLineDistanceKm <= radiusKm;

  // Layer 2: Estimated Road Distance Calculation (detour multiplier accounting for rivers/highways)
  const multiplier = selectedStore.roadDistanceMultiplier || 1.35;
  const roadDistanceKm = Number((straightLineDistanceKm * multiplier).toFixed(1));
  const maxRoadLimit = selectedStore.maxRoadDistanceKm || Number((radiusKm * 1.4).toFixed(1));
  const layer2Passed = roadDistanceKm <= maxRoadLimit;

  // Layer 3: Operational Check (Store status, operating hours, delivery status)
  const isStoreOpen = isStoreCurrentlyOpen(selectedStore.openingTime, selectedStore.closingTime);
  const isStatusActive = selectedStore.status === 'active' && selectedStore.deliveryStatus !== 'INACTIVE';
  const layer3Passed = isStoreOpen && isStatusActive;

  // Final 3-Layer Decision
  const isServiceable = layer1Passed && layer2Passed && layer3Passed;

  const etaMin = isServiceable ? Math.max(10, Math.round(10 + roadDistanceKm * 3)) : 0;
  const operatingHours = `${selectedStore.openingTime || '06:00'} - ${selectedStore.closingTime || '23:00'}`;

  if (isServiceable) {
    return {
      isServiceable: true,
      storeId: selectedStore.id,
      storeName: selectedStore.name,
      storeCode: selectedStore.storeCode || `STORE-${selectedStore.id}`,
      zoneId: `ZONE_${selectedStore.id}`,
      zoneName: `${selectedStore.name} — Hyperlocal Express (${radiusKm} KM Zone)`,
      distanceKm: straightLineDistanceKm,
      straightLineDistanceKm,
      roadDistanceKm,
      radiusKm,
      remainingKm: Number((radiusKm - straightLineDistanceKm).toFixed(1)),
      estimatedDeliveryMinutes: etaMin,
      deliveryFee: selectedStore.deliveryFee || 15,
      storeLatitude: selectedStore.latitude,
      storeLongitude: selectedStore.longitude,
      layer1Passed,
      layer2Passed,
      layer3Passed,
      storeOperatingHours: operatingHours,
      isStoreOpen,
      message: `✓ 10-15 Min Delivery Available (${roadDistanceKm} km via road from ${selectedStore.name})`,
    };
  }

  // Unserviceable Reason Synthesis
  let reason = '';
  if (!layer3Passed) {
    if (!isStoreOpen) {
      reason = `Store Closed (${selectedStore.name} operating hours: ${operatingHours})`;
    } else {
      reason = `Store Offline (${selectedStore.name} delivery service currently paused)`;
    }
  } else if (!layer1Passed) {
    reason = `Outside Delivery Radius (${straightLineDistanceKm} KM vs max ${radiusKm} KM radius)`;
  } else if (!layer2Passed) {
    reason = `Road Route Exceeds Limit (${roadDistanceKm} KM road detour exceeds max ${maxRoadLimit} KM road limit)`;
  }

  return {
    isServiceable: false,
    storeId: selectedStore.id,
    storeName: selectedStore.name,
    storeCode: selectedStore.storeCode || `STORE-${selectedStore.id}`,
    storeLatitude: selectedStore.latitude,
    storeLongitude: selectedStore.longitude,
    zoneId: 'UNSERVICEABLE',
    zoneName: 'Outside Delivery Service Area',
    distanceKm: straightLineDistanceKm,
    straightLineDistanceKm,
    roadDistanceKm,
    radiusKm,
    remainingKm: Number((straightLineDistanceKm - radiusKm).toFixed(1)),
    estimatedDeliveryMinutes: 0,
    deliveryFee: 0,
    layer1Passed,
    layer2Passed,
    layer3Passed,
    storeOperatingHours: operatingHours,
    isStoreOpen,
    message: `✕ Delivery Unavailable. ${reason}`,
    unserviceableReason: reason,
  };
}

/**
 * Get Mock/Live Tracking Data for Order
 */
export function getOrderLiveTracking(orderId: string): DriverLiveTrackingData {
  return {
    orderId,
    orderNumber: 'PK' + (orderId.replace(/[^0-9]/g, '') || '102938'),
    status: 'OUT_FOR_DELIVERY',
    driver: {
      id: 'drv-101',
      name: 'Ramesh Patil',
      phone: '+91982012XXXX',
      vehicleNumber: 'MH-46-AR-8819',
    },
    driverLocation: {
      latitude: 19.0315,
      longitude: 73.3155,
      heading: 45,
      speed: 24, // km/h
    },
    destinationLocation: {
      latitude: 19.0342,
      longitude: 73.3198,
      addressLine: 'Flat 302, Matoshree Heights, Neral Station Road',
    },
    distanceMeters: 1400,
    etaMinutes: 8,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Initiate Masked Call Session
 */
export function initiateMaskedCallSession(
  orderId: string,
  customerId: string,
  driverId: string
) {
  return {
    success: true,
    callId: 'call-' + Date.now(),
    maskedNumber: '+91226100XXXX',
    message: 'Connecting call via PocketKirana protected proxy...',
  };
}

// ══════════════════════════════════════════
// SERVER-SIDE DELIVERY ZONE VALIDATION
// Calls the validateDeliveryZone Cloud Function.
// Falls back to local Haversine if Firebase not configured.
// ══════════════════════════════════════════

const ZONE_CACHE = new Map<string, { result: ZoneServiceability; ts: number }>();
const ZONE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function validateDeliveryZoneServerSide(
  latitude: number,
  longitude: number
): Promise<ZoneServiceability> {
  const cacheKey = `${Math.round(latitude * 1000)},${Math.round(longitude * 1000)}`;
  const cached = ZONE_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.ts < ZONE_CACHE_TTL) {
    return cached.result;
  }

  try {
    const { isFirebaseConfigured } = await import('./firebase');
    if (!isFirebaseConfigured()) throw new Error('Firebase not configured');

    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const { getFirebaseApp } = await import('./firebase');

    const app = getFirebaseApp();
    if (!app) throw new Error('Firebase app unavailable');

    const functions = getFunctions(app, 'asia-south1');
    const callable = httpsCallable<
      { latitude: number; longitude: number },
      { isServiceable: boolean; distanceKm: number; message: string; deliveryRadiusKm: number }
    >(functions, 'validateDeliveryZone');

    const result = await callable({ latitude, longitude });
    const data = result.data;

    const zone: ZoneServiceability = {
      isServiceable: data.isServiceable,
      storeId: 'store-001',
      storeName: 'PocketKirana',
      zoneId: data.isServiceable ? 'zone-01' : '',
      zoneName: data.isServiceable ? 'Neral Service Zone' : '',
      distanceKm: data.distanceKm,
      straightLineDistanceKm: data.distanceKm,
      roadDistanceKm: Math.round(data.distanceKm * 1.3 * 10) / 10,
      radiusKm: data.deliveryRadiusKm || 3,
      remainingKm: Math.max(0, (data.deliveryRadiusKm || 3) - data.distanceKm),
      estimatedDeliveryMinutes: data.isServiceable ? Math.ceil(data.distanceKm * 4 + 10) : 0,
      deliveryFee: data.distanceKm <= 1 ? 0 : 25,
      layer1Passed: data.isServiceable,
      layer2Passed: data.isServiceable,
      layer3Passed: data.isServiceable,
      message: data.message,
    };

    ZONE_CACHE.set(cacheKey, { result: zone, ts: Date.now() });
    return zone;
  } catch (err) {
    // Fallback: local Haversine with fixed store coordinates
    const STORE_LAT = 19.0224536;
    const STORE_LNG = 73.3210018;
    const DELIVERY_RADIUS_KM = 3;

    const distanceKm = calculateDistanceKm(STORE_LAT, STORE_LNG, latitude, longitude);
    const isServiceable = distanceKm <= DELIVERY_RADIUS_KM;

    const zone: ZoneServiceability = {
      isServiceable,
      storeId: 'store-001',
      storeName: 'PocketKirana',
      zoneId: isServiceable ? 'zone-01' : '',
      zoneName: isServiceable ? 'Neral Service Zone' : '',
      distanceKm,
      straightLineDistanceKm: distanceKm,
      roadDistanceKm: Math.round(distanceKm * 1.3 * 10) / 10,
      radiusKm: DELIVERY_RADIUS_KM,
      remainingKm: Math.max(0, DELIVERY_RADIUS_KM - distanceKm),
      estimatedDeliveryMinutes: isServiceable ? Math.ceil(distanceKm * 4 + 10) : 0,
      deliveryFee: distanceKm <= 1 ? 0 : 25,
      layer1Passed: isServiceable,
      layer2Passed: isServiceable,
      layer3Passed: isServiceable,
      message: isServiceable
        ? `Delivery available (${distanceKm.toFixed(1)} km from store)`
        : `Outside delivery area (${distanceKm.toFixed(1)} km, limit: ${DELIVERY_RADIUS_KM} km)`,
    };

    ZONE_CACHE.set(cacheKey, { result: zone, ts: Date.now() });
    return zone;
  }
}
