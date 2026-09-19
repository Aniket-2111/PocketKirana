"use strict";
/**
 * PocketKirana — Shared Utilities for Cloud Functions
 * Haversine distance, audit logging, FCM dispatch helpers.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.newId = exports.inventoryDocId = exports.C = exports.STORE_LNG = exports.STORE_LAT = exports.STORE_ID = void 0;
exports.haversineKm = haversineKm;
exports.getStoreConfig = getStoreConfig;
exports.writeAuditLog = writeAuditLog;
exports.sendFcmToUser = sendFcmToUser;
exports.sendFcmToRole = sendFcmToRole;
exports.createNotificationRecord = createNotificationRecord;
exports.generateProductionOrderNumber = generateProductionOrderNumber;
exports.generateOrderNumber = generateOrderNumber;
const admin = __importStar(require("firebase-admin"));
// ══════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════
exports.STORE_ID = 'store-001';
exports.STORE_LAT = 19.0224536;
exports.STORE_LNG = 73.3210018;
// ══════════════════════════════════════════
// COLLECTIONS
// ══════════════════════════════════════════
exports.C = {
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
};
// ══════════════════════════════════════════
// HAVERSINE DISTANCE CALCULATION
// ══════════════════════════════════════════
/**
 * Calculate straight-line distance between two coordinates in kilometres.
 */
function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth radius in km
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
function toRad(deg) {
    return deg * (Math.PI / 180);
}
async function getStoreConfig() {
    const db = admin.firestore();
    const snap = await db.collection(exports.C.SETTINGS).doc('store').get();
    if (!snap.exists) {
        // Fallback defaults if not yet configured
        return {
            storeId: exports.STORE_ID,
            latitude: exports.STORE_LAT,
            longitude: exports.STORE_LNG,
            deliveryRadiusKm: 3,
            minimumOrderValue: 99,
            deliveryFee: 25,
            freeDeliveryThreshold: 299,
            isOpen: true,
            codEnabled: true,
            razorpayEnabled: false,
        };
    }
    return snap.data();
}
// ══════════════════════════════════════════
// AUDIT LOG
// ══════════════════════════════════════════
async function writeAuditLog(entry) {
    try {
        const db = admin.firestore();
        const logId = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        await db.collection(exports.C.AUDIT_LOGS).doc(logId).set({
            logId,
            ...entry,
            timestamp: new Date().toISOString(),
        });
    }
    catch (err) {
        console.error('[AuditLog] Failed to write audit log:', err);
    }
}
// ══════════════════════════════════════════
// FCM NOTIFICATION SENDER
// ══════════════════════════════════════════
async function sendFcmToUser(uid, notification, data) {
    try {
        const db = admin.firestore();
        const tokensSnap = await db
            .collection(exports.C.USERS)
            .doc(uid)
            .collection('fcmTokens')
            .where('enabled', '==', true)
            .get();
        if (tokensSnap.empty)
            return;
        const tokens = tokensSnap.docs.map((d) => d.data().fcmToken).filter(Boolean);
        if (tokens.length === 0)
            return;
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
        const invalidTokenIndices = [];
        results.responses.forEach((res, idx) => {
            if (!res.success && (res.error?.code === 'messaging/invalid-registration-token' ||
                res.error?.code === 'messaging/registration-token-not-registered')) {
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
    }
    catch (err) {
        console.error('[FCM] Failed to send FCM notification:', err);
    }
}
async function sendFcmToRole(role, storeId, notification, data) {
    try {
        const db = admin.firestore();
        let collectionName;
        if (role === 'admin')
            collectionName = exports.C.USERS;
        else if (role === 'picker')
            collectionName = exports.C.PICKERS;
        else
            collectionName = exports.C.DELIVERY_PARTNERS;
        const usersSnap = await db
            .collection(collectionName)
            .where('storeId', '==', storeId)
            .where('status', '==', 'active')
            .get();
        const sendPromises = usersSnap.docs.map((d) => sendFcmToUser(d.id, notification, data));
        await Promise.allSettled(sendPromises);
    }
    catch (err) {
        console.error('[FCM] Failed to send role broadcast:', err);
    }
}
// ══════════════════════════════════════════
// NOTIFICATION RECORD CREATOR
// ══════════════════════════════════════════
async function createNotificationRecord(notif) {
    try {
        const db = admin.firestore();
        const notifId = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        await db.collection(exports.C.NOTIFICATIONS).doc(notifId).set({
            id: notifId,
            ...notif,
            isRead: false,
            createdAt: new Date().toISOString(),
        });
    }
    catch (err) {
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
async function generateProductionOrderNumber(pool) {
    if (pool) {
        try {
            const result = await pool.query("SELECT NEXTVAL('pk_order_seq') AS nextval");
            const n = Number(result.rows[0].nextval);
            return n < 10 ? `PK-0${n}` : `PK-${n}`;
        }
        catch {
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
        }
        else {
            nextVal = (snap.data()?.current || 0) + 1;
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
function generateOrderNumber() {
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
const inventoryDocId = (productId, storeId) => `${productId}_${storeId}`;
exports.inventoryDocId = inventoryDocId;
const newId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
exports.newId = newId;
//# sourceMappingURL=utils.js.map