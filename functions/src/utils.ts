/**
 * PocketKirana — Shared Utilities for Cloud Functions
 * Haversine distance, audit logging, FCM dispatch helpers.
 */

import * as admin from 'firebase-admin';

// ══════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════

export const STORE_ID = 'store-001';
export const STORE_LAT = 19.0224536;
export const STORE_LNG = 73.3210018;

// ══════════════════════════════════════════
// COLLECTIONS
// ══════════════════════════════════════════

export const C = {
  SETTINGS: 'settings',
  USERS: 'users',
  PICKERS: 'pickers',
  DELIVERY_PARTNERS: 'deliveryPartners',
  PRODUCTS: 'products',
  PRODUCT_BARCODES: 'productBarcodes',
  CATEGORIES: 'categories',
  SHOPS: 'shops',
  STORE_LOCATIONS: 'storeLocations',
  INVENTORY: 'inventory',
  INVENTORY_MOVEMENTS: 'inventoryMovements',
  STOCK_RECEIPTS: 'stockReceipts',
  STOCK_RESERVATIONS: 'stockReservations',
  STOCK_ADJUSTMENTS: 'stockAdjustments',
  NEW_PRODUCT_REQUESTS: 'newProductRequests',
  ORDERS: 'orders',
  ORDER_ITEMS: 'orderItems',
  PAYMENTS: 'payments',
  REFUNDS: 'refunds',
  PICKING_TASKS: 'pickingTasks',
  PACKING_TASKS: 'packingTasks',
  DELIVERY_ASSIGNMENTS: 'deliveryAssignments',
  DELIVERY_TRACKING: 'deliveryTracking',
  ADDRESSES: 'addresses',
  COUPONS: 'coupons',
  OFFERS: 'offers',
  BANNERS: 'banners',
  CAMPAIGNS: 'campaigns',
  NOTIFICATIONS: 'notifications',
  SUPPORT_TICKETS: 'supportTickets',
  SERVICE_REQUESTS: 'serviceRequests',
  AUDIT_LOGS: 'auditLogs',
} as const;

// ══════════════════════════════════════════
// HAVERSINE DISTANCE CALCULATION
// ══════════════════════════════════════════

/**
 * Calculate straight-line distance between two coordinates in kilometres.
 */
export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// ══════════════════════════════════════════
// STORE CONFIG FETCHER
// ══════════════════════════════════════════

export interface StoreConfig {
  storeId: string;
  latitude: number;
  longitude: number;
  deliveryRadiusKm: number;
  minimumOrderValue: number;
  deliveryFee: number;
  freeDeliveryThreshold: number;
  isOpen: boolean;
  codEnabled: boolean;
  razorpayEnabled: boolean;
  razorpayKeyId?: string;
}

export async function getStoreConfig(): Promise<StoreConfig> {
  const db = admin.firestore();
  const snap = await db.collection(C.SETTINGS).doc('store').get();
  if (!snap.exists) {
    // Fallback defaults if not yet configured
    return {
      storeId: STORE_ID,
      latitude: STORE_LAT,
      longitude: STORE_LNG,
      deliveryRadiusKm: 3,
      minimumOrderValue: 99,
      deliveryFee: 25,
      freeDeliveryThreshold: 299,
      isOpen: true,
      codEnabled: true,
      razorpayEnabled: false,
    };
  }
  return snap.data() as StoreConfig;
}

// ══════════════════════════════════════════
// AUDIT LOG
// ══════════════════════════════════════════

export async function writeAuditLog(entry: {
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetCollection: string;
  targetId: string;
  description: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  storeId?: string;
  orderId?: string;
}): Promise<void> {
  try {
    const db = admin.firestore();
    const logId = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    await db.collection(C.AUDIT_LOGS).doc(logId).set({
      logId,
      ...entry,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[AuditLog] Failed to write audit log:', err);
  }
}

// ══════════════════════════════════════════
// FCM NOTIFICATION SENDER
// ══════════════════════════════════════════

export async function sendFcmToUser(
  uid: string,
  notification: {
    title: string;
    body: string;
    imageUrl?: string;
  },
  data?: Record<string, string>
): Promise<void> {
  try {
    const db = admin.firestore();
    const tokensSnap = await db
      .collection(C.USERS)
      .doc(uid)
      .collection('fcmTokens')
      .where('enabled', '==', true)
      .get();

    if (tokensSnap.empty) return;

    const tokens = tokensSnap.docs.map((d) => d.data().fcmToken as string).filter(Boolean);
    if (tokens.length === 0) return;

    const messaging = admin.messaging();
    const results = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl,
      },
      data: data || {},
      android: {
        priority: 'high',
        notification: { channelId: 'pocketkirana_orders' },
      },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
    });

    // Remove invalid tokens
    const invalidTokenIndices: number[] = [];
    results.responses.forEach((res, idx) => {
      if (!res.success && (
        res.error?.code === 'messaging/invalid-registration-token' ||
        res.error?.code === 'messaging/registration-token-not-registered'
      )) {
        invalidTokenIndices.push(idx);
      }
    });

    if (invalidTokenIndices.length > 0) {
      const batch = db.batch();
      tokensSnap.docs.forEach((docSnap, idx) => {
        if (invalidTokenIndices.includes(idx)) {
          batch.update(docSnap.ref, { enabled: false });
        }
      });
      await batch.commit();
    }
  } catch (err) {
    console.error('[FCM] Failed to send FCM notification:', err);
  }
}

