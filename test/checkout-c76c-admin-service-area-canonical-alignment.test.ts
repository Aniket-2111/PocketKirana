import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

// In-memory mock PostgreSQL state
let mockStoreRow = {
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
  delivery_fee_tiers: [] as any[],
  address: 'Station Road, Neral, Maharashtra',
};

let mockAssignments: Array<{ id: string; admin_user_id: string; store_id: string }> = [];
let mockAuditLogs: Array<any> = [];

const mockQuery = vi.fn(async (sql: string, params: any[] = []) => {
  const queryStr = sql.toLowerCase();

  // 1. SELECT admin_store_assignments (must match before general 'from stores')
  if (queryStr.includes('admin_store_assignments')) {
    const uid = params[0];
    const storeId = params[1];
    const match = mockAssignments.filter(
      (a) => a.admin_user_id === uid && a.store_id === storeId
    );
    return { rows: match };
  }

  // 2. UPDATE stores
  if (queryStr.includes('update stores')) {
    mockStoreRow = {
      ...mockStoreRow,
      id: params[0],
      name: params[1],
      address: params[2],
      is_active: params[3],
      opening_time: params[4],
      closing_time: params[5],
      delivery_radius_km: String(params[6]),
      delivery_fee: Number(params[7]),
      free_delivery_enabled: Boolean(params[8]),
      free_delivery_threshold: Number(params[9]),
      delivery_fee_tiers: typeof params[10] === 'string' ? JSON.parse(params[10]) : params[10],
      latitude: String(params[11]),
      longitude: String(params[12]),
      minimum_order_value: 0,
    };
    return { rows: [ { ...mockStoreRow } ] };
  }

  // 3. SELECT stores
  if (queryStr.includes('from stores')) {
    return { rows: [ { ...mockStoreRow } ] };
  }

  // 4. INSERT audit_logs
  if (queryStr.includes('insert into audit_logs')) {
    mockAuditLogs.push({
      id: params[0],
      firebase_uid: params[1],
      action: params[2],
      entity_type: params[3],
      entity_id: params[4],
      old_data: typeof params[5] === 'string' ? JSON.parse(params[5]) : params[5],
      new_data: typeof params[6] === 'string' ? JSON.parse(params[6]) : params[6],
      ip_address: params[7],
      user_agent: params[8],
      created_at: new Date(),
    });
    return { rows: [] };
  }

  // 5. Active picking/packing/delivery queues
  if (queryStr.includes('active_picking')) {
    return { rows: [{ active_picking: '3', active_packing: '2', active_delivery: '1' }] };
  }

  return { rows: [] };
});

vi.mock('@/lib/postgres', () => ({
  getPostgresPool: vi.fn(() => ({
    query: mockQuery,
    connect: vi.fn().mockResolvedValue({
      query: mockQuery,
      release: vi.fn(),
    }),
  })),
}));

// Mock Firebase services to verify transitional mirror does not break PostgreSQL
vi.mock('@/lib/firebaseServices', () => ({
  saveShopConfigFS: vi.fn(async () => true),
  fetchShopsFS: vi.fn(async () => []),
  fetchServiceRequestsFS: vi.fn(async () => []),
  updateServiceRequestStatusFS: vi.fn(async () => true),
}));

import { GET, PUT } from '@/app/api/admin/store/operations/route';
import {
  getDarkstoreOperationalStatus,
  updateDarkstoreOperations,
} from '@/lib/storeOperationsService';
import {
  generateDeveloperCoordinateToken,
  validateCoordinateModification,
} from '@/lib/coordinateProtection';
import { verifyStoreAccess } from '@/lib/routeAuth';
import {
  clearStoreCache,
  evaluateServerServiceability,
} from '@/lib/serverServiceability';

