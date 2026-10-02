import { getPostgresPool } from './postgres';

export interface StoreOperationalSettings {
  id: string;
  name: string;
  code: string;
  latitude: number;
  longitude: number;
  isActive: boolean;
  deliveryRadiusKm: number;
  maxRoadDistanceKm: number;
  roadDistanceMultiplier: number;
  openingTime: string;
  closingTime: string;
  deliveryFee: number;
  freeDeliveryThreshold: number;
  minimumOrderValue: number;
}

export type ServiceabilityErrorCode =
  | 'INVALID_COORDINATES'
  | 'STORE_NOT_FOUND'
  | 'STORE_OFFLINE'
  | 'STORE_CLOSED'
  | 'MINIMUM_ORDER_VALUE_NOT_MET'
  | 'OUT_OF_SERVICE_AREA'
  | 'ROAD_LIMIT_EXCEEDED'
  | 'SERVICEABILITY_ERROR';

export interface ServiceabilityDecision {
  serviceable: boolean;
  code?: ServiceabilityErrorCode;
  error?: string;
  store?: StoreOperationalSettings;
  straightLineDistanceKm?: number;
  roadDistanceKm?: number;
  deliveryFee?: number;
  freeDeliveryThreshold?: number;
}

export interface EvaluateServiceabilityOptions {
  currentTime?: Date;
  bypassCache?: boolean;
}

// In-memory cache for store operational records (30s TTL)
interface CacheEntry {
  store: StoreOperationalSettings;
  timestamp: number;
}
const storeCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 1000;

export function clearStoreCache(): void {
  storeCache.clear();
}

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

/**
 * Checks whether the given date/time is within store operating hours.
 * Handles both regular hours (e.g. 06:00 - 23:00) and midnight crossovers (e.g. 20:00 - 02:00).
 */
export function isStoreWithinHours(
  openingTime: string,
  closingTime: string,
  now: Date = new Date()
): boolean {
  if (!openingTime || !closingTime) return true;
  try {
    const [openH, openM] = openingTime.split(':').map(Number);
    const [closeH, closeM] = closingTime.split(':').map(Number);

    if (isNaN(openH) || isNaN(closeH)) return true;

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const openMinutes = openH * 60 + (openM || 0);
    const closeMinutes = closeH * 60 + (closeM || 0);

    if (closeMinutes > openMinutes) {
      return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
    } else {
      // Midnight crossover
      return currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
    }
  } catch {
    return true;
  }
}

/**
 * Resolves store operational settings from PostgreSQL `stores` table.
 * Specifically resolves legacy 'store-001' to 'store_primary' via the existing 'STORE-001' code.
 * Fails closed for unknown/unrecognized store IDs.
 */
export async function getStoreOperationalSettings(
  storeId: string,
  options?: { bypassCache?: boolean }
): Promise<StoreOperationalSettings | null> {
  const normalizedId = (storeId || '').trim();
  if (!normalizedId) {
    return null;
  }

  const cacheKey = normalizedId.toLowerCase();
  if (!options?.bypassCache) {
    const cached = storeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.store;
    }
  }

  const pool = getPostgresPool();
  const query = `
    SELECT 
      id,
      name,
      code,
      latitude,
      longitude,
      is_active,
      delivery_radius_km,
      max_road_distance_km,
      road_distance_multiplier,
      opening_time,
      closing_time,
      delivery_fee,
      free_delivery_threshold,
      minimum_order_value
    FROM stores
    WHERE id = $1 OR UPPER(code) = UPPER($1)
    ORDER BY 
      CASE 
        WHEN id = $1 THEN 1
        WHEN UPPER(code) = UPPER($1) THEN 2
        ELSE 3
      END
    LIMIT 1;
  `;

  const res = await pool.query(query, [normalizedId]);
  if (!res.rows || res.rows.length === 0) {
    return null;
  }

  const row = res.rows[0];
  const settings: StoreOperationalSettings = {
    id: String(row.id),
    name: String(row.name || ''),
    code: String(row.code || ''),
    latitude: parseFloat(String(row.latitude)),
    longitude: parseFloat(String(row.longitude)),
    isActive: Boolean(row.is_active),
    deliveryRadiusKm: parseFloat(String(row.delivery_radius_km ?? 3.0)),
    maxRoadDistanceKm: parseFloat(String(row.max_road_distance_km ?? 4.5)),
    roadDistanceMultiplier: parseFloat(String(row.road_distance_multiplier ?? 1.35)),
    openingTime: String(row.opening_time || '06:00'),
    closingTime: String(row.closing_time || '23:00'),
    deliveryFee: parseInt(String(row.delivery_fee ?? 29), 10),
    freeDeliveryThreshold: parseInt(String(row.free_delivery_threshold ?? 499), 10),
    minimumOrderValue: parseInt(String(row.minimum_order_value ?? 199), 10),
  };

  storeCache.set(cacheKey, { store: settings, timestamp: Date.now() });
  return settings;
}

