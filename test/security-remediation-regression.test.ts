import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

// Handlers
import { POST as seedPostHandler, GET as seedGetHandler } from '../app/api/seed/route';
import { POST as collectCashHandler } from '../app/api/delivery/orders/[id]/payment/collect-cash/route';
import { POST as verifyOtpHandler } from '../app/api/delivery/orders/[id]/verify-otp/route';
import { POST as deliveredHandler } from '../app/api/delivery/orders/[id]/delivered/route';
import { GET as paymentStatusHandler } from '../app/api/delivery/orders/[id]/payment/status/route';
import { POST as phonepeCreateHandler } from '../app/api/payments/phonepe/create/route';
import { POST as variantsPostHandler } from '../app/api/products/[id]/variants/route';
import { PUT as variantPutHandler, DELETE as variantDeleteHandler } from '../app/api/products/[id]/variants/[variantId]/route';
import { POST as reorderPostHandler } from '../app/api/products/[id]/variants/reorder/route';
import { parseProductExcelFile } from '../lib/productExcelUtils';
import { middleware } from '../middleware';

// Mocks
const mockGetDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockPgQuery = vi.fn();

vi.mock('../lib/firebase', () => ({
  db: {},
  getFirebaseDb: vi.fn(() => ({})),
  isFirebaseConfigured: vi.fn(() => true),
}));

vi.mock('firebase/firestore', () => ({
  getDoc: vi.fn((ref) => mockGetDoc(ref)),
  updateDoc: vi.fn((ref, data) => mockUpdateDoc(ref, data)),
  setDoc: vi.fn((ref, data, opt) => mockSetDoc(ref, data, opt)),
  doc: vi.fn((db, col, id) => ({ col, id })),
  collection: vi.fn((db, col) => ({ col })),
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    commit: vi.fn().mockResolvedValue(true),
  })),
}));

vi.mock('../lib/postgres', () => ({
  getPostgresPool: vi.fn(() => ({
    query: vi.fn((...args) => mockPgQuery(...args)),
    connect: vi.fn().mockResolvedValue({
      query: vi.fn((...args) => mockPgQuery(...args)),
      release: vi.fn(),
    }),
  })),
  queryPostgres: vi.fn((...args) => mockPgQuery(...args)),
}));

vi.mock('../lib/orderOrchestrator', () => ({
  transitionOrderStatus: vi.fn().mockResolvedValue({ status: 'DELIVERED' }),
}));

vi.mock('../app/api/payments/phonepe/shared', () => ({
  corsResponse: (data: any, init?: any) => {
    const { NextResponse } = require('next/server');
    return NextResponse.json(data, init);
  },
  OPTIONS: () => {
    const { NextResponse } = require('next/server');
    return NextResponse.json({ ok: true });
  },
  authenticateRequest: vi.fn().mockResolvedValue({ uid: 'usr-attacker', role: 'customer' }),
}));

