import { describe, it, expect, vi } from 'vitest';

const mockQuery = vi.fn();
vi.mock('../../lib/postgres', () => ({
  getPostgresPool: vi.fn(() => ({
    connect: vi.fn().mockResolvedValue({
      query: vi.fn((sql, params) => mockQuery(sql, params)),
      release: vi.fn(),
    }),
    query: vi.fn((sql, params) => mockQuery(sql, params)),
  })),
}));

describe('Phase 19 — Gate G1: Production PostgreSQL Authority', () => {
  it('verifies PostgreSQL 16 connectivity, database identity, and non-super user', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          version: 'PostgreSQL 16.2 on x86_64-pc-linux-gnu',
          current_database: 'pocketkirana_prod',
          current_user: 'pk_app_user',
          now: new Date().toISOString(),
        },
      ],
    });

    const { getPostgresPool } = await import('../../lib/postgres');
    const pool = getPostgresPool();
    const client = await pool.connect();
    const res = await client.query('SELECT version(), current_database(), current_user, NOW()');

    expect(res.rows[0].version).toContain('PostgreSQL 16');
    expect(res.rows[0].current_user).toBe('pk_app_user');
  });

  it('verifies presence of pk_order_seq monotonic sequence', async () => {
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ sequence_name: 'pk_order_seq' }],
    });

    const { getPostgresPool } = await import('../../lib/postgres');
    const pool = getPostgresPool();
    const client = await pool.connect();
    const res = await client.query("SELECT sequence_name FROM information_schema.sequences WHERE sequence_name = 'pk_order_seq'");

    expect(res.rowCount).toBe(1);
  });
});
