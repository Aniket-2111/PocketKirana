import { getPostgresPool } from './postgres';

export interface DeliveryFeeTier {
  minSubtotal: number;
  maxSubtotal: number | null;
  fee: number;
}

export interface StoreOperationalSettings {
  id: string;
  name: string;
  code: string;
  latitude: number;
  longitude: number;
  isActive: boolean;
  deliveryRadiusKm: number;
  openingTime: string;
  closingTime: string;
  deliveryFee: number;
  freeDeliveryEnabled: boolean;
  freeDeliveryThreshold: number;
  deliveryFeeTiers: DeliveryFeeTier[];
  /** @deprecated Retired in Migration 002 & Phase 2.7C.1 (minimum order requirement removed) */
  minimumOrderValue?: number;
  /** @deprecated Decommissioned in Phase 2.7C.1 in favor of pure Haversine distance */
  maxRoadDistanceKm?: number;
  /** @deprecated Decommissioned in Phase 2.7C.1 in favor of pure Haversine distance */
  roadDistanceMultiplier?: number;
}

export type ServiceabilityErrorCode =
  | 'INVALID_COORDINATES'
  | 'STORE_NOT_FOUND'
  | 'STORE_OFFLINE'
  | 'STORE_CLOSED'
  | 'OUT_OF_SERVICE_AREA'
  | 'SERVICEABILITY_ERROR'
  /** @deprecated Retired in Phase 2.7C.1 */
  | 'MINIMUM_ORDER_VALUE_NOT_MET'
  /** @deprecated Retired in Phase 2.7C.1 */
  | 'ROAD_LIMIT_EXCEEDED';

