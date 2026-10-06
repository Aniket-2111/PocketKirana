/**
 * PocketKirana — PostHog Client-Side Analytics Engine
 *
 * Implements resilient product analytics for Web and Capacitor APKs:
 *  - Non-blocking, isolated execution (never halts checkout, payment, or UI).
 *  - Duplicate event protection for re-renders & idempotency keys.
 *  - Automatic environment separation and platform tagging.
 *  - Respects user consent.
 */

import posthog from 'posthog-js';
import { PostHogEvents, PostHogEventName } from './events';
import { sanitizeAnalyticsProperties } from './sanitization';
import { hasAnalyticsConsent } from './consent';
import {
  AppPlatform,
  UserAnalyticsProperties,
  ProductAnalyticsProperties,
  CartAnalyticsProperties,
  CheckoutAnalyticsProperties,
  OrderAnalyticsProperties,
  DeliveryAnalyticsProperties,
  PickerAnalyticsProperties,
  ErrorAnalyticsProperties,
  PerformanceAnalyticsProperties,
  TrackEventOptions,
} from './types';

// In-memory deduplication cache to prevent re-render duplicates (e.g. React 19 strict mode or multi-renders)
const recentEventsCache = new Map<string, number>();
const DEFAULT_DEDUP_WINDOW_MS = 3000; // 3 seconds window

let isInitialized = false;

/**
 * Detects current runtime platform (web vs capacitor APKs)
 */
export function detectPlatform(): AppPlatform {
  if (typeof window === 'undefined') return 'web';

  const userAgent = window.navigator.userAgent || '';
  const isCapacitor = Boolean((window as any).Capacitor?.isNativePlatform?.() || (window as any).Capacitor);

  if (isCapacitor || userAgent.includes('PocketKirana-Customer')) {
    return 'customer_apk';
  }
  if (userAgent.includes('PocketKirana-Delivery')) {
    return 'delivery_apk';
  }
  if (userAgent.includes('PocketKirana-Picker')) {
    return 'picker_apk';
  }

  // Check URL pathname for sub-app contexts if running in web preview
  const path = window.location.pathname;
  if (path.startsWith('/delivery')) return 'delivery_apk';
  if (path.startsWith('/picker')) return 'picker_apk';

  return 'web';
}

/**
 * Initializes the PostHog client SDK on browser mount
 */
export function initPostHogClient(): void {
  if (typeof window === 'undefined' || isInitialized) {
    return;
  }

  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

  if (!apiKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[PostHog] Initialized in mock mode (NEXT_PUBLIC_POSTHOG_KEY not set). Events will be logged to console in dev.');
    }
    isInitialized = true;
    return;
  }

  try {
    posthog.init(apiKey, {
      api_host: apiHost,
      autocapture: false, // We use explicit, standardized event tracking
      capture_pageview: false, // Manual page views for Next.js App Router navigation accuracy
      capture_pageleave: true,
      persistence: 'localStorage+cookie',
      opt_out_capturing_by_default: !hasAnalyticsConsent(),
      sanitize_properties: (properties) => sanitizeAnalyticsProperties(properties),
      loaded: (ph) => {
        if (!hasAnalyticsConsent()) {
          ph.opt_out_capturing();
        }
      },
    });

    // Register super properties sent with every subsequent event
    posthog.register({
      platform: detectPlatform(),
      environment: process.env.NODE_ENV || 'development',
      app_version: '1.0.0',
    });

    isInitialized = true;
  } catch (err) {
    console.warn('[PostHog] Initialization failed gracefully:', err);
  }
}

/**
 * Deduplication check to prevent repeat event firing on React re-renders.
 */
function isDuplicateEvent(dedupKey: string, windowMs: number = DEFAULT_DEDUP_WINDOW_MS): boolean {
  const now = Date.now();
  const lastTime = recentEventsCache.get(dedupKey);

  if (lastTime && now - lastTime < windowMs) {
    return true;
  }

  recentEventsCache.set(dedupKey, now);

  // Prune cache if it gets too large
  if (recentEventsCache.size > 200) {
    const cutoff = now - 60000;
    for (const [k, timestamp] of recentEventsCache.entries()) {
      if (timestamp < cutoff) recentEventsCache.delete(k);
    }
  }

  return false;
}

/**
 * Base event tracking function.
 * Completely isolated: never throws and never impacts business logic.
 */
