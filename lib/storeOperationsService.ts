/**
 * PocketKirana — Single-Store / Darkstore Operational Optimization Service (v2.0.0)
 *
 * PostgreSQL Canonical Store Operations & Capacity Control:
 *   1. Store Status & Availability (OPEN, PAUSED, HIGH_DEMAND, CLOSED) -> `stores.is_active`
 *   2. Operating Hours Enforcement (opening_time, closing_time) -> `stores.opening_time`, `stores.closing_time`
 *   3. Delivery Radius & Geofencing (strictly 3.0, 4.0, or 5.0 km) -> `stores.delivery_radius_km`
 *   4. Delivery Fee & Free Delivery Threshold -> `stores.delivery_fee`, `stores.free_delivery_enabled`, `stores.free_delivery_threshold`
 *   5. Protected GPS Coordinates -> Guarded by `lib/coordinateProtection.ts`
 *   6. Persistent Audit Logging -> Written to PostgreSQL `audit_logs`
 *   7. Transitional Mirror -> Secondary write-through to Firestore `shops` collection
 */

import { getPostgresPool } from './postgres';
import { clearStoreCache } from './serverServiceability';
import { validateCoordinateModification } from './coordinateProtection';
import { saveShopConfigFS } from './firebaseServices';
import { randomUUID } from 'crypto';
import type { PoolClient } from 'pg';

export type StoreOperatingStatus = 'OPEN' | 'HIGH_DEMAND' | 'PAUSED' | 'CLOSED';

export interface AuthorizedStoreSummary {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  deliveryRadiusKm: number;
  deliveryFee: number;
}

export interface DarkstoreCapacityMetrics {
  storeId: string;
  storeName: string;
  status: StoreOperatingStatus;
  isOpenNow: boolean;
  openingTime: string; // "06:00"
  closingTime: string; // "23:00"
  deliveryRadiusKm: number;
  deliveryFee: number;
  freeDeliveryEnabled: boolean;
  freeDeliveryThreshold: number;
  latitude: number;
  longitude: number;
  address: string;
  deliveryFeeTiers: any[];
  maxActivePickingOrders: number;
  maxActivePackingOrders: number;
  currentActivePicking: number;
  currentActivePacking: number;
  currentOutForDelivery: number;
  pickingCapacityUtilization: number; // 0 - 100%
  packingCapacityUtilization: number; // 0 - 100%
  isFulfillmentSaturated: boolean;
  authorizedStores?: AuthorizedStoreSummary[];
}

export interface UpdateStoreOperationsParams {
  storeId?: string;
  status?: StoreOperatingStatus | 'active' | 'inactive' | 'maintenance';
  isActive?: boolean;
  name?: string;
  address?: string;
  openingTime?: string;
  closingTime?: string;
  deliveryRadiusKm?: number;
  deliveryFee?: number;
  freeDeliveryEnabled?: boolean;
  freeDeliveryThreshold?: number;
  deliveryFeeTiers?: any[];
  latitude?: number;
  longitude?: number;
  developerToken?: string;
  adminUid?: string;
  adminRole?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Checks whether the darkstore is currently open based on clock time and operational status.
 */
export function isStoreCurrentlyOpen(
  status: StoreOperatingStatus,
  openingTime = '06:00',
  closingTime = '23:00'
): boolean {
  if (status === 'CLOSED' || status === 'PAUSED') return false;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [openH, openM] = openingTime.split(':').map((x) => parseInt(x, 10));
  const [closeH, closeM] = closingTime.split(':').map((x) => parseInt(x, 10));

  const openMinutes = (openH || 0) * 60 + (openM || 0);
  const closeMinutes = (closeH || 0) * 60 + (closeM || 0);

  return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
}

/**
 * Fetches all stores an administrator is authorized to manage based on RBAC:
 * - 'admin': All stores from PostgreSQL `stores`.
 * - 'store_admin' / 'store_manager': Stores assigned via `admin_store_assignments`.
 */
export async function getAuthorizedStoresList(
  auth: { uid: string; role: string }
): Promise<AuthorizedStoreSummary[]> {
  const pool = getPostgresPool();

  if (auth.role === 'admin') {
    const res = await pool
      .query(
        `SELECT id, name, code, is_active, delivery_radius_km, delivery_fee
         FROM stores
         ORDER BY created_at ASC`
      )
      .catch(() => ({ rows: [] }));

    return (res.rows || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      isActive: r.is_active !== false,
      deliveryRadiusKm: parseFloat(r.delivery_radius_km || '3.0'),
      deliveryFee: parseFloat(r.delivery_fee || '29'),
    }));
  }

  if (auth.role === 'store_admin' || auth.role === 'store_manager') {
    const res = await pool
      .query(
        `SELECT s.id, s.name, s.code, s.is_active, s.delivery_radius_km, s.delivery_fee
         FROM stores s
         JOIN admin_store_assignments asa ON (asa.store_id = s.id OR UPPER(asa.store_id) = UPPER(s.code))
         LEFT JOIN admin_users au ON asa.admin_user_id = au.id
         WHERE (asa.admin_user_id = $1 OR au.firebase_uid = $1)
         ORDER BY s.created_at ASC`,
        [auth.uid]
      )
      .catch(() => ({ rows: [] }));

    return (res.rows || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      isActive: r.is_active !== false,
      deliveryRadiusKm: parseFloat(r.delivery_radius_km || '3.0'),
      deliveryFee: parseFloat(r.delivery_fee || '29'),
    }));
  }

  return [];
}

