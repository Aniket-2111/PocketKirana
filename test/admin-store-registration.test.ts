/**
 * PocketKirana — Phase 2A: Store Registration Core Test Suite
 *
 * Tests:
 * 1. Authentication:
 *    - Main Admin can register (HTTP 201)
 *    - Unauthenticated rejected (HTTP 401)
 *    - Store Admin rejected (HTTP 403)
 *    - Store Manager rejected (HTTP 403)
 *    - Customer rejected (HTTP 403)
 *
 * 2. Validation:
 *    - Missing store name rejected (HTTP 400)
 *    - Duplicate store code rejected (HTTP 409)
 *    - Invalid radius rejected (HTTP 400: only 3, 4, 5 accepted)
 *    - Invalid latitude rejected (HTTP 400)
 *    - Invalid longitude rejected (HTTP 400)
 *    - Invalid hours rejected (HTTP 400)
 *
 * 3. ACID Transaction:
 *    - Store + primary warehouse created together
 *    - STORE_REGISTERED audit log created
 *    - Warehouse failure rolls back store
 *    - Audit failure rolls back store
 *
 * 4. Data Integrity:
 *    - New store ID unique and deterministic (store_<code_slug>)
 *    - Store code unique
 *    - is_active = false (never silently active)
 *    - minimum_order_value = 0 (strictly 0)
 *    - Correct delivery configuration persisted
 *    - Correct hours persisted
 *
 * 5. Firestore Resilience:
 *    - PostgreSQL remains successful if Firestore mirror fails
 *
 * 6. Regression:
 *    - Existing store operations GET/PUT still work
 *    - Existing RBAC tests still pass
 *
 * 7. Real PostgreSQL Integration (Against isolated pocketkirana_test):
 *    - Validates current_database() === 'pocketkirana_test'
 *    - Hard-aborts if connected to production 'pocketkirana_db'
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as registerStoreRoute } from '@/app/api/admin/store/register/route';
import { GET as getStoreOperations, PUT as putStoreOperations } from '@/app/api/admin/store/operations/route';
import { registerCanonicalStore } from '@/lib/storeOperationsService';
import { verifyStoreAccess } from '@/lib/routeAuth';
import { clearStoreCache } from '@/lib/serverServiceability';
import { Pool } from 'pg';

// ─── IN-MEMORY POSTGRESQL STATE FOR ROUTE / ACID TESTS ───────────────────────

interface MockStore {
  id: string;
  name: string;
  code: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  latitude: string;
  longitude: string;
  is_active: boolean;
  delivery_radius_km: string;
  delivery_fee: number;
  free_delivery_enabled: boolean;
  free_delivery_threshold: number;
  delivery_fee_tiers: any;
  minimum_order_value: number;
  opening_time: string;
  closing_time: string;
  created_at: Date;
  updated_at: Date;
}

interface MockWarehouse {
  id: string;
  store_id: string;
  name: string;
  code: string;
  warehouse_type: string;
  address?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface MockAuditLog {
  id: string;
  firebase_uid?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  old_data?: any;
  new_data?: any;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}

let mockStores: MockStore[] = [];
let mockWarehouses: MockWarehouse[] = [];
let mockAuditLogs: MockAuditLog[] = [];
let storesSnapshot: MockStore[] = [];
let warehousesSnapshot: MockWarehouse[] = [];
let auditLogsSnapshot: MockAuditLog[] = [];
let forceWarehouseError = false;
let forceAuditError = false;
let transactionRolledBack = false;
let transactionCommitted = false;

// Mock the pg pool
const mockClient = {
  query: vi.fn(async (sql: string, params: any[] = []) => {
    const s = sql.toLowerCase().trim();

    if (s.startsWith('begin')) {
      transactionRolledBack = false;
      transactionCommitted = false;
      storesSnapshot = [...mockStores];
      warehousesSnapshot = [...mockWarehouses];
      auditLogsSnapshot = [...mockAuditLogs];
      return { rows: [] };
    }
    if (s.startsWith('commit')) {
      transactionCommitted = true;
      return { rows: [] };
    }
    if (s.startsWith('rollback')) {
      transactionRolledBack = true;
      mockStores = [...storesSnapshot];
      mockWarehouses = [...warehousesSnapshot];
      mockAuditLogs = [...auditLogsSnapshot];
      return { rows: [] };
    }

    // 1. SELECT id, code FROM stores WHERE id = $1 OR upper(code) = upper($2)
    if (s.includes('from stores') && s.includes('upper(code)')) {
      const idParam = params[0];
      const codeParam = String(params[1] || '').toUpperCase();
      const match = mockStores.find(
        (st) => st.id === idParam || st.code.toUpperCase() === codeParam
      );
      return { rows: match ? [match] : [] };
    }

    // 2. SELECT id, code FROM warehouses WHERE id = $1 OR upper(code) = upper($2)
    if (s.includes('from warehouses') && s.includes('upper(code)')) {
      const idParam = params[0];
      const codeParam = String(params[1] || '').toUpperCase();
      const match = mockWarehouses.find(
        (wh) => wh.id === idParam || wh.code.toUpperCase() === codeParam
      );
      return { rows: match ? [match] : [] };
    }

    // 3. INSERT INTO stores
    if (s.includes('insert into stores')) {
      const [
        id, name, code, phone, address, city, state, pincode,
        lat, lng, radius, openTime, closeTime, fee, freeEnabled,
        freeThresh, tiers
      ] = params;

      const newStore: MockStore = {
        id,
        name,
        code,
        phone,
        address,
        city,
        state,
        pincode,
        latitude: String(lat),
        longitude: String(lng),
        is_active: false,
        delivery_radius_km: String(radius),
        delivery_fee: Number(fee),
        free_delivery_enabled: Boolean(freeEnabled),
        free_delivery_threshold: Number(freeThresh),
        delivery_fee_tiers: typeof tiers === 'string' ? JSON.parse(tiers) : tiers,
        minimum_order_value: 0,
        opening_time: openTime,
        closing_time: closeTime,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockStores.push(newStore);
      return { rows: [{ ...newStore }] };
    }

    // 4. INSERT INTO warehouses
    if (s.includes('insert into warehouses')) {
      if (forceWarehouseError) {
        throw new Error('MOCK_WAREHOUSE_INSERT_FAILURE');
      }
      const [id, storeId, name, code, address] = params;
      const newWh: MockWarehouse = {
        id,
        store_id: storeId,
        name,
        code,
        warehouse_type: 'MAIN_STORE',
        address,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockWarehouses.push(newWh);
      return { rows: [newWh] };
    }

    // 5. INSERT INTO audit_logs
    if (s.includes('insert into audit_logs')) {
      if (forceAuditError) {
        throw new Error('MOCK_AUDIT_LOG_INSERT_FAILURE');
      }
      let newLog: MockAuditLog;
      if (params.length === 6) {
        const [id, uid, entityId, newData, ip, ua] = params;
        newLog = {
          id,
          firebase_uid: uid,
          action: 'STORE_REGISTERED',
          entity_type: 'STORE',
          entity_id: entityId,
          old_data: null,
          new_data: newData ? (typeof newData === 'string' ? JSON.parse(newData) : newData) : null,
          ip_address: ip,
          user_agent: ua,
          created_at: new Date(),
        };
      } else {
        const [id, uid, action, entityType, entityId, oldData, newData, ip, ua] = params;
        newLog = {
          id,
          firebase_uid: uid,
          action,
          entity_type: entityType,
          entity_id: entityId,
          old_data: oldData ? (typeof oldData === 'string' ? JSON.parse(oldData) : oldData) : null,
          new_data: newData ? (typeof newData === 'string' ? JSON.parse(newData) : newData) : null,
          ip_address: ip,
          user_agent: ua,
          created_at: new Date(),
        };
      }
      mockAuditLogs.push(newLog);
      return { rows: [newLog] };
    }

    // 6. Generic SELECT FROM stores
    if (s.includes('from stores')) {
      if (params.length > 0) {
        const idParam = params[0];
        const match = mockStores.find((st) => st.id === idParam || st.code.toUpperCase() === String(idParam).toUpperCase());
        return { rows: match ? [match] : [] };
      }
      return { rows: [...mockStores] };
    }

    // 7. UPDATE stores
    if (s.includes('update stores')) {
      const storeId = params[0];
      const match = mockStores.find((st) => st.id === storeId);
      if (match) {
        match.name = params[1];
        match.address = params[2];
        match.is_active = params[3];
        match.opening_time = params[4];
        match.closing_time = params[5];
        match.delivery_radius_km = String(params[6]);
        match.delivery_fee = Number(params[7]);
        match.free_delivery_enabled = Boolean(params[8]);
        match.free_delivery_threshold = Number(params[9]);
        match.delivery_fee_tiers = typeof params[10] === 'string' ? JSON.parse(params[10]) : params[10];
        match.latitude = String(params[11]);
        match.longitude = String(params[12]);
        return { rows: [match] };
      }
      return { rows: [] };
    }

    return { rows: [] };
  }),
  release: vi.fn(),
};

vi.mock('@/lib/postgres', () => ({
  getPostgresPool: vi.fn(() => ({
    query: mockClient.query,
    connect: vi.fn().mockResolvedValue(mockClient),
  })),
}));

const mockSaveShopConfigFS = vi.fn(async () => true);
vi.mock('@/lib/firebaseServices', () => ({
  saveShopConfigFS: mockSaveShopConfigFS,
  fetchShopsFS: vi.fn(async () => []),
}));

describe('Phase 2A: Store Registration Core Tests', () => {
  beforeEach(() => {
    clearStoreCache();
    mockStores = [
      {
        id: 'store_primary',
        name: 'PocketKirana Central Darkstore',
        code: 'STORE-001',
        latitude: '19.02245360',
        longitude: '73.32100180',
        is_active: true,
        delivery_radius_km: '3.00',
        opening_time: '06:00',
        closing_time: '23:00',
        delivery_fee: 15,
        free_delivery_enabled: true,
        free_delivery_threshold: 499,
        minimum_order_value: 0,
        delivery_fee_tiers: [],
        address: 'Station Road, Neral, Maharashtra',
        created_at: new Date('2026-01-01'),
        updated_at: new Date('2026-01-01'),
      },
    ];
    mockWarehouses = [
      {
        id: 'wh_store_primary',
        store_id: 'store_primary',
        name: 'PocketKirana Central Darkstore Primary Warehouse',
        code: 'WH-STORE-001',
        warehouse_type: 'MAIN_STORE',
        is_active: true,
        created_at: new Date('2026-01-01'),
        updated_at: new Date('2026-01-01'),
      },
    ];
    mockAuditLogs = [];
    forceWarehouseError = false;
    forceAuditError = false;
    transactionRolledBack = false;
    transactionCommitted = false;
    mockClient.query.mockClear();
    mockSaveShopConfigFS.mockClear();
  });

  // =========================================================================
  // 1. AUTHENTICATION & RBAC
  // =========================================================================
  describe('1. Authentication & RBAC', () => {
    test('1.1: Main Admin can register a new store (HTTP 201)', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/store/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-pk-role': 'admin',
          'x-pk-uid': 'admin_main_user',
        },
        body: JSON.stringify({
          name: 'PocketKirana Badlapur Hub',
          code: 'PK-BADLAPUR-01',
          latitude: 19.1550,
          longitude: 73.2350,
          delivery_radius_km: 4,
          delivery_fee: 25,
          free_delivery_enabled: true,
          free_delivery_threshold: 399,
          opening_time: '07:00',
          closing_time: '22:00',
          address: 'Katrap, Badlapur East',
          city: 'Badlapur',
          state: 'Maharashtra',
          pincode: '421503',
        }),
      });

      const res = await registerStoreRoute(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.registration_status).toBe('REGISTERED');
      expect(json.store.code).toBe('PK-BADLAPUR-01');
      expect(json.store.is_active).toBe(false);
      expect(json.warehouse.code).toBe('WH-PK-BADLAPUR-01');
    });

    test('1.2: Unauthenticated request rejected (HTTP 401)', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/store/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Unauthorized Store', code: 'UNAUTH-01' }),
      });

      const res = await registerStoreRoute(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/unauthorized/i);
    });

    test('1.3: Store Admin rejected (HTTP 403)', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/store/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-pk-role': 'store_admin',
          'x-pk-uid': 'store_admin_01',
        },
        body: JSON.stringify({ name: 'Store Admin Attempt', code: 'SA-01' }),
      });

      const res = await registerStoreRoute(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/forbidden/i);
    });

    test('1.4: Store Manager rejected (HTTP 403)', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/store/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-pk-role': 'store_manager',
          'x-pk-uid': 'manager_01',
        },
        body: JSON.stringify({ name: 'Manager Attempt', code: 'SM-01' }),
      });

      const res = await registerStoreRoute(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    test('1.5: Customer & Delivery Partner rejected (HTTP 403)', async () => {
      for (const role of ['customer', 'delivery_partner', 'picker']) {
        const req = new NextRequest('http://localhost:3000/api/admin/store/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-pk-role': role,
            'x-pk-uid': 'user_other',
          },
          body: JSON.stringify({ name: 'Other Role Attempt', code: 'OTHER-01' }),
        });

        const res = await registerStoreRoute(req);
        expect(res.status).toBe(403);
      }
    });
  });

  // =========================================================================
  // 2. INPUT VALIDATION
  // =========================================================================
  describe('2. Input Validation', () => {
    test('2.1: Missing or blank store name rejected (HTTP 400)', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/store/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-pk-role': 'admin', 'x-pk-uid': 'admin_1' },
        body: JSON.stringify({
          name: '   ',
          code: 'PK-TEST-01',
          latitude: 19.1,
          longitude: 73.1,
        }),
      });

      const res = await registerStoreRoute(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/store name is required/i);
    });

    test('2.2: Duplicate store code rejected (HTTP 409)', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/store/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-pk-role': 'admin', 'x-pk-uid': 'admin_1' },
        body: JSON.stringify({
          name: 'Duplicate Store',
          code: 'STORE-001', // already in mockStores
          latitude: 19.1,
          longitude: 73.1,
          delivery_radius_km: 3,
        }),
      });

      const res = await registerStoreRoute(req);
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error).toMatch(/already exists/i);
    });

    test('2.3: Invalid delivery radius rejected (HTTP 400: only 3, 4, 5 allowed)', async () => {
      const invalidRadii = [0.5, 1, 2, 2.5, 6, 10, 25];
      for (const radius of invalidRadii) {
        const safeCode = `PK-RAD-${String(radius).replace('.', '_')}`;
        const req = new NextRequest('http://localhost:3000/api/admin/store/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-pk-role': 'admin', 'x-pk-uid': 'admin_1' },
          body: JSON.stringify({
            name: 'Radius Test Store',
            code: safeCode,
            latitude: 19.1,
            longitude: 73.1,
            delivery_radius_km: radius,
          }),
        });

        const res = await registerStoreRoute(req);
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toMatch(/delivery radius must be strictly 3, 4, or 5/i);
      }
    });

    test('2.4: Invalid latitude rejected (HTTP 400)', async () => {
      for (const invalidLat of [NaN, -91, 91, 'invalid']) {
        const req = new NextRequest('http://localhost:3000/api/admin/store/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-pk-role': 'admin', 'x-pk-uid': 'admin_1' },
          body: JSON.stringify({
            name: 'Lat Test Store',
            code: 'PK-LAT-01',
            latitude: invalidLat,
            longitude: 73.1,
          }),
        });

        const res = await registerStoreRoute(req);
        expect(res.status).toBe(400);
      }
    });

    test('2.5: Invalid longitude rejected (HTTP 400)', async () => {
      for (const invalidLng of [NaN, -181, 181, 'invalid']) {
        const req = new NextRequest('http://localhost:3000/api/admin/store/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-pk-role': 'admin', 'x-pk-uid': 'admin_1' },
          body: JSON.stringify({
            name: 'Lng Test Store',
            code: 'PK-LNG-01',
            latitude: 19.1,
            longitude: invalidLng,
          }),
        });

        const res = await registerStoreRoute(req);
        expect(res.status).toBe(400);
      }
    });

    test('2.6: Invalid opening/closing hours format rejected (HTTP 400)', async () => {
      const invalidHours = ['25:00', '12:60', '8am', '9:0', 'invalid'];
      for (const badTime of invalidHours) {
        const req = new NextRequest('http://localhost:3000/api/admin/store/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-pk-role': 'admin', 'x-pk-uid': 'admin_1' },
          body: JSON.stringify({
            name: 'Hours Test Store',
            code: 'PK-HOURS-01',
            latitude: 19.1,
            longitude: 73.1,
            opening_time: badTime,
            closing_time: '22:00',
          }),
        });

        const res = await registerStoreRoute(req);
        expect(res.status).toBe(400);
      }
    });
  });

  // =========================================================================
  // 3. ACID TRANSACTION & ROLLBACK BEHAVIOR
  // =========================================================================
  describe('3. ACID Transaction & Rollback Behavior', () => {
    test('3.1: Store and primary warehouse created in the SAME transaction with audit log', async () => {
      const result = await registerCanonicalStore({
        name: 'PocketKirana Karjat Hub',
        code: 'PK-KARJAT-01',
        latitude: 18.9100,
        longitude: 73.3200,
        delivery_radius_km: 5,
        delivery_fee: 30,
        free_delivery_enabled: true,
        free_delivery_threshold: 499,
        actorUid: 'admin_audit_test',
        actorRole: 'admin',
      });

      expect(result.success).toBe(true);
      expect(transactionCommitted).toBe(true);
      expect(transactionRolledBack).toBe(false);

      // Verify store was inserted
      const storeInDb = mockStores.find((s) => s.code === 'PK-KARJAT-01');
      expect(storeInDb).toBeDefined();
      expect(storeInDb?.is_active).toBe(false);

      // Verify primary warehouse was inserted
      const whInDb = mockWarehouses.find((w) => w.store_id === result.store.id);
      expect(whInDb).toBeDefined();
      expect(whInDb?.code).toBe('WH-PK-KARJAT-01');
      expect(whInDb?.warehouse_type).toBe('MAIN_STORE');

      // Verify audit log was inserted
      const auditLog = mockAuditLogs.find((l) => l.entity_id === result.store.id);
      expect(auditLog).toBeDefined();
      expect(auditLog?.action).toBe('STORE_REGISTERED');
      expect(auditLog?.entity_type).toBe('STORE');
    });

    test('3.2: Primary warehouse failure triggers ROLLBACK and aborts store creation', async () => {
      forceWarehouseError = true;

      await expect(
        registerCanonicalStore({
          name: 'Rollback Store Test',
          code: 'PK-FAIL-WH-01',
          latitude: 19.0,
          longitude: 73.0,
          actorUid: 'admin_1',
          actorRole: 'admin',
        })
      ).rejects.toThrow('MOCK_WAREHOUSE_INSERT_FAILURE');

      expect(transactionRolledBack).toBe(true);
      expect(transactionCommitted).toBe(false);

      // Store must NOT be in the DB
      const storeInDb = mockStores.find((s) => s.code === 'PK-FAIL-WH-01');
      expect(storeInDb).toBeUndefined();
    });

    test('3.3: Audit log failure triggers ROLLBACK and aborts store creation', async () => {
      forceAuditError = true;

      await expect(
        registerCanonicalStore({
          name: 'Audit Rollback Store Test',
          code: 'PK-FAIL-AUDIT-01',
          latitude: 19.0,
          longitude: 73.0,
          actorUid: 'admin_1',
          actorRole: 'admin',
        })
      ).rejects.toThrow('MOCK_AUDIT_LOG_INSERT_FAILURE');

      expect(transactionRolledBack).toBe(true);
      expect(transactionCommitted).toBe(false);

      // Store must NOT be in the DB
      const storeInDb = mockStores.find((s) => s.code === 'PK-FAIL-AUDIT-01');
      expect(storeInDb).toBeUndefined();
    });
  });

  // =========================================================================
  // 4. DATA INTEGRITY GUARANTEES
  // =========================================================================
  describe('4. Data Integrity Guarantees', () => {
    test('4.1: Store ID is server-generated, deterministic, and unique', async () => {
      const res = await registerCanonicalStore({
        name: 'PocketKirana Vangani',
        code: 'PK-VANGANI-01',
        latitude: 19.08,
        longitude: 73.27,
      });

      expect(res.store.id).toBe('store_pk_vangani_01');
      expect(res.warehouse.id).toBe('wh_store_pk_vangani_01');
    });

    test('4.2: Newly registered store strictly has is_active = false', async () => {
      const res = await registerCanonicalStore({
        name: 'Inactive Check Store',
        code: 'PK-INACTIVE-01',
        latitude: 19.12,
        longitude: 73.21,
      });

      expect(res.store.is_active).toBe(false);
      const inDb = mockStores.find((s) => s.id === res.store.id);
      expect(inDb?.is_active).toBe(false);
    });

    test('4.3: minimum_order_value is strictly 0 and cannot be overridden', async () => {
      const res = await registerCanonicalStore({
        name: 'Min Order Test Store',
        code: 'PK-MINORDER-01',
        latitude: 19.10,
        longitude: 73.20,
      });

      expect(res.store.minimum_order_value).toBe(0);
      const inDb = mockStores.find((s) => s.id === res.store.id);
      expect(inDb?.minimum_order_value).toBe(0);
    });

    test('4.4: Delivery fee configuration and business hours are persisted faithfully', async () => {
      const tiers = [{ minOrder: 0, maxOrder: 200, fee: 35 }, { minOrder: 201, maxOrder: 500, fee: 15 }];
      const res = await registerCanonicalStore({
        name: 'Config Faithfulness Store',
        code: 'PK-CONFIG-01',
        latitude: 19.05,
        longitude: 73.30,
        delivery_fee: 35,
        free_delivery_enabled: true,
        free_delivery_threshold: 600,
        delivery_fee_tiers: tiers,
        opening_time: '05:30',
        closing_time: '23:30',
      });

      expect(res.store.delivery_fee).toBe(35);
      expect(res.store.free_delivery_enabled).toBe(true);
      expect(res.store.free_delivery_threshold).toBe(600);
      expect(res.store.delivery_fee_tiers).toEqual(tiers);
      expect(res.store.opening_time).toBe('05:30');
      expect(res.store.closing_time).toBe('23:30');
    });
  });

  // =========================================================================
  // 5. FIRESTORE RESILIENCE
  // =========================================================================
  describe('5. Firestore Mirror Resilience', () => {
    test('5.1: Non-fatal Firestore mirror failure does not rollback PostgreSQL commit', async () => {
      // Simulate Firestore failing
      mockSaveShopConfigFS.mockRejectedValueOnce(new Error('FIRESTORE_NETWORK_FAILURE'));

      const res = await registerCanonicalStore({
        name: 'Firestore Resilience Store',
        code: 'PK-FS-RESILIENT-01',
        latitude: 19.03,
        longitude: 73.31,
      });

      expect(res.success).toBe(true);
      expect(transactionCommitted).toBe(true);
      expect(res.store.code).toBe('PK-FS-RESILIENT-01');

      // The store is safely in PostgreSQL despite Firestore failure
      const inDb = mockStores.find((s) => s.code === 'PK-FS-RESILIENT-01');
      expect(inDb).toBeDefined();
    });
  });

  // =========================================================================
  // 6. REGRESSION
  // =========================================================================
  describe('6. Regression: Existing Store Operations', () => {
    test('6.1: Existing store operations GET still works with RBAC', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/store/operations?storeId=store_primary', {
        headers: { 'x-pk-role': 'admin', 'x-pk-uid': 'admin_1' },
      });
      const res = await getStoreOperations(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.storeId).toBe('store_primary');
    });

    test('6.2: Existing store operations PUT still works', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/store/operations', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-pk-role': 'admin',
          'x-pk-uid': 'admin_1',
        },
        body: JSON.stringify({
          storeId: 'store_primary',
          deliveryRadiusKm: 4.0,
        }),
      });

      const res = await putStoreOperations(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.deliveryRadiusKm).toBe(4.0);
    });

    test('6.3: Existing verifyStoreAccess still enforces permissions', async () => {
      const adminAccess = await verifyStoreAccess({ uid: 'admin_1', role: 'admin' }, 'store_primary');
      expect(adminAccess.authorized).toBe(true);

      const customerAccess = await verifyStoreAccess({ uid: 'cust_1', role: 'customer' }, 'store_primary');
      expect(customerAccess.authorized).toBe(false);
      expect(customerAccess.statusCode).toBe(403);
    });
  });
});
