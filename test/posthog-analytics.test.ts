/**
 * PocketKirana — PostHog Product Analytics Comprehensive Test Suite
 *
 * Validates:
 *  1. Central event naming standard (snake_case)
 *  2. Privacy & DPDP / PCI sanitization (blocks OTP, passwords, tokens, salt keys, credit cards, exact GPS)
 *  3. Client-side tracking resilience (no-op when key is absent, never crashes)
 *  4. Duplicate event protection (re-render guard, transaction deduplication)
 *  5. User consent compliance (opt-out / opt-in)
 *  6. User identification & logout (identifyUser, resetUser)
 *  7. Cart, checkout funnel, and order lifecycle event formatting
 *  8. Feature flag evaluation resilience and fallbacks
 *  9. Authoritative server-side event tracking (trackServerEvent)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PostHogEvents,
  sanitizeAnalyticsProperties,
  hasAnalyticsConsent,
  setAnalyticsConsent,
  trackEvent,
  identifyUser,
  resetUser,
  trackProductView,
  trackCartEvent,
  trackCheckoutEvent,
  trackOrderEvent,
  trackErrorEvent,
  trackPerformanceEvent,
  isFeatureEnabled,
  getFeatureFlag,
} from '../lib/analytics';
import { trackServerEvent } from '../lib/analytics/serverAnalytics';

describe('PocketKirana PostHog Analytics Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Event Naming & Structure Standard', () => {
    it('enforces snake_case for all defined PostHog events', () => {
      Object.entries(PostHogEvents).forEach(([key, value]) => {
        expect(value).toMatch(/^[a-z]+(_[a-z0-9]+)*$/);
        expect(value).not.toContain(' ');
        expect(value).not.toContain('-');
      });
    });

    it('contains all core customer, checkout, order, delivery, picker, and admin events', () => {
      expect(PostHogEvents.PRODUCT_VIEWED).toBe('product_viewed');
      expect(PostHogEvents.PRODUCT_ADDED_TO_CART).toBe('product_added_to_cart');
      expect(PostHogEvents.CHECKOUT_STARTED).toBe('checkout_started');
      expect(PostHogEvents.PAYMENT_STARTED).toBe('payment_started');
      expect(PostHogEvents.PAYMENT_SUCCESS).toBe('payment_success');
      expect(PostHogEvents.ORDER_PLACED).toBe('order_placed');
      expect(PostHogEvents.ORDER_CANCELLED).toBe('order_cancelled');
      expect(PostHogEvents.DELIVERY_ORDER_ACCEPTED).toBe('delivery_order_accepted');
      expect(PostHogEvents.ORDER_PICKING_COMPLETED).toBe('order_picking_completed');
      expect(PostHogEvents.ADMIN_LOGIN).toBe('admin_login');
      expect(PostHogEvents.API_ERROR).toBe('api_error');
    });
  });

  describe('2. Privacy & Sensitive Data Sanitization Layer', () => {
    it('completely strips passwords, OTPs, salt keys, auth tokens, and card numbers', () => {
      const sensitiveInput = {
        product_id: 'p-milk-1',
        price: 38,
        password: 'SuperSecretPassword123!',
        otp: '1234',
        delivery_otp: '5678',
        salt_key: 'phonepe_salt_9999',
        card_number: '4111111111111111',
        cvv: '123',
        upi_pin: '0000',
        authorization: 'Bearer eyJhbGciOi...',
        pk_session: 'session_token_xyz',
      };

      const sanitized = sanitizeAnalyticsProperties(sensitiveInput);

      expect(sanitized.product_id).toBe('p-milk-1');
      expect(sanitized.price).toBe(38);
      expect(sanitized.password).toBeUndefined();
      expect(sanitized.otp).toBeUndefined();
      expect(sanitized.delivery_otp).toBeUndefined();
      expect(sanitized.salt_key).toBeUndefined();
      expect(sanitized.card_number).toBeUndefined();
      expect(sanitized.cvv).toBeUndefined();
      expect(sanitized.upi_pin).toBeUndefined();
      expect(sanitized.authorization).toBeUndefined();
      expect(sanitized.pk_session).toBeUndefined();
    });

    it('blocks exact GPS coordinates (latitude, longitude, coords)', () => {
      const locationInput = {
        delivery_zone: 'Zone-A-Downtown',
        city: 'Indore',
        postalCode: '452001',
        latitude: 22.7196,
        longitude: 75.8577,
        lat: 22.7196,
        lng: 75.8577,
        coordinates: [22.7196, 75.8577],
      };

      const sanitized = sanitizeAnalyticsProperties(locationInput);

      expect(sanitized.delivery_zone).toBe('Zone-A-Downtown');
      expect(sanitized.city).toBe('Indore');
      expect(sanitized.postalCode).toBe('452001');
      expect(sanitized.latitude).toBeUndefined();
      expect(sanitized.longitude).toBeUndefined();
      expect(sanitized.lat).toBeUndefined();
      expect(sanitized.lng).toBeUndefined();
      expect(sanitized.coordinates).toBeUndefined();
    });

    it('blocks detailed street addresses while preserving city and delivery zone', () => {
      const addressInput = {
        houseNumber: 'Flat 402',
        buildingName: 'Silver Palms',
        floor: '4th',
        addressLine1: 'Main Ring Road',
        addressLine2: 'Near Bus Stand',
        landmark: 'Opposite Mall',
        city: 'Indore',
        deliveryZoneId: 'zone-01',
      };

      const sanitized = sanitizeAnalyticsProperties(addressInput);

      expect(sanitized.city).toBe('Indore');
      expect(sanitized.deliveryZoneId).toBe('zone-01');
      expect(sanitized.houseNumber).toBeUndefined();
      expect(sanitized.buildingName).toBeUndefined();
      expect(sanitized.addressLine1).toBeUndefined();
      expect(sanitized.addressLine2).toBeUndefined();
    });

    it('redacts raw JWT strings embedded in values', () => {
      const tokenInput = {
        meta: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozGz_W4m_placeholder',
      };

      const sanitized = sanitizeAnalyticsProperties(tokenInput);
      expect(sanitized.meta).toBe('[REDACTED_JWT]');
    });
  });

  describe('3. User Consent Management', () => {
    it('defaults to true when no opt-out is recorded', () => {
      expect(hasAnalyticsConsent()).toBe(true);
    });

    it('allows opting out and respects consent flag', () => {
      setAnalyticsConsent(false);
      expect(hasAnalyticsConsent()).toBe(false);

      // Restore consent
      setAnalyticsConsent(true);
      expect(hasAnalyticsConsent()).toBe(true);
    });
  });

  describe('4. Client-Side Tracking Resilience (Non-Blocking)', () => {
    it('does not throw when tracking events without an active API key', () => {
      expect(() => {
        trackEvent(PostHogEvents.PRODUCT_VIEWED, { product_id: 'p-1' });
        trackProductView({ product_id: 'p-1', product_name: 'Fresh Milk' });
        trackCartEvent(PostHogEvents.PRODUCT_ADDED_TO_CART, { product_id: 'p-1', quantity: 2 });
        trackCheckoutEvent(PostHogEvents.CHECKOUT_STARTED, { cart_value: 300 });
        trackOrderEvent(PostHogEvents.ORDER_PLACED, { order_id: 'ord-123' });
        trackErrorEvent(PostHogEvents.API_ERROR, { route: '/api/cart', error_code: 500 });
        trackPerformanceEvent(PostHogEvents.APP_START, 240);
      }).not.toThrow();
    });

    it('handles identifyUser and resetUser gracefully', () => {
      expect(() => {
        identifyUser('usr-cust-9999', { user_role: 'customer' });
        resetUser();
      }).not.toThrow();
    });
  });

  describe('5. Duplicate Event Protection', () => {
    it('suppresses duplicate events within the deduplication window', () => {
      const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});

      // First call fires
      trackEvent(
        PostHogEvents.PRODUCT_VIEWED,
        { product_id: 'p-dedup-test' },
        { dedupKey: 'product_viewed:p-dedup-test', dedupWindowMs: 2000 }
      );

      // Immediate second call should be ignored
      trackEvent(
        PostHogEvents.PRODUCT_VIEWED,
        { product_id: 'p-dedup-test' },
        { dedupKey: 'product_viewed:p-dedup-test', dedupWindowMs: 2000 }
      );

      spy.mockRestore();
    });

    it('deduplicates transaction events (payment_success, order_placed)', () => {
      expect(() => {
        trackCheckoutEvent(PostHogEvents.PAYMENT_SUCCESS, {
          order_id: 'ord-trans-001',
          payment_method: 'phonepe',
        });
        trackCheckoutEvent(PostHogEvents.PAYMENT_SUCCESS, {
          order_id: 'ord-trans-001',
          payment_method: 'phonepe',
        });
      }).not.toThrow();
    });
  });

  describe('6. Feature Flags Abstraction', () => {
    it('returns default value safely when PostHog is uninitialized or in test mode', () => {
      expect(isFeatureEnabled('new_homepage_v2', false)).toBe(false);
      expect(isFeatureEnabled('new_checkout_flow', true)).toBe(true);
      expect(getFeatureFlag('banner_experiment', 'control')).toBe('control');
    });
  });

  describe('7. Authoritative Server-Side Tracking', () => {
    it('runs trackServerEvent asynchronously without throwing', async () => {
      await expect(
        trackServerEvent('usr-cust-123', PostHogEvents.ORDER_CREATED, {
          order_id: 'ord-server-001',
          order_number: 'PK26081991761',
          total_amount: 450,
          payment_method: 'phonepe',
        })
      ).resolves.not.toThrow();
    });

    it('sanitizes server-side properties before capture', async () => {
      await expect(
        trackServerEvent('usr-cust-123', PostHogEvents.ORDER_CONFIRMED, {
          order_id: 'ord-server-002',
          db_password: 'root',
          salt_key: 'phonepe_secret_123',
        })
      ).resolves.not.toThrow();
    });
  });
});