describe('Security Remediation Regression Suite (13 Confirmed Findings)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPgQuery.mockResolvedValue({ rowCount: 0, rows: [] });
  });

  // ══════════════════════════════════════════════════════════════
  // PK-SEC-004: Seeder Security
  // ══════════════════════════════════════════════════════════════
  describe('PK-SEC-004: Database Seeder Protection', () => {
    it('blocks POST /api/seed in production environment', async () => {
      vi.stubEnv('NODE_ENV', 'production');

      const req = new NextRequest('http://localhost:3000/api/seed', {
        method: 'POST',
        headers: { 'X-Seed-Secret': 'pocketkirana-seed-2024' },
      });

      const res = await seedPostHandler(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain('disabled in production');

      vi.unstubAllEnvs();
    });

    it('rejects POST /api/seed without secret or with invalid secret in dev', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('SEED_SECRET', 'configured_secret_123');

      // Missing header
      const reqNoSecret = new NextRequest('http://localhost:3000/api/seed', { method: 'POST' });
      const resNoSecret = await seedPostHandler(reqNoSecret);
      expect(resNoSecret.status).toBe(401);

      // Invalid secret (including old default 'pocketkirana-seed-2024')
      const reqBadSecret = new NextRequest('http://localhost:3000/api/seed', {
        method: 'POST',
        headers: { 'X-Seed-Secret': 'pocketkirana-seed-2024' },
      });
      const resBadSecret = await seedPostHandler(reqBadSecret);
      expect(resBadSecret.status).toBe(401);

      vi.unstubAllEnvs();
    });

    it('GET /api/seed does not leak usage secrets', async () => {
      const res = await seedGetHandler();
      const json = await res.json();
      expect(JSON.stringify(json)).not.toContain('pocketkirana-seed-2024');
      expect(json.usage).toBeUndefined();
    });
  });

  // ══════════════════════════════════════════════════════════════
  // PK-SEC-008: COD Cash Collection
  // ══════════════════════════════════════════════════════════════
  describe('PK-SEC-008: COD Cash Collection Authorization & Integrity', () => {
    it('rejects unauthenticated cash collection request with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/delivery/orders/ord_100/payment/collect-cash', {
        method: 'POST',
        body: JSON.stringify({ partnerId: 'fake-partner', amountCollected: 500 }),
      });

      const res = await collectCashHandler(req, { params: Promise.resolve({ id: 'ord_100' }) });
      expect(res.status).toBe(401);
    });

    it('rejects cash collection if authenticated user is not delivery_partner or admin', async () => {
      const req = new NextRequest('http://localhost:3000/api/delivery/orders/ord_100/payment/collect-cash', {
        method: 'POST',
        headers: {
          'x-pk-uid': 'usr-customer-1',
          'x-pk-role': 'customer',
        },
        body: JSON.stringify({ amountCollected: 500 }),
      });

      const res = await collectCashHandler(req, { params: Promise.resolve({ id: 'ord_100' }) });
      expect(res.status).toBe(403);
    });

    it('rejects cash collection if delivery partner is not assigned to the order', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          orderNumber: 'PK-100',
          total: 500,
          partnerId: 'partner-real-assigned',
          paymentStatus: 'pending',
          paymentMethod: 'cod',
        }),
      });

      const req = new NextRequest('http://localhost:3000/api/delivery/orders/ord_100/payment/collect-cash', {
        method: 'POST',
        headers: {
          'x-pk-uid': 'partner-rogue',
          'x-pk-role': 'delivery_partner',
        },
        body: JSON.stringify({ amountCollected: 500 }),
      });

      const res = await collectCashHandler(req, { params: Promise.resolve({ id: 'ord_100' }) });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain('not assigned');
    });

    it('rejects cash collection for prepaid online orders', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          orderNumber: 'PK-100',
          total: 500,
          partnerId: 'partner-assigned',
          paymentStatus: 'pending',
          paymentMethod: 'phonepe',
        }),
      });

      const req = new NextRequest('http://localhost:3000/api/delivery/orders/ord_100/payment/collect-cash', {
        method: 'POST',
        headers: {
          'x-pk-uid': 'partner-assigned',
          'x-pk-role': 'delivery_partner',
        },
        body: JSON.stringify({ amountCollected: 500 }),
      });

      const res = await collectCashHandler(req, { params: Promise.resolve({ id: 'ord_100' }) });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('not eligible for cash collection');
    });

    it('rejects underpayment / amount mismatch', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          orderNumber: 'PK-100',
          total: 500,
          partnerId: 'partner-assigned',
          paymentStatus: 'pending',
          paymentMethod: 'cod',
        }),
      });

      const req = new NextRequest('http://localhost:3000/api/delivery/orders/ord_100/payment/collect-cash', {
        method: 'POST',
        headers: {
          'x-pk-uid': 'partner-assigned',
          'x-pk-role': 'delivery_partner',
        },
        body: JSON.stringify({ amountCollected: 250 }),
      });

      const res = await collectCashHandler(req, { params: Promise.resolve({ id: 'ord_100' }) });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Invalid amount collected');
    });

    it('successfully collects cash when assigned partner collects correct amount', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          orderNumber: 'PK-100',
          total: 500,
          partnerId: 'partner-assigned',
          paymentStatus: 'pending',
          paymentMethod: 'cod',
        }),
      });

      const req = new NextRequest('http://localhost:3000/api/delivery/orders/ord_100/payment/collect-cash', {
        method: 'POST',
        headers: {
          'x-pk-uid': 'partner-assigned',
          'x-pk-role': 'delivery_partner',
        },
        body: JSON.stringify({ amountCollected: 500 }),
      });

      const res = await collectCashHandler(req, { params: Promise.resolve({ id: 'ord_100' }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.paymentStatus).toBe('PAID');
      expect(json.collectedByPartnerId).toBe('partner-assigned');
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          paymentStatus: 'paid',
          paymentMethod: 'cod_cash',
          collectionStatus: 'COLLECTED',
          cashCollectedBy: 'partner-assigned',
        })
      );
    });
  });

  // ══════════════════════════════════════════════════════════════
  // PK-SEC-011: Delivery OTP Backdoors
  // ══════════════════════════════════════════════════════════════
  describe('PK-SEC-011: Delivery OTP Backdoor Removal & Strict Authoritative Check', () => {
    it('rejects hardcoded backdoor OTPs (1234, 4341, 0000) when order has different OTP', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          orderNumber: 'PK-100',
          deliveryOtp: '9876',
          partnerId: 'partner-1',
          paymentStatus: 'paid',
          paymentMethod: 'online',
          orderStatus: 'OUT_FOR_DELIVERY',
          deliveryOtpAttempts: 0,
        }),
      });

      for (const backdoorOtp of ['1234', '4341', '0000']) {
        const req = new NextRequest('http://localhost:3000/api/delivery/orders/ord_100/verify-otp', {
          method: 'POST',
          headers: {
            'x-pk-uid': 'partner-1',
            'x-pk-role': 'delivery_partner',
          },
          body: JSON.stringify({ otp: backdoorOtp }),
        });

        const res = await verifyOtpHandler(req, { params: Promise.resolve({ id: 'ord_100' }) });
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toContain('Incorrect OTP');
      }
    });

    it('succeeds only when authoritative delivery OTP matches', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          orderNumber: 'PK-100',
          deliveryOtp: '9876',
          partnerId: 'partner-1',
          paymentStatus: 'paid',
          paymentMethod: 'online',
          orderStatus: 'OUT_FOR_DELIVERY',
          deliveryOtpAttempts: 0,
        }),
      });

      const req = new NextRequest('http://localhost:3000/api/delivery/orders/ord_100/verify-otp', {
        method: 'POST',
        headers: {
          'x-pk-uid': 'partner-1',
          'x-pk-role': 'delivery_partner',
        },
        body: JSON.stringify({ otp: '9876' }),
      });

      const res = await verifyOtpHandler(req, { params: Promise.resolve({ id: 'ord_100' }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.otpStatus).toBe('VERIFIED');
    });

    it('delivered route rejects backdoor OTPs and requires valid auth', async () => {
      // Unauthenticated
      const reqUnauth = new NextRequest('http://localhost:3000/api/delivery/orders/ord_100/delivered', {
        method: 'POST',
        body: JSON.stringify({ otp: '1234' }),
      });
      const resUnauth = await deliveredHandler(reqUnauth, { params: Promise.resolve({ id: 'ord_100' }) });
      expect(resUnauth.status).toBe(401);

      // Backdoor OTP with real auth
      mockPgQuery.mockResolvedValue({
        rowCount: 1,
        rows: [{ id: 'ord_100', delivery_otp: '8877', order_status: 'OUT_FOR_DELIVERY', partner_id: 'partner-1' }],
      });

      const reqBackdoor = new NextRequest('http://localhost:3000/api/delivery/orders/ord_100/delivered', {
        method: 'POST',
        headers: {
          'x-pk-uid': 'partner-1',
          'x-pk-role': 'delivery_partner',
        },
        body: JSON.stringify({ otp: '1234' }),
      });

      const resBackdoor = await deliveredHandler(reqBackdoor, { params: Promise.resolve({ id: 'ord_100' }) });
      expect(resBackdoor.status).toBe(400);
      const json = await resBackdoor.json();
      expect(json.error).toContain('Invalid Delivery OTP');
    });
  });

  // ══════════════════════════════════════════════════════════════
  // PK-SEC-005: Product Variant Authorization
  // ══════════════════════════════════════════════════════════════
  describe('PK-SEC-005: Product Variant Mutation Authorization', () => {
    it('rejects unauthenticated variant creation with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/products/prod_1/variants', {
        method: 'POST',
        body: JSON.stringify({ variantName: '1 kg', sellingPrice: 100, mrp: 120 }),
      });

      const res = await variantsPostHandler(req, { params: Promise.resolve({ id: 'prod_1' }) });
      expect(res.status).toBe(401);
    });

    it('rejects non-admin roles (customer, delivery, picker) on variant mutations with 403', async () => {
      for (const role of ['customer', 'delivery_partner', 'picker']) {
        const reqPost = new NextRequest('http://localhost:3000/api/products/prod_1/variants', {
          method: 'POST',
          headers: { 'x-pk-uid': 'u1', 'x-pk-role': role },
          body: JSON.stringify({ variantName: '1 kg', sellingPrice: 100, mrp: 120 }),
        });
        const resPost = await variantsPostHandler(reqPost, { params: Promise.resolve({ id: 'prod_1' }) });
        expect(resPost.status).toBe(403);

        const reqPut = new NextRequest('http://localhost:3000/api/products/prod_1/variants/var_1', {
          method: 'PUT',
          headers: { 'x-pk-uid': 'u1', 'x-pk-role': role },
          body: JSON.stringify({ sellingPrice: 90 }),
        });
        const resPut = await variantPutHandler(reqPut, { params: Promise.resolve({ id: 'prod_1', variantId: 'var_1' }) });
        expect(resPut.status).toBe(403);

        const reqDelete = new NextRequest('http://localhost:3000/api/products/prod_1/variants/var_1', {
          method: 'DELETE',
          headers: { 'x-pk-uid': 'u1', 'x-pk-role': role },
        });
        const resDelete = await variantDeleteHandler(reqDelete, { params: Promise.resolve({ id: 'prod_1', variantId: 'var_1' }) });
        expect(resDelete.status).toBe(403);

        const reqReorder = new NextRequest('http://localhost:3000/api/products/prod_1/variants/reorder', {
          method: 'POST',
          headers: { 'x-pk-uid': 'u1', 'x-pk-role': role },
          body: JSON.stringify({ items: [{ id: 'var_1', displayOrder: 1 }] }),
        });
        const resReorder = await reorderPostHandler(reqReorder, { params: Promise.resolve({ id: 'prod_1' }) });
        expect(resReorder.status).toBe(403);
      }
    });
  });

  // ══════════════════════════════════════════════════════════════
  // PK-SEC-009: Payment Status Logic
  // ══════════════════════════════════════════════════════════════
  describe('PK-SEC-009: Authoritative Payment Status Evaluation', () => {
    it('returns unpaid for pending or failed online payments', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          orderNumber: 'PK-100',
          total: 500,
          paymentStatus: 'pending',
          paymentMethod: 'phonepe',
        }),
      });

      const req = new NextRequest('http://localhost:3000/api/delivery/orders/ord_100/payment/status');
      const res = await paymentStatusHandler(req, { params: Promise.resolve({ id: 'ord_100' }) });
      const json = await res.json();

      expect(json.isPaid).toBe(false);
      expect(json.paymentStatus).toBe('PENDING');
      expect(json.paidAt).toBeNull();
    });

    it('returns isPaid: true ONLY when paymentStatus is paid or completed', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          orderNumber: 'PK-100',
          total: 500,
          paymentStatus: 'paid',
          paymentMethod: 'phonepe',
          paymentDetails: { transactionId: 'TXN_SUCCESS_123' },
        }),
      });

      const req = new NextRequest('http://localhost:3000/api/delivery/orders/ord_100/payment/status');
      const res = await paymentStatusHandler(req, { params: Promise.resolve({ id: 'ord_100' }) });
      const json = await res.json();

      expect(json.isPaid).toBe(true);
      expect(json.paymentStatus).toBe('PAID');
      expect(json.transactionId).toBe('TXN_SUCCESS_123');
      expect(json.paidAt).not.toBeNull();
    });
  });

  // ══════════════════════════════════════════════════════════════
  // PK-SEC-010: PhonePe Demo Bypass Removal
  // ══════════════════════════════════════════════════════════════
  describe('PK-SEC-010: PhonePe Demo Bypass Removal', () => {
    it('denies payment initiation for usr-cust-1 if order belongs to another customer', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          customerId: 'usr-real-owner-999',
          total: 500,
          paymentStatus: 'pending',
        }),
      });

      const { authenticateRequest } = await import('../app/api/payments/phonepe/shared');
      (authenticateRequest as any).mockResolvedValueOnce({ uid: 'usr-cust-1', role: 'customer' });

      const req = new Request('http://localhost:3000/api/payments/phonepe/create', {
        method: 'POST',
        body: JSON.stringify({ orderId: 'ord_999' }),
      });

      const res = await phonepeCreateHandler(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain('Order ownership mismatch');
    });
  });

  // ══════════════════════════════════════════════════════════════
  // PK-SEC-012: Android allowBackup Configuration
  // ══════════════════════════════════════════════════════════════
  describe('PK-SEC-012: Android allowBackup Security Attribute', () => {
    it('has android:allowBackup="false" in all 3 AndroidManifest.xml files', () => {
      const manifests = [
        path.join(__dirname, '../customer-app/android/app/src/main/AndroidManifest.xml'),
        path.join(__dirname, '../delivery-app/android/app/src/main/AndroidManifest.xml'),
        path.join(__dirname, '../picker-app/android/app/src/main/AndroidManifest.xml'),
      ];

      for (const mPath of manifests) {
        const content = fs.readFileSync(mPath, 'utf8');
        expect(content).toContain('android:allowBackup="false"');
        expect(content).not.toContain('android:allowBackup="true"');
      }
    });
  });

  // ══════════════════════════════════════════════════════════════
  // PK-SEC-014: Excel Workbook Parsing Safety
  // ══════════════════════════════════════════════════════════════
  describe('PK-SEC-014: Excel Parsing Bounds & Resilience', () => {
    it('rejects oversized file buffer > 15MB', () => {
      const hugeBuffer = new Uint8Array(16 * 1024 * 1024);
      const result = parseProductExcelFile(hugeBuffer);
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('exceeds maximum allowed size');
    });

    it('safely handles corrupt/malformed workbook without crash', () => {
      const corruptBuffer = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe]);
      const result = parseProductExcelFile(corruptBuffer);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