export async function sendFcmToRole(
  role: 'admin' | 'picker' | 'delivery_partner',
  storeId: string,
  notification: { title: string; body: string; imageUrl?: string },
  data?: Record<string, string>
): Promise<void> {
  try {
    const db = admin.firestore();
    let collectionName: string;
    if (role === 'admin') collectionName = C.USERS;
    else if (role === 'picker') collectionName = C.PICKERS;
    else collectionName = C.DELIVERY_PARTNERS;

    const usersSnap = await db
      .collection(collectionName)
      .where('storeId', '==', storeId)
      .where('status', '==', 'active')
      .get();

    const sendPromises = usersSnap.docs.map((d) =>
      sendFcmToUser(d.id, notification, data)
    );
    await Promise.allSettled(sendPromises);
  } catch (err) {
    console.error('[FCM] Failed to send role broadcast:', err);
  }
}

// ══════════════════════════════════════════
// NOTIFICATION RECORD CREATOR
// ══════════════════════════════════════════

export async function createNotificationRecord(notif: {
  recipientId: string;
  recipientType: 'customer' | 'admin' | 'picker' | 'delivery_partner';
  type: string;
  title: string;
  message: string;
  orderId?: string;
  deepLink?: string;
  imageUrl?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    const db = admin.firestore();
    const notifId = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    await db.collection(C.NOTIFICATIONS).doc(notifId).set({
      id: notifId,
      ...notif,
      isRead: false,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Notification] Failed to create notification record:', err);
  }
}

// ══════════════════════════════════════════
// ORDER NUMBER GENERATOR
// ══════════════════════════════════════════

/**
 * generateProductionOrderNumber — concurrency-safe sequential production order number.
 * Supports PostgreSQL pool if provided, or Firestore atomic sequence counter in standalone functions runtime.
 *
 * Format:
 *   1   → PK-01
 *   9   → PK-09
 *   10  → PK-10
 *   99  → PK-99
 *   100 → PK-100
 */
export async function generateProductionOrderNumber(
  pool?: { query: (sql: string) => Promise<{ rows: Array<{ nextval: string | number }> }> }
): Promise<string> {
  if (pool) {
    try {
      const result = await pool.query("SELECT NEXTVAL('pk_order_seq') AS nextval");
      const n = Number(result.rows[0].nextval);
      return n < 10 ? `PK-0${n}` : `PK-${n}`;
    } catch {
      // Fallback to Firestore atomic counter if PG pool query fails
    }
  }

  // Standalone Firestore Atomic Sequence Counter for Cloud Functions environment
  const db = admin.firestore();
  const counterRef = db.collection('counters').doc('order_sequence');
  let nextVal = 1;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    if (!snap.exists) {
      nextVal = 1;
      tx.set(counterRef, { current: 1, updatedAt: new Date().toISOString() });
    } else {
      nextVal = ((snap.data()?.current as number) || 0) + 1;
      tx.update(counterRef, { current: nextVal, updatedAt: new Date().toISOString() });
    }
  });

  return nextVal < 10 ? `PK-0${nextVal}` : `PK-${nextVal}`;
}

/**
 * generateOrderNumber — retained for automated test scripts only.
 * Do NOT use this for production order creation.
 * @internal
 */
export function generateOrderNumber(): string {
  const date = new Date();
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const seq = Math.floor(10000 + Math.random() * 90000);
  return `PK${yy}${mm}${dd}${seq}`;
}

// ══════════════════════════════════════════
// ID GENERATORS
// ══════════════════════════════════════════

export const inventoryDocId = (productId: string, storeId: string) =>
  `${productId}_${storeId}`;

export const newId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