export function trackEvent(
  eventName: PostHogEventName | string,
  properties?: Record<string, any>,
  options?: TrackEventOptions
): void {
  try {
    if (typeof window === 'undefined') return;

    if (!hasAnalyticsConsent()) return;

    // Check deduplication if dedupKey is specified
    if (options?.dedupKey) {
      if (isDuplicateEvent(options.dedupKey, options.dedupWindowMs)) {
        return;
      }
    }

    const sanitized = sanitizeAnalyticsProperties(properties);
    const enrichedProperties = {
      ...sanitized,
      platform: sanitized.platform || detectPlatform(),
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    };

    const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!apiKey) {
      if (process.env.NODE_ENV !== 'production') {
        console.debug(`[PostHog Track Event] ${eventName}:`, enrichedProperties);
      }
      return;
    }

    posthog.capture(eventName, enrichedProperties);
  } catch (err) {
    // Non-fatal analytics error isolation
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[PostHog] Error tracking event '${eventName}':`, err);
    }
  }
}

/**
 * Identifies the authenticated user using their internal stable identifier.
 */
export function identifyUser(userId: string, properties?: UserAnalyticsProperties): void {
  try {
    if (typeof window === 'undefined' || !userId) return;

    if (!hasAnalyticsConsent()) return;

    const sanitizedProps = sanitizeAnalyticsProperties(properties);
    const enriched = {
      ...sanitizedProps,
      platform: sanitizedProps.platform || detectPlatform(),
      environment: process.env.NODE_ENV || 'development',
    };

    const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!apiKey) {
      if (process.env.NODE_ENV !== 'production') {
        console.debug(`[PostHog Identify] distinct_id: ${userId}`, enriched);
      }
      return;
    }

    posthog.identify(userId, enriched);
  } catch (err) {
    console.warn('[PostHog] Error identifying user:', err);
  }
}

/**
 * Sets user properties on an already identified user.
 */
export function setUserProperties(properties: UserAnalyticsProperties): void {
  try {
    if (typeof window === 'undefined') return;
    if (!hasAnalyticsConsent()) return;

    const sanitized = sanitizeAnalyticsProperties(properties);
    const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!apiKey) {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[PostHog Set User Properties]', sanitized);
      }
      return;
    }

    posthog.people.set(sanitized);
  } catch (err) {
    console.warn('[PostHog] Error setting user properties:', err);
  }
}

/**
 * Resets user session on logout.
 */
export function resetUser(): void {
  try {
    if (typeof window === 'undefined') return;
    recentEventsCache.clear();

    const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!apiKey) {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[PostHog Reset User]');
      }
      return;
    }

    posthog.reset();
  } catch (err) {
    console.warn('[PostHog] Error resetting user:', err);
  }
}

/**
 * Tracks page views for App Router navigation.
 */
export function trackPageView(url: string, properties?: Record<string, any>): void {
  const dedupKey = `pageview:${url}`;
  if (isDuplicateEvent(dedupKey, 1000)) return;

  trackEvent(PostHogEvents.PAGE_VIEWED, {
    path: url,
    ...properties,
  });
}

/**
 * Tracks product views with automatic deduplication per product ID.
 */
export function trackProductView(product: ProductAnalyticsProperties, source?: string): void {
  const dedupKey = `product_viewed:${product.product_id}`;
  trackEvent(
    PostHogEvents.PRODUCT_VIEWED,
    {
      product_id: product.product_id,
      category_id: product.category_id,
      brand_id: product.brand_id,
      product_name: product.product_name,
      price: product.price,
      quantity: product.quantity,
      source: source || product.source || 'direct',
    },
    { dedupKey, dedupWindowMs: 2000 }
  );
}

/**
 * Tracks cart operations.
 */
export function trackCartEvent(
  eventName:
    | typeof PostHogEvents.PRODUCT_ADDED_TO_CART
    | typeof PostHogEvents.PRODUCT_REMOVED_FROM_CART
    | typeof PostHogEvents.CART_VIEWED
    | typeof PostHogEvents.CART_QUANTITY_CHANGED
    | typeof PostHogEvents.CART_CLEARED,
  data: CartAnalyticsProperties
): void {
  trackEvent(eventName, {
    product_id: data.product_id,
    quantity: data.quantity,
    cart_item_count: data.cart_item_count,
    cart_value: data.cart_value,
    source: data.source || 'cart',
    variant_id: data.variant_id,
  });
}

/**
 * Tracks checkout funnel events.
 */
export function trackCheckoutEvent(
  eventName:
    | typeof PostHogEvents.CHECKOUT_STARTED
    | typeof PostHogEvents.ADDRESS_SELECTED
    | typeof PostHogEvents.DELIVERY_SLOT_SELECTED
    | typeof PostHogEvents.COUPON_OPENED
    | typeof PostHogEvents.COUPON_APPLIED
    | typeof PostHogEvents.COUPON_REMOVED
    | typeof PostHogEvents.PAYMENT_METHOD_SELECTED
    | typeof PostHogEvents.PAYMENT_STARTED
    | typeof PostHogEvents.PAYMENT_SUCCESS
    | typeof PostHogEvents.PAYMENT_FAILED
    | typeof PostHogEvents.ORDER_PLACED,
  data: CheckoutAnalyticsProperties
): void {
  // Guard payment_success and order_placed against duplicate client firing
  const isTransactionEvent = eventName === PostHogEvents.PAYMENT_SUCCESS || eventName === PostHogEvents.ORDER_PLACED;
  const dedupKey = isTransactionEvent && data.order_id ? `${eventName}:${data.order_id}` : undefined;

  trackEvent(
    eventName,
    {
      order_id: data.order_id,
      cart_value: data.cart_value,
      coupon_code: data.coupon_code,
      discount_amount: data.discount_amount,
      payment_method: data.payment_method,
      delivery_zone: data.delivery_zone,
      failure_type: data.failure_type,
      error_message: data.error_message,
    },
    { dedupKey, dedupWindowMs: 10000 }
  );
}

/**
 * Tracks order lifecycle transitions.
 */
export function trackOrderEvent(
  eventName:
    | typeof PostHogEvents.ORDER_CREATED
    | typeof PostHogEvents.ORDER_CONFIRMED
    | typeof PostHogEvents.ORDER_PACKED
    | typeof PostHogEvents.ORDER_OUT_FOR_DELIVERY
    | typeof PostHogEvents.ORDER_DELIVERED
    | typeof PostHogEvents.ORDER_CANCELLED
    | typeof PostHogEvents.ORDER_RETURNED
    | typeof PostHogEvents.ORDER_PLACED,
  data: OrderAnalyticsProperties
): void {
  const dedupKey = `${eventName}:${data.order_id}`;
  trackEvent(
    eventName,
    {
      order_id: data.order_id,
      order_number: data.order_number,
      order_value: data.order_value,
      item_count: data.item_count,
      payment_method: data.payment_method,
      delivery_zone: data.delivery_zone,
      store_id: data.store_id,
      cancel_reason: data.cancel_reason,
    },
    { dedupKey, dedupWindowMs: 10000 }
  );
}

/**
 * Tracks delivery partner operations.
 */
export function trackDeliveryEvent(
  eventName: PostHogEventName | string,
  data: DeliveryAnalyticsProperties
): void {
  trackEvent(eventName, {
    order_id: data.order_id,
    partner_id: data.partner_id,
    status: data.status,
    delivery_zone: data.delivery_zone,
    failure_reason: data.failure_reason,
    distance_km: data.distance_km,
  });
}

/**
 * Tracks picker staff operations.
 */
export function trackPickerEvent(
  eventName: PostHogEventName | string,
  data: PickerAnalyticsProperties
): void {
  trackEvent(eventName, {
    order_id: data.order_id,
    picker_id: data.picker_id,
    product_id: data.product_id,
    quantity: data.quantity,
    barcode: data.barcode,
    item_count: data.item_count,
  });
}

/**
 * Tracks admin actions.
 */
export function trackAdminEvent(
  eventName: PostHogEventName | string,
  data: Record<string, any>
): void {
  trackEvent(eventName, {
    ...data,
    user_role: 'admin',
  });
}

/**
 * Tracks application errors.
 */
export function trackErrorEvent(
  errorType:
    | typeof PostHogEvents.API_ERROR
    | typeof PostHogEvents.PRODUCT_FETCH_FAILED
    | typeof PostHogEvents.CART_ERROR
    | typeof PostHogEvents.CHECKOUT_ERROR
    | typeof PostHogEvents.PAYMENT_ERROR
    | typeof PostHogEvents.NOTIFICATION_ERROR
    | typeof PostHogEvents.LOCATION_ERROR
    | typeof PostHogEvents.AUTHENTICATION_ERROR,
  data: ErrorAnalyticsProperties
): void {
  trackEvent(errorType, {
    route: data.route,
    error_code: data.error_code,
    http_status: data.http_status,
    context: data.context,
    message: data.message ? data.message.slice(0, 200) : undefined, // Truncate safely
  });
}

/**
 * Tracks performance milestones.
 */
export function trackPerformanceEvent(
  metricName:
    | typeof PostHogEvents.APP_START
    | typeof PostHogEvents.HOME_LOAD_COMPLETED
    | typeof PostHogEvents.PRODUCT_LOAD_COMPLETED
    | typeof PostHogEvents.SEARCH_COMPLETED
    | typeof PostHogEvents.CHECKOUT_LOAD_COMPLETED
    | typeof PostHogEvents.ORDER_TRACKING_LOADED,
  durationMs: number,
  properties?: Record<string, any>
): void {
  trackEvent(metricName, {
    duration_ms: Math.round(durationMs),
    ...properties,
  });
}
