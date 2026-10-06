import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { POST as phonepeWebhookHandler } from '../app/api/payments/phonepe/webhook/route';

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

const mockClient = {
  query: vi.fn(async (sql: string, params?: any[]) => {
    mockQueries.push({ sql, params });

    if (sql === 'BEGIN') {
      mockRolledBack = false;
      mockCommitted = false;
      return { rowCount: 1 };
    }

    if (sql === 'ROLLBACK') {
      mockRolledBack = true;
      return { rowCount: 1 };
    }

    if (sql === 'COMMIT') {
      mockCommitted = true;
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
      return { rows: mockExistingTxRowCount > 0 ? [{ id: 'ptxn_existing' }] : [], rowCount: mockExistingTxRowCount };
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
const mockUpdateDoc = vi.fn().mockResolvedValue(true);
const mockSetDoc = vi.fn().mockResolvedValue(true);
const mockAppendOutboxEvent = vi.fn().mockResolvedValue(true);
const mockEnsurePickingTask = vi.fn().mockResolvedValue(true);

vi.mock('../lib/phonepeConfig', () => ({
  getPhonePeConfig: vi.fn(() => ({
    merchantId: 'TEST_MERCHANT_PK',
    saltKey: 'test_salt_secret_key_123',
    saltIndex: 1,
    env: 'UAT',
  })),
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
  })),
}));

function createSignedWebhookRequest(payloadObj: any, saltKey = 'test_salt_secret_key_123', saltIndex = 1) {
  const base64Response = Buffer.from(JSON.stringify(payloadObj)).toString('base64');
  const generatedHash = crypto
    .createHash('sha256')
    .update(base64Response + saltKey)
    .digest('hex');
  const xVerifyHeader = `${generatedHash}###${saltIndex}`;

  return new Request('http://localhost:3000/api/payments/phonepe/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-verify': xVerifyHeader,
    },
    body: JSON.stringify({ response: base64Response }),
  });
}

