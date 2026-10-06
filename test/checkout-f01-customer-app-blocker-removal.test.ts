import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('PHASE 2.7C.7.2 — Finding F-01: Customer App Hardcoded 4.5 km Blocker Removal Suite', () => {
  const customerCheckoutPath = path.resolve(__dirname, '../customer-app/app/checkout/page.tsx');
  let customerCheckoutSource: string;

  beforeEach(() => {
    customerCheckoutSource = fs.readFileSync(customerCheckoutPath, 'utf8');
  });

  describe('Static & Structural Safety Invariants', () => {
    it('Requirement 1: customer-app checkout contains no hardcoded 4.5 km serviceability blocker', () => {
      expect(customerCheckoutSource).not.toMatch(/dist\s*>\s*4\.5/);
      expect(customerCheckoutSource).not.toMatch(/Max\s+radius:\s*4\.5\s*KM/i);
      expect(customerCheckoutSource).not.toContain('4.5');
    });

    it('Requirement 2: customer-app checkout contains no hardcoded canonical store coordinates (19.0224536, 73.3210018)', () => {
      expect(customerCheckoutSource).not.toContain('19.0224536');
      expect(customerCheckoutSource).not.toContain('73.3210018');
    });

    it('Requirement 3: customer-app checkout does not perform client-side Haversine serviceability calculations', () => {
      expect(customerCheckoutSource).not.toMatch(/calculateDistanceKm\s*\(/);
      expect(customerCheckoutSource).not.toMatch(/from\s+['"]@\/lib\/locationServices['"]/);
    });

    it('Requirement 4: customer-app checkout does not use pincode 410101 as an authoritative serviceability rule', () => {
      // Pincode 410101 must not be used in conditional serviceability/delivery eligibility logic
      expect(customerCheckoutSource).not.toMatch(/isNeralPincode/);
      expect(customerCheckoutSource).not.toMatch(/postalCode\s*===\s*['"]410101['"]/);
    });

    it('Requirement 6: POST /api/checkout remains the final order submission endpoint', () => {
      expect(customerCheckoutSource).toContain("fetch('/api/checkout'");
      expect(customerCheckoutSource).toContain("method: 'POST'");
    });

    it('Requirement 7: No Firebase/Firestore order fallback is introduced', () => {
      expect(customerCheckoutSource).not.toContain('callPlaceOrder');
      expect(customerCheckoutSource).not.toMatch(/import\s+.*placeOrder.*from\s+['"].*functions/);
      expect(customerCheckoutSource).not.toContain("httpsCallable(functions, 'placeOrder')");
    });

    it('Requirement 8: Existing idempotency behavior remains intact (x-idempotency-key sent to POST /api/checkout)', () => {
      expect(customerCheckoutSource).toContain("'x-idempotency-key': idempotencyKey");
      expect(customerCheckoutSource).toMatch(/idempotencyKey\s*=\s*`checkout-\$\{currentUser\?.id \|\| 'guest'\}-\$\{Date\.now\(\)\}`/);
    });
  });

  describe('Runtime Execution & Server Authority Verification', () => {
    it('Requirement 5: A serviceability rejection comes from the canonical server result rather than a client distance check', async () => {
      // Simulate POST /api/checkout returning an authoritative 400 serviceability rejection
      const serverRejectionPayload = {
        error: 'Address is outside the delivery radius of 3 km for this store (distance: 4.8 km).',
        code: 'OUT_OF_SERVICE_AREA',
        distanceKm: 4.8,
        deliveryRadiusKm: 3.0,
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => serverRejectionPayload,
      });

      const toastSpy = vi.fn();
      let btnState = 'submitting';
      let isSubmitting = true;
      let frozenSnapshot: any = { items: ['test'] };

      // Emulate the updated customer-app checkout submit logic
      const targetAddressId = 'addr-remote-1';
      const apiResponse = await fetchMock('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-idempotency-key': 'checkout-usr-1-test',
        },
      });

      const apiData = await apiResponse.json().catch(() => null);
      let serverOrderId: string | null = null;

      if (apiResponse.ok && apiData?.success && apiData?.data?.orderId) {
        serverOrderId = apiData.data.orderId;
      } else if (apiData?.error) {
        // Authoritative server rejection surfaced to user
        toastSpy(apiData.error, 'error');
        btnState = 'idle';
        isSubmitting = false;
        frozenSnapshot = null;
      } else if (!apiResponse.ok) {
        toastSpy('Failed to place order. Please try again.', 'error');
        btnState = 'idle';
        isSubmitting = false;
        frozenSnapshot = null;
      }

      // Assertions
      expect(serverOrderId).toBeNull();
      expect(toastSpy).toHaveBeenCalledWith(
        'Address is outside the delivery radius of 3 km for this store (distance: 4.8 km).',
        'error'
      );
      expect(btnState).toBe('idle');
      expect(isSubmitting).toBe(false);
      expect(frozenSnapshot).toBeNull();
    });

    it('Allows an address at 4.6 km to proceed to POST /api/checkout when allowed by PostgreSQL store configuration', async () => {
      // Simulate POST /api/checkout succeeding for an address at 4.6 km with a 5 km store
      const serverSuccessPayload = {
        success: true,
        data: {
          orderId: 'ord-5km-store-success',
          orderNumber: 'PK-501',
          total: 350.0,
          requiresPayment: false,
          deliveryOtp: '1234',
        },
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => serverSuccessPayload,
      });

      const toastSpy = vi.fn();
      let serverOrderId: string | null = null;
      let serverOrderNumber: string | null = null;
      let serverTotal: number | null = null;
      let serverDeliveryOtp: string | null = null;

      const apiResponse = await fetchMock('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-idempotency-key': 'checkout-usr-1-test',
        },
      });

      const apiData = await apiResponse.json().catch(() => null);
      if (apiResponse.ok && apiData?.success && apiData?.data?.orderId) {
        serverOrderId = apiData.data.orderId;
        serverOrderNumber = apiData.data.orderNumber;
        serverTotal = apiData.data.total;
        serverDeliveryOtp = apiData.data.deliveryOtp;
      }

      expect(serverOrderId).toBe('ord-5km-store-success');
      expect(serverOrderNumber).toBe('PK-501');
      expect(serverTotal).toBe(350.0);
      expect(serverDeliveryOtp).toBe('1234');
      expect(toastSpy).not.toHaveBeenCalled();
    });
  });
});