/**
 * Fetches canonical store operational settings and live fulfillment capacity from PostgreSQL.
 */
export async function getDarkstoreOperationalStatus(
  storeId = 'store_primary'
): Promise<DarkstoreCapacityMetrics> {
  const pool = getPostgresPool();

  // 1. Fetch store operational settings from PostgreSQL
  const storeRes = await pool
    .query(
      `SELECT 
         id, name, code, is_active, latitude, longitude,
         opening_time, closing_time, delivery_radius_km,
         delivery_fee, free_delivery_enabled, free_delivery_threshold,
         delivery_fee_tiers, address
       FROM stores 
       WHERE id = $1 OR UPPER(code) = UPPER($1)
       LIMIT 1`,
      [storeId]
    )
    .catch(() => ({ rows: [] }));

  let storeRow = storeRes.rows[0];
  if (!storeRow) {
    // Fallback to first store in table
    const fallbackRes = await pool
      .query(`SELECT * FROM stores ORDER BY created_at ASC LIMIT 1`)
      .catch(() => ({ rows: [] }));
    storeRow = fallbackRes.rows[0] || {};
  }

  const status: StoreOperatingStatus = storeRow.is_active === false ? 'CLOSED' : 'OPEN';
  const openingTime = storeRow.opening_time ? String(storeRow.opening_time).substring(0, 5) : '06:00';
  const closingTime = storeRow.closing_time ? String(storeRow.closing_time).substring(0, 5) : '23:00';
  const deliveryRadiusKm = parseFloat(storeRow.delivery_radius_km || '3.0');
  const deliveryFee = parseFloat(storeRow.delivery_fee || '15.0');
  const freeDeliveryEnabled = storeRow.free_delivery_enabled !== false;
  const freeDeliveryThreshold = parseFloat(storeRow.free_delivery_threshold || '499.0');
  const latitude = parseFloat(storeRow.latitude || '19.0224536');
  const longitude = parseFloat(storeRow.longitude || '73.3210018');
  const address = storeRow.address || '';
  const deliveryFeeTiers = Array.isArray(storeRow.delivery_fee_tiers) ? storeRow.delivery_fee_tiers : [];

  // 2. Fetch live active queue counts from orders, picking, and delivery tables
  const queueRes = await pool
    .query(
      `SELECT
         (SELECT COUNT(*) FROM picking_tasks WHERE status IN ('pending', 'in_progress', 'assigned')) as active_picking,
         (SELECT COUNT(*) FROM packing_tasks WHERE status IN ('pending', 'in_progress')) as active_packing,
         (SELECT COUNT(*) FROM delivery_assignments WHERE status IN ('assigned', 'accepted', 'out_for_delivery')) as active_delivery`
    )
    .catch(() => ({ rows: [{ active_picking: 0, active_packing: 0, active_delivery: 0 }] }));

  const activePicking = parseInt(queueRes.rows[0]?.active_picking || '0', 10);
  const activePacking = parseInt(queueRes.rows[0]?.active_packing || '0', 10);
  const activeDelivery = parseInt(queueRes.rows[0]?.active_delivery || '0', 10);

  const maxActivePickingOrders = 20;
  const maxActivePackingOrders = 15;

  const pickingCapacityUtilization = Math.min(100, Math.round((activePicking / maxActivePickingOrders) * 100));
  const packingCapacityUtilization = Math.min(100, Math.round((activePacking / maxActivePackingOrders) * 100));
  const isFulfillmentSaturated = pickingCapacityUtilization >= 95 || packingCapacityUtilization >= 95;

  const isOpenNow = isStoreCurrentlyOpen(status, openingTime, closingTime);

  return {
    storeId: storeRow.id || storeId,
    storeName: storeRow.name || 'PocketKirana Central Darkstore',
    status,
    isOpenNow,
    openingTime,
    closingTime,
    deliveryRadiusKm,
    deliveryFee,
    freeDeliveryEnabled,
    freeDeliveryThreshold,
    latitude,
    longitude,
    address,
    deliveryFeeTiers,
    maxActivePickingOrders,
    maxActivePackingOrders,
    currentActivePicking: activePicking,
    currentActivePacking: activePacking,
    currentOutForDelivery: activeDelivery,
    pickingCapacityUtilization,
    packingCapacityUtilization,
    isFulfillmentSaturated,
  };
}

