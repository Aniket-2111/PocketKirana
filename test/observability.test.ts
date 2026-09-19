import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateCorrelationId,
  extractCorrelationId,
  redactSensitiveData,
  logger,
  metrics,
} from '../lib/observability';
import { GET as healthHandler } from '../app/api/health/route';
import { NextRequest } from 'next/server';

// Mock PostgreSQL pool for health checks
const mockQuery = vi.fn();
vi.mock('../lib/postgres', () => ({
  getPostgresPool: vi.fn(() => ({
    query: vi.fn((sql, params) => mockQuery(sql, params)),
    totalCount: 10,
    idleCount: 8,
    waitingCount: 0,
  })),
}));

describe('Phase 15: Observability, Health Probes & Metrics Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    metrics.reset();
  });

  describe('15B & 15C: Application Health Probes', () => {
    it('returns fast liveness probe without leaking secrets or hostnames', async () => {
      const req = new NextRequest('http://localhost:3000/api/health');
      const res = await healthHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe('ok');
      expect(json.service).toBe('pocketkirana-api');
      expect(json.timestamp).toBeDefined();

      // Ensure zero credentials or internal network hostnames are leaked
      expect(json.password).toBeUndefined();
      expect(json.database).toBeUndefined();
      expect(json.host).toBeUndefined();
      expect(json.secret).toBeUndefined();
    });

    it('returns deep health readiness when database and outbox are healthy', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            ping: 1,
            pending_outbox: '2',
            oldest_pending_age: '4.5',
          },
        ],
      });

      const req = new NextRequest('http://localhost:3000/api/health?deep=true');
      const res = await healthHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe('ok');
      expect(json.checks.database.status).toBe('ok');
      expect(json.checks.outbox.status).toBe('ok');
      expect(json.checks.outbox.pendingEventsCount).toBe(2);
      expect(json.checks.outbox.oldestPendingAgeSeconds).toBe(5);
    });

    it('reports degraded status when outbox backlog exceeds 60 seconds threshold', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            ping: 1,
            pending_outbox: '45',
            oldest_pending_age: '125.0', // Exceeds 60s SLA
          },
        ],
      });

      const req = new NextRequest('http://localhost:3000/api/health?deep=true');
      const res = await healthHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe('degraded');
      expect(json.checks.outbox.status).toBe('degraded');
      expect(json.checks.outbox.oldestPendingAgeSeconds).toBe(125);
    });
  });

  describe('15K, 15L, 15M: Correlation IDs & Sensitive Data Redaction', () => {
    it('generates valid correlation IDs starting with pk_req_', () => {
      const id = generateCorrelationId();
      expect(id).toMatch(/^pk_req_[a-z0-9]+_[a-f0-9]+$/);
    });

    it('extracts correlation ID from request headers', () => {
      const headers = new Headers();
      headers.set('x-correlation-id', 'pk_req_custom_trace_123');

      const extracted = extractCorrelationId(headers);
      expect(extracted).toBe('pk_req_custom_trace_123');
    });

    it('recursively scrubs sensitive fields from log metadata', () => {
      const payload = {
        orderId: 'PK-101',
        total: 500,
        customer: {
          id: 'usr_1',
          name: 'Aniket',
          password: 'super_secret_password_123',
          deliveryOtp: '5821',
        },
        payment: {
          gateway: 'phonepe',
          saltKey: '984712093847129038',
          card: {
            cardNumber: '4111111111111111',
            cvv: '891',
          },
        },
      };

      const redacted = redactSensitiveData(payload);

      expect(redacted.orderId).toBe('PK-101');
      expect(redacted.customer.name).toBe('Aniket');
      expect(redacted.customer.password).toBe('[REDACTED]');
      expect(redacted.customer.deliveryOtp).toBe('[REDACTED]');
      expect(redacted.payment.saltKey).toBe('[REDACTED]');
      expect(redacted.payment.card.cardNumber).toBe('[REDACTED]');
      expect(redacted.payment.card.cvv).toBe('[REDACTED]');
    });
  });

  describe('15D–15I: Business & Operational Metrics Collector', () => {
    it('increments counters and captures operational telemetry snapshots', () => {
      metrics.increment('outbox.events.published', 1);
      metrics.increment('outbox.events.published', 2);
      metrics.increment('payment.phonepe.success', 1, { gateway: 'phonepe' });
      metrics.increment('outbox.lease_lost', 1);

      const snapshot = metrics.getSnapshot();

      expect(snapshot['outbox.events.published'].count).toBe(3);
      expect(snapshot['payment.phonepe.success'].count).toBe(1);
      expect(snapshot['payment.phonepe.success'].tags?.gateway).toBe('phonepe');
      expect(snapshot['outbox.lease_lost'].count).toBe(1);
    });
  });
});