describe('Phase 2.7C.7.6-C: Canonical Admin Store Operations & Service-Area Alignment', () => {
  beforeEach(() => {
    clearStoreCache();
    mockStoreRow = {
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
    };
    mockAssignments = [];
    mockAuditLogs = [];
    mockQuery.mockClear();
  });

  afterEach(() => {
    clearStoreCache();
  });

  // =========================================================================
  // 1. RBAC & STORE AUTHORIZATION TESTS
  // =========================================================================
  describe('1. RBAC & Store Authorization', () => {
    test('C.7.6-C.1a: Unauthenticated request to GET is rejected with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/store/operations?storeId=store_primary');
      const res = await GET(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toMatch(/Unauthorized/);
    });

    test('C.7.6-C.1b: Unauthorized role (customer) is rejected with 401/403', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/store/operations?storeId=store_primary', {
        headers: { 'x-pk-role': 'customer', 'x-pk-uid': 'cust_123' },
      });
      const res = await GET(req);
      expect([401, 403]).toContain(res.status);
    });

    test('C.7.6-C.1c: Main Admin (role admin) has global authority across all stores', async () => {
      const access = await verifyStoreAccess(
        { uid: 'admin_global', role: 'admin' },
        'store_primary'
      );
      expect(access.authorized).toBe(true);
    });

    test('C.7.6-C.1d: Store Admin without matching assignment in admin_store_assignments is rejected with 403', async () => {
      const access = await verifyStoreAccess(
        { uid: 'unassigned_manager_999', role: 'store_manager' },
        'store_primary'
      );
      expect(access.authorized).toBe(false);
      expect(access.statusCode).toBe(403);
      expect(access.error).toMatch(/not assigned to manage store/);
    });

    test('C.7.6-C.1e: Store Admin with valid assignment in admin_store_assignments is authorized', async () => {
      mockAssignments.push({
        id: 'assign_1',
        admin_user_id: 'store_admin_neral',
        store_id: 'store_primary',
      });

      const access = await verifyStoreAccess(
        { uid: 'store_admin_neral', role: 'store_admin' },
        'store_primary'
      );
      expect(access.authorized).toBe(true);

      // Accessing a different unassigned store is rejected
      const unauthorizedAccess = await verifyStoreAccess(
        { uid: 'store_admin_neral', role: 'store_admin' },
        'store_panvel'
      );
      expect(unauthorizedAccess.authorized).toBe(false);
      expect(unauthorizedAccess.statusCode).toBe(403);
    });
  });

  // =========================================================================
  // 2. CANONICAL STORE OPERATIONS PERSISTENCE TESTS
  // =========================================================================
  describe('2. Canonical Store Operations Persistence', () => {
    test('C.7.6-C.2a: GET returns canonical PostgreSQL store metrics', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/store/operations?storeId=store_primary', {
        headers: { 'x-pk-role': 'admin', 'x-pk-uid': 'admin_1' },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.storeId).toBe('store_primary');
      expect([3.0, 4.0, 5.0]).toContain(json.data.deliveryRadiusKm);
      expect(typeof json.data.deliveryFee).toBe('number');
      expect(typeof json.data.freeDeliveryThreshold).toBe('number');
      expect(typeof json.data.latitude).toBe('number');
      expect(typeof json.data.longitude).toBe('number');
    });

    test('C.7.6-C.2b: Valid delivery radius 3.0, 4.0, 5.0 km are accepted and persisted to PostgreSQL', async () => {
      for (const radius of [3.0, 4.0, 5.0]) {
        const req = new NextRequest('http://localhost:3000/api/admin/store/operations', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-pk-role': 'admin',
            'x-pk-uid': 'admin_1',
          },
          body: JSON.stringify({
            storeId: 'store_primary',
            deliveryRadiusKm: radius,
          }),
        });

        const res = await PUT(req);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);
        expect(json.data.deliveryRadiusKm).toBe(radius);

        expect(parseFloat(mockStoreRow.delivery_radius_km)).toBe(radius);
      }
    });

    test('C.7.6-C.2c: Non-canonical delivery radius (e.g. 1.5, 2.5, 4.5, 6.0, 10.0) is rejected by server with 400', async () => {
      for (const invalidRadius of [1.5, 2.5, 4.5, 6.0, 10.0]) {
        const req = new NextRequest('http://localhost:3000/api/admin/store/operations', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-pk-role': 'admin',
            'x-pk-uid': 'admin_1',
          },
          body: JSON.stringify({
            storeId: 'store_primary',
            deliveryRadiusKm: invalidRadius,
          }),
        });

        const res = await PUT(req);
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toMatch(/Allowed canonical values are 3.0, 4.0, or 5.0 km/);
      }
    });

    test('C.7.6-C.2d: Operational hours, fee, and free delivery settings persist to PostgreSQL', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/store/operations', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-pk-role': 'admin',
          'x-pk-uid': 'admin_1',
        },
        body: JSON.stringify({
          storeId: 'store_primary',
          openingTime: '07:30',
          closingTime: '22:45',
          deliveryFee: 35,
          freeDeliveryEnabled: true,
          freeDeliveryThreshold: 599,
          status: 'OPEN',
        }),
      });

      const res = await PUT(req);
      expect(res.status).toBe(200);

      expect(mockStoreRow.opening_time).toBe('07:30');
      expect(mockStoreRow.closing_time).toBe('22:45');
      expect(mockStoreRow.delivery_fee).toBe(35);
      expect(mockStoreRow.free_delivery_enabled).toBe(true);
      expect(mockStoreRow.free_delivery_threshold).toBe(599);
      expect(mockStoreRow.is_active).toBe(true);
    });

    test('C.7.6-C.2e: Invalid operating hours (opening >= closing) is rejected with 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/store/operations', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-pk-role': 'admin',
          'x-pk-uid': 'admin_1',
        },
        body: JSON.stringify({
          storeId: 'store_primary',
          openingTime: '22:00',
          closingTime: '06:00',
        }),
      });

      const res = await PUT(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/Opening time must be strictly before closing time/);
    });

    test('C.7.6-C.2f: Negative delivery fee or negative free delivery threshold is rejected with 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/store/operations', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-pk-role': 'admin',
          'x-pk-uid': 'admin_1',
        },
        body: JSON.stringify({
          storeId: 'store_primary',
          deliveryFee: -10,
        }),
      });

      const res = await PUT(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/Delivery fee must be a non-negative number/);
    });
  });

  // =========================================================================
  // 3. STORE COORDINATE PROTECTION TESTS
  // =========================================================================
  describe('3. Store Coordinate Protection', () => {
    test('C.7.6-C.3a: Normal Admin cannot modify store coordinates via API (rejected with 403)', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/store/operations', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-pk-role': 'admin',
          'x-pk-uid': 'admin_1',
        },
        body: JSON.stringify({
          storeId: 'store_primary',
          latitude: 19.1000000,
          longitude: 73.4000000,
        }),
      });

      const res = await PUT(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/STORE_COORDINATES_PROTECTED/);

      // Verify PostgreSQL coordinates remain completely unchanged
      expect(parseFloat(mockStoreRow.latitude)).toBeCloseTo(19.0224536, 5);
      expect(parseFloat(mockStoreRow.longitude)).toBeCloseTo(73.3210018, 5);
    });

    test('C.7.6-C.3b: Authorized developer flow allows single-use relocation and rejects token replay', async () => {
      const devToken = generateDeveloperCoordinateToken({
        targetStoreId: 'store_primary',
        expiresInSeconds: 300,
      });

      // 1. First execution with fresh token succeeds (meaningful delta > 0.000001)
      const req1 = new NextRequest('http://localhost:3000/api/admin/store/operations', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-pk-role': 'admin',
          'x-pk-uid': 'admin_dev_ops',
        },
        body: JSON.stringify({
          storeId: 'store_primary',
          latitude: 19.0250000,
          longitude: 73.3250000,
          developerToken: devToken,
        }),
      });

      const res1 = await PUT(req1);
      expect(res1.status).toBe(200);

      // 2. Replay attack with same token is strictly rejected (single-use enforced)
      const req2 = new NextRequest('http://localhost:3000/api/admin/store/operations', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-pk-role': 'admin',
          'x-pk-uid': 'admin_dev_ops',
        },
        body: JSON.stringify({
          storeId: 'store_primary',
          latitude: 19.0280000,
          longitude: 73.3280000,
          developerToken: devToken, // replayed token
        }),
      });

      const res2 = await PUT(req2);
      expect(res2.status).toBe(403);
      const json2 = await res2.json();
      expect(json2.error).toMatch(/already been consumed/);
    });

    test('C.7.6-C.3c: Successful coordinate relocation logs to PostgreSQL audit_logs with action STORE_COORDINATE_RELOCATION', async () => {
      const devToken = generateDeveloperCoordinateToken({
        targetStoreId: 'store_primary',
        expiresInSeconds: 300,
      });

      await updateDarkstoreOperations({
        storeId: 'store_primary',
        latitude: 19.0250000,
        longitude: 73.3250000,
        developerToken: devToken,
        adminUid: 'dev_audit_tester',
      });

      const auditEntry = mockAuditLogs.find((l) => l.action === 'STORE_COORDINATE_RELOCATION');
      expect(auditEntry).toBeDefined();
      expect(auditEntry.entity_type).toBe('STORE');
      expect(auditEntry.firebase_uid).toBe('dev_audit_tester');
      expect(parseFloat(auditEntry.new_data.latitude)).toBeCloseTo(19.0250, 4);
      expect(parseFloat(auditEntry.new_data.longitude)).toBeCloseTo(73.3250, 4);
    });
  });

  // =========================================================================
  // 4. CANONICAL AUTHORITY & INSTANT SERVICEABILITY REFLECTION TESTS
  // =========================================================================
  describe('4. Canonical Serviceability Reflection', () => {
    test('C.7.6-C.4a: Changing radius in Admin API immediately changes customer serviceability check', async () => {
      // Step 1: Set radius to 3.0 KM
      await updateDarkstoreOperations({
        storeId: 'store_primary',
        deliveryRadiusKm: 3.0,
      });

      // Customer location at ~3.3 KM from store (19.0224536, 73.3210018)
      const testLat = 19.0450;
      const testLon = 73.3400;

      const eval1 = await evaluateServerServiceability(
        'store_primary',
        testLat,
        testLon,
        100,
        { bypassCache: true }
      );
      expect(eval1.serviceable).toBe(false);

      // Step 2: Expand radius to 5.0 KM
      await updateDarkstoreOperations({
        storeId: 'store_primary',
        deliveryRadiusKm: 5.0,
      });

      const eval2 = await evaluateServerServiceability(
        'store_primary',
        testLat,
        testLon,
        100,
        { bypassCache: true }
      );

      expect(eval2.serviceable).toBe(true);
      expect(eval2.store?.deliveryRadiusKm).toBe(5.0);
    });

    test('C.7.6-C.4b: Toggling store to CLOSED immediately fails customer serviceability with STORE_OFFLINE', async () => {
      await updateDarkstoreOperations({
        storeId: 'store_primary',
        status: 'CLOSED',
      });

      const evalResult = await evaluateServerServiceability(
        'store_primary',
        19.0225,
        73.3211,
        100,
        { bypassCache: true }
      );

      expect(evalResult.serviceable).toBe(false);
      expect(evalResult.code).toBe('STORE_OFFLINE');
    });

    test('C.7.6-C.4c: Updating delivery fee and free delivery threshold immediately reflects in serviceability', async () => {
      await updateDarkstoreOperations({
        storeId: 'store_primary',
        deliveryFee: 40,
        freeDeliveryEnabled: true,
        freeDeliveryThreshold: 750,
      });

      const evalResult = await evaluateServerServiceability(
        'store_primary',
        19.0225,
        73.3211,
        500, // below 750 threshold -> fee = 40
        { bypassCache: true }
      );

      expect(evalResult.serviceable).toBe(true);
      expect(evalResult.deliveryFee).toBe(40);
      expect(evalResult.freeDeliveryThreshold).toBe(750);

      // Cart meeting 750 threshold -> fee = 0
      const evalFree = await evaluateServerServiceability(
        'store_primary',
        19.0225,
        73.3211,
        800,
        { bypassCache: true }
      );
      expect(evalFree.deliveryFee).toBe(0);
    });
  });

  // =========================================================================
  // 5. STATIC SOURCE CODE AUDIT FOR ADMIN SERVICE-AREA PAGE
  // =========================================================================
  describe('5. Admin Service-Area UI Static Audit', () => {
    const pagePath = path.resolve(__dirname, '../app/admin/service-area/page.tsx');
    const pageSource = fs.readFileSync(pagePath, 'utf8');

    test('C.7.6-C.5a: saveShopConfigFS is NOT the primary save handler in app/admin/service-area/page.tsx', () => {
      expect(pageSource).not.toMatch(/await\s+saveShopConfigFS\s*\(/);
    });

    test('C.7.6-C.5b: Page submits updates directly to canonical /api/admin/store/operations', () => {
      expect(pageSource).toContain("fetch('/api/admin/store/operations'");
      expect(pageSource).toContain("method: 'PUT'");
    });

    test('C.7.6-C.5c: Arbitrary 1-15 km range slider is removed in favor of canonical [3.0, 4.0, 5.0]', () => {
      expect(pageSource).not.toMatch(/type=["']range["']/);
      expect(pageSource).toContain('3.0, 4.0, 5.0');
    });

    test('C.7.6-C.5d: Coordinates are displayed as read-only / protected', () => {
      expect(pageSource).toContain('readOnly');
      expect(pageSource).toContain('Protected GPS Coordinates');
    });

    test('C.7.6-C.5e: Free delivery controls are present in the admin UI', () => {
      expect(pageSource).toContain('freeDeliveryEnabled');
      expect(pageSource).toContain('freeDeliveryThreshold');
      expect(pageSource).toContain('Free Delivery Above (₹)');
    });
  });
});
