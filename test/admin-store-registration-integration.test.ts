/**
 * PocketKirana — Phase 2A Real PostgreSQL Integration Test
 *
 * TARGET DATABASE : pocketkirana_test  (pocketkirana_db is NEVER touched)
 *
 * Runtime Safety Guarantees:
 * 1. Reads test database connection string.
 * 2. Hard-aborts if db === 'pocketkirana_db'.
 * 3. Verifies SELECT current_database() === 'pocketkirana_test'.
 * 4. Inserts a canonical test store using registerCanonicalStore().
 * 5. Verifies canonical PostgreSQL store, primary warehouse, and STORE_REGISTERED audit log.
 * 6. Cleans up only the test store created by this suite.
 */

import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'fs';
import { Pool } from 'pg';

// Mock Firebase secondary mirror so no real Firebase network requests occur
vi.mock('@/lib/firebaseServices', () => ({
  saveShopConfigFS: vi.fn(async () => true),
  fetchShopsFS: vi.fn(async () => []),
}));

let testPool: Pool;
let testDatabaseUrl: string;

function getIsolatedTestDbUrl(): string {
  let rawUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!rawUrl && fs.existsSync('.env.local')) {
    const env = fs.readFileSync('.env.local', 'utf8');
    const match = env.match(/DATABASE_URL=([^\r\n]+)/);
    if (match) {
      rawUrl = match[1].trim().replace(/^["']|["']$/g, '');
    }
  }

  if (!rawUrl) {
    throw new Error('No database connection string found for test environment.');
  }

  // Force target to pocketkirana_test
  const testUrl = rawUrl.replace('/pocketkirana_db', '/pocketkirana_test');
  const parsed = new URL(testUrl);
  const dbName = parsed.pathname.replace(/^\//, '');

  if (dbName === 'pocketkirana_db') {
    throw new Error('FATAL SAFETY VIOLATION: Test suite attempted to connect to pocketkirana_db! ABORTING.');
  }
  if (dbName !== 'pocketkirana_test') {
    throw new Error(`FATAL SAFETY VIOLATION: Expected pocketkirana_test, got: ${dbName}`);
  }

  return testUrl;
}

describe('Phase 2A Real PostgreSQL Integration (pocketkirana_test)', () => {
  const TEST_STORE_CODE = 'PK-TEST-P2A-99';
  const EXPECTED_STORE_ID = 'store_pk_test_p2a_99';
  const EXPECTED_WH_ID = 'wh_store_pk_test_p2a_99';
  const EXPECTED_WH_CODE = 'WH-PK-TEST-P2A-99';

  beforeAll(async () => {
    testDatabaseUrl = getIsolatedTestDbUrl();
    process.env.DATABASE_URL = testDatabaseUrl;

    testPool = new Pool({ connectionString: testDatabaseUrl });

    // Runtime database verification — absolute guard
    const dbCheck = await testPool.query('SELECT current_database() as db');
    const currentDb = dbCheck.rows[0].db;
    if (currentDb !== 'pocketkirana_test') {
      throw new Error(`CRITICAL GUARD TRIGGERED: Connected to ${currentDb} instead of pocketkirana_test! Aborting.`);
    }

    // Clean up any stale test store from previous run
    await testPool.query('DELETE FROM audit_logs WHERE entity_id = $1', [EXPECTED_STORE_ID]);
    await testPool.query('DELETE FROM warehouses WHERE store_id = $1 OR id = $2', [EXPECTED_STORE_ID, EXPECTED_WH_ID]);
    await testPool.query('DELETE FROM stores WHERE id = $1 OR code = $2', [EXPECTED_STORE_ID, TEST_STORE_CODE]);
  });

  afterAll(async () => {
    if (testPool) {
      // Clean up test data
      await testPool.query('DELETE FROM audit_logs WHERE entity_id = $1', [EXPECTED_STORE_ID]);
      await testPool.query('DELETE FROM warehouses WHERE store_id = $1 OR id = $2', [EXPECTED_STORE_ID, EXPECTED_WH_ID]);
      await testPool.query('DELETE FROM stores WHERE id = $1 OR code = $2', [EXPECTED_STORE_ID, TEST_STORE_CODE]);
      await testPool.end();
    }
  });

  test('Integration 1: Database isolation confirmed to be pocketkirana_test', async () => {
    const res = await testPool.query('SELECT current_database() as db');
    expect(res.rows[0].db).toBe('pocketkirana_test');
  });

  test('Integration 2: registerCanonicalStore executes real transaction into pocketkirana_test', async () => {
    // Dynamic import to ensure process.env.DATABASE_URL is picked up by lib/postgres.ts
    const { registerCanonicalStore } = await import('@/lib/storeOperationsService');

    const result = await registerCanonicalStore({
      name: 'PocketKirana Test Darkstore Phase 2A',
      code: TEST_STORE_CODE,
      phone: '9876543210',
      address: '123 Test Market Road, Neral East',
      city: 'Neral',
      state: 'Maharashtra',
      pincode: '410101',
      latitude: 19.0250,
      longitude: 73.3250,
      delivery_radius_km: 4,
      delivery_fee: 25,
      free_delivery_enabled: true,
      free_delivery_threshold: 450,
      delivery_fee_tiers: [{ minOrder: 0, maxOrder: 200, fee: 30 }],
      opening_time: '06:30',
      closing_time: '22:30',
      actorUid: 'integration_test_admin',
      actorRole: 'admin',
    });

    expect(result.success).toBe(true);
    expect(result.registrationStatus).toBe('REGISTERED');
    expect(result.store.id).toBe(EXPECTED_STORE_ID);
    expect(result.store.code).toBe(TEST_STORE_CODE);
    expect(result.store.is_active).toBe(false);
    expect(result.store.minimum_order_value).toBe(0);
    expect(result.warehouse.id).toBe(EXPECTED_WH_ID);
    expect(result.warehouse.code).toBe(EXPECTED_WH_CODE);

    // 1. Verify store in PostgreSQL
    const storeRes = await testPool.query('SELECT * FROM stores WHERE id = $1', [EXPECTED_STORE_ID]);
    expect(storeRes.rows.length).toBe(1);
    const storeRow = storeRes.rows[0];
    expect(storeRow.name).toBe('PocketKirana Test Darkstore Phase 2A');
    expect(storeRow.code).toBe(TEST_STORE_CODE);
    expect(storeRow.is_active).toBe(false);
    expect(Number(storeRow.minimum_order_value)).toBe(0);
    expect(Number(storeRow.delivery_radius_km)).toBe(4);
    expect(Number(storeRow.delivery_fee)).toBe(25);
    expect(storeRow.free_delivery_enabled).toBe(true);
    expect(Number(storeRow.free_delivery_threshold)).toBe(450);
    expect(storeRow.opening_time).toBe('06:30');
    expect(storeRow.closing_time).toBe('22:30');

    // 2. Verify primary warehouse in PostgreSQL
    const whRes = await testPool.query('SELECT * FROM warehouses WHERE store_id = $1', [EXPECTED_STORE_ID]);
    expect(whRes.rows.length).toBe(1);
    const whRow = whRes.rows[0];
    expect(whRow.id).toBe(EXPECTED_WH_ID);
    expect(whRow.code).toBe(EXPECTED_WH_CODE);
    expect(whRow.warehouse_type).toBe('MAIN_STORE');
    expect(whRow.is_active).toBe(true);

    // 3. Verify audit log in PostgreSQL
    const auditRes = await testPool.query('SELECT * FROM audit_logs WHERE entity_id = $1', [EXPECTED_STORE_ID]);
    expect(auditRes.rows.length).toBe(1);
    const auditRow = auditRes.rows[0];
    expect(auditRow.action).toBe('STORE_REGISTERED');
    expect(auditRow.entity_type).toBe('STORE');
    expect(auditRow.firebase_uid).toBe('integration_test_admin');
  });

  test('Integration 3: Duplicate code rejected with 409 conflict', async () => {
    const { registerCanonicalStore } = await import('@/lib/storeOperationsService');

    await expect(
      registerCanonicalStore({
        name: 'Duplicate Attempt',
        code: TEST_STORE_CODE, // Already exists from previous test
        latitude: 19.0250,
        longitude: 73.3250,
      })
    ).rejects.toThrow(/already exists/i);
  });
});
