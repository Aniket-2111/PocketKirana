"use strict";
/**
 * Cloud Function: verifyStorePickup
 *
 * Called by delivery partner at the store to confirm order pickup.
 * Validates the pickup OTP, commits the stock reservation to actual
 * PICK inventory movements, and transitions order to PICKED_UP.
 *
 * Input:  { assignmentId, pickupOtp }
 * Output: { success, deliveryAddress, customerName, customerOtpHint }
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
exports.updateDeliveryStage = exports.verifyStorePickup = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const utils_1 = require("../utils");
exports.verifyStorePickup = (0, https_1.onCall)({ region: 'asia-south1', cors: true }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required.');
    }
    const uid = request.auth.uid;
    if (request.auth.token.role !== 'delivery_partner') {
        throw new https_1.HttpsError('permission-denied', 'Only delivery partners can verify pickup.');
    }
    const { assignmentId, pickupOtp } = request.data;
    if (!assignmentId || !pickupOtp) {
        throw new https_1.HttpsError('invalid-argument', 'assignmentId and pickupOtp are required.');
    }
    const db = admin.firestore();
    const assignmentRef = db.collection(utils_1.C.DELIVERY_ASSIGNMENTS).doc(assignmentId);
    const snap = await assignmentRef.get();
    if (!snap.exists) {
        throw new https_1.HttpsError('not-found', 'Assignment not found.');
    }
    const assignment = snap.data();
    if (assignment.partnerId !== uid) {
        throw new https_1.HttpsError('permission-denied', 'This assignment does not belong to you.');
    }
    if (assignment.status !== 'accepted' && assignment.status !== 'arrived_store') {
        throw new https_1.HttpsError('failed-precondition', `Cannot verify pickup at current status: ${assignment.status}`);
    }
    // Validate pickup OTP
    if (assignment.pickupOtp !== pickupOtp.trim()) {
        throw new https_1.HttpsError('invalid-argument', 'Incorrect pickup OTP. Please check with the store staff.');
    }
    const now = new Date().toISOString();
    const storeId = assignment.storeId || utils_1.STORE_ID;
    // Commit stock reservation → actual PICK movements
    const reservationSnap = await db
        .collection(utils_1.C.STOCK_RESERVATIONS)
        .doc(assignment.orderId)
        .get();
    if (reservationSnap.exists) {
        const reservation = reservationSnap.data();
        if (reservation.status === 'reserved') {
            const batch = db.batch();
            // Create PICK inventory movements for each item
            for (const item of (reservation.items || [])) {
                const movementId = (0, utils_1.newId)('mv');
                batch.set(db.collection(utils_1.C.INVENTORY_MOVEMENTS).doc(movementId), {
                    id: movementId,
                    productId: item.productId,
                    type: 'PICK',
                    quantity: -item.quantity, // negative = stock out
                    orderId: assignment.orderId,
                    orderNumber: assignment.orderNumber,
                    pickerId: uid,
                    pickerName: assignment.partnerName,
                    storeId,
                    reason: `Picked up for delivery - Order #${assignment.orderNumber}`,
                    timestamp: now,
                });
                // Reduce actual quantity in inventory
                const invRef = db.collection(utils_1.C.INVENTORY).doc(item.inventoryId);
                batch.update(invRef, {
                    quantity: admin.firestore.FieldValue.increment(-item.quantity),
                    reservedQuantity: admin.firestore.FieldValue.increment(-item.quantity),
                    updatedAt: now,
                });
            }
            // Mark reservation as committed
            batch.update(db.collection(utils_1.C.STOCK_RESERVATIONS).doc(assignment.orderId), { status: 'committed', committedAt: now });
            await batch.commit();
        }
    }
    // Update assignment status
    await assignmentRef.update({
        status: 'picked_up',
        pickedUpAt: now,
    });
    // Update partner stage
    await db.collection(utils_1.C.DELIVERY_PARTNERS).doc(uid).update({
        activeDeliveryStage: 'PICKED_UP',
    });
    // Update order
    await db.collection(utils_1.C.ORDERS).doc(assignment.orderId).update({
        orderStatus: 'OUT_FOR_DELIVERY',
        pickedUpAt: now,
        statusHistory: admin.firestore.FieldValue.arrayUnion({
            status: 'OUT_FOR_DELIVERY',
            timestamp: now,
            actorId: uid,
            note: 'Order picked up from store, out for delivery',
        }),
    });
    // Notify customer
    const customerId = assignment.customerId || '';
    await Promise.allSettled([
        (0, utils_1.createNotificationRecord)({
            recipientId: customerId,
            recipientType: 'customer',
            type: 'OUT_FOR_DELIVERY',
            title: '🚴 Order Is On Its Way!',
            message: `${assignment.partnerName} has picked up your order and is heading to you. Delivery OTP: ${assignment.customerOtp}`,
            orderId: assignment.orderId,
            deepLink: `/orders/${assignment.orderId}`,
        }),
        (0, utils_1.sendFcmToUser)(customerId, {
            title: '🚴 Order Is On Its Way!',
            body: `${assignment.partnerName} is coming to you. Keep your OTP ready!`,
        }, { orderId: assignment.orderId }),
    ]);
    await (0, utils_1.writeAuditLog)({
        actorId: uid,
        actorName: assignment.partnerName,
        actorRole: 'delivery_partner',
        action: 'STOCK_COMMITTED',
        targetCollection: utils_1.C.ORDERS,
        targetId: assignment.orderId,
        description: `Order #${assignment.orderNumber} picked up from store by ${assignment.partnerName}`,
        orderId: assignment.orderId,
        storeId,
    });
    return {
        success: true,
        deliveryAddress: assignment.deliveryAddress,
        deliveryLatitude: assignment.deliveryLatitude,
        deliveryLongitude: assignment.deliveryLongitude,
        customerName: assignment.customerName,
        message: 'Pickup verified! Head to the customer location.',
    };
});
/**
 * Cloud Function: updateDeliveryStage
 * Updates delivery partner GPS + stage for intermediate transitions
 * (ARRIVED_AT_STORE, ARRIVED_AT_CUSTOMER, etc.)
 */
