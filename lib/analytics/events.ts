/**
 * PocketKirana — Centralized PostHog Event Definitions
 *
 * All event names MUST strictly follow snake_case naming conventions.
 * Grouped logically across Customer, Discovery, Cart, Checkout, Delivery, Picker, Admin, Error, and Performance.
 */

export const PostHogEvents = {
  // ── App & Navigation ────────────────────────────────────────────────────────
  APP_OPENED: 'app_opened',
  SESSION_STARTED: 'session_started',
  PAGE_VIEWED: 'page_viewed',
  HOME_VIEWED: 'home_viewed',
  CATEGORY_VIEWED: 'category_viewed',
  BRAND_VIEWED: 'brand_viewed',

  // ── Product Discovery & Catalog ─────────────────────────────────────────────
  PRODUCT_VIEWED: 'product_viewed',
  PRODUCT_SEARCHED: 'product_searched',
  SEARCH_SUBMITTED: 'search_submitted',
  SEARCH_NO_RESULTS: 'search_no_results',
  CATEGORY_PRODUCT_CLICKED: 'category_product_clicked',
  RECOMMENDED_PRODUCT_CLICKED: 'recommended_product_clicked',
  SIMILAR_PRODUCT_CLICKED: 'similar_product_clicked',
  BRAND_PRODUCT_CLICKED: 'brand_product_clicked',
  FILTER_USED: 'filter_used',
  SORT_USED: 'sort_used',
  CATEGORY_OPENED: 'category_opened',
  BRAND_OPENED: 'brand_opened',
  RECOMMENDATION_CLICKED: 'recommendation_clicked',

  // ── Cart Interactions ───────────────────────────────────────────────────────
  PRODUCT_ADDED_TO_CART: 'product_added_to_cart',
  PRODUCT_REMOVED_FROM_CART: 'product_removed_from_cart',
  CART_VIEWED: 'cart_viewed',
  CART_QUANTITY_CHANGED: 'cart_quantity_changed',
  CART_CLEARED: 'cart_cleared',

  // ── Checkout Funnel ─────────────────────────────────────────────────────────
  CHECKOUT_STARTED: 'checkout_started',
  ADDRESS_SELECTED: 'address_selected',
  DELIVERY_SLOT_SELECTED: 'delivery_slot_selected',
  COUPON_OPENED: 'coupon_opened',
  COUPON_APPLIED: 'coupon_applied',
  COUPON_REMOVED: 'coupon_removed',
  PAYMENT_METHOD_SELECTED: 'payment_method_selected',
  PAYMENT_STARTED: 'payment_started',
  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_FAILED: 'payment_failed',
  ORDER_PLACED: 'order_placed',

  // ── Order Lifecycle ─────────────────────────────────────────────────────────
  ORDER_CREATED: 'order_created',
  ORDER_CONFIRMED: 'order_confirmed',
  ORDER_PACKED: 'order_packed',
  ORDER_OUT_FOR_DELIVERY: 'order_out_for_delivery',
  ORDER_DELIVERED: 'order_delivered',
  ORDER_CANCELLED: 'order_cancelled',
  ORDER_RETURNED: 'order_returned',

  // ── Delivery Partner App ────────────────────────────────────────────────────
  DELIVERY_APP_OPENED: 'delivery_app_opened',
  DELIVERY_ORDER_RECEIVED: 'delivery_order_received',
  DELIVERY_ORDER_ACCEPTED: 'delivery_order_accepted',
  DELIVERY_ORDER_REJECTED: 'delivery_order_rejected',
  DELIVERY_NAVIGATION_STARTED: 'delivery_navigation_started',
  DELIVERY_ARRIVED: 'delivery_arrived',
  DELIVERY_OTP_STARTED: 'delivery_otp_started',
  DELIVERY_COMPLETED: 'delivery_completed',
  DELIVERY_FAILED: 'delivery_failed',
  DELIVERY_CANCELLED: 'delivery_cancelled',
  LOCATION_PERMISSION_GRANTED: 'location_permission_granted',
  LOCATION_PERMISSION_DENIED: 'location_permission_denied',
  BACKGROUND_LOCATION_STARTED: 'background_location_started',
  BACKGROUND_LOCATION_FAILED: 'background_location_failed',
  NOTIFICATION_PERMISSION_GRANTED: 'notification_permission_granted',
  NOTIFICATION_PERMISSION_DENIED: 'notification_permission_denied',

  // ── Picker App ──────────────────────────────────────────────────────────────
  PICKER_APP_OPENED: 'picker_app_opened',
  PICKING_QUEUE_VIEWED: 'picking_queue_viewed',
  ORDER_PICKING_STARTED: 'order_picking_started',
  PRODUCT_PICKING_STARTED: 'product_picking_started',
  PRODUCT_QUANTITY_UPDATED: 'product_quantity_updated',
  PRODUCT_PICKED: 'product_picked',
  PRODUCT_UNAVAILABLE: 'product_unavailable',
  ORDER_PICKING_COMPLETED: 'order_picking_completed',
  BARCODE_SCAN_STARTED: 'barcode_scan_started',
  BARCODE_SCAN_SUCCESS: 'barcode_scan_success',
  BARCODE_SCAN_FAILED: 'barcode_scan_failed',

  // ── Admin Operations ────────────────────────────────────────────────────────
  ADMIN_LOGIN: 'admin_login',
  ADMIN_DASHBOARD_VIEWED: 'admin_dashboard_viewed',
  PRODUCT_CREATED: 'product_created',
  PRODUCT_UPDATED: 'product_updated',
  PRODUCT_DELETED: 'product_deleted',
  CATEGORY_CREATED: 'category_created',
  CATEGORY_UPDATED: 'category_updated',
  OFFER_CREATED: 'offer_created',
  OFFER_UPDATED: 'offer_updated',
  BANNER_CREATED: 'banner_created',
  BANNER_UPDATED: 'banner_updated',
  INVENTORY_UPDATED: 'inventory_updated',
  ORDER_STATUS_UPDATED: 'order_status_updated',

  // ── Application Errors ──────────────────────────────────────────────────────
  API_ERROR: 'api_error',
  PRODUCT_FETCH_FAILED: 'product_fetch_failed',
  CART_ERROR: 'cart_error',
  CHECKOUT_ERROR: 'checkout_error',
  PAYMENT_ERROR: 'payment_error',
  NOTIFICATION_ERROR: 'notification_error',
  LOCATION_ERROR: 'location_error',
  AUTHENTICATION_ERROR: 'authentication_error',

  // ── Performance Metrics ─────────────────────────────────────────────────────
  APP_START: 'app_start',
  HOME_LOAD_COMPLETED: 'home_load_completed',
  PRODUCT_LOAD_COMPLETED: 'product_load_completed',
  SEARCH_COMPLETED: 'search_completed',
  CHECKOUT_LOAD_COMPLETED: 'checkout_load_completed',
  ORDER_TRACKING_LOADED: 'order_tracking_loaded',
} as const;

export type PostHogEventName = typeof PostHogEvents[keyof typeof PostHogEvents];
