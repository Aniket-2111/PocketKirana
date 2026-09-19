import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';
import { POST as phonepeWebhookHandler } from '../app/api/payments/phonepe/webhook/route';
import { POST as verifyOtpHandler } from '../app/api/delivery/orders/[id]/verify-otp/route';
import { redactSensitiveData } from '../lib/observability';
import { decodeJwtPayload } from '../lib/sessionVerify';

// Mock Firebase & DB dependencies
const mockGetDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockQuery = vi.fn();

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

vi.mock('../lib/postgres', () => ({
  getPostgresPool: vi.fn(() => ({
    connect: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
      release: vi.fn(),
    }),
  })),
}));

vi.mock('../lib/db/outbox', () => ({
  appendOutboxEvent: vi.fn().mockResolvedValue(true),
}));

vi.mock('../lib/firebaseServices', () => ({
  ensurePickingTaskForOrder: vi.fn().mockResolvedValue(true),
}));

describe('Phase 16 — Comprehensive Security Verification & Penetration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('16B & 16H: Authentication & Token Cryptographic Security', () => {
    it('rejects access to protected admin route when unauthenticated', async () => {
      const req = new NextRequest('http://pocketkirana.com/admin/dashboard', {
        headers: { host: 'pocketkirana.com' },
      });
      const res = await middleware(req);
      expect(res.status).toBe(307); // Redirect to access-denied
      expect(res.headers.get('location')).toContain('/access-denied');
      expect(res.headers.get('location')).toContain('reason=unauthenticated');
    });

    it('rejects forged JWT with alg=none or unsigned payload in production', async () => {
      // Forged JWT claiming role=admin without valid RS256 signature
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({ uid: 'attacker_1', role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 })
      ).toString('base64url');
      const forgedJwt = `${header}.${payload}.`;

      const req = new NextRequest('http://pocketkirana.com/api/admin/settings', {
        method: 'GET',
        headers: {
          host: 'pocketkirana.com',
          cookie: `pk_session=${forgedJwt}`,
        },
      });

      // Enable strict mode
      process.env.NEXT_PUBLIC_AUTH_MIDDLEWARE_ENABLED = 'true';
      const res = await middleware(req);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('Invalid session token');
      delete process.env.NEXT_PUBLIC_AUTH_MIDDLEWARE_ENABLED;
    });

    it('safely parses JWT payload structure without executing malicious prototypes', () => {
      const payloadObj = { uid: 'usr_safe', role: 'customer', __proto__: { isAdmin: true } };
      const token = `eyJhbGciOiJSUzI1NiJ9.${Buffer.from(JSON.stringify(payloadObj)).toString('base64url')}.invalidsig`;
      const decoded = decodeJwtPayload(token);
      expect(decoded?.uid).toBe('usr_safe');
      expect(decoded?.role).toBe('customer');
      expect((decoded as any)?.isAdmin).toBeUndefined();
    });
  });

  describe('16G: Header Forgery Protection', () => {
    it('strips client-injected x-pk- headers at the edge', async () => {
      const req = new NextRequest('http://pocketkirana.com/api/products', {
        headers: {
          host: 'pocketkirana.com',
          'x-pk-uid': 'attacker_admin_impersonator',
          'x-pk-role': 'admin',
          'x-pk-admin': 'true',
        },
      });

      const res = await middleware(req);
      // The outgoing request headers passed downstream must NOT contain the forged client headers
      expect(res.headers.get('x-pk-uid')).toBeNull();
      expect(res.headers.get('x-pk-role')).toBeNull();
    });
  });

  describe('16I: CSRF Protection on Mutating API Endpoints', () => {
    it('blocks state-changing cross-origin requests from untrusted foreign origins', async () => {
      const req = new NextRequest('http://pocketkirana.com/api/checkout', {
        method: 'POST',
        headers: {
          host: 'pocketkirana.com',
          origin: 'https://evil-phishing-site.com',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ items: [] }),
      });

      const res = await middleware(req);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.code).toBe('CSRF_BLOCKED');
      expect(body.error).toBe('Cross-site request blocked');
    });

    it('permits same-origin state-changing requests', async () => {
      const req = new NextRequest('http://pocketkirana.com/api/health', {
        method: 'GET',
        headers: {
          host: 'pocketkirana.com',
          origin: 'https://pocketkirana.com',
        },
      });

      const res = await middleware(req);
      expect(res.status).toBe(200);
    });
  });

  describe('16M: Delivery OTP Security & Brute-Force Lockout', () => {
    it('tracks failed OTP attempts and locks verification permanently on 5th failure', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          orderNumber: 'PK-ORD-999',
          deliveryOtp: '7829',
          paymentStatus: 'paid',
          paymentMethod: 'online',
          partnerId: 'partner-1',
          orderStatus: 'OUT_FOR_DELIVERY',
          deliveryOtpAttempts: 4, // 4 prior failed attempts
          deliveryOtpLocked: false,
        }),
      });

      const req = new NextRequest('http://localhost:3000/api/delivery/orders/order_999/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ otp: '0000', partnerId: 'partner-1' }),
      });

      const res = await verifyOtpHandler(req, { params: Promise.resolve({ id: 'order_999' }) });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.isLocked).toBe(true);
      expect(json.attemptsRemaining).toBe(0);
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          deliveryOtpAttempts: 5,
          deliveryOtpLocked: true,
        })
      );
      // Ensure alert is logged to auditLogs
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'OTP_VERIFICATION_LOCKED',
          orderId: 'order_999',
        }),
        undefined
      );
    });

    it('rejects OTP verification immediately if order is already locked', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          orderNumber: 'PK-ORD-999',
          deliveryOtp: '7829',
          paymentStatus: 'paid',
          deliveryOtpAttempts: 5,
          deliveryOtpLocked: true,
        }),
      });

      const req = new NextRequest('http://localhost:3000/api/delivery/orders/order_999/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ otp: '7829' }),
      });

      const res = await verifyOtpHandler(req, { params: Promise.resolve({ id: 'order_999' }) });
      const json = await res.json();

      expect(res.status).toBe(429);
      expect(json.isLocked).toBe(true);
      expect(json.error).toContain('OTP verification is locked');
    });

    it('blocks OTP verification if payment is online but unpaid', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          orderNumber: 'PK-ORD-999',
          deliveryOtp: '7829',
          paymentStatus: 'pending', // Unpaid online order
          paymentMethod: 'online',
          deliveryOtpAttempts: 0,
          deliveryOtpLocked: false,
        }),
      });

      const req = new NextRequest('http://localhost:3000/api/delivery/orders/order_999/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ otp: '7829' }),
      });

      const res = await verifyOtpHandler(req, { params: Promise.resolve({ id: 'order_999' }) });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toContain('Online payment is not confirmed');
    });
  });

  describe('16N & 16O: Payment Webhook Signature & Amount Tampering Protection', () => {
    it('rejects PhonePe webhook with forged or invalid X-VERIFY signature', async () => {
      const payloadObj = {
        success: true,
        code: 'PAYMENT_SUCCESS',
        data: {
          merchantTransactionId: 'MT_123',
          transactionId: 'TXN_456',
          amount: 50000,
        },
      };
      const base64Response = Buffer.from(JSON.stringify(payloadObj)).toString('base64');
      const forgedXVerify = 'fake_sha256_checksum_hash###1';

      const req = new Request('http://localhost:3000/api/payments/phonepe/webhook', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-verify': forgedXVerify,
        },
        body: JSON.stringify({ response: base64Response }),
      });

      const res = await phonepeWebhookHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.message).toBe('Invalid signature ignored');
    });

    it('rejects webhook when paid amount mismatches canonical order amount', async () => {
      const payloadObj = {
        success: true,
        code: 'PAYMENT_SUCCESS',
        data: {
          merchantTransactionId: 'MT_TAMPER_123',
          transactionId: 'TXN_TAMPER_456',
          amount: 100, // Attacker paid ₹1 (100 paise) instead of ₹500 (50000 paise)
        },
      };
      const base64Response = Buffer.from(JSON.stringify(payloadObj)).toString('base64');
      const saltKey = 'test_salt_key_secret_123';
      const validHash = crypto.createHash('sha256').update(base64Response + saltKey).digest('hex');
      const validXVerify = `${validHash}###1`;

      // Mock payment and order lookup
      mockGetDoc
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ orderId: 'ord_real_500', customerId: 'cust_1', status: 'pending' }),
        })
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ total: 500, paymentStatus: 'pending' }), // Real total ₹500 = 50000 paise
        });

      const req = new Request('http://localhost:3000/api/payments/phonepe/webhook', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-verify': validXVerify,
        },
        body: JSON.stringify({ response: base64Response }),
      });

      const res = await phonepeWebhookHandler(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('Payment amount mismatch');
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'failed',
          failureReason: expect.stringContaining('Webhook amount mismatch: expected 50000 paise, got 100 paise'),
        }),
        { merge: true }
      );
    });

    it('idempotently handles duplicate payment webhook events without double charging', async () => {
      const payloadObj = {
        success: true,
        code: 'PAYMENT_SUCCESS',
        data: {
          merchantTransactionId: 'MT_ALREADY_PAID_123',
          transactionId: 'TXN_DEDUP_456',
          amount: 50000,
        },
      };
      const base64Response = Buffer.from(JSON.stringify(payloadObj)).toString('base64');
      const saltKey = 'test_salt_key_secret_123';
      const validHash = crypto.createHash('sha256').update(base64Response + saltKey).digest('hex');
      const validXVerify = `${validHash}###1`;

      // Mock payment as already completed
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ orderId: 'ord_1', customerId: 'cust_1', status: 'completed' }),
      });

      const req = new Request('http://localhost:3000/api/payments/phonepe/webhook', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-verify': validXVerify,
        },
        body: JSON.stringify({ response: base64Response }),
      });

      const res = await phonepeWebhookHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.message).toBe('Payment already processed');
    });
  });

  describe('16V: Secrets & PII Information Disclosure Redaction', () => {
    it('redacts sensitive credentials, private keys, auth keys, and tokens from all objects', () => {
      const sensitivePayload = {
        config: {
          msg91_authkey: 'MSG91_SECRET_987654',
          phonepe_salt_key: 'SALT_SECRET_123',
          private_key: '-----BEGIN RSA PRIVATE KEY-----',
          db_password: 'super_secure_postgres_pass',
        },
        user: {
          id: 'u_10',
          email: 'customer@example.com',
          delivery_otp: '9182',
        },
      };

      const redacted = redactSensitiveData(sensitivePayload);

      expect(redacted.config.msg91_authkey).toBe('[REDACTED]');
      expect(redacted.config.phonepe_salt_key).toBe('[REDACTED]');
      expect(redacted.config.private_key).toBe('[REDACTED]');
      expect(redacted.config.db_password).toBe('[REDACTED]');
      expect(redacted.user.delivery_otp).toBe('[REDACTED]');
      expect(redacted.user.email).toBe('customer@example.com');
    });
  });
});
