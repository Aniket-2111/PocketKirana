import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Phase 2.7C.7.6-A — Legacy Firebase placeOrder Authority Decommission', () => {
  const placeOrderSourcePath = path.resolve(__dirname, '../functions/src/orders/placeOrder.ts');
  const functionsClientSourcePath = path.resolve(__dirname, '../lib/functionsClient.ts');
  const webCheckoutPath = path.resolve(__dirname, '../app/checkout/page.tsx');
  const customerCheckoutPath = path.resolve(__dirname, '../customer-app/app/checkout/page.tsx');

  const placeOrderSource = fs.readFileSync(placeOrderSourcePath, 'utf8');
  const functionsClientSource = fs.readFileSync(functionsClientSourcePath, 'utf8');
  const webCheckoutSource = fs.readFileSync(webCheckoutPath, 'utf8');
  const customerCheckoutSource = fs.readFileSync(customerCheckoutPath, 'utf8');

  describe('Test 1 — Zero Active Production Callers', () => {
    it('app/checkout/page.tsx does NOT invoke or import placeOrder or callPlaceOrder', () => {
      expect(webCheckoutSource).not.toMatch(/import[^}]*callPlaceOrder[^}]*from/);
      expect(webCheckoutSource).not.toMatch(/import[^}]*placeOrder[^}]*from\s+['"][^'"]*functions/);
      expect(webCheckoutSource).not.toContain('callPlaceOrder(');
      expect(webCheckoutSource).not.toContain("httpsCallable(functions, 'placeOrder')");
    });

    it('customer-app/app/checkout/page.tsx does NOT invoke or import placeOrder or callPlaceOrder', () => {
      expect(customerCheckoutSource).not.toMatch(/import[^}]*callPlaceOrder[^}]*from/);
      expect(customerCheckoutSource).not.toMatch(/import[^}]*placeOrder[^}]*from\s+['"][^'"]*functions/);
      expect(customerCheckoutSource).not.toContain('callPlaceOrder(');
      expect(customerCheckoutSource).not.toContain("httpsCallable(functions, 'placeOrder')");
    });
  });

  describe('Test 2 — Legacy Callable Rejects on Invocation', () => {
    it('functions/src/orders/placeOrder.ts unconditionally throws HttpsError failed-precondition', () => {
      expect(placeOrderSource).toContain("throw new HttpsError(");
      expect(placeOrderSource).toContain("'failed-precondition'");
      expect(placeOrderSource).toContain('Legacy Firebase placeOrder is decommissioned');
      expect(placeOrderSource).toContain('LEGACY_ORDER_PATH_DECOMMISSIONED');
    });

    it('runtime invocation of placeOrder callable handler throws failed-precondition', async () => {
      const { placeOrder } = await import('../functions/src/orders/placeOrder');
      expect(typeof placeOrder).toBe('function');
      
      // In firebase-functions v2, callable functions have a .run method or execute as a function
      if (typeof (placeOrder as any).run === 'function') {
        await expect((placeOrder as any).run({
          auth: { uid: 'test-user', token: { role: 'customer' } },
          data: { cartItems: [{ productId: 'p1', quantity: 1 }], addressId: 'a1', paymentMethod: 'cod' },
        })).rejects.toThrow(/decommissioned/i);
      }
    });
  });

  describe('Test 3 — Zero Executable Order Creation in placeOrder.ts', () => {
    it('placeOrder.ts contains no Firestore order collection writes', () => {
      expect(placeOrderSource).not.toContain('collection(C.ORDERS)');
      expect(placeOrderSource).not.toContain("collection('orders')");
      expect(placeOrderSource).not.toContain('orderDoc');
      expect(placeOrderSource).not.toContain('orderNumber');
      expect(placeOrderSource).not.toContain('generateProductionOrderNumber');
    });
  });

  describe('Test 4 — Zero Executable Stock Reservation in placeOrder.ts', () => {
    it('placeOrder.ts contains no stock reservation logic or Firestore transaction', () => {
      expect(placeOrderSource).not.toContain('stockReservations');
      expect(placeOrderSource).not.toContain('inventoryDocId');
      expect(placeOrderSource).not.toContain('runTransaction');
      expect(placeOrderSource).not.toContain('reservationItems');
    });
  });

  describe('Test 5 — Zero Legacy Pricing or Business-Rule Authority in placeOrder.ts', () => {
    it('placeOrder.ts does not query Firestore store configuration', () => {
      expect(placeOrderSource).not.toContain('getStoreConfig');
      expect(placeOrderSource).not.toContain('settings/store');
    });

    it('placeOrder.ts does not evaluate minimum order value', () => {
      expect(placeOrderSource).not.toContain('minimumOrderValue');
      expect(placeOrderSource).not.toMatch(/subtotal\s*<\s*config\.minimumOrderValue/);
    });

    it('placeOrder.ts does not evaluate delivery fee or free delivery threshold', () => {
      expect(placeOrderSource).not.toContain('freeDeliveryThreshold');
      expect(placeOrderSource).not.toContain('deliveryFee');
      expect(placeOrderSource).not.toContain('haversineKm');
      expect(placeOrderSource).not.toContain('deliveryRadiusKm');
    });
  });

  describe('Test 6 — Canonical Replacement Remains Intact', () => {
    it('app/checkout/page.tsx uses POST /api/checkout as sole order submission endpoint', () => {
      expect(webCheckoutSource).toContain("fetch('/api/checkout'");
      expect(webCheckoutSource).toContain("method: 'POST'");
      expect(webCheckoutSource).toContain('x-idempotency-key');
    });

    it('customer-app/app/checkout/page.tsx uses POST /api/checkout as sole order submission endpoint', () => {
      expect(customerCheckoutSource).toContain("fetch('/api/checkout'");
      expect(customerCheckoutSource).toContain("method: 'POST'");
      expect(customerCheckoutSource).toContain('x-idempotency-key');
    });

    it('lib/functionsClient.ts marks callPlaceOrder as @deprecated NON-AUTHORITATIVE', () => {
      expect(functionsClientSource).toMatch(/@deprecated[\s\S]*?callPlaceOrder/);
      expect(functionsClientSource).toContain('POST /api/checkout');
    });
  });
});
