import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';

const routesPath = path.join(__dirname, '..', 'docs', 'phase-17-routes.json');
const routes = JSON.parse(fs.readFileSync(routesPath, 'utf8'));

describe('Phase 17 — 74+ Route Matrix & Surface Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('17A & 17B: Authoritative Route Discovery & Schema Validation', () => {
    it('discovers and reconciles all API routes present in the codebase', () => {
      expect(routes.length).toBeGreaterThanOrEqual(74); // Baseline was 74, actual is 102
      expect(routes.length).toBe(102);
    });

    it('verifies that every route exists as a valid route.ts file on disk', () => {
      for (const r of routes) {
        const filePath = path.join(__dirname, '..', 'app', r.route.replace(/^\//, ''), 'route.ts');
        expect(fs.existsSync(filePath)).toBe(true);
      }
    });

    it('verifies that every route exports at least one standard HTTP method', () => {
      const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
      for (const r of routes) {
        expect(r.methods.length).toBeGreaterThan(0);
        for (const m of r.methods) {
          expect(validMethods).toContain(m);
        }
      }
    });

    it('verifies that every protected non-public route has an explicit role and auth requirement', () => {
      for (const r of routes) {
        if (r.category !== 'PUBLIC' && r.category !== 'HEALTH' && r.category !== 'WEBHOOK') {
          expect(r.authRequired).toBe(true);
          expect(['admin', 'picker', 'delivery_partner', 'customer', 'user']).toContain(r.requiredRole);
        }
      }
    });
  });

  describe('17C–17E: HTTP Method & RBAC Boundary Enforcement', () => {
    it('enforces RBAC isolation for Admin routes', async () => {
      const adminRoutes = routes.filter((r: any) => r.category === 'ADMIN');
      expect(adminRoutes.length).toBe(20);

      // Verify unauthenticated attempt to admin route gets redirected/blocked
      const req = new NextRequest('http://pocketkirana.com/admin/dispatch', {
        headers: { host: 'pocketkirana.com' },
      });
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/access-denied');
    });

    it('enforces RBAC isolation for Picker routes', async () => {
      const pickerRoutes = routes.filter((r: any) => r.category === 'PICKER');
      expect(pickerRoutes.length).toBe(8);

      const req = new NextRequest('http://pocketkirana.com/picker/orders', {
        headers: { host: 'pocketkirana.com' },
      });
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/access-denied');
    });

    it('enforces RBAC isolation for Delivery routes', async () => {
      const deliveryRoutes = routes.filter((r: any) => r.category === 'DELIVERY');
      expect(deliveryRoutes.length).toBe(18);

      const req = new NextRequest('http://pocketkirana.com/delivery/active', {
        headers: { host: 'pocketkirana.com' },
      });
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/access-denied');
    });

    it('verifies public health endpoint is accessible without authentication', async () => {
      const healthRoute = routes.find((r: any) => r.route === '/api/health');
      expect(healthRoute).toBeDefined();
      expect(healthRoute?.authRequired).toBe(false);

      const req = new NextRequest('http://pocketkirana.com/api/health', {
        headers: { host: 'pocketkirana.com' },
      });
      const res = await middleware(req);
      expect(res.status).toBe(200);
    });
  });

  describe('17K: State Mutation & Idempotency Requirements', () => {
    it('verifies that state-changing mutation routes are flagged for idempotency', () => {
      const mutationRoutes = routes.filter((r: any) => r.methods.some((m: string) => ['POST', 'PUT', 'PATCH'].includes(m)));
      expect(mutationRoutes.length).toBeGreaterThan(30);

      for (const r of mutationRoutes) {
        expect(r.idempotencyRequired).toBe(true);
      }
    });
  });
});
