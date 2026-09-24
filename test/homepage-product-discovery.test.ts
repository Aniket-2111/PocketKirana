import { describe, it, expect } from 'vitest';
import { GET } from '../app/api/products/discover/route';
import { NextRequest } from 'next/server';

describe('Homepage Continuous Product Discovery API & Engine', { timeout: 15000 }, () => {
  it('returns paginated products with metadata (page 1, limit 12)', async () => {
    const req = new NextRequest('http://localhost:3000/api/products/discover?page=1&limit=12');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.products)).toBe(true);
    expect(data.pagination).toBeDefined();
    expect(data.pagination.page).toBe(1);
    expect(data.pagination.limit).toBe(12);
    expect(typeof data.pagination.hasMore).toBe('boolean');
    expect(typeof data.pagination.total).toBe('number');
  });

  it('respects excluded product IDs to avoid duplicate rendering with curated sections', async () => {
    // 1. Fetch initial batch
    const initialReq = new NextRequest('http://localhost:3000/api/products/discover?page=1&limit=6');
    const initialRes = await GET(initialReq);
    const initialData = await initialRes.json();
    const initialProducts = initialData.products || [];

    if (initialProducts.length > 0) {
      const excludedIds = initialProducts.slice(0, 3).map((p: any) => p.id);

      // 2. Query with exclusion parameter
      const req = new NextRequest(
        `http://localhost:3000/api/products/discover?page=1&limit=12&exclude=${excludedIds.join(',')}`
      );
      const res = await GET(req);
      const data = await res.json();

      expect(data.success).toBe(true);
      const returnedIds = new Set(data.products.map((p: any) => p.id));
      for (const excludedId of excludedIds) {
        expect(returnedIds.has(excludedId)).toBe(false);
      }
    }
  });

  it('handles category filtering accurately', async () => {
    const req = new NextRequest('http://localhost:3000/api/products/discover?page=1&limit=10&categoryId=fruits-vegetables');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    if (data.products.length > 0) {
      for (const p of data.products) {
        if (p.categoryId) {
          expect(
            p.categoryId.toLowerCase().includes('fruit') ||
            p.categoryId.toLowerCase().includes('veg') ||
            p.categoryId === 'fruits-vegetables'
          ).toBe(true);
        }
      }
    }
  });

  it('handles out-of-range pagination gracefully', async () => {
    const req = new NextRequest('http://localhost:3000/api/products/discover?page=9999&limit=12');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.products.length).toBe(0);
    expect(data.pagination.hasMore).toBe(false);
  });

  it('validates product formatting and required card fields', async () => {
    const req = new NextRequest('http://localhost:3000/api/products/discover?page=1&limit=5');
    const res = await GET(req);
    const data = await res.json();

    if (data.products.length > 0) {
      const sample = data.products[0];
      expect(sample.id).toBeDefined();
      expect(sample.name).toBeDefined();
      expect(typeof sample.sellingPrice).toBe('number');
      expect(sample.sellingPrice).toBeGreaterThanOrEqual(0);
      expect(sample.unit).toBeDefined();
      expect(typeof sample.mrp).toBe('number');
    }
  });
});