export interface ServiceabilityDecision {
  serviceable: boolean;
  code?: ServiceabilityErrorCode;
  error?: string;
  store?: StoreOperationalSettings;
  straightLineDistanceKm?: number;
  /** @deprecated Decommissioned in Phase 2.7C.1 */
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
 * Resolves the delivery fee according to Phase 2.7 authoritative rules:
 * 1. Free delivery: if freeDeliveryEnabled is true AND subtotal >= freeDeliveryThreshold -> fee = 0
 * 2. Populated delivery tiers: if deliveryFeeTiers is non-empty, matches minSubtotal <= subtotal <= maxSubtotal
 * 3. Fallback: if deliveryFeeTiers is empty or unmatched, falls back to store.deliveryFee
 * Monetary precision: preserves 2 decimal places (Math.round(val * 100) / 100).
 */
export function resolveDeliveryFee(
  store: {
    freeDeliveryEnabled: boolean;
    freeDeliveryThreshold: number;
    deliveryFee: number;
    deliveryFeeTiers?: DeliveryFeeTier[];
  },
  subtotal: number
): number {
  const cleanSubtotal = Math.max(0, typeof subtotal === 'number' && !isNaN(subtotal) ? subtotal : 0);

  // 1. FREE DELIVERY GATE (Highest Priority)
  // Waives fee ONLY if explicitly enabled AND subtotal meets store threshold
  if (store.freeDeliveryEnabled && cleanSubtotal >= store.freeDeliveryThreshold) {
    return 0;
  }

  // 2. TIERED RESOLUTION (Evaluated only if tiers are populated in database)
  if (Array.isArray(store.deliveryFeeTiers) && store.deliveryFeeTiers.length > 0) {
    for (const tier of store.deliveryFeeTiers) {
      if (typeof tier.minSubtotal !== 'number' || typeof tier.fee !== 'number' || tier.fee < 0) {
        continue; // Skip malformed tier safely
      }

      const meetsMin = cleanSubtotal >= tier.minSubtotal;
      const meetsMax = tier.maxSubtotal === null || cleanSubtotal <= tier.maxSubtotal;

      if (meetsMin && meetsMax) {
        // Preserve 2-decimal monetary precision
        return Math.max(0, Math.round(tier.fee * 100) / 100);
      }
    }
  }

  // 3. CANONICAL FALLBACK
  // Used when tiers array is empty ([]) or no tier matched.
  // Safely returns that store's configured delivery_fee column with 2-decimal precision.
  return Math.max(0, Math.round((store.deliveryFee ?? 0) * 100) / 100);
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
      opening_time,
      closing_time,
      delivery_fee,
      free_delivery_enabled,
      free_delivery_threshold,
      delivery_fee_tiers,
      minimum_order_value,
      max_road_distance_km,
      road_distance_multiplier
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

  let parsedTiers: DeliveryFeeTier[] = [];
  if (Array.isArray(row.delivery_fee_tiers)) {
    parsedTiers = row.delivery_fee_tiers;
  } else if (typeof row.delivery_fee_tiers === 'string') {
    try {
      const parsed = JSON.parse(row.delivery_fee_tiers);
      if (Array.isArray(parsed)) {
        parsedTiers = parsed;
      }
    } catch {
      parsedTiers = [];
    }
  }

  const rawDeliveryFee = parseFloat(String(row.delivery_fee ?? 0));
  const rawThreshold = parseFloat(String(row.free_delivery_threshold ?? 0));

  const settings: StoreOperationalSettings = {
    id: String(row.id),
    name: String(row.name || ''),
    code: String(row.code || ''),
    latitude: parseFloat(String(row.latitude)),
    longitude: parseFloat(String(row.longitude)),
    isActive: Boolean(row.is_active),
    deliveryRadiusKm: parseFloat(String(row.delivery_radius_km ?? 3.0)),
    openingTime: String(row.opening_time || '06:00'),
    closingTime: String(row.closing_time || '23:00'),
    deliveryFee: Math.max(0, Math.round(rawDeliveryFee * 100) / 100),
    freeDeliveryEnabled: Boolean(row.free_delivery_enabled),
    freeDeliveryThreshold: Math.max(0, Math.round(rawThreshold * 100) / 100),
    deliveryFeeTiers: parsedTiers,
    minimumOrderValue: 0,
    maxRoadDistanceKm: row.max_road_distance_km != null ? parseFloat(String(row.max_road_distance_km)) : undefined,
    roadDistanceMultiplier: row.road_distance_multiplier != null ? parseFloat(String(row.road_distance_multiplier)) : undefined,
  };

  storeCache.set(cacheKey, { store: settings, timestamp: Date.now() });
  return settings;
}

/**
 * Authoritative Server-Side Serviceability Evaluator for Checkout (Phase 2.7C.1).
 *
 * Executes the canonical serviceability check:
 * 1. Mandatory coordinates validation (lat/lng format, range, non-finite checks)
 * 2. Store resolution from PostgreSQL (resolves store-001 -> STORE-001 -> store_primary; fails closed on unknown)
 * 3. Store active status check (is_active)
 * 4. Operating hours check (opening_time - closing_time from PostgreSQL)
 * 5. Straight-line Haversine distance check (straightLineDistanceKm <= delivery_radius_km)
 *    - Allowed store radius values: 3 km, 4 km, 5 km
 *    - Exact boundary (distance === radius) is serviceable
 *    - Road distance, road multiplier, road cutoff (4.5 km / 6 km) DECOMMISSIONED
 *    - Minimum order requirement DECOMMISSIONED (subtotal < min order is NOT rejected)
 * 6. Authoritative Delivery Fee Resolution:
 *    - Evaluates store-specific freeDeliveryEnabled and freeDeliveryThreshold
 *    - Evaluates deliveryFeeTiers if populated
 *    - Falls back to store.deliveryFee with 2-decimal precision
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

  if (isNaN(lat) || !isFinite(lat) || isNaN(lng) || !isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
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

  // 5. Straight-Line Haversine Distance Check
  // Server calculates distance itself; store coordinates come from PostgreSQL.
  // Rule: straightLineDistanceKm <= delivery_radius_km
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

  // 6. Authoritative Delivery Fee Resolution
  const deliveryFee = resolveDeliveryFee(store, subtotal);

  return {
    serviceable: true,
    store,
    straightLineDistanceKm,
    deliveryFee,
    freeDeliveryThreshold: store.freeDeliveryThreshold,
  };
}