/**
 * Updates operational controls for a store in canonical PostgreSQL.
 * Strictly enforces schema constraints, coordinate immutability, and persistent audit logging.
 */
export async function updateDarkstoreOperations(params: UpdateStoreOperationsParams): Promise<void> {
  const pool = getPostgresPool();
  const rawStoreId = params.storeId || 'store_primary';

  // 1. Fetch current canonical store record
  const checkRes = await pool.query(
    `SELECT * FROM stores WHERE id = $1 OR UPPER(code) = UPPER($1) LIMIT 1`,
    [rawStoreId]
  );

  if (!checkRes.rows || checkRes.rows.length === 0) {
    throw new Error(`Store not found: ${rawStoreId}`);
  }

  const existing = checkRes.rows[0];
  const targetId = existing.id;

  // 2. Validate Delivery Radius (Must strictly be 3.0, 4.0, or 5.0 km per CHECK constraint)
  if (params.deliveryRadiusKm !== undefined) {
    const r = Number(params.deliveryRadiusKm);
    if (![3, 3.0, 4, 4.0, 5, 5.0].includes(r)) {
      throw new Error(`Invalid delivery radius: ${params.deliveryRadiusKm} km. Allowed canonical values are 3.0, 4.0, or 5.0 km.`);
    }
  }

  // 3. Validate Operating Hours
  const effectiveOpening = params.openingTime
    ? params.openingTime.trim().substring(0, 5)
    : existing.opening_time ? String(existing.opening_time).substring(0, 5) : '06:00';
  const effectiveClosing = params.closingTime
    ? params.closingTime.trim().substring(0, 5)
    : existing.closing_time ? String(existing.closing_time).substring(0, 5) : '23:00';

  const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!timeRegex.test(effectiveOpening) || !timeRegex.test(effectiveClosing)) {
    throw new Error('Invalid operating hours format: must be HH:MM.');
  }

  if (effectiveOpening >= effectiveClosing) {
    throw new Error('Opening time must be strictly before closing time.');
  }

  // 4. Validate Delivery Fee
  if (params.deliveryFee !== undefined) {
    const fee = Number(params.deliveryFee);
    if (isNaN(fee) || fee < 0) {
      throw new Error('Delivery fee must be a non-negative number.');
    }
  }

  // 5. Validate Free Delivery Threshold
  if (params.freeDeliveryThreshold !== undefined) {
    const threshold = Number(params.freeDeliveryThreshold);
    if (isNaN(threshold) || threshold < 0) {
      throw new Error('Free delivery threshold must be a non-negative number.');
    }
  }

  // 6. Coordinate Protection Verification
  const coordCheck = validateCoordinateModification({
    existingLat: parseFloat(existing.latitude),
    existingLng: parseFloat(existing.longitude),
    newLat: params.latitude,
    newLng: params.longitude,
    developerToken: params.developerToken,
    targetStoreId: targetId,
  });

  if (!coordCheck.authorized) {
    throw new Error(coordCheck.error || 'STORE_COORDINATES_PROTECTED: Coordinates cannot be modified by standard administrators.');
  }

  // 7. Resolve Active Status
  let finalIsActive: boolean = existing.is_active;
  if (params.isActive !== undefined) {
    finalIsActive = Boolean(params.isActive);
  } else if (params.status !== undefined) {
    finalIsActive =
      params.status === 'OPEN' ||
      params.status === 'HIGH_DEMAND' ||
      params.status === 'active';
  }

  // 8. Prepare Updated Field Values
  const finalName = params.name?.trim() || existing.name;
  const finalAddress = params.address !== undefined ? params.address.trim() : existing.address;
  const finalRadius = params.deliveryRadiusKm !== undefined ? Number(params.deliveryRadiusKm) : parseFloat(existing.delivery_radius_km);
  const finalFee = params.deliveryFee !== undefined ? Number(params.deliveryFee) : parseFloat(existing.delivery_fee);
  const finalFreeEnabled = params.freeDeliveryEnabled !== undefined ? Boolean(params.freeDeliveryEnabled) : (existing.free_delivery_enabled ?? true);
  const finalFreeThreshold = params.freeDeliveryThreshold !== undefined ? Number(params.freeDeliveryThreshold) : parseFloat(existing.free_delivery_threshold || 499);
  const finalTiers = params.deliveryFeeTiers !== undefined ? JSON.stringify(params.deliveryFeeTiers) : JSON.stringify(existing.delivery_fee_tiers || []);
  const finalLat = coordCheck.isModified && params.latitude !== undefined ? Number(params.latitude) : parseFloat(existing.latitude);
  const finalLng = coordCheck.isModified && params.longitude !== undefined ? Number(params.longitude) : parseFloat(existing.longitude);

  // 9. Execute Canonical Update in PostgreSQL
  const updateRes = await pool.query(
    `UPDATE stores
     SET 
       name = $2,
       address = $3,
       is_active = $4,
       opening_time = $5,
       closing_time = $6,
       delivery_radius_km = $7,
       delivery_fee = $8,
       free_delivery_enabled = $9,
       free_delivery_threshold = $10,
       delivery_fee_tiers = $11::jsonb,
       latitude = $12,
       longitude = $13,
       minimum_order_value = 0.00,
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      targetId,
      finalName,
      finalAddress,
      finalIsActive,
      effectiveOpening,
      effectiveClosing,
      finalRadius,
      finalFee,
      finalFreeEnabled,
      finalFreeThreshold,
      finalTiers,
      finalLat,
      finalLng,
    ]
  );

  const updatedStore = updateRes.rows[0];

  // 10. Immediately Invalidate In-Memory Serviceability Cache
  clearStoreCache();

  // 11. Persistent Audit Logging in PostgreSQL audit_logs
  const auditAction = coordCheck.isModified ? 'STORE_COORDINATE_RELOCATION' : 'STORE_OPERATIONS_UPDATE';
  const oldData = {
    name: existing.name,
    address: existing.address,
    is_active: existing.is_active,
    opening_time: existing.opening_time,
    closing_time: existing.closing_time,
    delivery_radius_km: existing.delivery_radius_km,
    delivery_fee: existing.delivery_fee,
    free_delivery_enabled: existing.free_delivery_enabled,
    free_delivery_threshold: existing.free_delivery_threshold,
    latitude: existing.latitude,
    longitude: existing.longitude,
  };
  const newData = {
    name: updatedStore.name,
    address: updatedStore.address,
    is_active: updatedStore.is_active,
    opening_time: updatedStore.opening_time,
    closing_time: updatedStore.closing_time,
    delivery_radius_km: updatedStore.delivery_radius_km,
    delivery_fee: updatedStore.delivery_fee,
    free_delivery_enabled: updatedStore.free_delivery_enabled,
    free_delivery_threshold: updatedStore.free_delivery_threshold,
    latitude: updatedStore.latitude,
    longitude: updatedStore.longitude,
  };

  try {
    const logId = randomUUID();
    await pool.query(
      `INSERT INTO audit_logs 
         (id, firebase_uid, action, entity_type, entity_id, old_data, new_data, ip_address, user_agent, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        logId,
        params.adminUid || 'admin_user',
        auditAction,
        'STORE',
        targetId,
        JSON.stringify(oldData),
        JSON.stringify(newData),
        params.ipAddress || null,
        params.userAgent || null,
      ]
    );
  } catch (auditErr: any) {
    console.warn('[StoreOperations] Audit log write warning:', auditErr.message);
  }

  // 12. Secondary Transitional Mirror Write to Firestore shops
  try {
    await saveShopConfigFS({
      id: targetId,
      name: updatedStore.name,
      ownerId: updatedStore.owner_id || 'system',
      phone: updatedStore.phone || '',
      email: updatedStore.email || '',
      gstNumber: updatedStore.gst_number || '',
      address: updatedStore.address || '',
      latitude: parseFloat(updatedStore.latitude),
      longitude: parseFloat(updatedStore.longitude),
      deliveryRadiusKm: parseFloat(updatedStore.delivery_radius_km),
      deliveryFee: parseFloat(updatedStore.delivery_fee),
      minimumOrderValue: 0,
      openingTime: effectiveOpening,
      closingTime: effectiveClosing,
      status: updatedStore.is_active ? 'active' : 'inactive',
    });
  } catch (fsErr: any) {
    console.warn('[StoreOperations] Firestore mirror write non-fatal warning:', fsErr.message);
  }
}

