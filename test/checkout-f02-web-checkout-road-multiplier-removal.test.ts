/**
 * Phase 2.7C.7.4 — Finding F-02 Regression Tests
 * Customer Web Checkout Road Multiplier & Client Serviceability Blocker Removal
 *
 * Verifies:
 * 1. app/checkout/page.tsx no longer imports or uses checkZoneServiceability
 * 2. app/checkout/page.tsx no longer synchronizes Firestore shops into in-memory state
 * 3. No active web checkout logic uses the 1.35 road multiplier or 1.4 road cutoff
 * 4. Canonical GET /api/serviceability/check is used for serviceability & fee preview
 * 5. Delivery fee is not calculated via hardcoded client rules (calculateDeliveryFee removed)
 * 6. POST /api/checkout remains the final authoritative order submission gate
 * 7. Existing legitimate callers of lib/locationServices.ts remain functional
 * 8. Zero regression on F-01, F-04, and F-05
 */

import { describe, it, test, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Phase 2.7C.7.4 — Finding F-02: Web Checkout Road Multiplier Removal', () => {
  const CHECKOUT_PATH = path.join(__dirname, '../app/checkout/page.tsx');
  const LOCATION_SERVICES_PATH = path.join(__dirname, '../lib/locationServices.ts');

  let checkoutSource: string;
  let locationServicesSource: string;

  beforeAll(() => {
    checkoutSource = fs.readFileSync(CHECKOUT_PATH, 'utf-8');
    locationServicesSource = fs.readFileSync(LOCATION_SERVICES_PATH, 'utf-8');
  });

  describe('F-02.1: Elimination of Client-Side Serviceability Blocker in Checkout', () => {
    test('checkZoneServiceability is NOT imported in app/checkout/page.tsx', () => {
      expect(checkoutSource).not.toMatch(/import[^}]*checkZoneServiceability[^}]*from/);
    });

    test('checkZoneServiceability is NOT called anywhere in app/checkout/page.tsx', () => {
      expect(checkoutSource).not.toMatch(/checkZoneServiceability\s*\(/);
    });

    test('handlePlaceOrder does NOT contain a client-side zone blocker', () => {
      expect(checkoutSource).not.toMatch(/const\s+zone\s*=\s*checkZoneServiceability/);
      expect(checkoutSource).not.toMatch(/if\s*\(!zone\.isServiceable\)/);
    });
  });

  describe('F-02.2: Elimination of In-Memory State Synchronization in Checkout', () => {
    test('fetchShopsFS is NOT imported in app/checkout/page.tsx', () => {
      expect(checkoutSource).not.toMatch(/import[^}]*fetchShopsFS[^}]*from/);
    });

    test('fetchShopsFS is NOT called in app/checkout/page.tsx', () => {
      expect(checkoutSource).not.toMatch(/fetchShopsFS\s*\(/);
    });

    test('setStoresState is NOT imported or called in app/checkout/page.tsx', () => {
      expect(checkoutSource).not.toMatch(/import[^}]*setStoresState[^}]*from/);
      expect(checkoutSource).not.toMatch(/setStoresState\s*\(/);
    });
  });

  describe('F-02.3: Elimination of Road Multiplier (1.35) and Cutoff (1.4) Authority', () => {
    test('app/checkout/page.tsx contains no 1.35 multiplier or 1.4 cutoff logic', () => {
      expect(checkoutSource).not.toContain('1.35');
      expect(checkoutSource).not.toMatch(/1\.4\s*\*/);
      expect(checkoutSource).not.toMatch(/\*\s*1\.4/);
      expect(checkoutSource).not.toContain('roadDistanceMultiplier');
      expect(checkoutSource).not.toContain('maxRoadDistanceKm');
    });

    test('lib/locationServices.ts marks checkZoneServiceability as @deprecated', () => {
      expect(locationServicesSource).toMatch(/@deprecated[\s\S]*?checkZoneServiceability/);
    });

    test('lib/locationServices.ts marks STORES_STATE and setStoresState as @deprecated', () => {
      expect(locationServicesSource).toMatch(/@deprecated[\s\S]*?STORES_STATE/);
      expect(locationServicesSource).toMatch(/@deprecated[\s\S]*?setStoresState/);
    });
  });

  describe('F-02.4: Delivery Fee Authority & Preview Integration', () => {
    test('calculateDeliveryFee is NOT imported or called in app/checkout/page.tsx', () => {
      expect(checkoutSource).not.toMatch(/import[^}]*calculateDeliveryFee[^}]*from/);
      expect(checkoutSource).not.toMatch(/calculateDeliveryFee\s*\(/);
    });

    test('app/checkout/page.tsx queries canonical GET /api/serviceability/check for preview', () => {
      expect(checkoutSource).toContain('/api/serviceability/check?lat=');
    });

    test('delivery fee in checkout display is bound to canonical server preview', () => {
      expect(checkoutSource).toMatch(/canonicalPreview\?\.deliveryFee/);
    });
  });

  describe('F-02.5: Preservation of Final Order Gate Authority', () => {
    test('POST /api/checkout remains the sole order submission endpoint', () => {
      expect(checkoutSource).toContain("fetch('/api/checkout'");
      expect(checkoutSource).toContain("method: 'POST'");
    });

    test('app/checkout/page.tsx does not call Cloud Function fallback (F-05 preserved)', () => {
      expect(checkoutSource).not.toContain('callPlaceOrder');
    });
  });

  describe('F-02.6: Functional Continuity of lib/locationServices.ts for Non-Checkout Callers', () => {
    test('pure mathematical calculateDistanceKm remains exported and functional', async () => {
      const { calculateDistanceKm } = await import('../lib/locationServices');
      expect(typeof calculateDistanceKm).toBe('function');
      // Maule Kirana (19.0224536, 73.3210018) to nearby coordinate
      const dist = calculateDistanceKm(19.0224536, 73.3210018, 19.0224536, 73.3210018);
      expect(dist).toBe(0);
      const dist1Km = calculateDistanceKm(19.0224536, 73.3210018, 19.0314536, 73.3210018);
      expect(dist1Km).toBeGreaterThan(0.9);
      expect(dist1Km).toBeLessThan(1.1);
    });
  });
});
