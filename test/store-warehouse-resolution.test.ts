/**
 * PocketKirana — Phase 2A.1: Store -> Primary Internal Inventory Location Resolution Test Suite
 *
 * TARGET DATABASE : pocketkirana_test  (pocketkirana_db is NEVER touched for DML)
 *
 * Verification Scope:
 * 1. Store A resolution (store_primary -> wh_store_primary)
 * 2. Store B resolution (store_central_001 -> wh_store_central_001)
 * 3. Unknown store explicit failure (store_does_not_exist -> 404)
 * 4. Missing warehouse explicit failure (store with no primary warehouse -> 404, no fallback)
 * 5. Checkout FEFO passes warehouse_id, not store_id
 * 6. Admin batch inventory resolves store_id to primary internal warehouse_id
 * 7. Cross-store isolation (Store A never resolves to Store B warehouse)
 * 8. Zero hardcoded warehouse IDs (wh_store-1 absent from production source)
 * 9. Existing FEFO batch allocation logic remains intact
 * 10. Real PostgreSQL transaction integrity & safety guards
 */

import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import {
  getPrimaryWarehouseIdForStore,
  getPrimaryWarehouseForStore,
} from '@/lib/storeOperationsService';
import { allocateFefoBatches, BatchCandidate, getFefoRecommendation } from '@/lib/fefo';
import { POST as batchesPostHandler, GET as batchesGetHandler } from '@/app/api/inventory/batches/route';
import { NextRequest } from 'next/server';

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

  // Force target strictly to pocketkirana_test
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

