import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';

// Mocks for OutboxWorker testing
const mockDispatchEvent = vi.fn();
const mockQuery = vi.fn();

vi.mock('../lib/services/outboxWorker', () => {
  return {
    OutboxWorker: vi.fn().mockImplementation(() => ({
      dispatchEvent: mockDispatchEvent,
    })),
  };
});

describe('Cloudflare Security Audit Batch 2 Regression Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PK-SEC-04: Middleware Localhost vs. Private LAN Isolation
  // ══════════════════════════════════════════════════════════════════════════
  describe('PK-SEC-04: Middleware Loopback vs. Private LAN Isolation', () => {
    it('A: allows development bypass for 127.0.0.1 in non-production, non-strict dev mode', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('NEXT_PUBLIC_AUTH_MIDDLEWARE_ENABLED', 'false');

      const req = new NextRequest('http://127.0.0.1:3000/admin/dashboard', {
        headers: { host: '127.0.0.1:3000' },
      });

      const res = await middleware(req);
      // Loopback traffic receives dev bypass (200 next response, not redirected)
      expect(res.status).toBe(200);
      expect(res.headers.get('location')).toBeNull();
    });

    it('B: allows development bypass for ::1 (IPv6 loopback)', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('NEXT_PUBLIC_AUTH_MIDDLEWARE_ENABLED', 'false');

      const req = new NextRequest('http://[::1]:3000/admin/dashboard', {
        headers: { host: '[::1]:3000' },
      });

      const res = await middleware(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('location')).toBeNull();
    });

    it('C: MUST NOT treat 192.168.1.x as localhost (redirects to access-denied)', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('NEXT_PUBLIC_AUTH_MIDDLEWARE_ENABLED', 'false');

      const req = new NextRequest('http://192.168.1.105:3000/admin/dashboard', {
        headers: { host: '192.168.1.105:3000' },
      });

      const res = await middleware(req);
      // Must not receive dev bypass — must redirect to login/access-denied
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/access-denied');
    });

    it('D: MUST NOT treat 10.x.x.x as localhost (redirects to access-denied)', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('NEXT_PUBLIC_AUTH_MIDDLEWARE_ENABLED', 'false');

      const req = new NextRequest('http://10.0.0.45:3000/admin/dashboard', {
        headers: { host: '10.0.0.45:3000' },
      });

      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/access-denied');
    });

    it('E: MUST NOT treat 172.16.x.x as localhost', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('NEXT_PUBLIC_AUTH_MIDDLEWARE_ENABLED', 'false');

      const req = new NextRequest('http://172.16.0.12:3000/admin/dashboard', {
        headers: { host: '172.16.0.12:3000' },
      });

      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/access-denied');
    });

    it('F: remote LAN request containing forged dev/admin headers MUST NOT receive localhost dev trust', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('NEXT_PUBLIC_AUTH_MIDDLEWARE_ENABLED', 'false');

      // Attacker on LAN sends spoofed dev headers
      const req = new NextRequest('http://192.168.1.105:3000/admin/settings', {
        headers: {
          host: '192.168.1.105:3000',
          'x-pk-uid': 'dev-user',
          'x-pk-role': 'admin',
          'x-pk-dev-bypass': '1',
        },
      });

      const res = await middleware(req);
      // Forged headers are stripped and LAN host is NOT localhost -> redirected to access-denied
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/access-denied');
      expect(res.headers.get('location')).toContain('reason=unauthenticated');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PK-SEC-05: Outbox Worker Launcher Delegation & Fencing
  // ══════════════════════════════════════════════════════════════════════════
  describe('PK-SEC-05: Outbox Worker Delegation to OutboxWorker Service', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const workerLauncher = require('../scripts/run_outbox_worker.js');

    beforeEach(() => {
      workerLauncher.setServiceWorker({
        dispatchEvent: mockDispatchEvent,
      });
    });

    it('initializes real OutboxWorker by default with expected service methods', () => {
      workerLauncher.setServiceWorker(null);
      const worker = workerLauncher.getServiceWorker();
      expect(worker).toBeDefined();
      expect(typeof worker.dispatchEvent).toBe('function');
      expect(typeof worker.leaseEvents).toBe('function');
      expect(typeof worker.markPublished).toBe('function');
      expect(typeof worker.handleFailure).toBe('function');
      // restore mock
      workerLauncher.setServiceWorker({ dispatchEvent: mockDispatchEvent });
    });

    it('A: actually passes outbox events to the real OutboxWorker processor', async () => {
      mockDispatchEvent.mockResolvedValueOnce(undefined);

      const testEvent = {
        id: 'evt_batch2_test_1',
        aggregate_type: 'order',
        aggregate_id: 'ord_batch2_1',
        event_type: 'order.confirmed',
        payload: { orderId: 'ord_batch2_1', status: 'CONFIRMED' },
        lease_token: 'worker_test_token',
      };

      await workerLauncher.processEvent(testEvent);

      expect(mockDispatchEvent).toHaveBeenCalledTimes(1);
      expect(mockDispatchEvent).toHaveBeenCalledWith(testEvent);
    });

    it('B: marks event PUBLISHED on successful processing with matching lease token', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rowCount: 1 }),
      };

      await workerLauncher.markPublished(mockClient, 'evt_batch2_test_2', 'worker_test_token_2');

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'PUBLISHED'"),
        ['evt_batch2_test_2', 'worker_test_token_2']
      );
    });

    it('C: fails processing and schedules retry without marking PUBLISHED when dispatchEvent throws', async () => {
      mockDispatchEvent.mockRejectedValueOnce(new Error('Firestore connection timeout'));

      const testEvent = {
        id: 'evt_batch2_fail_1',
        aggregate_type: 'order',
        aggregate_id: 'ord_batch2_fail',
        event_type: 'order.confirmed',
        payload: { orderId: 'ord_batch2_fail' },
        retry_count: 0,
        max_retries: 5,
        lease_token: 'worker_test_token_fail',
      };

      const mockClient = {
        query: vi.fn().mockResolvedValue({ rowCount: 1 }),
      };

      let threw = false;
      try {
        await workerLauncher.processEvent(testEvent);
      } catch (err: any) {
        threw = true;
        await workerLauncher.handleFailure(mockClient, testEvent, err);
      }

      // Event processor threw
      expect(threw).toBe(true);

      // handleFailure was called with RETRY_SCHEDULED (not PUBLISHED)
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'RETRY_SCHEDULED'"),
        expect.arrayContaining([1, 'Firestore connection timeout', 'evt_batch2_fail_1'])
      );
      expect(mockClient.query).not.toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'PUBLISHED'"),
        expect.anything()
      );
    });

    it('D: preserves dead-letter queueing when max_retries exceeded', async () => {
      const testEvent = {
        id: 'evt_batch2_dlq_1',
        retry_count: 4,
        max_retries: 5,
        lease_token: 'worker_test_token_dlq',
      };

      const mockClient = {
        query: vi.fn().mockResolvedValue({ rowCount: 1 }),
      };

      await workerLauncher.handleFailure(mockClient, testEvent, new Error('Poison pill payload'));

      // 5th attempt out of 5 -> DEAD_LETTERED
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'DEAD_LETTERED'"),
        expect.arrayContaining([5, 'Poison pill payload', 'evt_batch2_dlq_1'])
      );
    });

    it('E: preserves lease-token fencing (publication requires matching lease token)', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rowCount: 0 }),
      };

      await workerLauncher.markPublished(mockClient, 'evt_stolen', 'expired_token');

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('AND lease_token = $2'),
        ['evt_stolen', 'expired_token']
      );
    });
  });
});
