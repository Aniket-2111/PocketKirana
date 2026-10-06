import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { GET as phonepeStatusHandler } from '../app/api/payments/phonepe/status/route';

interface MockQueryCall {
  sql: string;
  params?: any[];
}

let mockQueries: MockQueryCall[] = [];
let mockCurrentOrder: any = null;
let mockUpdateRowCount = 1;
let mockExistingTxRowCount = 0;
let mockRolledBack = false;
let mockCommitted = false;
let commitTimestamp = 0;
let firestoreCallTimestamps: number[] = [];

const mockClient = {
  query: vi.fn(async (sql: string, params?: any[]) => {
    mockQueries.push({ sql, params });

    if (sql === 'BEGIN') {
      mockRolledBack = false;
      mockCommitted = false;
      commitTimestamp = 0;
      firestoreCallTimestamps = [];
      return { rowCount: 1 };
    }

    if (sql === 'ROLLBACK') {
      mockRolledBack = true;
      return { rowCount: 1 };
    }

    if (sql === 'COMMIT') {
      mockCommitted = true;
      commitTimestamp = Date.now();
      return { rowCount: 1 };
    }

    // 1. SELECT order with FOR UPDATE
    if (sql.includes('SELECT') && sql.includes('FROM orders')) {
      if (!mockCurrentOrder) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [{ ...mockCurrentOrder }], rowCount: 1 };
    }

    // 2. SELECT payment_transactions for idempotency check
    if (sql.includes('SELECT') && sql.includes('FROM payment_transactions')) {
      return {
        rows: mockExistingTxRowCount > 0 ? [{ id: 'ptxn_existing' }] : [],
        rowCount: mockExistingTxRowCount,
      };
    }

    // 3. UPDATE orders
    if (sql.includes('UPDATE orders')) {
      return { rowCount: mockUpdateRowCount };
    }

    // 4. INSERT into payments, payment_transactions, order_status_history
    if (sql.includes('INSERT INTO')) {
      return { rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }),
  release: vi.fn(),
};

const mockGetDoc = vi.fn();
const mockUpdateDoc = vi.fn().mockImplementation(async () => {
  firestoreCallTimestamps.push(Date.now());
  return true;
});
const mockSetDoc = vi.fn().mockImplementation(async () => {
  firestoreCallTimestamps.push(Date.now());
  return true;
});
const mockAppendOutboxEvent = vi.fn().mockResolvedValue(true);
const mockEnsurePickingTask = vi.fn().mockResolvedValue(true);

vi.mock('../lib/phonepeConfig', () => ({
  getPhonePeConfig: vi.fn(() => ({
    merchantId: 'TEST_MERCHANT_STATUS',
    saltKey: 'status_salt_key_123',
    saltIndex: 1,
    env: 'UAT',
    baseUrl: 'https://api-preprod.phonepe.com/apis/pg-sandbox',
  })),
  isSimulationMode: vi.fn(() => false),
}));

vi.mock('../lib/firebase', () => ({
  db: {},
  isFirebaseConfigured: vi.fn(() => true),
}));

vi.mock('firebase/firestore', () => ({
  getDoc: (...args: any[]) => mockGetDoc(...args),
  doc: vi.fn((_db, col, id) => ({ col, id })),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  setDoc: (...args: any[]) => mockSetDoc(...args),
}));

vi.mock('../lib/firebaseServices', () => ({
  ensurePickingTaskForOrder: (...args: any[]) => mockEnsurePickingTask(...args),
}));

vi.mock('../lib/db/outbox', () => ({
  appendOutboxEvent: (...args: any[]) => mockAppendOutboxEvent(...args),
}));

vi.mock('../lib/postgres', () => ({
  getPostgresPool: vi.fn(() => ({
    connect: vi.fn().mockResolvedValue(mockClient),
    query: vi.fn((...args: any[]) => mockClient.query(...(args as [string, any[]]))),
  })),
}));

describe('Phase 2.9B.4 — PhonePe Status / Recovery Canonical PostgreSQL Reconciliation', () => {
  const originalFetch = global.fetch;

  function mockGatewayResponse(data: {
    success?: boolean;
    responseCode?: string;
    amount?: number;
    transactionId?: string;
    code?: string;
  }) {
    global.fetch = vi.fn(async () => ({
      status: 200,
      json: async () => ({
        success: data.success ?? true,
        code: data.code || (data.responseCode === 'SUCCESS' ? 'PAYMENT_SUCCESS' : 'PAYMENT_ERROR'),
        message: 'Mock gateway response',
        data: {
          merchantId: 'TEST_MERCHANT_STATUS',
          merchantTransactionId: 'TXN_PK_PK-11_1728000000',
          transactionId: data.transactionId || 'T_PH_GATEWAY_REC_99',
          amount: data.amount ?? 51200, // 51200 paise = ₹512.00
          responseCode: data.responseCode ?? 'SUCCESS',
        },
      }),
    })) as any;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockQueries = [];
    mockUpdateRowCount = 1;
    mockExistingTxRowCount = 0;
    mockRolledBack = false;
    mockCommitted = false;
    commitTimestamp = 0;
    firestoreCallTimestamps = [];

    mockCurrentOrder = {
      id: 'ord_canonical_uuid_101',
      order_number: 'PK-11',
      customer_id: 'usr_cust_canonical_1',
      firebase_uid: 'usr_cust_canonical_1',
      total_amount: '512.00',
      payment_status: 'pending',
      order_status: 'PLACED',
    };

    mockGetDoc.mockResolvedValue({
      exists: () => false,
      data: () => null,
    });

    mockGatewayResponse({ responseCode: 'SUCCESS', amount: 51200 });
  });

  // ── TEST 1: PhonePe SUCCESS confirms PostgreSQL order ────────────
  it('1. PhonePe SUCCESS confirms PostgreSQL order: updates status to CONFIRMED/paid with canonical ID', async () => {
    const txnId = 'TXN_PK_PK-11_1728000000';
    const req = new Request(`http://localhost:3000/api/payments/phonepe/status?merchantTransactionId=${txnId}`, {
      method: 'GET',
    });

    const res = await phonepeStatusHandler(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.verified).toBe(true);
    expect(json.data.paymentStatus).toBe('paid');
    expect(json.data.orderStatus).toBe('CONFIRMED');
    expect(json.data.orderId).toBe('ord_canonical_uuid_101');

    // Verify PostgreSQL transaction committed
    expect(mockCommitted).toBe(true);
    expect(mockRolledBack).toBe(false);

    // Verify UPDATE orders query targeted canonical ID
    const updateQuery = mockQueries.find(q => q.sql.includes('UPDATE orders'));
    expect(updateQuery).toBeDefined();
    expect(updateQuery?.sql).toContain("payment_status = 'paid'");
    expect(updateQuery?.sql).toContain("order_status = 'CONFIRMED'");
    expect(updateQuery?.params).toEqual(['ord_canonical_uuid_101']);
  });

  // ── TEST 2: order_number resolution ──────────────────────────────
  it('2. order_number resolution: resolves canonical ID when input is order_number (e.g. PK-11)', async () => {
    const req = new Request(`http://localhost:3000/api/payments/phonepe/status?merchantTransactionId=TXN_PK_PK-11_1728000000&orderId=PK-11`, {
      method: 'GET',
    });

    const res = await phonepeStatusHandler(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.orderId).toBe('ord_canonical_uuid_101');

    // Verify canonical ID used across payments and orders
    const paymentInsert = mockQueries.find(q => q.sql.includes('INSERT INTO payments'));
    expect(paymentInsert?.params?.[1]).toBe('ord_canonical_uuid_101');

    const updateOrder = mockQueries.find(q => q.sql.includes('UPDATE orders'));
    expect(updateOrder?.params?.[0]).toBe('ord_canonical_uuid_101');
  });

  // ── TEST 3: payment ledger ───────────────────────────────────────
  it('3. payment ledger: inserts payment_transactions with transaction_type = STATUS_RECOVERY and status = SUCCESS', async () => {
    const txnId = 'TXN_PK_PK-11_1728000000';
    const req = new Request(`http://localhost:3000/api/payments/phonepe/status?merchantTransactionId=${txnId}`, {
      method: 'GET',
    });

    const res = await phonepeStatusHandler(req);
    expect(res.status).toBe(200);

    const ledgerInsert = mockQueries.find(q => q.sql.includes('INSERT INTO payment_transactions'));
    expect(ledgerInsert).toBeDefined();
    expect(ledgerInsert?.sql).toContain('STATUS_RECOVERY');
    expect(ledgerInsert?.sql).toContain('SUCCESS');
    expect(ledgerInsert?.params?.[1]).toBe(`pay_pk_${txnId}`);
    expect(ledgerInsert?.params?.[2]).toBe('T_PH_GATEWAY_REC_99');
    expect(ledgerInsert?.params?.[3]).toBe('512.00');
  });

  // ── TEST 4: outbox event ─────────────────────────────────────────
  it('4. outbox: enqueues payment.confirmed event before COMMIT with canonical payload', async () => {
    const txnId = 'TXN_PK_PK-11_1728000000';
    const req = new Request(`http://localhost:3000/api/payments/phonepe/status?merchantTransactionId=${txnId}`, {
      method: 'GET',
    });

    const res = await phonepeStatusHandler(req);
    expect(res.status).toBe(200);

    expect(mockAppendOutboxEvent).toHaveBeenCalledTimes(1);
    const [clientArg, outboxEvent] = mockAppendOutboxEvent.mock.calls[0];
    expect(clientArg).toBe(mockClient);
    expect(outboxEvent.eventType).toBe('payment.confirmed');
    expect(outboxEvent.aggregateType).toBe('payment');
    expect(outboxEvent.aggregateId).toBe(`pay_pk_${txnId}`);
    expect(outboxEvent.payload.orderId).toBe('ord_canonical_uuid_101');
    expect(outboxEvent.payload.orderNumber).toBe('PK-11');
    expect(outboxEvent.payload.amount).toBe(512);
  });

  // ── TEST 5: idempotency ──────────────────────────────────────────
  it('5. idempotency: repeated status polling commits without duplicating payments, ledger, history, or outbox', async () => {
    mockCurrentOrder.order_status = 'CONFIRMED';
    mockCurrentOrder.payment_status = 'paid';

    const txnId = 'TXN_PK_PK-11_1728000000';
    const req = new Request(`http://localhost:3000/api/payments/phonepe/status?merchantTransactionId=${txnId}`, {
      method: 'GET',
    });

    const res = await phonepeStatusHandler(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.message).toBe('Payment already processed');
    expect(json.data.verified).toBe(true);

    // Verify transaction committed but no INSERT or UPDATE queries occurred
    expect(mockCommitted).toBe(true);
    expect(mockQueries.some(q => q.sql.includes('INSERT INTO payments'))).toBe(false);
    expect(mockQueries.some(q => q.sql.includes('INSERT INTO payment_transactions'))).toBe(false);
    expect(mockQueries.some(q => q.sql.includes('INSERT INTO order_status_history'))).toBe(false);
    expect(mockQueries.some(q => q.sql.includes('UPDATE orders'))).toBe(false);
    expect(mockAppendOutboxEvent).not.toHaveBeenCalled();
  });

  // ── TEST 6: unknown order ────────────────────────────────────────
  it('6. unknown order: returns HTTP 404, rolls back transaction, zero mutations', async () => {
    mockCurrentOrder = null; // No order found in PostgreSQL

    const txnId = 'TXN_PK_UNKNOWN_999';
    const req = new Request(`http://localhost:3000/api/payments/phonepe/status?merchantTransactionId=${txnId}`, {
      method: 'GET',
    });

    const res = await phonepeStatusHandler(req);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Associated order not found');

    expect(mockRolledBack).toBe(true);
    expect(mockCommitted).toBe(false);
    expect(mockQueries.some(q => q.sql.includes('UPDATE orders'))).toBe(false);
    expect(mockAppendOutboxEvent).not.toHaveBeenCalled();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  // ── TEST 7: amount mismatch ──────────────────────────────────────
  it('7. amount mismatch: returns HTTP 400, rolls back transaction, no confirmation', async () => {
    // Gateway returns ₹1.00 (100 paise) instead of ₹512.00 (51200 paise)
    mockGatewayResponse({ responseCode: 'SUCCESS', amount: 100 });

    const txnId = 'TXN_PK_PK-11_1728000000';
    const req = new Request(`http://localhost:3000/api/payments/phonepe/status?merchantTransactionId=${txnId}`, {
      method: 'GET',
    });

    const res = await phonepeStatusHandler(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Payment amount mismatch');

    expect(mockRolledBack).toBe(true);
    expect(mockCommitted).toBe(false);
    expect(mockQueries.some(q => q.sql.includes('UPDATE orders'))).toBe(false);
    expect(mockAppendOutboxEvent).not.toHaveBeenCalled();
  });

  // ── TEST 8: FOR UPDATE row locking ───────────────────────────────
  it('8. FOR UPDATE: verifies canonical order query includes FOR UPDATE row lock', async () => {
    const txnId = 'TXN_PK_PK-11_1728000000';
    const req = new Request(`http://localhost:3000/api/payments/phonepe/status?merchantTransactionId=${txnId}`, {
      method: 'GET',
    });

    await phonepeStatusHandler(req);

    const selectOrderQuery = mockQueries.find(q => q.sql.includes('SELECT') && q.sql.includes('FROM orders'));
    expect(selectOrderQuery).toBeDefined();
    expect(selectOrderQuery?.sql).toContain('FOR UPDATE');
  });

  // ── TEST 9: rowCount protection ──────────────────────────────────
  it('9. rowCount protection: simulated rowCount 0 triggers rollback and returns HTTP 500', async () => {
    mockUpdateRowCount = 0; // Simulate 0 rows affected on UPDATE orders

    const txnId = 'TXN_PK_PK-11_1728000000';
    const req = new Request(`http://localhost:3000/api/payments/phonepe/status?merchantTransactionId=${txnId}`, {
      method: 'GET',
    });

    const res = await phonepeStatusHandler(req);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.success).toBe(false);
    expect(json.error).toContain('Failed to update order state');

    expect(mockRolledBack).toBe(true);
    expect(mockCommitted).toBe(false);
  });

  // ── TEST 10: Firestore-after-commit ──────────────────────────────
  it('10. Firestore-after-commit: Firestore projection occurs only after PostgreSQL COMMIT', async () => {
    const txnId = 'TXN_PK_PK-11_1728000000';
    const req = new Request(`http://localhost:3000/api/payments/phonepe/status?merchantTransactionId=${txnId}`, {
      method: 'GET',
    });

    await phonepeStatusHandler(req);

    expect(mockCommitted).toBe(true);
    expect(firestoreCallTimestamps.length).toBeGreaterThan(0);
    // Every firestore write timestamp must be >= PostgreSQL commit timestamp
    for (const ts of firestoreCallTimestamps) {
      expect(ts).toBeGreaterThanOrEqual(commitTimestamp);
    }
  });

  // ── TEST 11: Firestore failure after commit ──────────────────────
  it('11. Firestore failure after commit: PostgreSQL remains committed and route returns HTTP 200', async () => {
    mockUpdateDoc.mockRejectedValueOnce(new Error('Firestore write quota exceeded'));

    const txnId = 'TXN_PK_PK-11_1728000000';
    const req = new Request(`http://localhost:3000/api/payments/phonepe/status?merchantTransactionId=${txnId}`, {
      method: 'GET',
    });

    const res = await phonepeStatusHandler(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.verified).toBe(true);
    expect(mockCommitted).toBe(true);
    expect(mockRolledBack).toBe(false);
  });

  // ── TEST 12: non-success PhonePe response ────────────────────────
  it('12. non-success PhonePe response: leaves PostgreSQL untouched and does not enqueue outbox event', async () => {
    mockGatewayResponse({ responseCode: 'PAYMENT_ERROR', code: 'PAYMENT_ERROR' });

    const txnId = 'TXN_PK_PK-11_1728000000';
    const req = new Request(`http://localhost:3000/api/payments/phonepe/status?merchantTransactionId=${txnId}`, {
      method: 'GET',
    });

    const res = await phonepeStatusHandler(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.verified).toBe(false);
    expect(json.data.paymentStatus).toBe('pending');
    expect(json.data.orderStatus).toBe('PAYMENT_PENDING');

    // No PostgreSQL transaction began
    expect(mockQueries.length).toBe(0);
    expect(mockAppendOutboxEvent).not.toHaveBeenCalled();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });
});
