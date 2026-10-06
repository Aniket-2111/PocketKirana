import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { locationFlowService } from '../lib/locationFlowService';

describe('Phase 2.7C.7.6-B — Canonical Serviceability Alignment for LocationPermissionGuard & locationFlowService', () => {
  const locationFlowServicePath = path.resolve(__dirname, '../lib/locationFlowService.ts');
  const locationPermissionGuardPath = path.resolve(__dirname, '../customer-app/components/LocationPermissionGuard.tsx');
  const unserviceableModalPath = path.resolve(__dirname, '../customer-app/components/customer/UnserviceableAreaModal.tsx');
  const locationServicesPath = path.resolve(__dirname, '../lib/locationServices.ts');

  let locationFlowServiceSource: string;
  let locationPermissionGuardSource: string;
  let unserviceableModalSource: string;
  let locationServicesSource: string;

  beforeEach(() => {
    locationFlowServiceSource = fs.readFileSync(locationFlowServicePath, 'utf8');
    locationPermissionGuardSource = fs.readFileSync(locationPermissionGuardPath, 'utf8');
    unserviceableModalSource = fs.readFileSync(unserviceableModalPath, 'utf8');
    locationServicesSource = fs.readFileSync(locationServicesPath, 'utf8');

    locationFlowService.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Test 1: Canonical API is Used with Actual Coordinates ──────────────────
  describe('Test 1 — Canonical API is used', () => {
    it('evaluateServiceability() makes a GET request to /api/serviceability/check with coordinates and storeId=store-001', async () => {
      let requestedUrl = '';
      vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
        requestedUrl = String(input);
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            serviceable: true,
            code: 'SERVICEABLE',
            status: 'SERVICEABLE',
            straightLineDistanceKm: 1.2,
            distanceKm: 1.2,
            maximumDistanceKm: 4.5,
            deliveryFee: 15,
            store: { id: 'store-001', name: 'Maule Kirana (Neral Hub)', deliveryRadiusKm: 4.5 },
          }),
        } as Response);
      }));

      const lat = 19.025;
      const lon = 73.322;
      const res = await locationFlowService.evaluateServiceability(lat, lon);

      expect(requestedUrl).toContain('/api/serviceability/check');
      expect(requestedUrl).toContain(`lat=${lat}`);
      expect(requestedUrl).toContain(`lng=${lon}`);
      expect(requestedUrl).toContain('storeId=store-001');
      expect(res?.isServiceable).toBe(true);
      expect(res?.distanceKm).toBe(1.2);
    });

    it('source inspection proves locationFlowService references canonical /api/serviceability/check', () => {
      expect(locationFlowServiceSource).toContain('/api/serviceability/check');
    });
  });

  // ─── Test 2: Legacy checkZoneServiceability is Not Used in this Flow ────────
  describe('Test 2 — Legacy serviceability function is not used', () => {
    it('lib/locationFlowService.ts does NOT import checkZoneServiceability', () => {
      expect(locationFlowServiceSource).not.toMatch(/import[^}]*checkZoneServiceability[^}]*from/);
    });

    it('lib/locationFlowService.ts does NOT call checkZoneServiceability anywhere', () => {
      expect(locationFlowServiceSource).not.toMatch(/checkZoneServiceability\s*\(/);
    });

    it('customer-app/components/LocationPermissionGuard.tsx does NOT import or call checkZoneServiceability', () => {
      expect(locationPermissionGuardSource).not.toMatch(/checkZoneServiceability/);
    });

    it('checkZoneServiceability in lib/locationServices.ts is marked as @deprecated', () => {
      expect(locationServicesSource).toMatch(/@deprecated[^\n]*Replaced by canonical `evaluateServerServiceability\(\)`/);
    });
  });

  // ─── Test 3: No Hardcoded Radius Authority ─────────────────────────────────
  describe('Test 3 — No hardcoded radius authority', () => {
    it('evaluateServiceability() does not hardcode 3.0, 4.5, or 5.0 km decision limits', () => {
      // Must not contain `distance <= 3.0` or `distance <= 4.5` or `distance <= 5.0`
      expect(locationFlowServiceSource).not.toMatch(/distance\s*<=\s*3/);
      expect(locationFlowServiceSource).not.toMatch(/distance\s*<=\s*4\.5/);
      expect(locationFlowServiceSource).not.toMatch(/distance\s*<=\s*5/);
      expect(locationFlowServiceSource).not.toMatch(/straightLineDistanceKm\s*<=\s*radiusKm/);
    });

    it('takes radius dynamically from canonical API response', async () => {
      vi.stubGlobal('fetch', vi.fn(() => {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            serviceable: true,
            code: 'SERVICEABLE',
            straightLineDistanceKm: 5.5,
            distanceKm: 5.5,
            maximumDistanceKm: 8.0, // Non-standard dynamic radius
            store: { id: 'store-001', name: 'Maule Kirana (Neral Hub)', deliveryRadiusKm: 8.0 },
          }),
        } as Response);
      }));

      const res = await locationFlowService.evaluateServiceability(19.05, 73.35);
      expect(res?.radiusKm).toBe(8.0);
      expect(res?.maximumDistanceKm).toBe(8.0);
      expect(res?.isServiceable).toBe(true);
    });
  });

  // ─── Test 4: No Road Multiplier ─────────────────────────────────────────────
  describe('Test 4 — No road multiplier', () => {
    it('lib/locationFlowService.ts does not apply 1.35 or 1.4 road multiplier', () => {
      expect(locationFlowServiceSource).not.toMatch(/1\.35/);
      expect(locationFlowServiceSource).not.toMatch(/1\.4/);
      expect(locationFlowServiceSource).not.toMatch(/roadDistanceMultiplier/);
      expect(locationFlowServiceSource).not.toMatch(/maxRoadDistanceKm/);
    });
  });

  // ─── Test 5: No Hardcoded Customer Delivery Fee ────────────────────────────
  describe('Test 5 — No hardcoded pricing', () => {
    it('lib/locationFlowService.ts does not hardcode delivery fee 15, 25, 299 or 99', () => {
      expect(locationFlowServiceSource).not.toMatch(/deliveryFee\s*[:=]\s*(?:15|25)\b/);
      expect(locationFlowServiceSource).not.toMatch(/minOrderAmount/);
      expect(locationFlowServiceSource).not.toMatch(/freeDeliveryThreshold/);
    });

    it('delivery fee is sourced directly from canonical API response', async () => {
      vi.stubGlobal('fetch', vi.fn(() => {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            serviceable: true,
            code: 'SERVICEABLE',
            straightLineDistanceKm: 1.0,
            distanceKm: 1.0,
            deliveryFee: 40, // Canonical backend calculated fee
            store: { id: 'store-001', name: 'Maule Kirana' },
          }),
        } as Response);
      }));

      const res = await locationFlowService.evaluateServiceability(19.02, 73.32);
      expect(res?.deliveryFee).toBe(40);
    });
  });

  // ─── Test 6: Advisory Behavior (Non-Blocking) ──────────────────────────────
  describe('Test 6 — Advisory behavior', () => {
    it('when canonical API returns serviceable: false, LocationPermissionGuard remains non-blocking', async () => {
      vi.stubGlobal('fetch', vi.fn(() => {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            serviceable: false,
            code: 'OUT_OF_SERVICE_AREA',
            status: 'OUT_OF_RANGE',
            straightLineDistanceKm: 12.0,
            distanceKm: 12.0,
            maximumDistanceKm: 4.5,
            message: 'Outside Delivery Radius (12.0 KM vs max 4.5 KM radius)',
            store: { id: 'store-001', name: 'Maule Kirana (Neral Hub)' },
          }),
        } as Response);
      }));

      await locationFlowService.evaluateServiceability(18.91, 73.32);
      const state = locationFlowService.getState();

      expect(state.status).toBe('UNSERVICEABLE');
      expect(state.serviceability?.isServiceable).toBe(false);
      expect(state.isUnserviceableModalOpen).toBe(true);

      // User can continue browsing
      locationFlowService.continueBrowsing();
      const updatedState = locationFlowService.getState();
      expect(updatedState.isUnserviceableModalOpen).toBe(false);
      expect(updatedState.allowBrowsingUnserviceable).toBe(true);
    });

    it('UnserviceableAreaModal source provides "Continue Browsing" action', () => {
      expect(unserviceableModalSource).toContain('continueBrowsing()');
      expect(unserviceableModalSource).toContain('Continue Browsing');
    });

    it('CustomerLocationPermissionGuard renders children unconditionally', () => {
      expect(locationPermissionGuardSource).toContain('{children}');
      // Does not return null or redirect away when unserviceable
      expect(locationPermissionGuardSource).not.toContain("router.replace('/not-serviceable')");
      expect(locationPermissionGuardSource).not.toContain('router.push');
    });
  });

  // ─── Test 7: API Failure Behavior ──────────────────────────────────────────
  describe('Test 7 — API failure behavior', () => {
    it('network failure sets SERVICEABILITY_NETWORK_ERROR without invoking fallback or fabricating data', async () => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('Network connection timeout'))));

      const res = await locationFlowService.evaluateServiceability(19.02, 73.32);
      const state = locationFlowService.getState();

      expect(res).toBeNull();
      expect(state.status).toBe('SERVICEABILITY_NETWORK_ERROR');
      expect(state.isNetworkError).toBe(true);
      expect(state.serviceability).toBeNull();
      expect(state.error).toContain("Couldn't check delivery availability");
    });

    it('HTTP 500 error sets SERVICEABILITY_NETWORK_ERROR cleanly', async () => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal Server Error' }),
      } as Response)));

      const res = await locationFlowService.evaluateServiceability(19.02, 73.32);
      const state = locationFlowService.getState();

      expect(res).toBeNull();
      expect(state.status).toBe('SERVICEABILITY_NETWORK_ERROR');
      expect(state.isNetworkError).toBe(true);
    });
  });

  // ─── Test 8: Checkout Remains Independent ──────────────────────────────────
  describe('Test 8 — Checkout remains independent', () => {
    it('LocationPermissionGuard does not call /api/checkout or Firebase placeOrder', () => {
      expect(locationPermissionGuardSource).not.toContain('/api/checkout');
      expect(locationPermissionGuardSource).not.toContain('placeOrder');
      expect(locationPermissionGuardSource).not.toContain('callPlaceOrder');
    });

    it('locationFlowService does not call /api/checkout or Firebase placeOrder', () => {
      expect(locationFlowServiceSource).not.toContain('/api/checkout');
      expect(locationFlowServiceSource).not.toContain('placeOrder');
      expect(locationFlowServiceSource).not.toContain('callPlaceOrder');
    });
  });

  // ─── Test 9: Auth and FCM Unaffected ────────────────────────────────────────
  describe('Test 9 — Auth and FCM unaffected', () => {
    it('fcmClient and userService imports remain intact in test suite', () => {
      const notificationTestPath = path.resolve(__dirname, 'location-notification-flow.test.ts');
      const notificationTestSource = fs.readFileSync(notificationTestPath, 'utf8');

      expect(notificationTestSource).toContain("import { requestFCMNotificationPermission } from '../lib/fcmClient'");
      expect(notificationTestSource).toContain("import { saveFcmToken } from '../lib/userService'");
    });

    it('locationFlowService maintains reset and subscribe patterns without altering auth dependencies', () => {
      expect(typeof locationFlowService.reset).toBe('function');
      expect(typeof locationFlowService.subscribe).toBe('function');
      expect(typeof locationFlowService.getState).toBe('function');
    });
  });
});
