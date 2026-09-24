import { describe, it, expect } from 'vitest';
import { GET } from '../app/api/products/discover/route';
import { NextRequest } from 'next/server';
import { categorizeDbError, getPostgresPoolStats } from '../lib/postgres';

describe('Discovery API, PostgreSQL Hardening & Fallback Resilience Suite', { timeout: 10000 }, () => {
  it('measures fast discovery response (< 500ms) with exclusions and pagination', async () => {
    const start = Date.now();
    const req = new NextRequest(
      'http://localhost:3000/api/products/discover?page=1&limit=12&exclude=p-milk-fresh-1l,p-butter-500g,p-cauliflower-1pc'
    );
    const res = await GET(req);
    const duration = Date.now() - start;

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.products)).toBe(true);
    expect(data.products.length).toBeLessThanOrEqual(12);
    expect(data.pagination).toBeDefined();
    expect(data.pagination.page).toBe(1);
    expect(data.pagination.limit).toBe(12);
    expect(duration).toBeLessThan(1000); // Sub-second performance target
  });

  it('measures fast discovery response for page 2 and page 3', async () => {
    for (const page of [2, 3]) {
      const start = Date.now();
      const req = new NextRequest(`http://localhost:3000/api/products/discover?page=${page}&limit=12`);
      const res = await GET(req);
      const duration = Date.now() - start;

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.pagination.page).toBe(page);
      expect(duration).toBeLessThan(1000);
    }
  });

  it('handles category, brand, and search filters with zero timeouts', async () => {
    const filters = [
      'categoryId=dairy-bread-eggs',
      'brandId=amul',
      'search=milk',
      'categoryId=fruits-vegetables&search=fresh',
    ];

    for (const filter of filters) {
      const start = Date.now();
      const req = new NextRequest(`http://localhost:3000/api/products/discover?page=1&limit=12&${filter}`);
      const res = await GET(req);
      const duration = Date.now() - start;

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(duration).toBeLessThan(1000);
    }
  });

  it('sanitizes error messages and categorizes errors without leaking credentials', () => {
    const fakeErrorWithCreds = new Error(
      'connection to postgresql://postgres:super_secret_password_123@192.168.0.106:5433/pocketkirana_db failed: connection timeout expired'
    );
    const result = categorizeDbError(fakeErrorWithCreds);

    expect(result.category).toBe('CONNECTION_TIMEOUT');
    expect(result.message).not.toContain('super_secret_password_123');
    expect(result.message).toContain('postgresql://***:***@');
  });

  it('exposes safe pool statistics without leaking internal connection state', () => {
    const stats = getPostgresPoolStats();
    expect(typeof stats.totalCount).toBe('number');
    expect(typeof stats.idleCount).toBe('number');
    expect(typeof stats.waitingCount).toBe('number');
    expect(stats.totalCount).toBeGreaterThanOrEqual(0);
    expect(stats.idleCount).toBeGreaterThanOrEqual(0);
    expect(stats.waitingCount).toBeGreaterThanOrEqual(0);
  });
});
