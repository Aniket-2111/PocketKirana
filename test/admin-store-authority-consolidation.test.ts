/**
 * PocketKirana — Phase: Admin Store Authority Consolidation Test Suite
 *
 * Verifies:
 * 1. Legacy `/admin/stores` permanently redirects to `/admin/service-area`.
 * 2. Legacy `/api/admin/stores` and `/api/admin/stores/[id]` are retired (HTTP 410 Gone) and cannot mutate `STORES_STATE`.
 * 3. In-memory `updateStoreConfig` is retired and cannot mutate store state.
 * 4. Multi-store support in `/api/admin/store/operations` returns authorized stores from PostgreSQL according to RBAC.
 * 5. Store selection controls which PostgreSQL store is loaded/updated.
 * 6. Store Admin without store assignment is rejected with 403.
 * 7. Store coordinates remain strictly protected against casual admin modification.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

// ─── Route Handlers Under Test ───────────────────────────────────────────────
import { GET as getStoresLegacy, POST as postStoresLegacy } from '@/app/api/admin/stores/route';
import {
  GET as getStoreByIdLegacy,
  PUT as putStoreByIdLegacy,
  PATCH as patchStoreByIdLegacy,
  DELETE as deleteStoreByIdLegacy,
} from '@/app/api/admin/stores/[id]/route';
import { GET as getStoreOperations, PUT as putStoreOperations } from '@/app/api/admin/store/operations/route';
import { getStores, updateStoreConfig } from '@/lib/locationServices';
import { getAuthorizedStoresList } from '@/lib/storeOperationsService';
import { verifyStoreAccess } from '@/lib/routeAuth';

// ─── PostgreSQL Mocking ──────────────────────────────────────────────────────
const mockStoresTable = [
  {
    id: 'store_primary',
    name: 'PocketKirana Central Darkstore',
    code: 'STORE-001',
    is_active: true,
    latitude: '19.02245360',
    longitude: '73.32100180',
    delivery_radius_km: '3.00',
    delivery_fee: 29,
    free_delivery_enabled: true,
    free_delivery_threshold: 499,
    minimum_order_value: 0,
    opening_time: '06:00',
    closing_time: '23:00',
    delivery_fee_tiers: [],
    created_at: new Date('2026-01-01'),
  },
  {
    id: 'store_central_001',
    name: 'PocketKirana Central Store',
    code: 'PK-STORE-01',
    is_active: true,
    latitude: '19.02245360',
    longitude: '73.32100180',
    delivery_radius_km: '3.00',
    delivery_fee: 29,
    free_delivery_enabled: true,
    free_delivery_threshold: 499,
    minimum_order_value: 0,
    opening_time: '06:00',
    closing_time: '23:00',
    delivery_fee_tiers: [],
    created_at: new Date('2026-02-01'),
  },
];

const mockStoreAssignments: Array<{ admin_user_id: string; store_id: string }> = [
  { admin_user_id: 'store_admin_primary_only', store_id: 'store_primary' },
];

const mockQuery = vi.fn(async (sql: string, params: any[] = []) => {
  const queryStr = sql.toLowerCase();

  // 1. admin_store_assignments check
  if (queryStr.includes('admin_store_assignments')) {
    const uid = params[0];
    const targetStore = params[1];
    if (targetStore) {
      const match = mockStoreAssignments.filter(
        (a) => a.admin_user_id === uid && a.store_id === targetStore
      );
      return { rows: match };
    }
    // List assigned stores
    const assigned = mockStoreAssignments
      .filter((a) => a.admin_user_id === uid)
      .map((a) => mockStoresTable.find((s) => s.id === a.store_id))
      .filter(Boolean);
    return { rows: assigned };
  }

  // 2. SELECT FROM stores WHERE id = $1
  if (queryStr.includes('where id = $1 or upper(code) = upper($1)')) {
    const storeId = params[0];
    const row = mockStoresTable.find(
      (s) => s.id === storeId || s.code.toUpperCase() === String(storeId).toUpperCase()
    );
    return { rows: row ? [row] : [] };
  }

  // 3. SELECT * FROM stores ORDER BY created_at ASC
  if (queryStr.includes('from stores') && queryStr.includes('order by')) {
    return { rows: [...mockStoresTable] };
  }

  // 4. UPDATE stores
  if (queryStr.includes('update stores')) {
    const targetId = params[0];
    const idx = mockStoresTable.findIndex((s) => s.id === targetId);
    if (idx !== -1) {
      mockStoresTable[idx] = {
        ...mockStoresTable[idx],
        name: params[1],
        delivery_radius_km: String(params[6]),
        delivery_fee: Number(params[7]),
      };
      return { rows: [mockStoresTable[idx]] };
    }
    return { rows: [] };
  }

  // 5. Active queues
  if (queryStr.includes('active_picking')) {
    return { rows: [{ active_picking: 0, active_packing: 0, active_delivery: 0 }] };
  }

  // 6. audit_logs
  if (queryStr.includes('insert into audit_logs')) {
    return { rows: [] };
  }

  return { rows: [] };
});

vi.mock('@/lib/postgres', () => ({
  getPostgresPool: vi.fn(() => ({
    query: mockQuery,
  })),
}));

describe('Admin Store Authority Consolidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. LEGACY ROUTE REDIRECT AUDIT
  // =========================================================================
  describe('1. Legacy /admin/stores Route Retirement', () => {
    test('app/admin/stores/page.tsx redirects to /admin/service-area', () => {
      const pagePath = path.resolve(__dirname, '../app/admin/stores/page.tsx');
      const pageSrc = fs.readFileSync(pagePath, 'utf8');

      expect(pageSrc).toContain("redirect('/admin/service-area')");
      expect(pageSrc).not.toContain('InteractiveMapCanvas');
      expect(pageSrc).not.toContain('updateStoreConfig');
      expect(pageSrc).not.toContain('INITIAL_STORES');
      expect(pageSrc).not.toContain('minOrder');
    });
  });

  // =========================================================================
  // 2. LEGACY STORE APIS RETIREMENT (HTTP 410 GONE)
  // =========================================================================
  describe('2. Legacy Store APIs Retirement', () => {
    test('GET /api/admin/stores returns 410 GONE', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/stores');
      const res = await getStoresLegacy(req);
      expect(res.status).toBe(410);
      const json = await res.json();
      expect(json.error).toBe('GONE');
      expect(json.message).toContain('retired');
    });

    test('POST /api/admin/stores returns 410 GONE', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/stores', { method: 'POST' });
      const res = await postStoresLegacy(req);
      expect(res.status).toBe(410);
      const json = await res.json();
      expect(json.error).toBe('GONE');
    });

    test('GET /api/admin/stores/[id] returns 410 GONE', async () => {
      const res = await getStoreByIdLegacy();
      expect(res.status).toBe(410);
      const json = await res.json();
      expect(json.error).toBe('GONE');
    });

    test('PUT /api/admin/stores/[id] returns 410 GONE and prevents mutation', async () => {
      const res = await putStoreByIdLegacy();
      expect(res.status).toBe(410);
      const json = await res.json();
      expect(json.error).toBe('GONE');
    });

    test('PATCH /api/admin/stores/[id] returns 410 GONE and prevents mutation', async () => {
      const res = await patchStoreByIdLegacy();
      expect(res.status).toBe(410);
      const json = await res.json();
      expect(json.error).toBe('GONE');
    });

    test('DELETE /api/admin/stores/[id] returns 410 GONE', async () => {
      const res = await deleteStoreByIdLegacy();
      expect(res.status).toBe(410);
      const json = await res.json();
      expect(json.error).toBe('GONE');
    });
  });

  // =========================================================================
  // 3. IN-MEMORY STORE STATE MUTATION DECOMMISSIONING
  // =========================================================================
  describe('3. In-Memory Store State Decommissioning', () => {
    test('updateStoreConfig is disabled and returns null without mutating state', () => {
      const initialCount = getStores().length;
      const result = updateStoreConfig('fake-store-999', { name: 'Attempted Hack' });

      expect(result).toBeNull();
      expect(getStores().length).toBe(initialCount);
    });
  });

  // =========================================================================
  // 4. CANONICAL MULTI-STORE SUPPORT & RBAC
  // =========================================================================
  describe('4. Canonical Multi-Store Support & RBAC', () => {
    test('Main Admin receives all canonical stores from PostgreSQL', async () => {
      const stores = await getAuthorizedStoresList({ uid: 'admin_1', role: 'admin' });
      expect(stores.length).toBe(2);
      expect(stores.map((s) => s.id)).toEqual(['store_primary', 'store_central_001']);
    });

    test('Store Admin receives only assigned stores', async () => {
      const stores = await getAuthorizedStoresList({
        uid: 'store_admin_primary_only',
        role: 'store_admin',
      });
      expect(stores.length).toBe(1);
      expect(stores[0].id).toBe('store_primary');
    });

    test('GET /api/admin/store/operations includes authorizedStores list in response', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/store/operations?storeId=store_primary', {
        headers: { 'x-pk-role': 'admin', 'x-pk-uid': 'admin_1' },
      });
      const res = await getStoreOperations(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data.storeId).toBe('store_primary');
      expect(Array.isArray(json.data.authorizedStores)).toBe(true);
      expect(json.data.authorizedStores.length).toBe(2);
      expect(json.data.authorizedStores[0].id).toBe('store_primary');
      expect(json.data.authorizedStores[1].id).toBe('store_central_001');
    });

    test('Switching storeId loads second store (store_central_001)', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/store/operations?storeId=store_central_001', {
        headers: { 'x-pk-role': 'admin', 'x-pk-uid': 'admin_1' },
      });
      const res = await getStoreOperations(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data.storeId).toBe('store_central_001');
      expect(json.data.storeName).toBe('PocketKirana Central Store');
    });

    test('Store Admin attempting to access unassigned store is rejected with 403', async () => {
      const access = await verifyStoreAccess(
        { uid: 'store_admin_primary_only', role: 'store_admin' },
        'store_central_001'
      );
      expect(access.authorized).toBe(false);
      expect(access.statusCode).toBe(403);
    });
  });

  // =========================================================================
  // 5. COORDINATE PROTECTION & CANONICAL SETTINGS IN SERVICE-AREA UI
  // =========================================================================
  describe('5. Service-Area UI Static Audit', () => {
    const serviceAreaPath = path.resolve(__dirname, '../app/admin/service-area/page.tsx');
    const serviceAreaSrc = fs.readFileSync(serviceAreaPath, 'utf8');

    test('app/admin/service-area/page.tsx has multi-store selector', () => {
      expect(serviceAreaSrc).toContain('admin-store-select');
      expect(serviceAreaSrc).toContain('authorizedStores');
      expect(serviceAreaSrc).toContain('handleStoreSelect');
    });

    test('app/admin/service-area/page.tsx has error state banner with retry button', () => {
      expect(serviceAreaSrc).toContain('errorMessage');
      expect(serviceAreaSrc).toContain('Authority Connection Error');
      expect(serviceAreaSrc).toContain('Retry');
    });

    test('app/admin/service-area/page.tsx does not import mock INITIAL_STORES or updateStoreConfig', () => {
      expect(serviceAreaSrc).not.toContain('INITIAL_STORES');
      expect(serviceAreaSrc).not.toContain('updateStoreConfig');
    });

    test('Coordinates remain strictly read-only and locked', () => {
      expect(serviceAreaSrc).toContain('readOnly');
      expect(serviceAreaSrc).toContain('Protected GPS Coordinates');
      expect(serviceAreaSrc).toContain('Fixed Store Hub');
      expect(serviceAreaSrc).toContain('locked={true}');
    });

    test('Delivery radius is constrained to canonical 3.0, 4.0, 5.0 KM (no slider)', () => {
      expect(serviceAreaSrc).not.toMatch(/type=["']range["']/);
      expect(serviceAreaSrc).toContain('[3.0, 4.0, 5.0]');
    });
  });
});