exports.updateDeliveryStage = (0, https_1.onCall)({ region: 'asia-south1', cors: true }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required.');
    }
    if (request.auth.token.role !== 'delivery_partner') {
        throw new https_1.HttpsError('permission-denied', 'Delivery partners only.');
    }
    const { assignmentId, stage, latitude, longitude } = request.data;
    const db = admin.firestore();
    const now = new Date().toISOString();
    const uid = request.auth.uid;
    const snap = await db.collection(utils_1.C.DELIVERY_ASSIGNMENTS).doc(assignmentId).get();
    if (!snap.exists || snap.data()?.partnerId !== uid) {
        throw new https_1.HttpsError('not-found', 'Assignment not found.');
    }
    const assignment = snap.data();
    // Update tracking if coordinates provided
    if (latitude && longitude) {
        await db.collection(utils_1.C.DELIVERY_TRACKING).doc(assignmentId).set({
            assignmentId,
            partnerId: uid,
            orderId: assignment.orderId,
            currentLat: latitude,
            currentLng: longitude,
            updatedAt: now,
            isActive: true,
        }, { merge: true });
    }
    // Update assignment status
    const statusMap = {
        ARRIVED_AT_STORE: 'arrived_store',
        ARRIVED_AT_CUSTOMER: 'arrived_customer',
    };
    if (statusMap[stage]) {
        await db.collection(utils_1.C.DELIVERY_ASSIGNMENTS).doc(assignmentId).update({
            status: statusMap[stage],
            [`${stage.toLowerCase()}At`]: now,
        });
    }
    // Update partner GPS
    await db.collection(utils_1.C.DELIVERY_PARTNERS).doc(uid).update({
        activeDeliveryStage: stage,
        ...(latitude && longitude && {
            currentLocation: { latitude, longitude, lastUpdated: now },
        }),
    });
    // Update order status
    const orderStatusMap = {
        ARRIVED_AT_STORE: 'ARRIVED_AT_STORE',
        ARRIVED_AT_CUSTOMER: 'ARRIVED_AT_CUSTOMER',
    };
    if (orderStatusMap[stage]) {
        await db.collection(utils_1.C.ORDERS).doc(assignment.orderId).update({
            orderStatus: orderStatusMap[stage],
            statusHistory: admin.firestore.FieldValue.arrayUnion({
                status: orderStatusMap[stage],
                timestamp: now,
                actorId: uid,
                note: `Delivery partner ${stage.toLowerCase().replace('_', ' ')}`,
            }),
        });
    }
    return { success: true };
});
//# sourceMappingURL=verifyPickup.js.map