export interface RegisterCanonicalStoreParams {
  name: string;
  code: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  latitude: number;
  longitude: number;
  deliveryRadiusKm?: number;
  delivery_radius_km?: number;
  deliveryFee?: number;
  delivery_fee?: number;
  freeDeliveryEnabled?: boolean;
  free_delivery_enabled?: boolean;
  freeDeliveryThreshold?: number;
  free_delivery_threshold?: number;
  deliveryFeeTiers?: any[];
  delivery_fee_tiers?: any[];
  openingTime?: string;
  opening_time?: string;
  closingTime?: string;
  closing_time?: string;
  adminUid?: string;
  adminRole?: string;
  actorUid?: string;
  actorRole?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface RegisterCanonicalStoreResult {
  success: true;
  store: {
    id: string;
    code: string;
    name: string;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    latitude: number;
    longitude: number;
    isActive: boolean;
    is_active: boolean;
    deliveryRadiusKm: number;
    delivery_radius_km: number;
    deliveryFee: number;
    delivery_fee: number;
    freeDeliveryEnabled: boolean;
    free_delivery_enabled: boolean;
    freeDeliveryThreshold: number;
    free_delivery_threshold: number;
    deliveryFeeTiers: any[];
    delivery_fee_tiers: any[];
    openingTime: string;
    opening_time: string;
    closingTime: string;
    closing_time: string;
    minimumOrderValue: number;
    minimum_order_value: number;
    createdAt: string;
    updatedAt: string;
  };
  warehouse: {
    id: string;
    storeId: string;
    store_id: string;
    name: string;
    code: string;
    warehouseType: string;
    warehouse_type: string;
    address: string | null;
    isActive: boolean;
    is_active: boolean;
    createdAt: string;
  };
  registrationStatus: 'REGISTERED';
}

/**
 * Registers a brand-new canonical store in PostgreSQL inside an ACID transaction:
 * 1. Validates store business parameters, coordinates, operating hours, and radius (strictly 3, 4, or 5 km).
 * 2. Generates deterministic store ID and warehouse ID/code.
 * 3. Enforces uniqueness of store code and ID before insertion.
 * 4. Inserts store record with is_active = false and minimum_order_value = 0.
 * 5. Inserts primary fulfillment warehouse associated with the store.
 * 6. Inserts STORE_REGISTERED audit log in the same transaction.
 * 7. Commits transaction, clears in-memory cache, and executes secondary non-fatal Firestore mirror.
 */
export async function registerCanonicalStore(
  params: RegisterCanonicalStoreParams
): Promise<RegisterCanonicalStoreResult> {
  // 1. Validate Store Name
  if (!params.name || typeof params.name !== 'string' || params.name.trim() === '') {
    const err: any = new Error('Store name is required.');
    err.statusCode = 400;
    throw err;
  }
  const name = params.name.trim();
  if (name.length > 128) {
    const err: any = new Error('Store name must not exceed 128 characters.');
    err.statusCode = 400;
    throw err;
  }

  // 2. Validate Store Code
  if (!params.code || typeof params.code !== 'string' || params.code.trim() === '') {
    const err: any = new Error('Store code is required.');
    err.statusCode = 400;
    throw err;
  }
  const rawCode = params.code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{2,32}$/.test(rawCode)) {
    const err: any = new Error('Store code must be 2 to 32 alphanumeric characters, dashes, or underscores.');
    err.statusCode = 400;
    throw err;
  }