/**
 * Authoritative Server-Side Serviceability Evaluator for Checkout.
 *
 * Executes the strict multi-layer serviceability check:
 * 1. Coordinates validation (mandatory lat/lng within bounds)
 * 2. Store resolution from PostgreSQL (resolves store-001 -> STORE-001 -> store_primary)
 * 3. Store active status check (is_active)
 * 4. Operating hours check (opening_time - closing_time)
 * 5. Minimum order value check (subtotal >= minimum_order_value)
 * 6. Layer 1: Haversine straight-line distance check (<= delivery_radius_km)
 * 7. Layer 2: Estimated road detour distance check (<= max_road_distance_km)
 */
export async function evaluateServerServiceability(
  storeId: string | undefined,
  latInput: unknown,
  lngInput: unknown,
  subtotal: number,
  options?: EvaluateServiceabilityOptions
): Promise<ServiceabilityDecision> {
  // 1. Mandatory Coordinate Validation
  if (
    latInput === undefined ||
    latInput === null ||
    lngInput === undefined ||
    lngInput === null ||
    latInput === '' ||
    lngInput === ''
  ) {
    return {
      serviceable: false,
      code: 'INVALID_COORDINATES',
      error: 'Delivery coordinates (latitude and longitude) are required.',
    };
  }

  const lat = typeof latInput === 'number' ? latInput : parseFloat(String(latInput));
  const lng = typeof lngInput === 'number' ? lngInput : parseFloat(String(lngInput));

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return {
      serviceable: false,
      code: 'INVALID_COORDINATES',
      error: 'Invalid coordinates provided. Latitude must be between -90 and 90, longitude between -180 and 180.',
    };
  }

  // 2. Resolve Store Operational Settings from PostgreSQL
  if (!storeId || typeof storeId !== 'string') {
    return {
      serviceable: false,
      code: 'STORE_NOT_FOUND',
      error: 'A valid store ID is required.',
    };
  }

  const store = await getStoreOperationalSettings(storeId, { bypassCache: options?.bypassCache });

  if (!store) {
    return {
      serviceable: false,
      code: 'STORE_NOT_FOUND',
      error: `Store '${storeId}' was not found or is not configured for delivery.`,
    };
  }

  // 3. Store Active Status Check
  if (!store.isActive) {
    return {
      serviceable: false,
      code: 'STORE_OFFLINE',
      error: `Store '${store.name}' is currently offline. Delivery is temporarily paused.`,
      store,
    };
  }

  // 4. Operating Hours Check
  const effectiveTime = options?.currentTime || new Date();
  const isOpen = isStoreWithinHours(store.openingTime, store.closingTime, effectiveTime);
  if (!isOpen) {
    return {
      serviceable: false,
      code: 'STORE_CLOSED',
      error: `Store '${store.name}' is currently closed. Operating hours are ${store.openingTime} to ${store.closingTime}.`,
      store,
    };
  }

  // 5. Minimum Order Value Check
  if (subtotal < store.minimumOrderValue) {
    return {
      serviceable: false,
      code: 'MINIMUM_ORDER_VALUE_NOT_MET',
      error: `Minimum order value for ${store.name} is ₹${store.minimumOrderValue}. Current order subtotal is ₹${subtotal}.`,
      store,
    };
  }

  // 6. Layer 1: Straight-Line Haversine Distance Check
  const straightLineDistanceKm = calculateDistanceKm(
    store.latitude,
    store.longitude,
    lat,
    lng
  );

  if (straightLineDistanceKm > store.deliveryRadiusKm) {
    return {
      serviceable: false,
      code: 'OUT_OF_SERVICE_AREA',
      error: `Delivery address is ${straightLineDistanceKm} km from ${store.name}, which exceeds the maximum delivery radius of ${store.deliveryRadiusKm} km.`,
      store,
      straightLineDistanceKm,
    };
  }

  // 7. Layer 2: Estimated Road Detour Distance Check
  const roadDistanceKm = Number(
    (straightLineDistanceKm * store.roadDistanceMultiplier).toFixed(1)
  );

  if (roadDistanceKm > store.maxRoadDistanceKm) {
    return {
      serviceable: false,
      code: 'ROAD_LIMIT_EXCEEDED',
      error: `Estimated road distance (${roadDistanceKm} km) exceeds the maximum allowed road limit of ${store.maxRoadDistanceKm} km for ${store.name}.`,
      store,
      straightLineDistanceKm,
      roadDistanceKm,
    };
  }

  // Authoritative Delivery Fee & Threshold resolution from the Store
  const deliveryFee = subtotal >= store.freeDeliveryThreshold ? 0 : store.deliveryFee;

  return {
    serviceable: true,
    store,
    straightLineDistanceKm,
    roadDistanceKm,
    deliveryFee,
    freeDeliveryThreshold: store.freeDeliveryThreshold,
  };
}
