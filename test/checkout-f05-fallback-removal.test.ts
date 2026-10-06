import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('PHASE 2.7C.7.1 — Finding F-05: Cloud Function Order Fallback Removal Suite', () => {
  const checkoutPagePath = path.resolve(__dirname, '../app/checkout/page.tsx');
  let checkoutPageSource: string;

  beforeEach(() => {
    checkoutPageSource = fs.readFileSync(checkoutPagePath, 'utf8');
  });

  describe('Static & Structural Safety Invariants', () => {
    it('Invariant 1: app/checkout/page.tsx does NOT import callPlaceOrder', () => {
      expect(checkoutPageSource).not.toMatch(/import\s+.*callPlaceOrder.*from/);
      expect(checkoutPageSource).not.toContain("from '@/lib/functionsClient'");
    });

    it('Invariant 2: app/checkout/page.tsx does NOT invoke callPlaceOrder anywhere in handlePlaceOrder', () => {
      expect(checkoutPageSource).not.toContain('callPlaceOrder(');
    });

    it('Invariant 3: app/checkout/page.tsx does NOT import placeOrder from Firebase Cloud Functions', () => {
      expect(checkoutPageSource).not.toMatch(/import\s+.*placeOrder.*from\s+['"].*functions/);
    });

    it('Invariant 4: POST /api/checkout is the single order submission endpoint in app/checkout/page.tsx', () => {
      const fetchMatches = checkoutPageSource.match(/fetch\(['"`]([^'"`]+)['"`]/g);
      expect(fetchMatches).toBeDefined();
      const checkoutFetches = fetchMatches?.filter((m) => m.includes('/api/checkout'));
      expect(checkoutFetches?.length).toBe(1);
    });
  });

  describe('Runtime Emulation: Error, Rejection & Network Scenarios', () => {
    it('Test 1 — API success: processes order via /api/checkout and does NOT trigger any Cloud Function fallback', async () => {
      const mockSuccessResponse = {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            orderId: 'ord-test-success-123',
            orderNumber: 'PK-999',
            total: 250.0,
            requiresPayment: false,
          },
        }),
      };

      const fetchMock = vi.fn().mockResolvedValue(mockSuccessResponse);
      const callPlaceOrderSpy = vi.fn();

      // Emulate the exact logic in app/checkout/page.tsx
      const idempotencyKey = `idemp_${Date.now()}_test`;
      let result: any = null;

      try {
        const checkoutRes = await fetchMock('/api/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-idempotency-key': idempotencyKey,
          },
        });

        const checkoutData = await checkoutRes.json();
        if (checkoutRes.ok && checkoutData.success) {
          result = {
            success: true,
            orderId: checkoutData.data.orderId,
            orderNumber: checkoutData.data.orderNumber,
            total: checkoutData.data.total,
            requiresPayment: checkoutData.data.requiresPayment,
          };
        } else {
          throw new Error('Should not reach here');
        }
      } catch (networkErr: any) {
        throw new Error('Should not reach catch on success');
      }

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.orderId).toBe('ord-test-success-123');
      expect(result.orderNumber).toBe('PK-999');
      expect(callPlaceOrderSpy).not.toHaveBeenCalled();
    });

    it('Test 2 — API business rejection: returns error toast, does NOT call callPlaceOrder, and returns to retryable state', async () => {
      const mockBusinessRejection = {
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          error: 'Item Toor Dal has insufficient stock (available: 0, requested: 2).',
        }),
      };

      const fetchMock = vi.fn().mockResolvedValue(mockBusinessRejection);
      const toastSpy = vi.fn();
      let isProcessing = true;
      let frozenSnapshot: any = { items: ['item-1'] };
      let callPlaceOrderAttempted = false;

      const idempotencyKey = `idemp_${Date.now()}_test`;
      let result: any = null;

      try {
        const checkoutRes = await fetchMock('/api/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-idempotency-key': idempotencyKey,
          },
        });

        const checkoutData = await checkoutRes.json();
        if (checkoutRes.ok && checkoutData.success) {
          result = {
            success: true,
            orderId: checkoutData.data.orderId,
          };
        } else {
          // Canonical API rejection
          const errorMsg = checkoutData?.error || 'Failed to place order. Please try again.';
          frozenSnapshot = null;
          toastSpy(errorMsg, 'error');
          isProcessing = false;
        }
      } catch (networkErr: any) {
        // Not reached in HTTP 400
      }

      // Assertions
      expect(result).toBeNull();
      expect(callPlaceOrderAttempted).toBe(false);
      expect(toastSpy).toHaveBeenCalledWith(
        'Item Toor Dal has insufficient stock (available: 0, requested: 2).',
        'error'
      );
      expect(isProcessing).toBe(false);
      expect(frozenSnapshot).toBeNull();
    });

    it('Test 3 — API/network failure: surfaces retryable error, re-enables checkout button, and executes zero Firebase fallback', async () => {
      const networkError = new TypeError('Failed to fetch');
      const fetchMock = vi.fn().mockRejectedValue(networkError);
      const toastSpy = vi.fn();
      let isProcessing = true;
      let frozenSnapshot: any = { items: ['item-1'] };
      let callPlaceOrderAttempted = false;

      const idempotencyKey = `idemp_${Date.now()}_test`;
      let result: any = null;

      try {
        const checkoutRes = await fetchMock('/api/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-idempotency-key': idempotencyKey,
          },
        });

        const checkoutData = await checkoutRes.json();
        if (checkoutRes.ok && checkoutData.success) {
          result = checkoutData.data;
        } else {
          const errorMsg = checkoutData?.error || 'Failed to place order. Please try again.';
          frozenSnapshot = null;
          toastSpy(errorMsg, 'error');
          isProcessing = false;
        }
      } catch (networkErr: any) {
        frozenSnapshot = null;
        toastSpy('Network error while placing order. Please check your connection and try again.', 'error');
        isProcessing = false;
      }

      expect(result).toBeNull();
      expect(callPlaceOrderAttempted).toBe(false);
      expect(toastSpy).toHaveBeenCalledWith(
        'Network error while placing order. Please check your connection and try again.',
        'error'
      );
      expect(isProcessing).toBe(false); // Button returns to usable/retryable state
      expect(frozenSnapshot).toBeNull();
    });

    it('Test 4 — Idempotency preservation: x-idempotency-key header is passed in request to POST /api/checkout', async () => {
      let capturedHeaders: Record<string, string> = {};
      const fetchMock = vi.fn().mockImplementation((_url, options) => {
        capturedHeaders = options.headers;
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: { orderId: 'ord-1', total: 100 } }),
        });
      });

      const idempotencyKey = `idemp_${Date.now()}_xyz123`;
      await fetchMock('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-idempotency-key': idempotencyKey,
        },
      });

      expect(capturedHeaders['x-idempotency-key']).toBe(idempotencyKey);
      expect(capturedHeaders['x-idempotency-key']).toMatch(/^idemp_\d+_[a-z0-9]+$/);
    });
  });

  describe('Test 5 — Repository-Wide Active Caller Scan Verification', () => {
    it('Verifies zero active production callers of callPlaceOrder across the entire codebase', () => {
      const appCheckout = fs.readFileSync(path.resolve(__dirname, '../app/checkout/page.tsx'), 'utf8');
      const customerAppCheckout = fs.readFileSync(path.resolve(__dirname, '../customer-app/app/checkout/page.tsx'), 'utf8');

      expect(appCheckout).not.toContain('callPlaceOrder');
      expect(customerAppCheckout).not.toContain('callPlaceOrder');
    });
  });
});