  // 3. Validate Coordinates
  if (params.latitude === undefined || params.latitude === null || (params.latitude as unknown) === '') {
    const err: any = new Error('Latitude is required.');
    err.statusCode = 400;
    throw err;
  }
  if (params.longitude === undefined || params.longitude === null || (params.longitude as unknown) === '') {
    const err: any = new Error('Longitude is required.');
    err.statusCode = 400;
    throw err;
  }
  const lat = Number(params.latitude);
  const lng = Number(params.longitude);
  if (isNaN(lat) || !isFinite(lat) || lat < -90 || lat > 90) {
    const err: any = new Error('Latitude must be a valid number between -90 and 90.');
    err.statusCode = 400;
    throw err;
  }
  if (isNaN(lng) || !isFinite(lng) || lng < -180 || lng > 180) {
    const err: any = new Error('Longitude must be a valid number between -180 and 180.');
    err.statusCode = 400;
    throw err;
  }

  // 4. Validate Delivery Radius (strictly 3.0, 4.0, or 5.0)
  const radiusParam = params.deliveryRadiusKm !== undefined ? params.deliveryRadiusKm : params.delivery_radius_km;
  const radius = radiusParam !== undefined ? Number(radiusParam) : 3.0;
  if (![3, 4, 5, 3.0, 4.0, 5.0].includes(radius)) {
    const err: any = new Error('Delivery radius must be strictly 3, 4, or 5 km.');
    err.statusCode = 400;
    throw err;
  }

  // 5. Validate Delivery Fee
  const feeParam = params.deliveryFee !== undefined ? params.deliveryFee : params.delivery_fee;
  const fee = feeParam !== undefined ? Number(feeParam) : 29;
  if (isNaN(fee) || fee < 0) {
    const err: any = new Error('Delivery fee must be a non-negative number.');
    err.statusCode = 400;
    throw err;
  }