describe('Phase 2.9B.3 — PhonePe Webhook Canonical PostgreSQL Reconciliation Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueries = [];
    mockUpdateRowCount = 1;
    mockExistingTxRowCount = 0;
    mockRolledBack = false;
    mockCommitted = false;
    mockGetDoc.mockResolvedValue({ exists: () => false });
  });

  // TEST 1 — order_number resolution (PK-11)
  describe('TEST 1 — order_number resolution', () => {
    it('resolves canonical order UUID when webhook receives order_number PK-11 and updates canonical orders.id', async () => {
      // PostgreSQL contains canonical order
      mockCurrentOrder = {
        id: 'ord_uuid_canonical_11',
        order_number: 'PK-11',
        customer_id: 'cust_user_11',
        firebase_uid: 'fb_uid_11',
        total_amount: '250.00',
        payment_status: 'pending',
        order_status: 'PLACED',
      };

      const payload = {
        success: true,
        code: 'PAYMENT_SUCCESS',
        data: {
          merchantTransactionId: 'TXN_PK_PK-11_1728000000',
          transactionId: 'PG_TXN_PHONEPE_9911',
          amount: 25000, // 25000 paise = ₹250.00
        },
      };

      const req = createSignedWebhookRequest(payload);
      const res = await phonepeWebhookHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.message).toBe('Webhook processed successfully');
      expect(mockCommitted).toBe(true);

      // Verify PostgreSQL order lookup locked row and used parameterized candidates
      const orderQuery = mockQueries.find((q) => q.sql.includes('SELECT') && q.sql.includes('FROM orders'));
      expect(orderQuery).toBeDefined();
      expect(orderQuery?.sql).toContain('FOR UPDATE');
      expect(orderQuery?.params).toContain('PK-11');

      // Verify UPDATE targeted canonical ID ('ord_uuid_canonical_11'), NOT 'PK-11'
      const updateQuery = mockQueries.find((q) => q.sql.includes('UPDATE orders'));
      expect(updateQuery).toBeDefined();
      expect(updateQuery?.params).toEqual(['ord_uuid_canonical_11']);
      expect(updateQuery?.sql).toContain("payment_status = 'paid'");
      expect(updateQuery?.sql).toContain("order_status = 'CONFIRMED'");

      // Verify payments table record uses canonicalOrderId
      const paymentsInsert = mockQueries.find((q) => q.sql.includes('INSERT INTO payments'));
      expect(paymentsInsert).toBeDefined();
      expect(paymentsInsert?.params?.[1]).toBe('ord_uuid_canonical_11');

      // Verify order status history was recorded
      const historyInsert = mockQueries.find((q) => q.sql.includes('INSERT INTO order_status_history'));
      expect(historyInsert).toBeDefined();
      expect(historyInsert?.params?.[1]).toBe('ord_uuid_canonical_11');
      expect(historyInsert?.params?.[3]).toBe('CONFIRMED');

      // Verify outbox event created with canonicalOrderId
      expect(mockAppendOutboxEvent).toHaveBeenCalledWith(
        mockClient,
        expect.objectContaining({
          aggregateType: 'payment',
          eventType: 'payment.confirmed',
          payload: expect.objectContaining({
            orderId: 'ord_uuid_canonical_11',
            orderNumber: 'PK-11',
          }),
        })
      );
    });
  });

  // TEST 2 — direct canonical ID resolution
  describe('TEST 2 — direct canonical ID resolution', () => {
    it('successfully reconciles payment when webhook receives direct canonical PostgreSQL order ID', async () => {
      mockCurrentOrder = {
        id: 'ord_uuid_canonical_22',
        order_number: 'PK-22',
        customer_id: 'cust_user_22',
        total_amount: '499.00',
        payment_status: 'pending',
        order_status: 'PLACED',
      };

      // Payment document in Firestore has orderId pointing to canonical PostgreSQL ID
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ orderId: 'ord_uuid_canonical_22', customerId: 'cust_user_22', status: 'pending' }),
      });

      const payload = {
        success: true,
        code: 'PAYMENT_SUCCESS',
        data: {
          merchantTransactionId: 'TXN_PK_ord_uuid_canonical_22_1728000000',
          transactionId: 'PG_TXN_PHONEPE_9922',
          amount: 49900, // ₹499.00
        },
      };

      const req = createSignedWebhookRequest(payload);
      const res = await phonepeWebhookHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);

      const updateQuery = mockQueries.find((q) => q.sql.includes('UPDATE orders'));
      expect(updateQuery?.params).toEqual(['ord_uuid_canonical_22']);
      expect(mockCommitted).toBe(true);
    });
  });

  // TEST 3 — unknown order
  describe('TEST 3 — unknown order handling', () => {
    it('returns HTTP 404, rolls back transaction, and prevents mutations when order does not exist in PostgreSQL', async () => {
      // PostgreSQL has no record of this order
      mockCurrentOrder = null;

      const payload = {
        success: true,
        code: 'PAYMENT_SUCCESS',
        data: {
          merchantTransactionId: 'TXN_PK_UNKNOWN_99_1728000000',
          transactionId: 'PG_TXN_UNKNOWN_99',
          amount: 10000,
        },
      };

      const req = createSignedWebhookRequest(payload);
      const res = await phonepeWebhookHandler(req);
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Associated order not found');

      // Verify transaction was rolled back
      expect(mockRolledBack).toBe(true);
      expect(mockCommitted).toBe(false);

      // Verify no UPDATE, no payments INSERT, no outbox event, and no Firestore projection
      const updateQuery = mockQueries.find((q) => q.sql.includes('UPDATE orders'));
      expect(updateQuery).toBeUndefined();
      expect(mockAppendOutboxEvent).not.toHaveBeenCalled();
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });
  });

  // TEST 4 — amount mismatch
  describe('TEST 4 — amount mismatch', () => {
    it('returns HTTP 400 and rolls back when webhook amount does not match PostgreSQL total_amount', async () => {
      mockCurrentOrder = {
        id: 'ord_uuid_canonical_44',
        order_number: 'PK-44',
        total_amount: '500.00', // ₹500.00 = 50000 paise
        payment_status: 'pending',
        order_status: 'PLACED',
      };

      const payload = {
        success: true,
        code: 'PAYMENT_SUCCESS',
        data: {
          merchantTransactionId: 'TXN_PK_PK-44_1728000000',
          transactionId: 'PG_TXN_TAMPER_44',
          amount: 100, // Attacker paid ₹1.00 (100 paise) instead of ₹500.00
        },
      };

      const req = createSignedWebhookRequest(payload);
      const res = await phonepeWebhookHandler(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Payment amount mismatch');

      expect(mockRolledBack).toBe(true);
      expect(mockCommitted).toBe(false);

      // Zero order updates or outbox events
      const updateQuery = mockQueries.find((q) => q.sql.includes('UPDATE orders'));
      expect(updateQuery).toBeUndefined();
      expect(mockAppendOutboxEvent).not.toHaveBeenCalled();
    });
  });

  // TEST 5 — zero-row update protection
  describe('TEST 5 — zero-row update protection', () => {
    it('throws error and rolls back with HTTP 500 when UPDATE orders affects 0 rows', async () => {
      mockCurrentOrder = {
        id: 'ord_uuid_canonical_55',
        order_number: 'PK-55',
        total_amount: '300.00',
        payment_status: 'pending',
        order_status: 'PLACED',
      };

      // Simulate UPDATE orders returning 0 affected rows (e.g. concurrent deletion or race condition)
      mockUpdateRowCount = 0;

      const payload = {
        success: true,
        code: 'PAYMENT_SUCCESS',
        data: {
          merchantTransactionId: 'TXN_PK_PK-55_1728000000',
          transactionId: 'PG_TXN_ROWCOUNT_55',
          amount: 30000,
        },
      };

      const req = createSignedWebhookRequest(payload);
      const res = await phonepeWebhookHandler(req);
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error).toContain('Failed to update order state');

      // Verify transaction was rolled back and never committed
      expect(mockRolledBack).toBe(true);
      expect(mockCommitted).toBe(false);
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });
  });

  // TEST 6 — duplicate webhook (idempotency)
  describe('TEST 6 — duplicate webhook idempotency', () => {
    it('detects already confirmed and paid order and returns idempotent 200 without duplicate mutations', async () => {
      // Order is already confirmed and paid
      mockCurrentOrder = {
        id: 'ord_uuid_canonical_66',
        order_number: 'PK-66',
        total_amount: '150.00',
        payment_status: 'paid',
        order_status: 'CONFIRMED',
      };

      const payload = {
        success: true,
        code: 'PAYMENT_SUCCESS',
        data: {
          merchantTransactionId: 'TXN_PK_PK-66_1728000000',
          transactionId: 'PG_TXN_DUP_66',
          amount: 15000,
        },
      };

      const req = createSignedWebhookRequest(payload);
      const res = await phonepeWebhookHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.message).toBe('Payment already processed');

      // Verify no UPDATE orders query was executed
      const updateQuery = mockQueries.find((q) => q.sql.includes('UPDATE orders'));
      expect(updateQuery).toBeUndefined();

      // Verify no outbox events or payments inserts
      const paymentsInsert = mockQueries.find((q) => q.sql.includes('INSERT INTO payments'));
      expect(paymentsInsert).toBeUndefined();
      expect(mockAppendOutboxEvent).not.toHaveBeenCalled();
    });

    it('detects existing transaction in payment_transactions ledger and exits idempotently', async () => {
      mockCurrentOrder = {
        id: 'ord_uuid_canonical_67',
        order_number: 'PK-67',
        total_amount: '150.00',
        payment_status: 'pending',
        order_status: 'PLACED',
      };

      // Transaction already recorded in ledger
      mockExistingTxRowCount = 1;

      const payload = {
        success: true,
        code: 'PAYMENT_SUCCESS',
        data: {
          merchantTransactionId: 'TXN_PK_PK-67_1728000000',
          transactionId: 'PG_TXN_LEDGER_67',
          amount: 15000,
        },
      };

      const req = createSignedWebhookRequest(payload);
      const res = await phonepeWebhookHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.message).toBe('Payment already processed');

      const updateQuery = mockQueries.find((q) => q.sql.includes('UPDATE orders'));
      expect(updateQuery).toBeUndefined();
    });
  });

  // TEST 7 — concurrent webhook protection (row locking verification)
  describe('TEST 7 — concurrent webhook protection semantics', () => {
    it('executes SELECT FOR UPDATE on order lookup to serialize concurrent webhook deliveries', async () => {
      mockCurrentOrder = {
        id: 'ord_uuid_canonical_77',
        order_number: 'PK-77',
        total_amount: '200.00',
        payment_status: 'pending',
        order_status: 'PLACED',
      };

      const payload = {
        success: true,
        code: 'PAYMENT_SUCCESS',
        data: {
          merchantTransactionId: 'TXN_PK_PK-77_1728000000',
          transactionId: 'PG_TXN_LOCK_77',
          amount: 20000,
        },
      };

      const req = createSignedWebhookRequest(payload);
      const res = await phonepeWebhookHandler(req);
      expect(res.status).toBe(200);

      // Verify that FOR UPDATE clause is explicitly in the order selection SQL
      const selectQuery = mockQueries.find((q) => q.sql.includes('SELECT') && q.sql.includes('FROM orders'));
      expect(selectQuery).toBeDefined();
      expect(selectQuery?.sql).toMatch(/FOR UPDATE/i);
    });
  });

  // TEST 8 — invalid signature
  describe('TEST 8 — invalid signature protection', () => {
    it('returns 200 with invalid signature ignored (fail-closed security ACK preventing retry storms)', async () => {
      const payload = {
        success: true,
        code: 'PAYMENT_SUCCESS',
        data: {
          merchantTransactionId: 'TXN_PK_PK-88_1728000000',
          transactionId: 'PG_TXN_FORGED_88',
          amount: 10000,
        },
      };

      // Sign with an invalid salt key
      const req = createSignedWebhookRequest(payload, 'wrong_salt_key_attacker');
      const res = await phonepeWebhookHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.message).toBe('Invalid signature ignored');

      // Verify zero queries were executed in PostgreSQL
      expect(mockQueries.length).toBe(0);
      expect(mockAppendOutboxEvent).not.toHaveBeenCalled();
    });
  });
});
