import { describe, it, expect, vi } from 'vitest';
import crypto from 'crypto';
import { POST as phonepeWebhookHandler } from '../../app/api/payments/phonepe/webhook/route';

vi.mock('../../lib/firebase', () => ({
  db: {},
  isFirebaseConfigured: vi.fn(() => true),
}));

vi.mock('firebase/firestore', () => ({
  getDoc: vi.fn().mockResolvedValue({
    exists: () => true,
    data: () => ({ orderId: 'ord_sandbox_1', customerId: 'cust_1', total: 500, paymentStatus: 'pending' }),
  }),
  updateDoc: vi.fn().mockResolvedValue(true),
  setDoc: vi.fn().mockResolvedValue(true),
  doc: vi.fn((db, col, id) => ({ col, id })),
  collection: vi.fn((db, col) => ({ col })),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
}));

vi.mock('../../lib/phonepeConfig', () => ({
  getPhonePeConfig: vi.fn(() => ({
    merchantId: 'MOCK_MERCHANT',
    saltKey: 'mock_salt_key_123',
    saltIndex: 1,
    env: 'UAT',
  })),
}));

vi.mock('../../lib/postgres', () => ({
  getPostgresPool: vi.fn(() => ({
    connect: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
      release: vi.fn(),
    }),
  })),
}));

vi.mock('../../lib/firebaseServices', () => ({
  ensurePickingTaskForOrder: vi.fn().mockResolvedValue(true),
}));

describe('Phase 19 — Gate G3: Payment Sandbox Verification', () => {
  it('verifies PhonePe sandbox webhook checksum and confirms payment', async () => {
    const payload = {
      success: true,
      code: 'PAYMENT_SUCCESS',
      data: {
        merchantTransactionId: 'MT_SANDBOX_101',
        transactionId: 'TXN_SANDBOX_101',
        amount: 50000, // ₹500.00
      },
    };
    const base64 = Buffer.from(JSON.stringify(payload)).toString('base64');
    const hash = crypto.createHash('sha256').update(base64 + 'mock_salt_key_123').digest('hex');
    const xVerify = `${hash}###1`;

    const req = new Request('http://localhost:3000/api/payments/phonepe/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-verify': xVerify,
      },
      body: JSON.stringify({ response: base64 }),
    });

    const res = await phonepeWebhookHandler(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });
});