  // 6. Validate Free Delivery Configuration
  const freeEnabledParam = params.freeDeliveryEnabled !== undefined ? params.freeDeliveryEnabled : params.free_delivery_enabled;
  const freeEnabled = freeEnabledParam !== undefined ? Boolean(freeEnabledParam) : true;
  const freeThreshParam = params.freeDeliveryThreshold !== undefined ? params.freeDeliveryThreshold : params.free_delivery_threshold;
  const freeThreshold = freeThreshParam !== undefined ? Number(freeThreshParam) : 499;
  if (isNaN(freeThreshold) || freeThreshold < 0) {
    const err: any = new Error('Free delivery threshold must be a non-negative number.');
    err.statusCode = 400;
    throw err;
  }

  // 7. Validate Fee Tiers
  const feeTiers = Array.isArray(params.deliveryFeeTiers)
    ? params.deliveryFeeTiers
    : Array.isArray(params.delivery_fee_tiers)
    ? params.delivery_fee_tiers
    : [];

  // 8. Validate Business Operating Hours (HH:mm)
  const timeRegex = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  const rawOpen = params.openingTime || params.opening_time;
  const rawClose = params.closingTime || params.closing_time;
  const openTime = rawOpen ? String(rawOpen).trim() : '06:00';
  const closeTime = rawClose ? String(rawClose).trim() : '23:00';
  if (!timeRegex.test(openTime)) {
    const err: any = new Error('Opening time must be in HH:mm format (e.g. 06:00).');
    err.statusCode = 400;
    throw err;
  }
  if (!timeRegex.test(closeTime)) {
    const err: any = new Error('Closing time must be in HH:mm format (e.g. 23:00).');
    err.statusCode = 400;
    throw err;
  }

  const effectiveAdminUid = params.adminUid || params.actorUid || 'SYSTEM';
  const effectiveAdminRole = params.adminRole || params.actorRole || 'admin';

  // 9. Generate Deterministic Canonical IDs
  const slug = rawCode.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const storeId = `store_${slug}`.substring(0, 64);
  const warehouseId = `wh_${storeId}`.substring(0, 64);
  const warehouseCode = `WH-${rawCode}`.substring(0, 32);
  const warehouseName = `${name} Primary Warehouse`.substring(0, 128);

  const pool = getPostgresPool();
  const client = await pool.connect();

  let createdStoreRow: any;
  let createdWhRow: any;

  try {
    await client.query('BEGIN');

    // Check store collision
    const existingStoreRes = await client.query(
      `SELECT id, code FROM stores WHERE id = $1 OR UPPER(code) = UPPER($2) LIMIT 1`,
      [storeId, rawCode]
    );
    if (existingStoreRes.rows.length > 0) {
      const existing = existingStoreRes.rows[0];
      const conflictField = existing.id === storeId ? 'store ID' : 'store code';
      const err: any = new Error(`A store with this ${conflictField} already exists (${existing.code}).`);
      err.statusCode = 409;
      throw err;
    }

    // Check warehouse collision
    const existingWhRes = await client.query(
      `SELECT id, code FROM warehouses WHERE id = $1 OR UPPER(code) = UPPER($2) LIMIT 1`,
      [warehouseId, warehouseCode]
    );
    if (existingWhRes.rows.length > 0) {
      const existingWh = existingWhRes.rows[0];
      const err: any = new Error(`A warehouse with this code already exists (${existingWh.code}).`);
      err.statusCode = 409;
      throw err;
    }

    // Insert Store (Strictly is_active = false on creation, minimum_order_value = 0.00)
    const storeInsertRes = await client.query(
      `INSERT INTO stores (
        id, name, code, phone, address, city, state, pincode,
        latitude, longitude, is_active, delivery_radius_km,
        opening_time, closing_time, delivery_fee, free_delivery_enabled,
        free_delivery_threshold, delivery_fee_tiers, minimum_order_value,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, false, $11,
        $12, $13, $14, $15,
        $16, $17::jsonb, 0.00,
        NOW(), NOW()
      ) RETURNING *`,
      [
        storeId,
        name,
        rawCode,
        params.phone?.trim() || null,
        params.address?.trim() || null,
        params.city?.trim() || null,
        params.state?.trim() || null,
        params.pincode?.trim() || null,
        lat,
        lng,
        radius,
        openTime,
        closeTime,
        fee,
        freeEnabled,
        freeThreshold,
        JSON.stringify(feeTiers),
      ]
    );
    createdStoreRow = storeInsertRes.rows[0];

    // Insert Associated Primary Warehouse
    const whInsertRes = await client.query(
      `INSERT INTO warehouses (
        id, store_id, name, code, warehouse_type, address, is_active, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, 'MAIN_STORE', $5, true, NOW(), NOW()
      ) RETURNING *`,
      [
        warehouseId,
        storeId,
        warehouseName,
        warehouseCode,
        params.address?.trim() || null,
      ]
    );
    createdWhRow = whInsertRes.rows[0];

    // Insert Audit Log
    const auditPayload = {
      storeId,
      code: rawCode,
      name,
      latitude: lat,
      longitude: lng,
      deliveryRadiusKm: radius,
      deliveryFee: fee,
      freeDeliveryEnabled: freeEnabled,
      freeDeliveryThreshold: freeThreshold,
      openingTime: openTime,
      closingTime: closeTime,
      warehouseId,
      warehouseCode,
      adminUid: effectiveAdminUid,
      adminRole: effectiveAdminRole,
      registrationStatus: 'REGISTERED',
      isActive: false,
    };
    const logId = randomUUID();
    await client.query(
      `INSERT INTO audit_logs (
        id, firebase_uid, action, entity_type, entity_id, old_data, new_data, ip_address, user_agent, created_at
      ) VALUES ($1, $2, 'STORE_REGISTERED', 'STORE', $3, NULL, $4::jsonb, $5, $6, NOW())`,
      [
        logId,
        effectiveAdminUid,
        storeId,
        JSON.stringify(auditPayload),
        params.ipAddress || null,
        params.userAgent || null,
      ]
    );

    await client.query('COMMIT');
  } catch (txErr: any) {
    await client.query('ROLLBACK');
    if (txErr.code === '23505') {
      const err: any = new Error('Database unique constraint violation: A store or warehouse with this identifier already exists.');
      err.statusCode = 409;
      throw err;
    }
    throw txErr;
  } finally {
    client.release();
  }

