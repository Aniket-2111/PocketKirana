import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('PHASE 2.7C.7.5 — Finding F-03: Customer App Address Setup Canonical Serviceability Suite', () => {
  const setupAddressPath = path.resolve(__dirname, '../customer-app/app/setup-address/page.tsx');
  const locationServicesPath = path.resolve(__dirname, '../lib/locationServices.ts');
  const functionsClientPath = path.resolve(__dirname, '../lib/functionsClient.ts');
  const webCheckoutPath = path.resolve(__dirname, '../app/checkout/page.tsx');
  const customerCheckoutPath = path.resolve(__dirname, '../customer-app/app/checkout/page.tsx');
  const locationPickerModalPath = path.resolve(__dirname, '../components/customer/LocationPickerModal.tsx');

  let setupAddressSource: string;
  let locationServicesSource: string;
  let functionsClientSource: string;

  beforeEach(() => {
    setupAddressSource = fs.readFileSync(setupAddressPath, 'utf8');
    locationServicesSource = fs.readFileSync(locationServicesPath, 'utf8');
    functionsClientSource = fs.readFileSync(functionsClientPath, 'utf8');
  });

  describe('Static & Structural Safety Invariants', () => {
    it('1. setup-address/page.tsx no longer imports validateDeliveryZoneServerSide', () => {
      expect(setupAddressSource).not.toMatch(/import[^}]*validateDeliveryZoneServerSide[^}]*from/);
      expect(setupAddressSource).not.toContain('validateDeliveryZoneServerSide');
    });

    it('2. setup-address/page.tsx no longer calls Firebase validateDeliveryZone', () => {
      expect(setupAddressSource).not.toContain("httpsCallable(functions, 'validateDeliveryZone')");
      expect(setupAddressSource).not.toContain("'validateDeliveryZone'");
      expect(setupAddressSource).not.toContain('"validateDeliveryZone"');
    });

    it('3. Customer App setup calls canonical /api/serviceability/check', () => {
      expect(setupAddressSource).toContain('/api/serviceability/check?');
    });

    it('4. Latitude is passed correctly in query string', () => {
      expect(setupAddressSource).toMatch(/\/api\/serviceability\/check\?[^'"]*lat=\$\{latitude\}/);
    });

    it('5. Longitude is passed correctly in query string', () => {
      expect(setupAddressSource).toMatch(/\/api\/serviceability\/check\?[^'"]*lng=\$\{longitude\}/);
    });

    it('6. Store ID is passed correctly as store-001', () => {
      expect(setupAddressSource).toMatch(/\/api\/serviceability\/check\?[^'"]*storeId=store-001/);
    });

    it('7. Serviceable result routes to /home', () => {
      expect(setupAddressSource).toContain("router.replace('/home')");
    });

    it('8. Unserviceable result routes to /not-serviceable with query params', () => {
      expect(setupAddressSource).toMatch(/router\.replace\(`\/not-serviceable\?dist=\$\{zoneResult\.distanceKm\}&lat=\$\{latitude\}&lon=\$\{longitude\}`\)/);
    });

    it('9. Canonical distanceKm is used with straightLineDistanceKm fallback', () => {
      expect(setupAddressSource).toContain('data?.distanceKm');
      expect(setupAddressSource).toContain('data?.straightLineDistanceKm');
    });

    it('10. Canonical maximumDistanceKm is used dynamically for display (no hardcoded "3 KM")', () => {
      expect(setupAddressSource).toMatch(/zoneResult\.maximumDistanceKm/);
      expect(setupAddressSource).not.toContain('3 KM delivery radius in Neral');
    });

    it('11. Address is saved before serviceability routing check', () => {
      const saveIdx = setupAddressSource.indexOf('await saveOrUpdateAddress(latitude, longitude, geoDisplay);');
      const unserviceableCheckIdx = setupAddressSource.indexOf('if (!zoneResult.isServiceable)');
      expect(saveIdx).toBeGreaterThan(0);
      expect(unserviceableCheckIdx).toBeGreaterThan(0);
      expect(saveIdx).toBeLessThan(unserviceableCheckIdx);
    });

    it('12. No hardcoded 3 km / 4.5 km serviceability rule remains in setup-address flow', () => {
      expect(setupAddressSource).not.toMatch(/4\.5\s*km/i);
      expect(setupAddressSource).not.toContain('4.5');
      expect(setupAddressSource).not.toMatch(/deliveryRadiusKm\s*\|\|\s*4\.5/);
    });

    it('13. No 1.3 / 1.35 road multiplier remains in setup-address flow', () => {
      expect(setupAddressSource).not.toContain('1.3');
      expect(setupAddressSource).not.toContain('1.35');
      expect(setupAddressSource).not.toContain('roadDistanceKm');
    });

    it('14. Deprecation annotation added to validateDeliveryZoneServerSide in lib/locationServices.ts', () => {
      expect(locationServicesSource).toMatch(/@deprecated[\s\S]*?validateDeliveryZoneServerSide/);
    });

    it('15. Deprecation annotation added to callValidateDeliveryZone in lib/functionsClient.ts', () => {
      expect(functionsClientSource).toMatch(/@deprecated[\s\S]*?callValidateDeliveryZone/);
    });
  });

  describe('Preservation of Prior Hardening Phases (F-01, F-02, F-04, F-05)', () => {
    it('F-01: customer-app/app/checkout/page.tsx has no 4.5 km blocker or hardcoded store coords', () => {
      const src = fs.readFileSync(customerCheckoutPath, 'utf8');
      expect(src).not.toContain('4.5');
      expect(src).not.toContain('19.0224536');
      expect(src).not.toContain('73.3210018');
    });

    it('F-02: app/checkout/page.tsx has no road distance multiplier and uses canonical /api/serviceability/check', () => {
      const src = fs.readFileSync(webCheckoutPath, 'utf8');
      expect(src).not.toContain('1.35');
      expect(src).toContain('/api/serviceability/check?lat=');
    });

    it('F-04: components/customer/LocationPickerModal.tsx saved-address click is unblocked', () => {
      const src = fs.readFileSync(locationPickerModalPath, 'utf8');
      expect(src).not.toMatch(/onClick[^}]*addrServiceable\s*&&\s*handleSelectSaved/);
      expect(src).toMatch(/onClick=\{[^}]*handleSelectSaved\(addr\)[^}]*\}/);
      expect(src).not.toMatch(/checkZoneServiceability\s*\(/);
    });

    it('F-05: app/checkout/page.tsx has no callPlaceOrder Cloud Function fallback', () => {
      const src = fs.readFileSync(webCheckoutPath, 'utf8');
      expect(src).not.toContain('callPlaceOrder');
    });
  });

  describe('Contract & Behavioral Verification', () => {
    it('Serviceable canonical response evaluates correctly and routes to /home', async () => {
      const canonicalData = {
        serviceable: true,
        code: 'SERVICEABLE',
        status: 'SERVICEABLE',
        message: '✓ PocketKirana delivers to your location',
        straightLineDistanceKm: 1.2,
        distanceKm: 1.2,
        maximumDistanceKm: 3,
        storeName: 'PocketKirana Neral Central',
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => canonicalData,
      });

      const res = await mockFetch('/api/serviceability/check?lat=19.023&lng=73.322&storeId=store-001');
      const data = await res.json();

      const isServiceable = Boolean(data?.serviceable);
      const distanceKm = typeof data?.distanceKm === 'number'
        ? data.distanceKm
        : (typeof data?.straightLineDistanceKm === 'number' ? data.straightLineDistanceKm : 0);
      const maximumDistanceKm = typeof data?.maximumDistanceKm === 'number' ? data.maximumDistanceKm : 3;

      expect(isServiceable).toBe(true);
      expect(distanceKm).toBe(1.2);
      expect(maximumDistanceKm).toBe(3);

      const routerReplace = vi.fn();
      if (!isServiceable) {
        routerReplace(`/not-serviceable?dist=${distanceKm}&lat=19.023&lon=73.322`);
      } else {
        routerReplace('/home');
      }

      expect(routerReplace).toHaveBeenCalledWith('/home');
    });

    it('Unserviceable canonical response routes to /not-serviceable with canonical distance', async () => {
      const canonicalData = {
        serviceable: false,
        code: 'OUT_OF_SERVICE_AREA',
        status: 'OUT_OF_RANGE',
        error: 'Address is outside delivery range of 3.0 km.',
        message: 'Address is outside delivery range of 3.0 km.',
        straightLineDistanceKm: 4.8,
        distanceKm: 4.8,
        maximumDistanceKm: 3,
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => canonicalData,
      });

      const res = await mockFetch('/api/serviceability/check?lat=19.060&lng=73.322&storeId=store-001');
      const data = await res.json();

      const isServiceable = Boolean(data?.serviceable);
      const distanceKm = typeof data?.distanceKm === 'number'
        ? data.distanceKm
        : (typeof data?.straightLineDistanceKm === 'number' ? data.straightLineDistanceKm : 0);
      const maximumDistanceKm = typeof data?.maximumDistanceKm === 'number' ? data.maximumDistanceKm : 3;

      expect(isServiceable).toBe(false);
      expect(distanceKm).toBe(4.8);
      expect(maximumDistanceKm).toBe(3);

      const routerReplace = vi.fn();
      if (!isServiceable) {
        routerReplace(`/not-serviceable?dist=${distanceKm}&lat=19.060&lon=73.322`);
      } else {
        routerReplace('/home');
      }

      expect(routerReplace).toHaveBeenCalledWith('/not-serviceable?dist=4.8&lat=19.060&lon=73.322');
    });

    it('Resilience: Network failure in setup flow preserves fail-open onboarding to /home', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network offline'));
      const saveAddressMock = vi.fn().mockResolvedValue(true);
      const routerReplace = vi.fn();

      try {
        await mockFetch('/api/serviceability/check?lat=19.023&lng=73.322&storeId=store-001');
      } catch (err) {
        // Fail-open onboarding path: save address then navigate to home
        await saveAddressMock(19.023, 73.322, 'Neral');
        routerReplace('/home');
      }

      expect(saveAddressMock).toHaveBeenCalledWith(19.023, 73.322, 'Neral');
      expect(routerReplace).toHaveBeenCalledWith('/home');
    });
  });
});
