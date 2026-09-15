/**
 * PocketKirana — Canonical Firestore Collection Schema
 * Single source of truth for all Firestore collection names and document shapes.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ ARCHITECTURE RULE                                                       │
 * │                                                                         │
 * │ PostgreSQL = ALL business data (orders, payments, products, inventory,  │
 * │             delivery assignments, picking tasks, packing tasks,         │
 * │             delivery earnings, offers, coupons, admin, reports)         │
 * │                                                                         │
 * │ Firestore  = Identity layer + customer-facing realtime + notifications  │
 * │             (user profiles, addresses, FCM tokens, live delivery GPS,   │
 * │              realtime task state for app UIs, push notification records) │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * All server-side Cloud Functions and client-side service files
 * must import collection names from here — never hardcode strings.
 */

// ══════════════════════════════════════════
// COLLECTION NAME CONSTANTS
// ══════════════════════════════════════════

export const COLLECTIONS = {
  // ── Store configuration (read-heavy singleton, safe in Firestore) ─────────
  SETTINGS: 'settings',

  // ── Identity & Profiles ───────────────────────────────────────────────────
  // Customer profile data that extends Firebase Auth.
  // PostgreSQL links to these via firebase_uid — it never stores customer PII.
  USERS: 'users',

  // Picker and delivery partner Firestore profiles (auth + app state).
  // Business records (picking_tasks, delivery_assignments) are in PostgreSQL.
  PICKERS: 'pickers',
  DELIVERY_PARTNERS: 'deliveryPartners',

  // ── Customer addresses ────────────────────────────────────────────────────
  // Stored in Firestore so the customer app can read/write offline-first.
  // When an order is placed, the selected address is COPIED into
  // PostgreSQL order_addresses (immutable snapshot for the order record).
  ADDRESSES: 'addresses',

  // ── FCM / Push Notification tokens ───────────────────────────────────────
  // Maps firebase_uid → [device FCM tokens]
  // Written by each app on login; read by the backend notification dispatcher.
  NOTIFICATION_TOKENS: 'notificationTokens',

  // ── Customer-facing push notification records ─────────────────────────────
  // Lightweight records shown in the customer app's notification inbox.
  // The authoritative business event is always in PostgreSQL audit_logs.
  NOTIFICATIONS: 'notifications',

  // ── Realtime delivery tracking ────────────────────────────────────────────
  // Updated by the delivery partner app every ~7 seconds during active delivery.
  // Used for live map tracking in the customer app. NOT an audit record.
  // Authoritative GPS history is in PostgreSQL delivery_tracking.
  DELIVERY_TRACKING: 'deliveryTracking',

  // ── Realtime task state (UI layer only) ───────────────────────────────────
  // Mirrors just the *status* of PostgreSQL picking_tasks / packing_tasks /
  // delivery_assignments so picker and partner apps get instant Firestore
  // onSnapshot updates without polling the backend API.
  //
  // Source of truth is ALWAYS PostgreSQL. These are updated server-side
  // (by Cloud Functions or API event hooks) after each PostgreSQL write.
  PICKING_TASKS: 'pickingTasks',
  PACKING_TASKS: 'packingTasks',
  DELIVERY_ASSIGNMENTS: 'deliveryAssignments',

  // ── Customer support ──────────────────────────────────────────────────────
  // Tickets with realtime chat messages — Firestore is appropriate here.
  SUPPORT_TICKETS: 'supportTickets',
  SERVICE_REQUESTS: 'serviceRequests',

  // ── Misc requests ─────────────────────────────────────────────────────────
  // Picker-initiated new product requests (low volume, admin review needed).
  NEW_PRODUCT_REQUESTS: 'newProductRequests',

  // ── Financial Collections & Settlements ──────────────────────────────────
  COD_COLLECTIONS: 'codCollections',
  SETTLEMENTS: 'settlements',
  DELIVERY_EXCEPTIONS: 'deliveryExceptions',

  // ── Immutable audit trail ─────────────────────────────────────────────────
  // Append-only log of all sensitive operations. Duplicated from PostgreSQL
  // audit_logs for fast Firebase Console inspection. PostgreSQL is primary.
  AUDIT_LOGS: 'auditLogs',

  // ── DEPRECATED: Migrate to PostgreSQL API calls ───────────────────────────
  // These Firestore collections are kept temporarily for backward compatibility
  // while inventoryService.ts is being migrated to PostgreSQL.
  // TODO: Remove after inventoryService.ts is refactored to use /api/inventory.
  /** @deprecated Use PostgreSQL inventory table via /api/inventory */
  INVENTORY: 'inventory',
  /** @deprecated Use PostgreSQL inventory_transactions table via /api/inventory/movements */
  INVENTORY_MOVEMENTS: 'inventoryMovements',
} as const;