describe('Phase 2A.1 — Store -> Primary Inventory Location Resolution', () => {
  const STORE_A = 'store_primary';
  const WH_A = 'wh_store_primary';
  const STORE_B = 'store_central_001';
  const WH_B = 'wh_store_central_001';
  const STORE_ORPHAN = 'store_orphan_test';
  const TEST_VARIANT_ID = 'var_test_milk_1l';

  beforeAll(async () => {
    testDatabaseUrl = getIsolatedTestDbUrl();
    process.env.DATABASE_URL = testDatabaseUrl;
    testPool = new Pool({ connectionString: testDatabaseUrl });

    // Runtime Safety Guard: Verify target is strictly pocketkirana_test
    const dbCheck = await testPool.query('SELECT current_database() as db');
    const currentDb = dbCheck.rows[0].db;
    if (currentDb !== 'pocketkirana_test') {
      throw new Error(`CRITICAL GUARD TRIGGERED: Connected to ${currentDb} instead of pocketkirana_test! Aborting.`);
    }

    // Clean up test rows
    await testPool.query('DELETE FROM inventory_balances WHERE warehouse_id IN ($1, $2)', [WH_A, WH_B]);
    await testPool.query('DELETE FROM inventory_batches WHERE warehouse_id IN ($1, $2)', [WH_A, WH_B]);
    await testPool.query('DELETE FROM warehouses WHERE id IN ($1, $2)', [WH_A, WH_B]);
    await testPool.query('DELETE FROM stores WHERE id IN ($1, $2, $3)', [STORE_A, STORE_B, STORE_ORPHAN]);

    // Seed test stores in pocketkirana_test
    await testPool.query(
      `INSERT INTO stores (id, name, code, latitude, longitude, delivery_radius_km, is_active, created_at, updated_at)
       VALUES 
         ($1, 'PocketKirana Central Darkstore', 'STORE-001', 18.5204, 73.8567, 3.0, true, NOW(), NOW()),
         ($2, 'PocketKirana Central Store', 'PK-STORE-01', 18.5304, 73.8667, 4.0, true, NOW(), NOW()),
         ($3, 'PocketKirana Orphan Store', 'PK-STORE-ORPHAN', 18.5404, 73.8767, 3.0, true, NOW(), NOW())`,
      [STORE_A, STORE_B, STORE_ORPHAN]
    );

    // Seed primary warehouses linked to stores
    await testPool.query(
      `INSERT INTO warehouses (id, store_id, name, code, warehouse_type, is_active, created_at, updated_at)
       VALUES 
         ($1, $2, 'PocketKirana Central Darkstore Warehouse', 'WH_STORE-001', 'MAIN_STORE', true, NOW(), NOW()),
         ($3, $4, 'PocketKirana Central Store Warehouse', 'WH_PK-STORE-01', 'MAIN_STORE', true, NOW(), NOW())`,
      [WH_A, STORE_A, WH_B, STORE_B]
    );

    // Ensure dummy product and variant exist for batch inward tests
    await testPool.query(
      `INSERT INTO products (id, name, slug, description, is_active, created_at, updated_at)
       VALUES ('prod_test_milk', 'Amul Milk 1L', 'amul-milk-1l', 'Fresh Milk', true, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`
    );
    await testPool.query(
      `INSERT INTO product_variants (id, product_id, sku, variant_name, selling_price, mrp, is_active, created_at, updated_at)
       VALUES ($1, 'prod_test_milk', 'SKU-MILK-1L', '1L Pouch', 66.0, 66.0, true, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [TEST_VARIANT_ID]
    );
  });

  afterAll(async () => {
    if (testPool) {
      await testPool.query('DELETE FROM inventory_events WHERE warehouse_id IN ($1, $2)', [WH_A, WH_B]);
      await testPool.query('DELETE FROM inventory_balances WHERE warehouse_id IN ($1, $2)', [WH_A, WH_B]);
      await testPool.query('DELETE FROM inventory_batches WHERE warehouse_id IN ($1, $2)', [WH_A, WH_B]);
      await testPool.query('DELETE FROM warehouses WHERE id IN ($1, $2)', [WH_A, WH_B]);
      await testPool.query('DELETE FROM stores WHERE id IN ($1, $2, $3)', [STORE_A, STORE_B, STORE_ORPHAN]);
      await testPool.query('DELETE FROM product_variants WHERE id = $1', [TEST_VARIANT_ID]);
      await testPool.query('DELETE FROM products WHERE id = $1', ['prod_test_milk']);
      await testPool.end();
    }
  });

  test('Test 1 — Store A resolution: store_primary resolves to wh_store_primary', async () => {
    const warehouseId = await getPrimaryWarehouseIdForStore(STORE_A, testPool as any);
    expect(warehouseId).toBe(WH_A);

    const warehouseSummary = await getPrimaryWarehouseForStore(STORE_A, testPool as any);
    expect(warehouseSummary.id).toBe(WH_A);
    expect(warehouseSummary.storeId).toBe(STORE_A);
    expect(warehouseSummary.warehouseType).toBe('MAIN_STORE');
    expect(warehouseSummary.isActive).toBe(true);
  });

  test('Test 2 — Store B resolution: store_central_001 resolves to wh_store_central_001', async () => {
    const warehouseId = await getPrimaryWarehouseIdForStore(STORE_B, testPool as any);
    expect(warehouseId).toBe(WH_B);

    const warehouseSummary = await getPrimaryWarehouseForStore(STORE_B, testPool as any);
    expect(warehouseSummary.id).toBe(WH_B);
    expect(warehouseSummary.storeId).toBe(STORE_B);
    expect(warehouseSummary.warehouseType).toBe('MAIN_STORE');
    expect(warehouseSummary.isActive).toBe(true);
  });

  test('Test 3 — Unknown store: store_does_not_exist returns explicit 404 failure', async () => {
    await expect(getPrimaryWarehouseIdForStore('store_does_not_exist', testPool as any)).rejects.toThrow(
      /Store not found: No store exists with identifier 'store_does_not_exist'/
    );
  });

  test('Test 4 — Missing warehouse: store with no warehouse returns explicit 404 failure without fallback', async () => {
    await expect(getPrimaryWarehouseIdForStore(STORE_ORPHAN, testPool as any)).rejects.toThrow(
      /No active primary inventory location \(warehouse\) found for store 'store_orphan_test'/
    );
  });

  test('Test 5 — Checkout FEFO identifier flow: resolves warehouseId before querying FEFO', async () => {
    // 1. Inward a batch to Warehouse A
    const batchId = `b_test_${Date.now()}`;
    await testPool.query(
      `INSERT INTO inventory_batches (id, warehouse_id, variant_id, batch_number, expiry_date, received_qty, status, received_at)
       VALUES ($1, $2, $3, 'BAT-CHK-01', '2026-11-01', 50, 'ACTIVE', NOW())`,
      [batchId, WH_A, TEST_VARIANT_ID]
    );
    await testPool.query(
      `INSERT INTO inventory_balances (id, warehouse_id, variant_id, batch_id, available_qty, reserved_qty, damaged_qty, expired_qty, updated_at)
       VALUES ($1, $2, $3, $4, 50, 0, 0, 0, NOW())`,
      [`bal_${Date.now()}`, WH_A, TEST_VARIANT_ID, batchId]
    );

    // 2. Resolve warehouseId from storeId
    const resolvedWarehouseId = await getPrimaryWarehouseIdForStore(STORE_A, testPool as any);
    expect(resolvedWarehouseId).toBe(WH_A);

    // 3. FEFO query receives warehouseId (NOT storeId)
    const fefoResult = await getFefoRecommendation(TEST_VARIANT_ID, resolvedWarehouseId, 5, testPool as any);
    expect(fefoResult.fulfilledQty).toBe(5);
    expect(fefoResult.isFullyFulfilled).toBe(true);
    expect(fefoResult.allocations.length).toBeGreaterThan(0);
    expect(fefoResult.allocations[0].batchId).toBe(batchId);

    // 4. Passing storeId directly to FEFO must fail to find warehouse batches (proving separation)
    const invalidStoreFefo = await getFefoRecommendation(TEST_VARIANT_ID, STORE_A, 5, testPool as any);
    expect(invalidStoreFefo.fulfilledQty).toBe(0);
    expect(invalidStoreFefo.isFullyFulfilled).toBe(false);
  });

  test('Test 6 — Admin inventory: POST /api/inventory/batches accepts store_id and resolves internal warehouse', async () => {
    const fakeReq = new NextRequest('http://localhost:3000/api/inventory/batches', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-pk-role': 'admin',
        'x-pk-uid': 'admin_test_uid',
      },
      body: JSON.stringify({
        store_id: STORE_B,
        variant_id: TEST_VARIANT_ID,
        batch_number: 'BATCH-STORE-B-001',
        received_qty: 25,
        mrp_at_receipt: 66.0,
        notes: 'Inwarded via store_id resolution',
      }),
    });

    const res = await batchesPostHandler(fakeReq);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.batch.warehouse_id).toBe(WH_B); // Resolved internally to Store B's warehouse!

    // Verify row was written to inventory_balances with WH_B
    const balCheck = await testPool.query(
      'SELECT warehouse_id, available_qty FROM inventory_balances WHERE batch_id = $1',
      [json.batch.id]
    );
    expect(balCheck.rowCount).toBe(1);
    expect(balCheck.rows[0].warehouse_id).toBe(WH_B);
  });

  test('Test 7 — Cross-store isolation: Store A never resolves to Store B warehouse', async () => {
    const whA = await getPrimaryWarehouseIdForStore(STORE_A, testPool as any);
    const whB = await getPrimaryWarehouseIdForStore(STORE_B, testPool as any);

    expect(whA).toBe(WH_A);
    expect(whB).toBe(WH_B);
    expect(whA).not.toBe(whB);
    expect(whA).not.toBe(WH_B);
    expect(whB).not.toBe(WH_A);
  });

  test('Test 8 — No hardcoded warehouse: wh_store-1 completely absent from production source', async () => {
    const dirsToScan = ['app', 'lib', 'components'];
    const forbiddenToken = 'wh_store-1';

    function scanDir(dirPath: string): string[] {
      const violations: string[] = [];
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          violations.push(...scanDir(fullPath));
        } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          if (content.includes(forbiddenToken)) {
            violations.push(fullPath);
          }
        }
      }
      return violations;
    }

    const allViolations: string[] = [];
    for (const dir of dirsToScan) {
      if (fs.existsSync(dir)) {
        allViolations.push(...scanDir(dir));
      }
    }

    expect(allViolations).toHaveLength(0);
  });

  test('Test 9 — Existing FEFO behavior: pure batch allocation rules remain unmodified', () => {
    const batches: BatchCandidate[] = [
      { id: 'b-nov', batchNumber: 'B-NOV', expiryDate: '2026-11-01', availableQty: 20, status: 'ACTIVE' },
      { id: 'b-oct', batchNumber: 'B-OCT', expiryDate: '2026-10-01', availableQty: 10, status: 'ACTIVE' },
      { id: 'b-dec', batchNumber: 'B-DEC', expiryDate: '2026-12-01', availableQty: 30, status: 'ACTIVE' },
    ];

    const result = allocateFefoBatches(batches, 15, new Date('2026-09-01'));
    expect(result.isFullyFulfilled).toBe(true);
    expect(result.fulfilledQty).toBe(15);
    expect(result.allocations[0].batchId).toBe('b-oct');
    expect(result.allocations[0].pickQty).toBe(10);
    expect(result.allocations[1].batchId).toBe('b-nov');
    expect(result.allocations[1].pickQty).toBe(5);
  });
});
