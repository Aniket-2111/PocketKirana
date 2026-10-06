import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

// Ensure DATABASE_URL is set for test environment
if (!process.env.DATABASE_URL) {
  try {
    const envFile = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
    const match = envFile.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
    if (match) {
      process.env.DATABASE_URL = match[1];
    }
  } catch {}
}

import { GET as getOverview } from '@/app/api/admin/analytics/overview/route';
import { GET as getChart } from '@/app/api/admin/analytics/chart/route';
import { GET as getSalesReport } from '@/app/api/admin/reports/sales/route';
import { GET as getPaymentsSummary } from '@/app/api/admin/payments/summary/route';

describe('Admin P0 Financial & Data Authority Tests', () => {
  it('1. GET /api/admin/analytics/overview requires admin role', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/analytics/overview');
    const res = await getOverview(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/Admin/i);
  });

  it('2. GET /api/admin/analytics/chart requires admin role', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/analytics/chart?timeframe=7d');
    const res = await getChart(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/Admin/i);
  });

  it('3. GET /api/admin/reports/sales requires admin role', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/reports/sales');
    const res = await getSalesReport(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/Admin/i);
  });

  it('4. GET /api/admin/payments/summary requires admin role', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/payments/summary');
    const res = await getPaymentsSummary(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/Admin/i);
  });

  it('5. GET /api/admin/analytics/overview returns real PostgreSQL aggregations with admin role', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/analytics/overview', {
      headers: {
        'x-pk-role': 'admin',
        'x-pk-uid': 'admin-1',
      },
    });
    const res = await getOverview(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toBeDefined();
    expect(json.data.metrics).toBeDefined();
    expect(typeof json.data.metrics.totalSales).toBe('number');
    expect(typeof json.data.metrics.totalOrders).toBe('number');
    expect(typeof json.data.metrics.pendingOrders).toBe('number');
    expect(typeof json.data.metrics.averageOrderValue).toBe('number');
    expect(Array.isArray(json.data.charts.revenueMonthly)).toBe(true);
    expect(json.data.charts.revenueMonthly.length).toBeGreaterThan(0);

    // Verify no fake 142000 hardcoded numbers in revenueMonthly
    const months = json.data.charts.revenueMonthly;
    const mar = months.find((m: any) => m.month === 'Mar');
    if (mar) {
      expect(mar.revenue).not.toBe(142000);
    }
  });

  it('6. GET /api/admin/analytics/chart returns real daily timeseries array from PostgreSQL', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/analytics/chart?timeframe=7d', {
      headers: {
        'x-pk-role': 'admin',
        'x-pk-uid': 'admin-1',
      },
    });
    const res = await getChart(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.timeframe).toBe('7d');
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBe(7);

    // Verify structure
    const sample = json.data[0];
    expect(sample).toHaveProperty('date');
    expect(sample).toHaveProperty('shortDate');
    expect(sample).toHaveProperty('revenue');
    expect(sample).toHaveProperty('orders');
    expect(sample).toHaveProperty('expenses');
    expect(sample).toHaveProperty('profit');
    expect(sample).toHaveProperty('prevRevenue');
  });

  it('7. GET /api/admin/reports/sales exports real PostgreSQL orders CSV', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/reports/sales', {
      headers: {
        'x-pk-role': 'admin',
        'x-pk-uid': 'admin-1',
      },
    });
    const res = await getSalesReport(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    const csv = await res.text();
    expect(csv).toContain('Order Number,Customer Name,Status,Payment Method,Amount (INR),Date');
  });

  it('8. GET /api/admin/payments/summary returns real database collections', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/payments/summary', {
      headers: {
        'x-pk-role': 'admin',
        'x-pk-uid': 'admin-1',
      },
    });
    const res = await getPaymentsSummary(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.summary).toBeDefined();
    expect(typeof json.summary.totalCollection).toBe('number');
    // Ensure fake fallback 47100 is not present
    expect(json.summary.totalCollection).not.toBe(47100);
  });

  it('9. Static source audit: verify complete removal of fake numbers from Admin files', () => {
    const adminPage = fs.readFileSync(path.join(process.cwd(), 'app/admin/page.tsx'), 'utf8');
    const chartComp = fs.readFileSync(path.join(process.cwd(), 'components/admin/ModernSalesAnalyticsChart.tsx'), 'utf8');
    const overviewRoute = fs.readFileSync(path.join(process.cwd(), 'app/api/admin/analytics/overview/route.ts'), 'utf8');

    // Item 1: Fake dashboard KPI values
    expect(adminPage).not.toContain("'82,650'");
    expect(adminPage).not.toContain("'1,645'");
    expect(adminPage).not.toContain('+11%');
    expect(adminPage).not.toContain('752 Pcs');

    // Item 2: Fake sales analytics chart data
    expect(chartComp).not.toContain('Math.sin');
    expect(chartComp).not.toContain('+18.4%');
    expect(chartComp).not.toContain('42.1%');
    expect(chartComp).not.toContain('57.9%');
    expect(chartComp).not.toContain('14200, 16800, 15400');

    // Item 3: Hardcoded monthly revenue analytics API
    expect(overviewRoute).not.toContain('142000');
    expect(overviewRoute).not.toContain('185000');
    expect(overviewRoute).not.toContain('fetchOrdersFS');

    // Item 4: INITIAL_ORDERS mock fallback
    expect(adminPage).not.toContain('INITIAL_ORDERS');
    expect(overviewRoute).not.toContain('INITIAL_ORDERS');
  });
});