/**
 * REMOVED FROM FIRESTORE (now PostgreSQL-only):
 *
 * ❌ ORDERS, ORDER_ITEMS          → PostgreSQL: orders, order_items
 * ❌ PAYMENTS, REFUNDS            → PostgreSQL: payments, payment_transactions, refunds
 * ❌ INVENTORY, INVENTORY_MOVEMENTS,
 *    STOCK_RECEIPTS, STOCK_RESERVATIONS,
 *    STOCK_ADJUSTMENTS            → PostgreSQL: inventory, inventory_transactions, stock_reservations
 * ❌ PRODUCTS, PRODUCT_BARCODES,
 *    CATEGORIES, BRANDS           → PostgreSQL: products, product_variants, categories, brands
 * ❌ SHOPS, STORE_LOCATIONS       → PostgreSQL: stores
 * ❌ COUPONS, OFFERS,
 *    BANNERS, CAMPAIGNS           → PostgreSQL: coupons, offers, offer_products
 */

export type CollectionName = typeof COLLECTIONS[keyof typeof COLLECTIONS];

// ══════════════════════════════════════════
// DOCUMENT ID HELPERS
// ══════════════════════════════════════════

/** Inventory document ID: `{productId}_{storeId}` */
export const inventoryId = (productId: string, storeId: string) =>
  `${productId}_${storeId}`;

/** Delivery tracking document ID: same as assignmentId */
export const trackingId = (assignmentId: string) => assignmentId;

// ══════════════════════════════════════════
// FIRESTORE DOCUMENT TYPES
// ══════════════════════════════════════════

/**
 * settings/store — Single document for store configuration.
 * Stored at: settings/store
 */
export interface StoreConfig {
  storeId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  gstNumber?: string;

  // Fixed coordinates — Neral, Maharashtra
  latitude: number;   // 19.0224536
  longitude: number;  // 73.3210018

  // Delivery configuration
  deliveryRadiusKm: number;        // 3
  minimumOrderValue: number;
  deliveryFee: number;
  freeDeliveryThreshold: number;

  // Operations
  openingTime: string;             // "06:00"
  closingTime: string;             // "23:00"
  isOpen: boolean;
  codEnabled: boolean;

  // Online payment
  razorpayEnabled: boolean;
  razorpayKeyId?: string;          // Public key only (secret in Functions env)

  updatedAt: string;
}

/**
 * inventory/{productId}_{storeId}
 * Core inventory record. availableQuantity is always computed.
 */
export interface InventoryDoc {
  inventoryId: string;
  productId: string;
  productName: string;
  sku: string;
  storeId: string;
  locationId?: string;             // Primary storage location
  locationCode?: string;           // e.g. A-02-B-04

  quantity: number;                // Total physical quantity
  reservedQuantity: number;        // Reserved by active orders
  damagedQuantity: number;
  availableQuantity: number;       // quantity - reserved - damaged

  reorderLevel: number;
  maxStockLevel?: number;
  updatedAt: string;
  updatedBy?: string;              // uid of last actor
}

/**
 * stockReservations/{orderId}
 * Created atomically when an order is confirmed.
 */
export interface StockReservationDoc {
  reservationId: string;
  orderId: string;
  customerId: string;
  storeId: string;
  items: {
    productId: string;
    inventoryId: string;
    quantity: number;
  }[];
  status: 'reserved' | 'committed' | 'released' | 'expired';
  reservedAt: string;
  expiresAt: string;               // 30 minutes after reservation
  committedAt?: string;
  releasedAt?: string;
}

/**
 * stockReceipts/{receiptId}
 * Created when picker receives inward stock from supplier.
 */
export interface StockReceiptDoc {
  receiptId: string;
  productId: string;
  productName: string;
  barcode: string;
  storeId: string;
  quantity: number;
  locationId?: string;
  supplierName?: string;
  batchNumber?: string;
  expiryDate?: string;
  notes?: string;
  pickerId: string;
  pickerName: string;
  receivedAt: string;
  status: 'received' | 'putaway_pending' | 'putaway_complete';
}

/**
 * deliveryAssignments/{assignmentId}
 * Created when an order transitions to READY_FOR_PICKUP.
 */
export interface DeliveryAssignmentDoc {
  assignmentId: string;
  orderId: string;
  orderNumber: string;
  storeId: string;
  storeName: string;
  storeAddress: string;
  storeLatitude: number;
  storeLongitude: number;

  partnerId: string;
  partnerName: string;
  partnerPhone: string;

  customerName: string;
  customerPhone: string;           // Masked: +91 XXXXXX7890
  deliveryAddress: string;
  deliveryLatitude: number;
  deliveryLongitude: number;

