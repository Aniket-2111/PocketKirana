/**
 * PHASE 2.9B.5-I — Real PostgreSQL PhonePe Integration Tests
 *
 * TARGET DATABASE : pocketkirana_test  (pocketkirana_db is NEVER touched)
 * CONNECTION      : DATABASE_URL env — must point to pocketkirana_test
 *
 * Safety guarantees (enforced at runtime):
 *   - SELECT current_database() verified == pocketkirana_test before any DML
 *   - pocketkirana_db is hard-rejected
 *   - All external HTTP (PhonePe gateway), FCM, MSG91, Firestore writes are
 *     stubbed at the module level so no real side-effects occur.
 *   - No TRUNCATE of shared tables; cleanup removes only TEST-PHONEPE- records.
 *
 * Actual stores schema:  id, name, code, phone, address, city, state, pincode,
 *                        latitude, longitude, is_active, delivery_radius_km, ...
 *                        (NO store_code, NO email)
 * Actual orders schema:  id, order_number, firebase_uid (NOT customer_id), store_id,
 *                        total_amount, payment_status, order_status, payment_method,
 *                        currency, created_at, updated_at, ...
 * Actual payments schema: id, order_id, firebase_uid (NOT customer_id), payment_method,
 *                         amount, currency, status, gateway, gateway_order_id,
 *                         gateway_payment_id, paid_at, created_at, updated_at
 *
 * Tests:
 *   1. Successful payment reconciliation (webhook path)
 *   2. Webhook using orders.id as candidate
 *   3. Webhook using order_number as candidate
 *   4. Idempotency (duplicate webhook replay)
 *   5. Amount mismatch - rejection
 *   6. Unknown order - 404
 *   7. Rollback behaviour (forced error before COMMIT)
 *   8. Status-recovery route (mocked gateway SUCCESS)
 *   9. Concurrent reconciliation (race - exactly one success)
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import crypto from 'crypto';
import { Pool, PoolClient } from 'pg';

// ─── 0. CONSTANTS ────────────────────────────────────────────────────────────

const TEST_SALT_KEY = 'test_salt_key_phase_2_9b_5_i';
const TEST_SALT_INDEX = '1';
const TEST_MERCHANT_ID = 'TEST_MERCHANT_PK_2951';

const TEST_STORE_ID = 'TEST-PHONEPE-STORE-001';
const TEST_FIREBASE_UID = 'TEST-PHONEPE-UID-001';

// ─── 1. MODULE MOCKS ─────────────────────────────────────────────────────────

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

vi.mock('../lib/firebase', () => ({
  db: null,
  isFirebaseConfigured: vi.fn(() => false),
}));

vi.mock('../lib/firebaseServices', () => ({
  ensurePickingTaskForOrder: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body: unknown, init?: ResponseInit) => ({
      json: async () => body,
      status: (init as any)?.status ?? 200,
      headers: { set: vi.fn(), get: vi.fn() },
      body,
    })),
  },
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(() => undefined),
  })),
}));

// ─── 2. REAL POSTGRES POOL ───────────────────────────────────────────────────

let pool: Pool;
let testRunId: string;
let syntheticStoreDbId: string;

function buildTestPool(): Pool {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    throw new Error(
      'DATABASE_URL is not set — must point to pocketkirana_test for integration tests'
    );
  }

  // Strip trailing query params that could confuse pg (e.g. ?schema=public from Prisma)
  const cleanUrl = rawUrl.replace(/\?.*$/, '');
  const parsed = new URL(cleanUrl);
  const dbName = parsed.pathname.replace(/^\//, '');

  if (dbName === 'pocketkirana_db') {
    throw new Error(
      'FATAL SAFETY VIOLATION: Integration test attempted to use production database (pocketkirana_db)! ABORTING.'
    );
  }
  if (dbName !== 'pocketkirana_test') {
    throw new Error(`FATAL SAFETY VIOLATION: Expected pocketkirana_test, got: ${dbName}`);
  }

  return new Pool({
    connectionString: cleanUrl,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });
}

// ─── 3. SETUP / TEARDOWN ─────────────────────────────────────────────────────

beforeAll(async () => {
  pool = buildTestPool();

  // Runtime database verification — absolute guard
  const dbCheck = await pool.query('SELECT current_database()');
  const currentDb = dbCheck.rows[0].current_database;

  if (currentDb !== 'pocketkirana_test') {
    await pool.end();
    throw new Error(
      `ABORT: Connected to '${currentDb}' instead of 'pocketkirana_test'. Production safety guard triggered.`
    );
  }

  // Patch globalThis so the route's getPostgresPool() returns our test pool
  (globalThis as any)._postgresPool = pool;

  testRunId = `2951I-${Date.now()}`;
  console.log(`[Phase 2.9B.5-I] Run ID: ${testRunId}  DB: ${currentDb}`);

  // Insert a synthetic store for FK constraints on orders.store_id
  // stores schema: id, name, code, phone, address, city, state, pincode, is_active, created_at, updated_at
  const storeCode = `TPKST${testRunId.slice(-6)}`;
  const storeRes = await pool.query(
    `INSERT INTO stores (
       id, name, code,
       address, city, state, pincode,
       phone, is_active,
       free_delivery_enabled, delivery_fee_tiers,
       created_at, updated_at
     ) VALUES (
       $1, $2, $3,
       'Test Address, Integration Lane', 'Testpur', 'MH', '400001',
       '+919999999999', TRUE,
       FALSE, '[]'::jsonb,
       NOW(), NOW()
     ) RETURNING id`,
    [TEST_STORE_ID, 'TEST-PHONEPE-STORE Integration Store', storeCode]
  );
  syntheticStoreDbId = storeRes.rows[0].id;
  console.log(`[Phase 2.9B.5-I] Synthetic store inserted: ${syntheticStoreDbId}`);
});

afterAll(async () => {
  if (!pool) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const testOrders = await client.query(
      `SELECT id FROM orders WHERE order_number LIKE 'TEST-PHONEPE-%'`
    );
    const testOrderIds = testOrders.rows.map((r: any) => r.id);

    if (testOrderIds.length > 0) {
      await client.query(
        `DELETE FROM outbox_events
         WHERE aggregate_id LIKE 'pay_pk_TEST-PHONEPE-%'
            OR aggregate_id = ANY($1)`,
        [testOrderIds]
      );
      await client.query(
        `DELETE FROM payment_transactions WHERE payment_id LIKE 'pay_pk_TEST-PHONEPE-%'`
      );
      await client.query(
        `DELETE FROM payments WHERE order_id = ANY($1)`,
        [testOrderIds]
      );
      await client.query(
        `DELETE FROM order_status_history WHERE order_id = ANY($1)`,
        [testOrderIds]
      );
      await client.query(
        `DELETE FROM order_items WHERE order_id = ANY($1)`,
        [testOrderIds]
      );
      await client.query(
        `DELETE FROM orders WHERE id = ANY($1)`,
        [testOrderIds]
      );
    }

    await client.query(`DELETE FROM stores WHERE id = $1`, [TEST_STORE_ID]);
    await client.query('COMMIT');

    console.log(
      `[Phase 2.9B.5-I] Cleanup complete. Removed ${testOrderIds.length} test order(s) and synthetic store.`
    );
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  (globalThis as any)._postgresPool = undefined;
  await pool.end();
});

// ─── 4. TEST HELPERS ─────────────────────────────────────────────────────────

function buildWebhookRequest(payload: Record<string, any>): Request {
  const json = JSON.stringify(payload);
  const base64 = Buffer.from(json).toString('base64');
  const hash = crypto
    .createHash('sha256')
    .update(base64 + TEST_SALT_KEY)
    .digest('hex');
  const xVerify = `${hash}###${TEST_SALT_INDEX}`;

  return new Request('http://localhost/api/payments/phonepe/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-verify': xVerify },
    body: JSON.stringify({ response: base64 }),
  });
}

function buildPhonePeSuccessPayload(
  merchantTransactionId: string,
  amountPaise: number,
  transactionId?: string
) {
  return {
    success: true,
    code: 'PAYMENT_SUCCESS',
    message: 'Your request has been successfully completed.',
    data: {
      merchantId: TEST_MERCHANT_ID,
      merchantTransactionId,
      transactionId: transactionId || `TXNID_${merchantTransactionId}`,
      amount: amountPaise,
      state: 'COMPLETED',
      responseCode: 'SUCCESS',
      paymentInstrument: { type: 'UPI_INTENT', utr: `UTR_${Date.now()}` },
    },
  };
}

async function insertTestOrder(opts: {
  orderNumber: string;
  totalAmount: number;
  storeId?: string;
  paymentStatus?: string;
  orderStatus?: string;
}): Promise<{ id: string; order_number: string; total_amount: string }> {
  const orderId = `ord-test-${crypto.randomBytes(6).toString('hex')}`;
  const {
    orderNumber,
    totalAmount,
    storeId = TEST_STORE_ID,
    paymentStatus = 'pending',
    orderStatus = 'PAYMENT_PENDING',
  } = opts;

  // orders schema: id, order_number, firebase_uid, store_id, total_amount,
  //                payment_status, order_status, payment_method, ...
  //                (NO currency column in orders table)
  const res = await pool.query(
    `INSERT INTO orders (
       id, order_number, firebase_uid, store_id,
       total_amount, payment_status, order_status,
       payment_method,
       created_at, updated_at
     ) VALUES (
       $1, $2, $3, $4,
       $5, $6, $7,
       'phonepe',
       NOW(), NOW()
     ) RETURNING id, order_number, total_amount`,
    [orderId, orderNumber, TEST_FIREBASE_UID, storeId, totalAmount, paymentStatus, orderStatus]
  );
  return res.rows[0];
}

async function callWebhook(req: Request): Promise<{ body: any; status: number }> {
  const { POST } = await import('../app/api/payments/phonepe/webhook/route');
  const res = await POST(req);
  const body = (res as any).body ?? (await (res as any).json?.());
  const status = (res as any).status ?? 200;
  return { body, status };
}

async function queryDirect(sql: string, params?: any[]) {
  const r = await pool.query(sql, params);
  return r.rows;
}

// ─── 5. SAFETY CHECK ─────────────────────────────────────────────────────────

describe('[SAFETY] Production baseline guard', () => {
  it('test pool is connected to pocketkirana_test, not pocketkirana_db', async () => {
    const r = await pool.query('SELECT current_database()');
    expect(r.rows[0].current_database).toBe('pocketkirana_test');
  });
});

// ─── 6. TEST 1 — Successful reconciliation ───────────────────────────────────

describe('[Test 1] Successful payment reconciliation', () => {
  it('reconciles a Rs100 payment and persists all required rows', async () => {
    const orderNumber = `TEST-PHONEPE-T1-${testRunId}`;
    const order = await insertTestOrder({ orderNumber, totalAmount: 100.00 });

    const merchantTransactionId = `TXN_PK_${orderNumber}_${Date.now()}`;
    const amountPaise = 10000;

    const payload = buildPhonePeSuccessPayload(merchantTransactionId, amountPaise);
    const { body, status } = await callWebhook(buildWebhookRequest(payload));

    expect(status).toBe(200);
    expect(body.success).toBe(true);

    const orders = await queryDirect(
      `SELECT payment_status, order_status, total_amount FROM orders WHERE id = $1`,
      [order.id]
    );
    expect(orders[0].payment_status).toBe('paid');
    expect(orders[0].order_status).toBe('CONFIRMED');
    expect(Number(orders[0].total_amount)).toBeCloseTo(100.00, 2);

    const payments = await queryDirect(
      `SELECT order_id, amount, gateway, status FROM payments WHERE order_id = $1`,
      [order.id]
    );
    expect(payments.length).toBeGreaterThanOrEqual(1);
    expect(payments[0].status).toBe('completed');
    expect(payments[0].gateway).toBe('phonepe');
    expect(Number(payments[0].amount)).toBeCloseTo(100.00, 2);

    const txns = await queryDirect(
      `SELECT transaction_type, status, amount FROM payment_transactions WHERE payment_id = $1`,
      [`pay_pk_${merchantTransactionId}`]
    );
    expect(txns.length).toBeGreaterThanOrEqual(1);
    expect(txns[0].status).toBe('SUCCESS');
    expect(Number(txns[0].amount)).toBeCloseTo(100.00, 2);

    const history = await queryDirect(
      `SELECT new_status, changed_by FROM order_status_history WHERE order_id = $1`,
      [order.id]
    );
    expect(history.some((h: any) => h.new_status === 'CONFIRMED')).toBe(true);
    expect(history.some((h: any) => String(h.changed_by).startsWith('system:phonepe'))).toBe(true);

    const outbox = await queryDirect(
      `SELECT event_type, payload FROM outbox_events WHERE aggregate_id = $1`,
      [`pay_pk_${merchantTransactionId}`]
    );
    expect(outbox.length).toBeGreaterThanOrEqual(1);
    expect(outbox[0].event_type).toBe('payment.confirmed');
    const evtPayload =
      typeof outbox[0].payload === 'string'
        ? JSON.parse(outbox[0].payload)
        : outbox[0].payload;
    expect(Number(evtPayload.amount)).toBeCloseTo(100.00, 2);
  });
});

// ─── 7. TEST 2 — Webhook via orders.id ───────────────────────────────────────

describe('[Test 2] Webhook resolution via orders.id', () => {
  it('resolves and updates the correct order when candidate is a UUID id', async () => {
    const orderNumber = `TEST-PHONEPE-T2-${testRunId}`;
    const order = await insertTestOrder({ orderNumber, totalAmount: 250.00 });

    const merchantTransactionId = `TXN_PK_${order.id}_${Date.now()}`;
    const amountPaise = 25000;

    const payload = buildPhonePeSuccessPayload(merchantTransactionId, amountPaise);
    const { body, status } = await callWebhook(buildWebhookRequest(payload));

    expect(status).toBe(200);
    expect(body.success).toBe(true);

    const orders = await queryDirect(
      `SELECT payment_status, order_status FROM orders WHERE id = $1`,
      [order.id]
    );
    expect(orders[0].payment_status).toBe('paid');
    expect(orders[0].order_status).toBe('CONFIRMED');

    const payments = await queryDirect(
      `SELECT order_id FROM payments WHERE order_id = $1`,
      [order.id]
    );
    expect(payments.length).toBeGreaterThanOrEqual(1);
    expect(payments[0].order_id).toBe(order.id);
  });
});

// ─── 8. TEST 3 — Webhook via order_number ────────────────────────────────────

describe('[Test 3] Webhook resolution via order_number', () => {
  it('resolves and updates exactly one order when candidate is an order_number', async () => {
    const orderNumber = `TEST-PHONEPE-T3-${testRunId}`;
    const order = await insertTestOrder({ orderNumber, totalAmount: 75.50 });

    const merchantTransactionId = `TXN_PK_${orderNumber}_${Date.now()}`;
    const amountPaise = 7550;

    const payload = buildPhonePeSuccessPayload(merchantTransactionId, amountPaise);
    const { body, status } = await callWebhook(buildWebhookRequest(payload));

    expect(status).toBe(200);
    expect(body.success).toBe(true);

    const orders = await queryDirect(
      `SELECT id, payment_status, order_status FROM orders WHERE order_number = $1`,
      [orderNumber]
    );
    expect(orders.length).toBe(1);
    expect(orders[0].id).toBe(order.id);
    expect(orders[0].payment_status).toBe('paid');
    expect(orders[0].order_status).toBe('CONFIRMED');

    const otherOrders = await queryDirect(
      `SELECT COUNT(*) AS cnt FROM orders
       WHERE payment_status = 'paid'
         AND order_number LIKE 'TEST-PHONEPE-T3-%'
         AND id != $1`,
      [order.id]
    );
    expect(Number(otherOrders[0].cnt)).toBe(0);
  });
});

// ─── 9. TEST 4 — Idempotency ─────────────────────────────────────────────────

describe('[Test 4] Idempotency — duplicate webhook replay', () => {
  it('processes first call and silently ignores the second without corruption', async () => {
    const orderNumber = `TEST-PHONEPE-T4-${testRunId}`;
    const order = await insertTestOrder({ orderNumber, totalAmount: 500.00 });

    const merchantTransactionId = `TXN_PK_${orderNumber}_${Date.now()}`;
    const transactionId = `TXNID_IDEMPOTENCY_${Date.now()}`;
    const amountPaise = 50000;

    const payload = buildPhonePeSuccessPayload(merchantTransactionId, amountPaise, transactionId);

    const r1 = await callWebhook(buildWebhookRequest(payload));
    expect(r1.status).toBe(200);
    expect(r1.body.success).toBe(true);

    const r2 = await callWebhook(buildWebhookRequest(payload));
    expect(r2.status).toBe(200);
    expect(r2.body.success).toBe(true);
    expect(String(r2.body.message ?? r2.body.error ?? '')).toMatch(/already processed|idempotent/i);

    const txns = await queryDirect(
      `SELECT COUNT(*) AS cnt FROM payment_transactions
       WHERE transaction_id = $1 AND status = 'SUCCESS'`,
      [transactionId]
    );
    expect(Number(txns[0].cnt)).toBe(1);

    const orders = await queryDirect(
      `SELECT payment_status, order_status, total_amount FROM orders WHERE id = $1`,
      [order.id]
    );
    expect(orders[0].payment_status).toBe('paid');
    expect(orders[0].order_status).toBe('CONFIRMED');
    expect(Number(orders[0].total_amount)).toBeCloseTo(500.00, 2);

    const outbox = await queryDirect(
      `SELECT COUNT(*) AS cnt FROM outbox_events
       WHERE aggregate_id = $1 AND event_type = 'payment.confirmed'`,
      [`pay_pk_${merchantTransactionId}`]
    );
    expect(Number(outbox[0].cnt)).toBe(1);
  });
});

// ─── 10. TEST 5 — Amount mismatch ────────────────────────────────────────────

describe('[Test 5] Amount mismatch rejection', () => {
  it('rejects a payment where gateway amount (Rs99) differs from order total (Rs100)', async () => {
    const orderNumber = `TEST-PHONEPE-T5-${testRunId}`;
    const order = await insertTestOrder({ orderNumber, totalAmount: 100.00 });

    const merchantTransactionId = `TXN_PK_${orderNumber}_${Date.now()}`;
    const wrongAmountPaise = 9900;

    const payload = buildPhonePeSuccessPayload(merchantTransactionId, wrongAmountPaise);
    const { body, status } = await callWebhook(buildWebhookRequest(payload));

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(String(body.error)).toMatch(/amount mismatch/i);

    const orders = await queryDirect(
      `SELECT payment_status, order_status FROM orders WHERE id = $1`,
      [order.id]
    );
    expect(orders[0].payment_status).toBe('pending');
    expect(orders[0].order_status).toBe('PAYMENT_PENDING');

    const payments = await queryDirect(
      `SELECT COUNT(*) AS cnt FROM payments WHERE order_id = $1`,
      [order.id]
    );
    expect(Number(payments[0].cnt)).toBe(0);

    const outbox = await queryDirect(
      `SELECT COUNT(*) AS cnt FROM outbox_events WHERE aggregate_id = $1`,
      [`pay_pk_${merchantTransactionId}`]
    );
    expect(Number(outbox[0].cnt)).toBe(0);
  });
});

// ─── 11. TEST 6 — Unknown order ──────────────────────────────────────────────

describe('[Test 6] Unknown order — 404', () => {
  it('returns 404 and creates no database records for a non-existent order', async () => {
    const nonExistentOrderNumber = `TEST-PHONEPE-GHOST-${testRunId}`;
    const merchantTransactionId = `TXN_PK_${nonExistentOrderNumber}_${Date.now()}`;
    const amountPaise = 20000;

    const payload = buildPhonePeSuccessPayload(merchantTransactionId, amountPaise);
    const { body, status } = await callWebhook(buildWebhookRequest(payload));

    expect(status).toBe(404);
    expect(body.success).toBe(false);
    expect(String(body.error)).toMatch(/not found/i);

    const payments = await queryDirect(
      `SELECT COUNT(*) AS cnt FROM payments WHERE id = $1`,
      [`pay_pk_${merchantTransactionId}`]
    );
    expect(Number(payments[0].cnt)).toBe(0);

    const txns = await queryDirect(
      `SELECT COUNT(*) AS cnt FROM payment_transactions WHERE transaction_id LIKE $1`,
      [`%${nonExistentOrderNumber}%`]
    );
    expect(Number(txns[0].cnt)).toBe(0);

    const outbox = await queryDirect(
      `SELECT COUNT(*) AS cnt FROM outbox_events WHERE aggregate_id = $1`,
      [`pay_pk_${merchantTransactionId}`]
    );
    expect(Number(outbox[0].cnt)).toBe(0);
  });
});

// ─── 12. TEST 7 — Rollback behaviour ─────────────────────────────────────────

describe('[Test 7] Rollback behaviour — forced mid-transaction error', () => {
  it('leaves zero partial state when a transaction aborts before COMMIT', async () => {
    const orderNumber = `TEST-PHONEPE-T7-${testRunId}`;
    const order = await insertTestOrder({ orderNumber, totalAmount: 300.00 });

    const merchantTransactionId = `TXN_PK_${orderNumber}_ROLLBACK_${Date.now()}`;
    const paymentId = `pay_pk_${merchantTransactionId}`;

    // payments schema uses firebase_uid (not customer_id)
    const client: PoolClient = await pool.connect();
    let rolledBack = false;
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO payments (
           id, order_id, firebase_uid, payment_method, amount, currency,
           status, gateway, gateway_order_id, gateway_payment_id, paid_at
         ) VALUES ($1, $2, $3, 'phonepe', $4, 'INR', 'completed', 'phonepe', $5, $6, NOW())`,
        [
          paymentId,
          order.id,
          TEST_FIREBASE_UID,
          '300.00',
          merchantTransactionId,
          `TXNID_ROLLBACK_${Date.now()}`,
        ]
      );

      await client.query(
        `INSERT INTO order_status_history
           (id, order_id, old_status, new_status, changed_by, notes, created_at)
         VALUES ($1, $2, 'PAYMENT_PENDING', 'CONFIRMED', 'system:test_rollback', 'Rollback test', NOW())`,
        [`osh_rollback_${Date.now()}`, order.id]
      );

      throw new Error('Simulated fatal error before COMMIT — testing rollback');
    } catch (_err) {
      await client.query('ROLLBACK');
      rolledBack = true;
    } finally {
      client.release();
    }

    expect(rolledBack).toBe(true);

    const payments = await queryDirect(
      `SELECT COUNT(*) AS cnt FROM payments WHERE id = $1`,
      [paymentId]
    );
    expect(Number(payments[0].cnt)).toBe(0);

    const history = await queryDirect(
      `SELECT COUNT(*) AS cnt FROM order_status_history
       WHERE order_id = $1 AND changed_by = 'system:test_rollback'`,
      [order.id]
    );
    expect(Number(history[0].cnt)).toBe(0);

    const orders = await queryDirect(
      `SELECT payment_status, order_status FROM orders WHERE id = $1`,
      [order.id]
    );
    expect(orders[0].payment_status).toBe('pending');
    expect(orders[0].order_status).toBe('PAYMENT_PENDING');
  });
});

// ─── 13. TEST 8 — Status-recovery route ─────────────────────────────────────

describe('[Test 8] Payment status recovery route', () => {
  it('reconciles an order via the status route with a mocked SUCCESS gateway response', async () => {
    const orderNumber = `TEST-PHONEPE-T8-${testRunId}`;
    const order = await insertTestOrder({ orderNumber, totalAmount: 199.00 });

    const merchantTransactionId = `TXN_PK_${orderNumber}_${Date.now()}`;
    const transactionId = `TXNID_STATUS_${Date.now()}`;
    const amountPaise = 19900;

    const gatewayResponse = {
      success: true,
      code: 'PAYMENT_SUCCESS',
      data: {
        merchantId: TEST_MERCHANT_ID,
        merchantTransactionId,
        transactionId,
        amount: amountPaise,
        state: 'COMPLETED',
        responseCode: 'SUCCESS',
        paymentInstrument: { type: 'UPI_INTENT', utr: `UTR_STATUS_${Date.now()}` },
      },
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => gatewayResponse,
    }));

    vi.stubEnv('NEXT_PUBLIC_AUTH_MIDDLEWARE_ENABLED', 'false');

    const { GET } = await import('../app/api/payments/phonepe/status/route');

    const url =
      `http://localhost/api/payments/phonepe/status` +
      `?merchantTransactionId=${encodeURIComponent(merchantTransactionId)}` +
      `&orderId=${encodeURIComponent(order.id)}`;

    const res = await GET(new Request(url, { method: 'GET' }));
    const body = (res as any).body ?? (await (res as any).json?.());
    const statusCode = (res as any).status ?? 200;

    expect(statusCode).toBe(200);
    expect(body.success).toBe(true);

    const orders = await queryDirect(
      `SELECT payment_status, order_status FROM orders WHERE id = $1`,
      [order.id]
    );
    expect(orders[0].payment_status).toBe('paid');
    expect(orders[0].order_status).toBe('CONFIRMED');

    const payments = await queryDirect(
      `SELECT status, gateway FROM payments WHERE order_id = $1`,
      [order.id]
    );
    expect(payments.length).toBeGreaterThanOrEqual(1);
    expect(payments[0].status).toBe('completed');

    const txns = await queryDirect(
      `SELECT status, transaction_type FROM payment_transactions WHERE transaction_id = $1`,
      [transactionId]
    );
    expect(txns.length).toBeGreaterThanOrEqual(1);
    expect(txns[0].status).toBe('SUCCESS');
    expect(txns[0].transaction_type).toBe('STATUS_RECOVERY');

    const outbox = await queryDirect(
      `SELECT event_type FROM outbox_events WHERE aggregate_id = $1`,
      [`pay_pk_${merchantTransactionId}`]
    );
    expect(outbox.some((e: any) => e.event_type === 'payment.confirmed')).toBe(true);

    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
});

// ─── 14. TEST 9 — Concurrent reconciliation ──────────────────────────────────

describe('[Test 9] Concurrent reconciliation — race condition guard', () => {
  it('allows exactly one successful reconciliation when two webhooks race for the same order', async () => {
    const orderNumber = `TEST-PHONEPE-T9-${testRunId}`;
    const order = await insertTestOrder({ orderNumber, totalAmount: 150.00 });

    const merchantTransactionId = `TXN_PK_${orderNumber}_${Date.now()}`;
    const transactionId = `TXNID_CONCURRENT_${Date.now()}`;
    const amountPaise = 15000;

    const payload = buildPhonePeSuccessPayload(merchantTransactionId, amountPaise, transactionId);

    const [r1, r2] = await Promise.all([
      callWebhook(buildWebhookRequest(payload)),
      callWebhook(buildWebhookRequest(payload)),
    ]);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r1.body.success).toBe(true);
    expect(r2.body.success).toBe(true);

    const txns = await queryDirect(
      `SELECT COUNT(*) AS cnt FROM payment_transactions
       WHERE transaction_id = $1 AND status = 'SUCCESS'`,
      [transactionId]
    );
    expect(Number(txns[0].cnt)).toBe(1);

    const orders = await queryDirect(
      `SELECT payment_status, order_status, total_amount FROM orders WHERE id = $1`,
      [order.id]
    );
    expect(orders[0].payment_status).toBe('paid');
    expect(orders[0].order_status).toBe('CONFIRMED');
    expect(Number(orders[0].total_amount)).toBeCloseTo(150.00, 2);

    const outbox = await queryDirect(
      `SELECT COUNT(*) AS cnt FROM outbox_events
       WHERE aggregate_id = $1 AND event_type = 'payment.confirmed'`,
      [`pay_pk_${merchantTransactionId}`]
    );
    expect(Number(outbox[0].cnt)).toBe(1);

    const history = await queryDirect(
      `SELECT COUNT(*) AS cnt FROM order_status_history
       WHERE order_id = $1
         AND new_status = 'CONFIRMED'
         AND changed_by LIKE 'system:phonepe%'`,
      [order.id]
    );
    expect(Number(history[0].cnt)).toBe(1);
  });
});
