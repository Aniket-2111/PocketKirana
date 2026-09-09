"use strict";
/**
 * Cloud Function: autoCompleteOrders
 *
 * Scheduled function that runs every hour to auto-complete orders that have
 * been in DELIVERED status for more than 24 hours without manual completion.
 *
 * This handles the common case where:
 * - Admin forgets to mark an order as COMPLETED
 * - Customer does not leave a review and order stays in DELIVERED state
 *
 * On auto-complete:
 * 1. Updates order status: DELIVERED → COMPLETED
 * 2. Commits stock reservation: 'reserved' → 'committed'
 * 3. Writes audit log
 *
 * Schedule: every hour via Cloud Scheduler
 * Region:   asia-south1
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
exports.autoCompleteOrders = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin = __importStar(require("firebase-admin"));
const utils_1 = require("../utils");
const AUTO_COMPLETE_AFTER_HOURS = 24;
exports.autoCompleteOrders = (0, scheduler_1.onSchedule)({
    schedule: 'every 60 minutes',
    region: 'asia-south1',
    timeoutSeconds: 120,
    memory: '256MiB',
}, async () => {
    const db = admin.firestore();
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - AUTO_COMPLETE_AFTER_HOURS * 60 * 60 * 1000).toISOString();
    console.log(`[AutoCompleteOrders] Running at ${now.toISOString()}, cutoff: ${cutoffTime}`);
    // ── Find DELIVERED orders older than 24 hours ────────────────────
    const deliveredSnap = await db
        .collection(utils_1.C.ORDERS)
        .where('orderStatus', '==', 'DELIVERED')
        .where('deliveredAt', '<', cutoffTime)
        .limit(50) // Process in batches
        .get();
    if (deliveredSnap.empty) {
        console.log('[AutoCompleteOrders] No orders to auto-complete.');
        return;
    }
    console.log(`[AutoCompleteOrders] Auto-completing ${deliveredSnap.size} orders.`);
    const nowIso = now.toISOString();
    const results = await Promise.allSettled(deliveredSnap.docs.map(async (orderDoc) => {
        const order = orderDoc.data();
        const batch = db.batch();
        // Update order status to COMPLETED
        batch.update(orderDoc.ref, {
            orderStatus: 'COMPLETED',
            completedAt: nowIso,
            statusHistory: admin.firestore.FieldValue.arrayUnion({
                status: 'COMPLETED',
                timestamp: nowIso,
                actorId: 'system',
                note: `Auto-completed ${AUTO_COMPLETE_AFTER_HOURS} hours after delivery.`,
            }),
        });
        // Commit the stock reservation (mark stock as permanently consumed)
        const reservationRef = db.collection(utils_1.C.STOCK_RESERVATIONS).doc(orderDoc.id);
        const resSnap = await reservationRef.get();
        if (resSnap.exists && resSnap.data()?.status === 'reserved') {
            batch.update(reservationRef, {
                status: 'committed',
                committedAt: nowIso,
            });
        }
        await batch.commit();
        // Audit log
        await (0, utils_1.writeAuditLog)({
            actorId: 'system',
            actorName: 'System Scheduler',
            actorRole: 'system',
            action: 'ORDER_STATUS_CHANGED',
            targetCollection: utils_1.C.ORDERS,
            targetId: orderDoc.id,
            description: `Order #${order.orderNumber} auto-completed after ${AUTO_COMPLETE_AFTER_HOURS}h.`,
            orderId: orderDoc.id,
            storeId: order.storeId || utils_1.STORE_ID,
            oldValue: { orderStatus: 'DELIVERED' },
            newValue: { orderStatus: 'COMPLETED' },
        });
        console.log(`[AutoCompleteOrders] Completed order: ${order.orderNumber} (${orderDoc.id})`);
    }));
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;
    console.log(`[AutoCompleteOrders] Done. Completed: ${succeeded}, Failed: ${failed}`);
});
//# sourceMappingURL=autoCompleteOrders.js.map