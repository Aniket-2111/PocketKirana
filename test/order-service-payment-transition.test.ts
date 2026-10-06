import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  OrderService,
  CANONICAL_PAYMENT_STATUSES,
  CanonicalPaymentStatus,
  CanonicalOrderStatus,
} from '../lib/services/orderService';

// Mock database query tracking
interface MockQueryCall {
  sql: string;
  params?: any[];
}

let mockQueries: MockQueryCall[] = [];
let mockCurrentOrder: any = null;

const mockClient = {
  query: vi.fn(async (sql: string, params?: any[]) => {
    mockQueries.push({ sql, params });

    // 1. SELECT order with FOR UPDATE
    if (sql.includes('SELECT') && sql.includes('FROM orders')) {
      if (!mockCurrentOrder) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [{ ...mockCurrentOrder }], rowCount: 1 };
    }

    // 2. UPDATE orders
    if (sql.includes('UPDATE orders')) {
      return { rowCount: 1 };
    }

    // 3. INSERT into history, events, audit
    if (sql.includes('INSERT INTO')) {
      return { rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }),
};

vi.mock('../lib/postgres', () => ({
  withTransaction: vi.fn(async (cb: (client: any) => Promise<any>) => {
    return await cb(mockClient);
  }),
  getPostgresPool: vi.fn(() => ({
    query: vi.fn(async (sql: string, params?: any[]) => {
      mockQueries.push({ sql, params });
      return { rows: mockCurrentOrder ? [mockCurrentOrder] : [], rowCount: mockCurrentOrder ? 1 : 0 };
    }),
  })),
}));

vi.mock('../lib/outbox', () => ({
  appendOutboxEvent: vi.fn(async () => {}),
}));

describe('Phase 2.9B.2 — OrderService Payment State Transition Unit Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueries = [];
    mockCurrentOrder = {
      id: 'order_uuid_1001',
      order_number: 'PK-1001',
      order_status: 'PLACED',
      payment_status: 'pending',
      delivery_otp: null,
      confirmed_at: null,
      delivered_at: null,
      cancelled_at: null,
    };
  });

  describe('Canonical Payment Status Schema & Validation', () => {
    it('defines the exact canonical payment status vocabulary', () => {
      expect(CANONICAL_PAYMENT_STATUSES).toEqual([
        'pending',
        'paid',
        'completed',
        'failed',
        'refunded',
      ]);
    });
  });

  // TEST 1 — Explicit paid transition
  describe('TEST 1 — Explicit paid transition', () => {
    it('updates both order_status and payment_status to paid with exact SQL parameter mapping', async () => {
      mockCurrentOrder = {
        id: 'order_uuid_1001',
        order_number: 'PK-1001',
        order_status: 'PLACED',
        payment_status: 'pending',
        delivery_otp: null,
      };

      const result = await OrderService.transitionOrder({
        orderId: 'order_uuid_1001',
        targetStatus: 'CONFIRMED',
        paymentStatus: 'paid',
        actorId: 'phonepe_webhook',
        actorRole: 'system',
        reason: 'PhonePe payment confirmed',
      });

      expect(result.success).toBe(true);
      expect(result.previousStatus).toBe('PLACED');
      expect(result.newStatus).toBe('CONFIRMED');
      expect(result.paymentStatus).toBe('paid');
      expect(result.idempotent).toBe(false);

      // Verify the UPDATE orders SQL query and parameters
      const updateQuery = mockQueries.find((q) => q.sql.includes('UPDATE orders'));
      expect(updateQuery).toBeDefined();

      // Parameter mapping MUST be exactly:
      // [$1 targetStatus, $2 paymentStatus || null, $3 deliveryOtp, $4 order.id]
      expect(updateQuery?.params).toEqual([
        'CONFIRMED',
        'paid',
        null,
        'order_uuid_1001',
      ]);

      // Verify SQL contains payment_status = COALESCE($2, payment_status)
      expect(updateQuery?.sql).toContain('payment_status = COALESCE($2, payment_status)');
      expect(updateQuery?.sql).toContain('order_status = $1');
      expect(updateQuery?.sql).toContain('delivery_otp = COALESCE($3, delivery_otp)');
      expect(updateQuery?.sql).toContain('WHERE id = $4');
    });
  });

  // TEST 2 — Omitted paymentStatus
  describe('TEST 2 — Omitted paymentStatus preserves existing DB status', () => {
    it('passes $2 as null and preserves pending status when paymentStatus is omitted', async () => {
      mockCurrentOrder = {
        id: 'order_uuid_1002',
        order_number: 'PK-1002',
        order_status: 'PLACED',
        payment_status: 'pending',
        delivery_otp: null,
      };

      const result = await OrderService.transitionOrder({
        orderId: 'order_uuid_1002',
        targetStatus: 'CONFIRMED',
        actorId: 'admin_user_1',
        actorRole: 'admin',
        reason: 'Manual order confirmation',
      });

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('CONFIRMED');
      expect(result.paymentStatus).toBe('pending');

      const updateQuery = mockQueries.find((q) => q.sql.includes('UPDATE orders'));
      expect(updateQuery).toBeDefined();

      // $2 MUST be null so COALESCE($2, payment_status) leaves existing DB column value
      expect(updateQuery?.params).toEqual([
        'CONFIRMED',
        null,
        null,
        'order_uuid_1002',
      ]);
    });
  });

  // TEST 3 — Existing paid status preservation
  describe('TEST 3 — Existing paid status preservation', () => {
    it('preserves existing paid status when moving to PICKING without paymentStatus', async () => {
      mockCurrentOrder = {
        id: 'order_uuid_1003',
        order_number: 'PK-1003',
        order_status: 'CONFIRMED',
        payment_status: 'paid',
        delivery_otp: null,
      };

      const result = await OrderService.transitionOrder({
        orderId: 'order_uuid_1003',
        targetStatus: 'PICKING',
        actorId: 'picker_user_1',
        actorRole: 'picker',
      });

      expect(result.success).toBe(true);
      expect(result.previousStatus).toBe('CONFIRMED');
      expect(result.newStatus).toBe('PICKING');
      expect(result.paymentStatus).toBe('paid');

      const updateQuery = mockQueries.find((q) => q.sql.includes('UPDATE orders'));
      expect(updateQuery).toBeDefined();
      expect(updateQuery?.params).toEqual([
        'PICKING',
        null,
        null,
        'order_uuid_1003',
      ]);
    });
  });

  // TEST 4 — Invalid payment status
  describe('TEST 4 — Invalid payment status validation', () => {
    it('rejects invalid payment status values and throws before executing any SQL', async () => {
      mockCurrentOrder = {
        id: 'order_uuid_1004',
        order_number: 'PK-1004',
        order_status: 'PLACED',
        payment_status: 'pending',
        delivery_otp: null,
      };

      await expect(
        OrderService.transitionOrder({
          orderId: 'order_uuid_1004',
          targetStatus: 'CONFIRMED',
          paymentStatus: 'bogus_status' as any,
          actorId: 'bad_actor',
          actorRole: 'system',
        })
      ).rejects.toThrow(/Invalid payment status: bogus_status/);

      // Verify no queries were executed in database
      const updateQuery = mockQueries.find((q) => q.sql.includes('UPDATE orders'));
      expect(updateQuery).toBeUndefined();
    });

    it('accepts all canonical payment statuses', async () => {
      for (const validStatus of CANONICAL_PAYMENT_STATUSES) {
        mockQueries = [];
        mockCurrentOrder = {
          id: 'order_uuid_test',
          order_number: 'PK-TEST',
          order_status: 'PLACED',
          payment_status: 'pending',
          delivery_otp: null,
        };

        const result = await OrderService.transitionOrder({
          orderId: 'order_uuid_test',
          targetStatus: 'CONFIRMED',
          paymentStatus: validStatus,
          actorId: 'system_user',
          actorRole: 'system',
        });

        expect(result.success).toBe(true);
        expect(result.paymentStatus).toBe(validStatus);

        const updateQuery = mockQueries.find((q) => q.sql.includes('UPDATE orders'));
        expect(updateQuery?.params?.[1]).toBe(validStatus);
      }
    });
  });

  // TEST 5 — Existing order transitions (Picker/Rider/Admin)
  describe('TEST 5 — Existing picker/rider transitions without paymentStatus', () => {
    it('executes full sequence of picker and rider transitions without paymentStatus and preserves DB value', async () => {
      const transitions: Array<{
        from: CanonicalOrderStatus;
        to: CanonicalOrderStatus;
        role: 'customer' | 'picker' | 'delivery_partner' | 'admin' | 'system';
      }> = [
        { from: 'CONFIRMED', to: 'PICKING', role: 'picker' },
        { from: 'PICKING', to: 'PACKING', role: 'picker' },
        { from: 'PACKING', to: 'READY_FOR_PICKUP', role: 'picker' },
        { from: 'READY_FOR_PICKUP', to: 'ASSIGNED', role: 'system' },
        { from: 'ASSIGNED', to: 'ACCEPTED', role: 'delivery_partner' },
        { from: 'ACCEPTED', to: 'PICKED_UP', role: 'delivery_partner' },
        { from: 'PICKED_UP', to: 'OUT_FOR_DELIVERY', role: 'delivery_partner' },
        { from: 'OUT_FOR_DELIVERY', to: 'ARRIVED_AT_CUSTOMER', role: 'delivery_partner' },
        { from: 'ARRIVED_AT_CUSTOMER', to: 'DELIVERED', role: 'delivery_partner' },
      ];

      for (const t of transitions) {
        mockQueries = [];
        mockCurrentOrder = {
          id: 'order_flow_1',
          order_number: 'PK-FLOW-1',
          order_status: t.from,
          payment_status: 'paid', // Order is already paid
          delivery_otp: t.from === 'OUT_FOR_DELIVERY' ? '1234' : null,
        };

        const result = await OrderService.transitionOrder({
          orderId: 'order_flow_1',
          targetStatus: t.to,
          actorId: `user_${t.role}`,
          actorRole: t.role,
        });

        expect(result.success).toBe(true);
        expect(result.newStatus).toBe(t.to);
        expect(result.paymentStatus).toBe('paid'); // Still paid

        const updateQuery = mockQueries.find((q) => q.sql.includes('UPDATE orders'));
        expect(updateQuery).toBeDefined();

        // Parameter 1: targetStatus, Parameter 2: null (omitted paymentStatus)
        expect(updateQuery?.params?.[0]).toBe(t.to);
        expect(updateQuery?.params?.[1]).toBeNull();
      }
    });
  });

  describe('Idempotency Behavior with Payment Status', () => {
    it('returns idempotent: true when both order_status and payment_status match', async () => {
      mockCurrentOrder = {
        id: 'order_idemp_1',
        order_number: 'PK-IDEMP-1',
        order_status: 'CONFIRMED',
        payment_status: 'paid',
        delivery_otp: null,
      };

      const result = await OrderService.transitionOrder({
        orderId: 'order_idemp_1',
        targetStatus: 'CONFIRMED',
        paymentStatus: 'paid',
        actorId: 'webhook',
        actorRole: 'system',
      });

      expect(result.idempotent).toBe(true);
      expect(result.newStatus).toBe('CONFIRMED');
      expect(result.paymentStatus).toBe('paid');

      // No UPDATE query should be executed
      const updateQuery = mockQueries.find((q) => q.sql.includes('UPDATE orders'));
      expect(updateQuery).toBeUndefined();
    });

    it('executes UPDATE when order_status is already CONFIRMED but payment_status is still pending', async () => {
      mockCurrentOrder = {
        id: 'order_idemp_2',
        order_number: 'PK-IDEMP-2',
        order_status: 'CONFIRMED',
        payment_status: 'pending',
        delivery_otp: null,
      };

      // In the case where an order was already set to CONFIRMED (e.g. by another caller),
      // but paymentStatus is now arriving as 'paid', it should update payment_status
      // (using admin/system override or state machine allowed path)
      const result = await OrderService.transitionOrder({
        orderId: 'order_idemp_2',
        targetStatus: 'CONFIRMED',
        paymentStatus: 'paid',
        actorId: 'webhook',
        actorRole: 'system',
        isAdminOverride: true,
        reason: 'Payment confirmed reconciliation',
      });

      expect(result.idempotent).toBe(false);
      expect(result.paymentStatus).toBe('paid');

      const updateQuery = mockQueries.find((q) => q.sql.includes('UPDATE orders'));
      expect(updateQuery).toBeDefined();
      expect(updateQuery?.params).toEqual([
        'CONFIRMED',
        'paid',
        null,
        'order_idemp_2',
      ]);
    });
  });
});
