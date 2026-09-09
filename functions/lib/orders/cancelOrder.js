"use strict";
/**
 * Cloud Function: cancelOrder
 *
 * Enforces cancellation rules based on current order status:
 * - CREATED / PAYMENT_PENDING / CONFIRMED / STOCK_RESERVED: Customer can self-cancel
 * - PICKING / PICKED / PACKING: Admin approval required
 * - READY_FOR_PICKUP and beyond: Cannot be cancelled by customer
 *
 * On cancellation:
 * 1. Releases stock reservation atomically
 * 2. Creates refund record if payment was completed
 * 3. Updates order status to CANCELLED
 * 4. Notifies admin
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
exports.cancelOrder = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const utils_1 = require("../utils");
const CUSTOMER_CANCELLABLE_STATUSES = new Set([
    'CREATED',
    'PAYMENT_PENDING',
    'PAYMENT_FAILED',
    'CONFIRMED',
    'STOCK_RESERVED',
]);
const ADMIN_CANCELLABLE_STATUSES = new Set([
    'PICKING',
    'PICKED',
    'PACKING',
]);
exports.cancelOrder = (0, https_1.onCall)({ region: 'asia-south1', cors: true }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required.');
    }
    const uid = request.auth.uid;
    const role = request.auth.token.role || 'customer';
    const { orderId, reason } = request.data;
    if (!orderId) {
        throw new https_1.HttpsError('invalid-argument', 'orderId is required.');
    }
    const db = admin.firestore();
    const orderRef = db.collection(utils_1.C.ORDERS).doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Order not found.');
    }
    const order = orderSnap.data();
    // Ownership check — customer can only cancel their own orders
    if (role === 'customer' && order.customerId !== uid) {
        throw new https_1.HttpsError('permission-denied', 'You can only cancel your own orders.');
    }
    const currentStatus = order.orderStatus;
    // Check if cancellation is allowed
    if (role === 'customer') {
        if (!CUSTOMER_CANCELLABLE_STATUSES.has(currentStatus)) {
            if (ADMIN_CANCELLABLE_STATUSES.has(currentStatus)) {
                throw new https_1.HttpsError('failed-precondition', `Your order is currently being prepared. Please contact support to request cancellation.`);
            }
            throw new https_1.HttpsError('failed-precondition', `Order cannot be cancelled at status: ${currentStatus}. The order is already out for delivery or delivered.`);
        }
    }
    else if (role !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'Only customers and admins can cancel orders.');
    }
    const now = new Date().toISOString();
    // ── RELEASE STOCK RESERVATION ──────────────────────────────────
    const reservationSnap = await db
        .collection(utils_1.C.STOCK_RESERVATIONS)
        .doc(orderId)
        .get();
    if (reservationSnap.exists) {
        const reservation = reservationSnap.data();
        if (reservation.status === 'reserved') {
            await db.runTransaction(async (tx) => {
                // Release reserved quantities for each item
                for (const item of (reservation.items || [])) {
                    const invRef = db.collection(utils_1.C.INVENTORY).doc(item.inventoryId);
                    const invSnap = await tx.get(invRef);
                    if (invSnap.exists) {
                        const inv = invSnap.data();
                        const newReserved = Math.max(0, (inv.reservedQuantity || 0) - item.quantity);
                        const newAvailable = (inv.quantity || 0) - newReserved - (inv.damagedQuantity || 0);
                        tx.update(invRef, {
                            reservedQuantity: newReserved,
                            availableQuantity: Math.max(0, newAvailable),
                            updatedAt: now,
                        });
                    }
                }
                // Mark reservation as released
                tx.update(db.collection(utils_1.C.STOCK_RESERVATIONS).doc(orderId), {
                    status: 'released',
                    releasedAt: now,
                });
            });
        }
    }
    // ── CREATE REFUND RECORD (if online payment was completed) ──────
    let refundId = null;
    if (order.paymentStatus === 'completed' && order.paymentMethod !== 'cod') {
        refundId = (0, utils_1.newId)('ref');
        await db.collection(utils_1.C.REFUNDS).doc(refundId).set({
            refundId,
            orderId,
            paymentId: order.paymentId || '',
            customerId: order.customerId,
            amount: order.total,
            reason: reason || 'Customer requested cancellation',
            status: 'REQUESTED',
            createdAt: now,
        });
    }
    // ── UPDATE ORDER STATUS ────────────────────────────────────────
    await orderRef.update({
        orderStatus: 'CANCELLED',
        cancelledAt: now,
        cancelledBy: uid,
        cancellationReason: reason || 'No reason provided',
        ...(refundId && { refundId }),
        statusHistory: admin.firestore.FieldValue.arrayUnion({
            status: 'CANCELLED',
            timestamp: now,
            actorId: uid,
            note: reason || 'Cancelled by customer',
        }),
    });
    // ── CANCEL PICKING TASK (if exists) ───────────────────────────
    if (order.pickingTaskId) {
        await db.collection(utils_1.C.PICKING_TASKS).doc(order.pickingTaskId).update({
            status: 'cancelled',
            cancelledAt: now,
        });
    }
    // ── NOTIFICATIONS ─────────────────────────────────────────────
    const refundMsg = refundId
        ? `A refund of ₹${order.total} will be processed within 3-5 business days.`
        : '';
    await Promise.allSettled([
        (0, utils_1.createNotificationRecord)({
            recipientId: order.customerId,
            recipientType: 'customer',
            type: 'ORDER_CANCELLED',
            title: '❌ Order Cancelled',
            message: `Order #${order.orderNumber} has been cancelled. ${refundMsg}`,
            orderId,
        }),
        (0, utils_1.sendFcmToUser)(order.customerId, {
            title: '❌ Order Cancelled',
            body: `Order #${order.orderNumber} cancelled. ${refundMsg}`,
        }, { orderId }),
        (0, utils_1.createNotificationRecord)({
            recipientId: 'admin',
            recipientType: 'admin',
            type: 'ADMIN_ORDER_CANCELLED',
            title: `🚫 Order Cancelled: #${order.orderNumber}`,
            message: `Cancelled by ${role === 'admin' ? 'Admin' : 'Customer'}. Reason: ${reason || 'No reason'}`,
            orderId,
        }),
        (0, utils_1.sendFcmToRole)('admin', order.storeId || utils_1.STORE_ID, {
            title: `🚫 Order Cancelled: #${order.orderNumber}`,
            body: `Reason: ${reason || 'No reason provided'}`,
        }, { orderId }),
    ]);
    // ── AUDIT LOG ─────────────────────────────────────────────────
    await (0, utils_1.writeAuditLog)({
        actorId: uid,
        actorName: order.customerName || uid,
        actorRole: role,
        action: 'ORDER_CANCELLED',
        targetCollection: utils_1.C.ORDERS,
        targetId: orderId,
        description: `Order #${order.orderNumber} cancelled. Reason: ${reason || 'No reason'}${refundId ? ` | Refund ${refundId} created` : ''}`,
        orderId,
        storeId: order.storeId,
        oldValue: { orderStatus: currentStatus },
        newValue: { orderStatus: 'CANCELLED' },
    });
    return {
        success: true,
        message: `Order #${order.orderNumber} has been cancelled.${refundId ? ' Refund has been initiated.' : ''}`,
        refundId,
    };
});
//# sourceMappingURL=cancelOrder.js.map