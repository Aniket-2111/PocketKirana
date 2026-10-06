import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Phase 2.7C.7.6-D — Remaining Legacy UI & Business-Rule Cleanup', () => {
  const customerNotServiceablePath = path.resolve(__dirname, '../customer-app/app/not-serviceable/page.tsx');
  const webNotServiceablePath = path.resolve(__dirname, '../app/not-serviceable/page.tsx');
  const webCheckoutPath = path.resolve(__dirname, '../app/checkout/page.tsx');
  const customerCheckoutPath = path.resolve(__dirname, '../customer-app/app/checkout/page.tsx');
  const checkoutRoutePath = path.resolve(__dirname, '../app/api/checkout/route.ts');
  const adminServiceAreaPath = path.resolve(__dirname, '../app/admin/service-area/page.tsx');
  const storeOperationsServicePath = path.resolve(__dirname, '../lib/storeOperationsService.ts');
  const servicesApiPath = path.resolve(__dirname, '../services/api/index.ts');
  const functionsValidatePath = path.resolve(__dirname, '../functions/src/inventory/validateDeliveryZone.ts');

  const customerNotServiceableSrc = fs.readFileSync(customerNotServiceablePath, 'utf8');
  const webNotServiceableSrc = fs.existsSync(webNotServiceablePath) ? fs.readFileSync(webNotServiceablePath, 'utf8') : '';
  const webCheckoutSrc = fs.readFileSync(webCheckoutPath, 'utf8');
  const customerCheckoutSrc = fs.readFileSync(customerCheckoutPath, 'utf8');
  const checkoutRouteSrc = fs.readFileSync(checkoutRoutePath, 'utf8');
  const adminServiceAreaSrc = fs.readFileSync(adminServiceAreaPath, 'utf8');
  const storeOperationsServiceSrc = fs.readFileSync(storeOperationsServicePath, 'utf8');
  const servicesApiSrc = fs.readFileSync(servicesApiPath, 'utf8');
  const functionsValidateSrc = fs.readFileSync(functionsValidatePath, 'utf8');

  // ── 1. NOT-SERVICEABLE PAGE CLEANUP ────────────────────────────
  describe('D.1 — Not-Serviceable Page UI Cleanup', () => {
    test('1. Customer /not-serviceable page contains no universal 3 KM claim', () => {
      expect(customerNotServiceableSrc).not.toContain('3 KM of our Neral store');
      expect(customerNotServiceableSrc).not.toContain('3.0 KM\n                </span>');
      expect(customerNotServiceableSrc).not.toContain('within 3 KM of Maule Kirana');
      expect(customerNotServiceableSrc).not.toContain('3 KM Zone');
    });

    test('2. Web /not-serviceable page contains no universal 3 KM claim', () => {
      expect(webNotServiceableSrc).not.toContain('3 KM of our Neral store');
      expect(webNotServiceableSrc).not.toContain('within 3 KM of Maule Kirana');
      expect(webNotServiceableSrc).not.toContain('3 KM Zone');
    });

    test('3. Customer /not-serviceable page contains no hardcoded universal store identity', () => {
      expect(customerNotServiceableSrc).not.toContain('Maule Kirana Shop (Neral)');
      expect(customerNotServiceableSrc).not.toContain('About Maule Kirana');
    });

    test('4. Web /not-serviceable page contains no hardcoded universal store identity', () => {
      expect(webNotServiceableSrc).not.toContain('Maule Kirana Shop (Neral)');
      expect(webNotServiceableSrc).not.toContain('About Maule Kirana');
    });

    test('5. Customer /not-serviceable page dynamically consumes query parameters with neutral fallback', () => {
      expect(customerNotServiceableSrc).toContain("searchParams.get('dist')");
      expect(customerNotServiceableSrc).toContain("searchParams.get('maxDist')");
      expect(customerNotServiceableSrc).toContain("searchParams.get('store')");
      expect(customerNotServiceableSrc).toContain('This location is currently outside the delivery area for the selected store.');
      expect(customerNotServiceableSrc).toContain('Selected Store');
    });
  });

  // ── 2. AUDIT REMAINING LEGACY SERVICEABILITY UI ────────────────
  describe('D.2 & D.3 — Production Checkout Authority Cleanliness', () => {
    test('6. No active production checkout path uses checkZoneServiceability', () => {
      expect(webCheckoutSrc).not.toContain('checkZoneServiceability');
      expect(customerCheckoutSrc).not.toContain('checkZoneServiceability');
      expect(checkoutRouteSrc).not.toContain('checkZoneServiceability');
    });

    test('7. No active production checkout path uses validateDeliveryZone Cloud Function', () => {
      expect(webCheckoutSrc).not.toContain('validateDeliveryZone');
      expect(customerCheckoutSrc).not.toContain('validateDeliveryZone');
      expect(checkoutRouteSrc).not.toContain('validateDeliveryZone');
    });

    test('8. No active production checkout path uses Firebase placeOrder callable', () => {
      expect(webCheckoutSrc).not.toContain('callPlaceOrder');
      expect(customerCheckoutSrc).not.toContain('callPlaceOrder');
      expect(checkoutRouteSrc).not.toContain('callPlaceOrder');
    });

    test('9. No active production checkout path enforces minimum order', () => {
      expect(webCheckoutSrc).not.toMatch(/subtotal\s*<\s*(199|99|minimumOrder)/i);
      expect(customerCheckoutSrc).not.toMatch(/subtotal\s*<\s*(199|99|minimumOrder)/i);
      expect(checkoutRouteSrc).not.toContain('MINIMUM_ORDER_NOT_MET');
    });

    test('10. No active production checkout path uses road distance multiplier (1.35 / 1.4)', () => {
      expect(webCheckoutSrc).not.toContain('1.35');
      expect(webCheckoutSrc).not.toContain('1.4');
      expect(customerCheckoutSrc).not.toContain('1.35');
      expect(customerCheckoutSrc).not.toContain('1.4');
      expect(checkoutRouteSrc).not.toContain('1.35');
      expect(checkoutRouteSrc).not.toContain('1.4');
    });

    test('11. Authoritative delivery fee is computed by canonical backend, not client', () => {
      expect(checkoutRouteSrc).toContain('evaluateServerServiceability');
      expect(checkoutRouteSrc).toContain('resolveDeliveryFee');
    });
  });

  // ── 3. LEGACY SDK STUBS ────────────────────────────────────────
  describe('D.6 — Legacy SDK Stubs Cleanliness', () => {
    test('12. services/api/index.ts has no dead placeOrder stub pointing to /api/checkout/place-order', () => {
      expect(servicesApiSrc).not.toContain('/api/checkout/place-order');
      expect(servicesApiSrc).not.toMatch(/placeOrder\s*\(/);
    });
  });

  // ── 4. LEGACY FIREBASE SERVICEABILITY ──────────────────────────
  describe('D.5 — Legacy Firebase Serviceability Deprecation', () => {
    test('13. functions/src/inventory/validateDeliveryZone.ts is explicitly marked deprecated', () => {
      expect(functionsValidateSrc).toMatch(/@deprecated\s+NON-AUTHORITATIVE/i);
      expect(functionsValidateSrc).toContain('GET /api/serviceability/check');
    });
  });

  // ── 5. ADMIN SERVICE AREA REGRESSION ───────────────────────────
  describe('D.7 — Admin Service Area Canonical Alignment Intact', () => {
    test('14. Admin Service Area reads from canonical /api/admin/store/operations', () => {
      expect(adminServiceAreaSrc).toContain('/api/admin/store/operations');
    });

    test('15. Admin Service Area does not directly call saveShopConfigFS or fetchShopsFS', () => {
      expect(adminServiceAreaSrc).not.toContain('saveShopConfigFS');
      expect(adminServiceAreaSrc).not.toContain('fetchShopsFS');
    });

    test('16. Admin Service Area restricts radius to 3.0, 4.0, 5.0 km segmented options', () => {
      expect(adminServiceAreaSrc).toContain('[3.0, 4.0, 5.0]');
      expect(adminServiceAreaSrc).not.toContain('type="range"');
    });

    test('17. Admin Service Area displays coordinates as protected read-only', () => {
      expect(adminServiceAreaSrc).toContain('readOnly');
      expect(adminServiceAreaSrc).toContain('Protected GPS Coordinates');
    });

    test('18. Firestore remains secondary/non-authoritative mirror in storeOperationsService', () => {
      expect(storeOperationsServiceSrc).toContain('UPDATE stores');
      expect(storeOperationsServiceSrc).toContain('await saveShopConfigFS');
      const pgUpdateIdx = storeOperationsServiceSrc.indexOf('UPDATE stores');
      const fsWriteIdx = storeOperationsServiceSrc.indexOf('await saveShopConfigFS');
      expect(pgUpdateIdx).toBeGreaterThan(0);
      expect(fsWriteIdx).toBeGreaterThan(pgUpdateIdx);
    });
  });
});
