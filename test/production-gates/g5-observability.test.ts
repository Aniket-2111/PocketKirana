import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as healthHandler } from '../../app/api/health/route';
import { metrics } from '../../lib/observability';

const mockQuery = vi.fn();
vi.mock('../../lib/postgres', () => ({
  getPostgresPool: vi.fn(() => ({
    query: vi.fn((sql, params) => mockQuery(sql, params)),
    totalCount: 10,
    idleCount: 8,
    waitingCount: 0,
  })),
}));

describe('Phase 19 — Gate G5: Production Observability & Probes', () => {
  it('verifies deep health probe captures database latency and outbox SLA', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          ping: 1,
          pending_outbox: '0',
          oldest_pending_age: '2.1',
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
  });

  it('records and emits operational metrics snapshot', () => {
    metrics.increment('payment.phonepe.success', 1);
    const snapshot = metrics.getSnapshot();
    expect(snapshot['payment.phonepe.success'].count).toBeGreaterThanOrEqual(1);
  });
});