  status: 'pending' | 'accepted' | 'rejected' | 'arrived_store' |
          'picked_up' | 'out_for_delivery' | 'arrived_customer' |
          'delivered' | 'failed' | 'cancelled';

  pickupOtp: string;               // For store handover verification
  customerOtp: string;             // For customer delivery verification

  estimatedDistanceKm: number;
  estimatedEarnings: number;

  dispatchedAt: string;
  acceptedAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  failedAt?: string;
  failureReason?: string;

  codAmount?: number;
  codCollected?: boolean;
  proofOfDeliveryUrl?: string;

  earnings?: {
    baseFee: number;
    distanceFee: number;
    peakBonus: number;
    total: number;
  };
}

/**
 * deliveryTracking/{assignmentId}
 * Updated by delivery partner every 7 seconds during active delivery.
 */
export interface DeliveryTrackingDoc {
  assignmentId: string;
  partnerId: string;
  orderId: string;
  currentLat: number;
  currentLng: number;
  speed?: number;               // km/h
  heading?: number;             // degrees 0-360
  accuracy?: number;            // meters
  updatedAt: string;
  isActive: boolean;
}

/**
 * payments/{paymentId}
 * Created by Cloud Function after payment verification.
 */
export interface PaymentDoc {
  paymentId: string;
  orderId: string;
  customerId: string;
  amount: number;
  currency: 'INR';
  method: 'razorpay' | 'upi' | 'phonepe' | 'cod' | 'wallet';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  gateway: 'razorpay' | 'phonepe' | 'cod' | 'internal';
  gatewayOrderId?: string;     // Razorpay / PhonePe order or transaction ID
  gatewayPaymentId?: string;   // Razorpay / PhonePe payment ID
  gatewaySignature?: string;   // For audit — do not expose to client
  paidAt?: string;
  failureReason?: string;
  createdAt: string;
}

/**
 * refunds/{refundId}
 * Created when order is cancelled after payment.
 */
export interface RefundDoc {
  refundId: string;
  orderId: string;
  paymentId: string;
  customerId: string;
  amount: number;
  reason: string;
  status: 'REQUESTED' | 'APPROVED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REJECTED';
  gatewayRefundId?: string;
  processedBy?: string;        // Admin uid
  createdAt: string;
  processedAt?: string;
}

/**
 * productBarcodes/{barcodeId}
 * Barcode registry — one product can have multiple barcode entries.
 */
export interface ProductBarcodeDoc {
  barcodeId: string;
  productId: string;
  storeId: string;
  barcode: string;             // The actual barcode value
  barcodeType: 'UPC' | 'EAN' | 'EAN13' | 'QR' | 'INTERNAL' | 'SKU';
  isPrimary: boolean;
  createdAt: string;
  createdBy: string;           // Admin uid
}

/**
 * auditLogs/{logId}
 * Immutable audit trail for all sensitive operations.
 */
export interface AuditLogDoc {
  logId: string;
  actorId: string;             // uid of the person performing the action
  actorName: string;
  actorRole: string;
  action: AuditAction;
  targetCollection: string;
  targetId: string;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  description: string;
  storeId?: string;
  orderId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

export type AuditAction =
  | 'PRODUCT_CREATED'
  | 'PRODUCT_UPDATED'
  | 'PRODUCT_PRICE_CHANGED'
  | 'PRODUCT_DEACTIVATED'
  | 'PRODUCT_DELETED'
  | 'INVENTORY_ADJUSTED'
  | 'INVENTORY_RECEIVED'
  | 'STOCK_PUTAWAY'
  | 'STOCK_RESERVED'
  | 'STOCK_RELEASED'
  | 'STOCK_COMMITTED'
  | 'ORDER_PLACED'
  | 'ORDER_CONFIRMED'
  | 'ORDER_CANCELLED'
  | 'ORDER_STATUS_CHANGED'
  | 'PAYMENT_VERIFIED'
  | 'PAYMENT_FAILED'
  | 'REFUND_REQUESTED'
  | 'REFUND_APPROVED'
  | 'REFUND_COMPLETED'
  | 'PICKER_APPROVED'
  | 'PICKER_SUSPENDED'
  | 'PARTNER_APPROVED'
  | 'PARTNER_SUSPENDED'
  | 'USER_ROLE_CHANGED'
  | 'USER_BLOCKED'
  | 'COUPON_CREATED'
  | 'COUPON_DEACTIVATED'
  | 'OFFER_CREATED'
  | 'STORE_CONFIG_CHANGED'
  | 'DELIVERY_COMPLETED'
  | 'DELIVERY_FAILED'
  | 'BARCODE_ASSIGNED'
  | 'NEW_PRODUCT_APPROVED'
  | 'NEW_PRODUCT_REJECTED';