  // Invalidate In-Memory Serviceability Cache
  clearStoreCache();

  // Secondary Non-authoritative Transitional Mirror to Firestore shops
  try {
    await saveShopConfigFS({
      id: storeId,
      name: createdStoreRow.name,
      ownerId: effectiveAdminUid || 'system',
      phone: createdStoreRow.phone || '',
      email: '',
      gstNumber: '',
      address: createdStoreRow.address || '',
      latitude: parseFloat(createdStoreRow.latitude),
      longitude: parseFloat(createdStoreRow.longitude),
      deliveryRadiusKm: parseFloat(createdStoreRow.delivery_radius_km),
      deliveryFee: parseFloat(createdStoreRow.delivery_fee),
      minimumOrderValue: 0,
      openingTime: createdStoreRow.opening_time,
      closingTime: createdStoreRow.closing_time,
      status: 'inactive',
    });
  } catch (fsErr: any) {
    console.warn('[registerCanonicalStore] Firestore mirror write non-fatal warning:', fsErr.message);
  }

  return {
    success: true,
    store: {
      id: createdStoreRow.id,
      code: createdStoreRow.code,
      name: createdStoreRow.name,
      phone: createdStoreRow.phone,
      address: createdStoreRow.address,
      city: createdStoreRow.city,
      state: createdStoreRow.state,
      pincode: createdStoreRow.pincode,
      latitude: parseFloat(createdStoreRow.latitude),
      longitude: parseFloat(createdStoreRow.longitude),
      isActive: Boolean(createdStoreRow.is_active),
      is_active: Boolean(createdStoreRow.is_active),
      deliveryRadiusKm: parseFloat(createdStoreRow.delivery_radius_km),
      delivery_radius_km: parseFloat(createdStoreRow.delivery_radius_km),
      deliveryFee: parseFloat(createdStoreRow.delivery_fee),
      delivery_fee: parseFloat(createdStoreRow.delivery_fee),
      freeDeliveryEnabled: Boolean(createdStoreRow.free_delivery_enabled),
      free_delivery_enabled: Boolean(createdStoreRow.free_delivery_enabled),
      freeDeliveryThreshold: parseFloat(createdStoreRow.free_delivery_threshold),
      free_delivery_threshold: parseFloat(createdStoreRow.free_delivery_threshold),
      deliveryFeeTiers: createdStoreRow.delivery_fee_tiers || [],
      delivery_fee_tiers: createdStoreRow.delivery_fee_tiers || [],
      openingTime: createdStoreRow.opening_time,
      opening_time: createdStoreRow.opening_time,
      closingTime: createdStoreRow.closing_time,
      closing_time: createdStoreRow.closing_time,
      minimumOrderValue: 0,
      minimum_order_value: 0,
      createdAt: createdStoreRow.created_at ? new Date(createdStoreRow.created_at).toISOString() : new Date().toISOString(),
      updatedAt: createdStoreRow.updated_at ? new Date(createdStoreRow.updated_at).toISOString() : new Date().toISOString(),
    },
    warehouse: {
      id: createdWhRow.id,
      storeId: createdWhRow.store_id,
      store_id: createdWhRow.store_id,
      name: createdWhRow.name,
      code: createdWhRow.code,
      warehouseType: createdWhRow.warehouse_type,
      warehouse_type: createdWhRow.warehouse_type,
      address: createdWhRow.address,
      isActive: Boolean(createdWhRow.is_active),
      is_active: Boolean(createdWhRow.is_active),
      createdAt: createdWhRow.created_at ? new Date(createdWhRow.created_at).toISOString() : new Date().toISOString(),
    },
    registrationStatus: 'REGISTERED',
  };
}

