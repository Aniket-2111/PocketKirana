import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { POST as checkoutHandler } from '../app/api/checkout/route';
import { POST as phonepeWebhookHandler } from '../app/api/payments/phonepe/webhook/route';
import { POST as verifyOtpHandler } from '../app/api/delivery/orders/[id]/verify-otp/route';
import { POST as updateLocationHandler } from '../app/api/delivery/orders/[id]/location/route';
import { OutboxWorker } from '../lib/services/outboxWorker';

// Mock DB pool and Firestore
const mockQuery = vi.fn();
const mockClient = {
  query: vi.fn((sql, params) => mockQuery(sql, params)),
  release: vi.fn(),
};

vi.mock('../lib/postgres', () => ({
  getPostgresPool: vi.fn(() => ({
    connect: vi.fn().mockResolvedValue(mockClient),
    query: vi.fn((sql, params) => mockQuery(sql, params)),
    totalCount: 10,
    idleCount: 8,
    waitingCount: 0,
  })),
}));

const mockGetDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockSetDoc = vi.fn();

vi.mock('../lib/firebase', () => ({
  db: {},
  isFirebaseConfigured: vi.fn(() => true),
}));

vi.mock('firebase/firestore', () => ({
  getDoc: vi.fn((ref) => mockGetDoc(ref)),
  updateDoc: vi.fn((ref, data) => mockUpdateDoc(ref, data)),
  setDoc: vi.fn((ref, data, opt) => mockSetDoc(ref, data, opt)),
  doc: vi.fn((db, col, id) => ({ col, id })),
  collection: vi.fn((db, col) => ({ col })),
  query: vi.fn((...args) => ({ args })),
  where: vi.fn((...args) => ({ args })),
  getDocs: vi.fn(() => ({ empty: true, docs: [] })),
}));

vi.mock('../lib/phonepeConfig', () => ({
  getPhonePeConfig: vi.fn(() => ({
    merchantId: 'TEST_MERCHANT',
    saltKey: 'test_salt_key_secret_123',
    saltIndex: 1,
    env: 'UAT',
  })),
}));

vi.mock('../lib/firebaseServices', () => ({
  ensurePickingTaskForOrder: vi.fn().mockResolvedValue(true),
}));

