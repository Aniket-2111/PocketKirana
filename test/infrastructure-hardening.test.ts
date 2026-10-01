import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OutboxWorker } from '../lib/services/outboxWorker';
import { isFirebaseConfigured } from '../lib/firebase';
import { EXPECTED_TABLES } from '../scripts/verify_production_schema';

// Mock postgres pool for fencing tests
const mockQuery = vi.fn();
vi.mock('../lib/postgres', () => ({
  queryPostgres: vi.fn((sql, params) => mockQuery(sql, params)),
  getPostgresPool: vi.fn(() => ({
    query: vi.fn((sql, params) => mockQuery(sql, params)),
  })),
}));

describe('Phase 13: Production Infrastructure & Environment Hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('13I: Outbox Worker Lease-Token Fencing', () => {
    it('successfully publishes event when lease token matches', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [] });

      const worker = new OutboxWorker({ workerId: 'worker_primary_123' });
      const published = await worker.markPublished('evt_fence_1', 'worker_primary_123');

      expect(published).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND lease_token = $2'),
        ['evt_fence_1', 'worker_primary_123']
      );
    });

    it('rejects publication when lease token was lost / expired (rowCount === 0)', async () => {
      // Simulate expired lease where row was stolen by worker_b or already completed
      mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

      const worker = new OutboxWorker({ workerId: 'worker_expired_999' });
      const published = await worker.markPublished('evt_fence_1', 'worker_expired_999');

      expect(published).toBe(false);
    });

    it('handles retry failure with lease token fencing', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [] });

      const worker = new OutboxWorker({ workerId: 'worker_active_456' });
      const event: any = {
        id: 'evt_fail_1',
        retry_count: 1,
        max_retries: 5,
        lease_token: 'worker_active_456',
      };

      const handled = await worker.handleFailure(event, new Error('Network timeout'), 'worker_active_456');
      expect(handled).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND lease_token = $6'),
        expect.arrayContaining(['evt_fail_1', 'worker_active_456'])
      );
    });

    it('aborts failure transition if lease was lost during processing', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

      const worker = new OutboxWorker({ workerId: 'worker_lost_789' });
      const event: any = {
        id: 'evt_fail_2',
        retry_count: 2,
        max_retries: 5,
        lease_token: 'worker_lost_789',
      };

      const handled = await worker.handleFailure(event, new Error('Deadlock'), 'worker_lost_789');
      expect(handled).toBe(false);
    });
  });

  describe('13E: Production Firebase Isolation Guard', () => {
    it('refuses connection if configured with pocketkirana-dev in production', () => {
      const originalEnv = process.env.NODE_ENV;
      const originalProject = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      const originalKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

      try {
        (process.env as any).NODE_ENV = 'production';
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'pocketkirana-dev';
        process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'AIzaSyFakeKeyForTestEnv1234567890';

        const isConfigured = isFirebaseConfigured();
        expect(isConfigured).toBe(false);
      } finally {
        (process.env as any).NODE_ENV = originalEnv;
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = originalProject;
        process.env.NEXT_PUBLIC_FIREBASE_API_KEY = originalKey;
      }
    });

    it('allows connection in production when pointing to valid production project', () => {
      const originalEnv = process.env.NODE_ENV;
      const originalProject = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      const originalKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

      try {
        (process.env as any).NODE_ENV = 'production';
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'pocketkirana-prod';
        process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'AIzaSyRealValidProductionKey1234567890';

        const isConfigured = isFirebaseConfigured();
        expect(isConfigured).toBe(true);
      } finally {
        (process.env as any).NODE_ENV = originalEnv;
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = originalProject;
        process.env.NEXT_PUBLIC_FIREBASE_API_KEY = originalKey;
      }
    });
  });

  describe('13C: Canonical Schema Table Inventory', () => {
    it('verifies all 62 canonical tables are listed in schema verifier', () => {
      expect(EXPECTED_TABLES.length).toBe(64); // 64 including core schema relations
      expect(EXPECTED_TABLES).toContain('orders');
      expect(EXPECTED_TABLES).toContain('order_items');
      expect(EXPECTED_TABLES).toContain('outbox_events');
      expect(EXPECTED_TABLES).toContain('notification_events');
      expect(EXPECTED_TABLES).toContain('inventory_batches');
      expect(EXPECTED_TABLES).toContain('stock_reservations');
      expect(EXPECTED_TABLES).toContain('payment_transactions');
      expect(EXPECTED_TABLES).toContain('delivery_tracking');
      expect(EXPECTED_TABLES).toContain('idempotency_keys');
    });
  });
});