export interface PrimaryWarehouseSummary {
  id: string;
  storeId: string;
  name: string;
  code: string;
  warehouseType: string;
  isActive: boolean;
}

/**
 * Resolves the primary internal warehouse ID associated with a store.
 *
 * Enforces canonical resolution:
 *   Business Store (store_id) -> Primary Internal Warehouse (warehouses.id)
 *
 * Canonical Rules:
 *   1. Accepts canonical storeId.
 *   2. Validates that the store exists in PostgreSQL (throws explicit 404 if not found).
 *   3. Resolves the primary active warehouse (is_active = true) with preference for warehouse_type = 'MAIN_STORE'.
 *   4. Returns actual warehouses.id.
 *   5. Zero fallback to hardcoded, global, mock, or unrelated warehouses.
 *   6. Explicitly fails if no valid primary warehouse is associated with the store.
 */
export async function getPrimaryWarehouseIdForStore(
  storeId: string,
  client?: PoolClient
): Promise<string> {
  if (!storeId || typeof storeId !== 'string' || !storeId.trim()) {
    const error: any = new Error('Invalid storeId: Store ID is required for warehouse resolution.');
    error.statusCode = 400;
    throw error;
  }

  const trimmedStoreId = storeId.trim();
  const pool = client || getPostgresPool();

  // 1. Verify store exists in PostgreSQL
  const storeRes = await pool.query(
    'SELECT id, name, is_active FROM stores WHERE id = $1',
    [trimmedStoreId]
  );

  if (storeRes.rowCount === 0) {
    const error: any = new Error(`Store not found: No store exists with identifier '${trimmedStoreId}'.`);
    error.statusCode = 404;
    throw error;
  }

  // 2. Query the primary internal warehouse associated with this store
  const whRes = await pool.query(
    `SELECT id, is_active, warehouse_type
     FROM warehouses
     WHERE store_id = $1 AND is_active = true
     ORDER BY 
       CASE WHEN warehouse_type = 'MAIN_STORE' THEN 1 ELSE 2 END,
       created_at ASC
     LIMIT 1`,
    [trimmedStoreId]
  );

  if (whRes.rowCount === 0) {
    const error: any = new Error(
      `No active primary inventory location (warehouse) found for store '${trimmedStoreId}'.`
    );
    error.statusCode = 404;
    throw error;
  }

  return whRes.rows[0].id;
}

/**
 * Resolves the primary internal warehouse details for a store.
 */
export async function getPrimaryWarehouseForStore(
  storeId: string,
  client?: PoolClient
): Promise<PrimaryWarehouseSummary> {
  if (!storeId || typeof storeId !== 'string' || !storeId.trim()) {
    const error: any = new Error('Invalid storeId: Store ID is required for warehouse resolution.');
    error.statusCode = 400;
    throw error;
  }

  const trimmedStoreId = storeId.trim();
  const pool = client || getPostgresPool();

  const storeRes = await pool.query(
    'SELECT id, name, is_active FROM stores WHERE id = $1',
    [trimmedStoreId]
  );

  if (storeRes.rowCount === 0) {
    const error: any = new Error(`Store not found: No store exists with identifier '${trimmedStoreId}'.`);
    error.statusCode = 404;
    throw error;
  }

  const whRes = await pool.query(
    `SELECT id, store_id, name, code, warehouse_type, is_active
     FROM warehouses
     WHERE store_id = $1 AND is_active = true
     ORDER BY 
       CASE WHEN warehouse_type = 'MAIN_STORE' THEN 1 ELSE 2 END,
       created_at ASC
     LIMIT 1`,
    [trimmedStoreId]
  );

  if (whRes.rowCount === 0) {
    const error: any = new Error(
      `No active primary inventory location (warehouse) found for store '${trimmedStoreId}'.`
    );
    error.statusCode = 404;
    throw error;
  }

  const row = whRes.rows[0];
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    code: row.code,
    warehouseType: row.warehouse_type,
    isActive: Boolean(row.is_active),
  };
}