describe('Phase 18 — Full E2E Lifecycle & Failure Injections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockReset();
  });

  describe('18D & 18E: Golden-Path End-to-End Lifecycle', () => {
    it('executes full checkout → payment → picker → delivery → OTP → delivered sequence', async () => {
      // 1. Customer Checkout with FEFO batch allocation & Outbox event
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ nextval: '101' }] }) // NEXTVAL pk_order_seq
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'prod_1',
              quantity: 20,
              reserved_quantity: 0,
            },
          ],
          rowCount: 1,
        }) // SELECT inventory FOR UPDATE
        .mockResolvedValueOnce({ rows: [] }) // UPDATE inventory reserved
        .mockResolvedValueOnce({ rows: [] }) // INSERT stock_reservations
        .mockResolvedValueOnce({ rows: [] }) // INSERT orders
        .mockResolvedValueOnce({ rows: [] }) // INSERT order_items
        .mockResolvedValueOnce({ rows: [] }) // INSERT order_addresses
        .mockResolvedValueOnce({ rows: [] }) // INSERT outbox_events
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const checkoutReq = new NextRequest('http://localhost:3000/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cartItems: [{ productId: 'prod_1', quantity: 2, unitPrice: 65, productName: 'Organic Milk 1L' }],
          address: { fullName: 'Aniket Yadav', addressLine1: '123 Main St', city: 'Mumbai', pincode: '400001' },
          paymentMethod: 'phonepe',
        }),
      });

      const checkoutRes = await checkoutHandler(checkoutReq);
      const checkoutJson = await checkoutRes.json();
      expect(checkoutRes.status).toBe(200);
      expect(checkoutJson.success).toBe(true);
      expect(checkoutJson.data.orderNumber).toBe('PK-101');

      const createdOrderId = checkoutJson.data.orderId;

      // 2. PhonePe Payment Webhook Confirmation
      const payloadObj = {
        success: true,
        code: 'PAYMENT_SUCCESS',
        data: {
          merchantTransactionId: 'MT_PK_101',
          transactionId: 'TXN_E2E_101',
          amount: 16600, // Total calculated by checkout: subtotal 130 + delivery 29 + tax 7 = 166 -> 16600 paise
        },
      };
      const base64Response = Buffer.from(JSON.stringify(payloadObj)).toString('base64');
      const saltKey = 'test_salt_key_secret_123';
      const validHash = crypto.createHash('sha256').update(base64Response + saltKey).digest('hex');
      const validXVerify = `${validHash}###1`;

      mockGetDoc
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ orderId: createdOrderId, customerId: 'cust_e2e_1', status: 'pending' }),
        })
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ total: 166, paymentStatus: 'pending' }),
        });

      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rowCount: 0, rows: [] }) // Check idempotency
        .mockResolvedValueOnce({ rows: [] }) // INSERT payments
        .mockResolvedValueOnce({ rows: [] }) // INSERT payment_transactions
        .mockResolvedValueOnce({ rows: [] }) // UPDATE orders CONFIRMED
        .mockResolvedValueOnce({ rows: [] }) // INSERT outbox event
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const webhookReq = new Request('http://localhost:3000/api/payments/phonepe/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-verify': validXVerify },
        body: JSON.stringify({ response: base64Response }),
      });

      const webhookRes = await phonepeWebhookHandler(webhookReq);
      const webhookJson = await webhookRes.json();
      expect(webhookRes.status).toBe(200);
      expect(webhookJson.success).toBe(true);

      // 3. Live GPS Location Tracking
      const locationReq = new NextRequest(`http://localhost:3000/api/delivery/orders/${createdOrderId}/location`, {
        method: 'POST',
        body: JSON.stringify({
          latitude: 19.076,
          longitude: 72.8777,
          heading: 90,
          speed: 25,
          accuracy: 5,
        }),
      });

      const locationRes = await updateLocationHandler(locationReq, { params: Promise.resolve({ id: createdOrderId }) });
      const locationJson = await locationRes.json();
      expect(locationRes.status).toBe(200);
      expect(locationJson.success).toBe(true);

      // 4. Delivery OTP Verification & Final Delivery Transition
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          orderNumber: 'PK-101',
          deliveryOtp: '5432',
          paymentStatus: 'paid',
          paymentMethod: 'phonepe',
          partnerId: 'partner-1',
          orderStatus: 'OUT_FOR_DELIVERY',
          deliveryOtpAttempts: 0,
          deliveryOtpLocked: false,
        }),
      });

      const otpReq = new NextRequest(`http://localhost:3000/api/delivery/orders/${createdOrderId}/verify-otp`, {
        method: 'POST',
        body: JSON.stringify({ otp: '5432', partnerId: 'partner-1' }),
      });

      const otpRes = await verifyOtpHandler(otpReq, { params: Promise.resolve({ id: createdOrderId }) });
      const otpJson = await otpRes.json();
      expect(otpRes.status).toBe(200);
      expect(otpJson.success).toBe(true);
      expect(otpJson.data.otpStatus).toBe('VERIFIED');
    });
  });

  describe('18M: Outbox Worker Crash & Lease-Token Fencing', () => {
    it('prevents a zombie/crashed worker with an expired lease token from committing updates', async () => {
      const worker = new OutboxWorker({ workerId: 'worker_crashed_1', pollIntervalMs: 1000 });

      // Worker B reclaimed event; Worker A's update returns rowCount === 0
      mockQuery.mockResolvedValueOnce({ rowCount: 0 });

      const res = await worker.markPublished('evt_e2e_stale_1', 'old_lease_token_A');
      expect(res).toBe(false); // Refused update, prevented state corruption
    });
  });

  describe('18N: Database Failure Injection & Graceful Degrade', () => {
    it('returns structured 500 without crashing when database connection drops', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Connection terminated unexpectedly'));

      const checkoutReq = new NextRequest('http://localhost:3000/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cartItems: [{ productId: 'prod_1', quantity: 1, unitPrice: 65 }],
          address: { fullName: 'Aniket', addressLine1: '123 Main St', city: 'Mumbai', pincode: '400001' },
          paymentMethod: 'cod',
        }),
      });

      const res = await checkoutHandler(checkoutReq);
      const json = await res.json();
      expect(res.status).toBe(500);
      expect(json.error).toBeDefined();
    });
  });

  describe('18O: Inventory Concurrency & Race Condition Defense', () => {
    it('aborts checkout when item stock is depleted during transaction', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ nextval: '102' }] }) // NEXTVAL pk_order_seq
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'prod_sold_out',
              quantity: 0,
              reserved_quantity: 0, // Stock exhausted
            },
          ],
          rowCount: 1,
        }) // SELECT inventory FOR UPDATE
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      const req = new NextRequest('http://localhost:3000/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cartItems: [{ productId: 'prod_sold_out', quantity: 1, unitPrice: 100 }],
          address: { fullName: 'Customer', addressLine1: '123 Main St', city: 'Mumbai', pincode: '400001' },
          paymentMethod: 'cod',
        }),
      });

      const res = await checkoutHandler(req);
      const json = await res.json();
      expect(res.status).toBe(400);
      expect(json.error).toContain('out of stock');
    });
  });

  describe('18R: Delivery OTP Brute-force Lockout Injection', () => {
    it('permanently blocks order verification after 5 failed OTP attempts', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          orderNumber: 'PK-ORD-LOCKED',
          deliveryOtp: '9999',
          paymentStatus: 'paid',
          deliveryOtpAttempts: 5,
          deliveryOtpLocked: true,
        }),
      });

      const req = new NextRequest('http://localhost:3000/api/delivery/orders/ord_locked/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ otp: '9999' }), // Even the correct OTP is rejected when locked
      });

      const res = await verifyOtpHandler(req, { params: Promise.resolve({ id: 'ord_locked' }) });
      const json = await res.json();
      expect(res.status).toBe(429);
      expect(json.isLocked).toBe(true);
      expect(json.error).toContain('OTP verification is locked');
    });
  });
});
