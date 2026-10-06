/**
 * PHASE 2.9B.5-I-CLEANUP — Real PostgreSQL PhonePe CREATE Route Schema Test
 *
 * TARGET DATABASE : pocketkirana_test (pocketkirana_db is NEVER touched)
 *
 * Verifies:
 * 1. The CREATE route reads orders from PostgreSQL without throwing ERROR 42703.
 * 2. Query does not reference nonexistent 'customer_id' or 'customer_phone' on orders.
 * 3. Uses canonical 'firebase_uid' for customer identity and order ownership.
 * 4. Resolves customer phone from canonical 'order_addresses' table or falls back safely to '9999999999'.
 * 5. Does not silently fall back to Firestore because of schema mismatch.
 * 6. Safety guard: Hard-aborts if connected to 'pocketkirana_db'.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import crypto from 'crypto';
import { Pool } from 'pg';

const TEST_SALT_KEY = 'test_salt_key_create_cleanup';
const TEST_SALT_INDEX = '1';
const TEST_MERCHANT_ID = 'TEST_MERCHANT_PK_CREATE';
const TEST_UID = 'usr-cust-1';
const TEST_STORE_ID = 'TEST-PHONEPE-CREATE-STORE-001';

// ─── MODULE MOCKS ────────────────────────────────────────────────────────────

vi.mock('../lib/phonepeConfig', () => ({
  getPhonePeConfig: vi.fn(() => ({
    merchantId: TEST_MERCHANT_ID,
    saltKey: TEST_SALT_KEY,
    saltIndex: TEST_SALT_INDEX,
    isProduction: false,
    baseUrl: 'https://api-preprod.phonepe.com/apis/pg-sandbox',
  })),
  isSimulationMode: vi.fn(() => false),
}));

const mockGetDoc = vi.fn().mockResolvedValue({ exists: () => false });
vi.mock('../lib/firebase', () => ({
  db: { _isMockDb: true },
  isFirebaseConfigured: vi.fn(() => true),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, coll, id) => ({ coll, id })),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  setDoc: vi.fn().mockResolvedValue(undefined),
}));

// ─── REAL POSTGRES POOL BUILDER ──────────────────────────────────────────────

let pool: Pool;
let testRunId: string;
let lastPhonePePayload: any = null;

function buildTestPool(): Pool {
  let envUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;
  if (!envUrl) {
    try {
      const fs = require('fs');
      const path = require('path');
      const envPath = path.resolve(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const match = content.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
        if (match) envUrl = match[1];
      }
    } catch {}
  }
  if (!envUrl) {
    throw new Error('DATABASE_URL or DATABASE_URL_TEST must be set for integration test');
  }

  // Derive test database URL if DATABASE_URL points to pocketkirana_db
  let targetUrl = envUrl.replace(/\?.*$/, '');
  if (targetUrl.includes('/pocketkirana_db')) {
    targetUrl = targetUrl.replace('/pocketkirana_db', '/pocketkirana_test');
  }

  const parsed = new URL(targetUrl);
  const dbName = parsed.pathname.replace(/^\//, '');

  if (dbName === 'pocketkirana_db') {
    throw new Error(
      'FATAL SAFETY VIOLATION: Test attempted to use production database (pocketkirana_db)! ABORTING.'
    );
  }
  if (dbName !== 'pocketkirana_test') {
    throw new Error(`FATAL SAFETY VIOLATION: Expected pocketkirana_test, got: ${dbName}`);
  }

  return new Pool({
    connectionString: targetUrl,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });
}

// ─── SETUP / TEARDOWN ────────────────────────────────────────────────────────

beforeAll(async () => {
  pool = buildTestPool();

  const dbCheck = await pool.query('SELECT current_database()');
  const currentDb = dbCheck.rows[0].current_database;
  if (currentDb !== 'pocketkirana_test') {
    await pool.end();
    throw new Error(`ABORT: Connected to '${currentDb}' instead of 'pocketkirana_test'.`);
  }

  // Inject into global pool so queryPostgres uses test pool
  (globalThis as any)._postgresPool = pool;
  testRunId = Date.now().toString().slice(-6);

  // Insert synthetic store for FK
  await pool.query(
    `INSERT INTO stores (
       id, name, code, address, city, state, pincode, phone, is_active,
       free_delivery_enabled, delivery_fee_tiers, created_at, updated_at
     ) VALUES (
       $1, 'TEST Create Store', $2, 'Address', 'Panvel', 'MH', '410206', '+919999999999', TRUE,
       FALSE, '[]'::jsonb, NOW(), NOW()
     ) ON CONFLICT (id) DO NOTHING`,
    [TEST_STORE_ID, `TSTCR${testRunId.slice(-6)}`]
  );

  // Intercept fetch for PhonePe /pg/v1/pay
  vi.stubGlobal('fetch', vi.fn(async (url: any, init: any) => {
    if (String(url).includes('/pg/v1/pay')) {
      const parsedBody = JSON.parse(init.body);
      const decodedPayload = JSON.parse(Buffer.from(parsedBody.request, 'base64').toString('utf8'));
      lastPhonePePayload = decodedPayload;

      return {
        ok: true,
        json: async () => ({
          success: true,
          code: 'PAYMENT_INITIATED',
          message: 'Payment Initiated',
          data: {
            merchantId: TEST_MERCHANT_ID,
            merchantTransactionId: decodedPayload.merchantTransactionId,
            instrumentResponse: {
              type: 'PAY_PAGE',
              redirectInfo: {
                url: `https://mercury-uat.phonepe.com/transact?token=tok_test_${Date.now()}`,
                method: 'GET',
              },
            },
          },
        }),
      };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  }));
});

afterAll(async () => {
  if (!pool) return;
  vi.unstubAllGlobals();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const testOrders = await client.query(
      `SELECT id FROM orders WHERE order_number LIKE 'TEST-PHONEPE-CREATE-%'`
    );
    const testOrderIds = testOrders.rows.map((r: any) => r.id);

    if (testOrderIds.length > 0) {
      await client.query(`DELETE FROM payments WHERE order_id = ANY($1)`, [testOrderIds]);
      await client.query(`DELETE FROM order_addresses WHERE order_id = ANY($1)`, [testOrderIds]);
      await client.query(`DELETE FROM orders WHERE id = ANY($1)`, [testOrderIds]);
    }
    await client.query(`DELETE FROM stores WHERE id = $1`, [TEST_STORE_ID]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    (globalThis as any)._postgresPool = undefined;
    await pool.end();
  }
});

// ─── HELPERS ─────────────────────────────────────────────────────────────────

async function invokeCreateRoute(body: { orderId: string; customerPhone?: string }) {
  const { POST } = await import('../app/api/payments/phonepe/create/route');
  const req = new Request('http://localhost:3000/api/payments/phonepe/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const res = await POST(req);
  const json = await res.json();
  return { status: res.status, json };
}

// ─── TESTS ───────────────────────────────────────────────────────────────────

describe('Phase 2.9B.5-I-CLEANUP: PhonePe CREATE Route PostgreSQL Schema Fix', () => {
  it('Safety Guard: Test connects strictly to pocketkirana_test', async () => {
    const r = await pool.query('SELECT current_database()');
    expect(r.rows[0].current_database).toBe('pocketkirana_test');
  });

  it('Test 1: Reads canonical PostgreSQL order with order_addresses phone without ERROR 42703', async () => {
    const orderId = `ord_create_t1_${Date.now()}`;
    const orderNumber = `TEST-PHONEPE-CREATE-T1-${testRunId}`;
    lastPhonePePayload = null;

    // Insert canonical PostgreSQL order (using firebase_uid, no customer_id / customer_phone on orders)
    await pool.query(
      `INSERT INTO orders (
         id, order_number, firebase_uid, store_id, total_amount, payment_status, order_status,
         payment_method, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, 'pending', 'placed', 'phonepe', NOW(), NOW())`,
      [orderId, orderNumber, TEST_UID, TEST_STORE_ID, 275.50]
    );

    // Insert canonical order address with phone
    await pool.query(
      `INSERT INTO order_addresses (
         id, order_id, receiver_name, phone, address_line_1, city, state, pincode, created_at
       ) VALUES ($1, $2, 'Test Customer', '+91 9876543210', 'Line 1', 'Panvel', 'MH', '410206', NOW())`,
      [`addr_${orderId}`, orderId]
    );

    const { status, json } = await invokeCreateRoute({ orderId });

    expect(status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.orderId).toBe(orderId);
    expect(json.data.amount).toBe(275.50);

    // Verify PhonePe payload received correct canonical values
    expect(lastPhonePePayload).not.toBeNull();
    expect(lastPhonePePayload.merchantUserId).toBe(`USER_${TEST_UID}`);
    expect(lastPhonePePayload.amount).toBe(27550); // 275.50 * 100 paise
    expect(lastPhonePePayload.mobileNumber).toBe('9876543210'); // extracted from order_addresses

    // Verify payment record in PostgreSQL
    const pRes = await pool.query(`SELECT status, amount, firebase_uid FROM payments WHERE order_id = $1`, [orderId]);
    expect(pRes.rows.length).toBe(1);
    expect(pRes.rows[0].firebase_uid).toBe(TEST_UID);
    expect(Number(pRes.rows[0].amount)).toBeCloseTo(275.50, 2);

    // Verify Firestore fallback was NOT triggered
    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  it('Test 2: Reads canonical PostgreSQL order without address and falls back safely to default phone', async () => {
    const orderId = `ord_create_t2_${Date.now()}`;
    const orderNumber = `TEST-PHONEPE-CREATE-T2-${testRunId}`;
    lastPhonePePayload = null;

    // Insert order WITHOUT order_addresses record
    await pool.query(
      `INSERT INTO orders (
         id, order_number, firebase_uid, store_id, total_amount, payment_status, order_status,
         payment_method, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, 'pending', 'placed', 'phonepe', NOW(), NOW())`,
      [orderId, orderNumber, TEST_UID, TEST_STORE_ID, 150.00]
    );

    const { status, json } = await invokeCreateRoute({ orderId });

    expect(status).toBe(200);
    expect(json.success).toBe(true);
    expect(lastPhonePePayload).not.toBeNull();
    expect(lastPhonePePayload.mobileNumber).toBe('9999999999'); // Safe default
  });

  it('Test 3: Enforces order ownership using canonical firebase_uid (returns 403 on mismatch)', async () => {
    const orderId = `ord_create_t3_${Date.now()}`;
    const orderNumber = `TEST-PHONEPE-CREATE-T3-${testRunId}`;

    // Insert order belonging to another customer
    await pool.query(
      `INSERT INTO orders (
         id, order_number, firebase_uid, store_id, total_amount, payment_status, order_status,
         payment_method, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, 'pending', 'placed', 'phonepe', NOW(), NOW())`,
      [orderId, orderNumber, 'usr-different-owner-999', TEST_STORE_ID, 200.00]
    );

    const { status, json } = await invokeCreateRoute({ orderId });

    expect(status).toBe(403);
    expect(json.success).toBe(false);
    expect(json.error).toContain('Order ownership mismatch');
  });

  it('Test 4: Rejects payment initiation for already paid order', async () => {
    const orderId = `ord_create_t4_${Date.now()}`;
    const orderNumber = `TEST-PHONEPE-CREATE-T4-${testRunId}`;

    await pool.query(
      `INSERT INTO orders (
         id, order_number, firebase_uid, store_id, total_amount, payment_status, order_status,
         payment_method, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, 'paid', 'CONFIRMED', 'phonepe', NOW(), NOW())`,
      [orderId, orderNumber, TEST_UID, TEST_STORE_ID, 300.00]
    );

    const { status, json } = await invokeCreateRoute({ orderId });

    expect(status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toContain('Order has already been paid');
  });
});
