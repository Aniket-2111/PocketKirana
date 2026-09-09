"use strict";
/**
 * Cloud Function: acceptDeliveryAssignment
 *
 * Called by a delivery partner to accept an incoming delivery request.
 * Validates the assignment is still in 'pending' state (not expired/taken).
 * Transitions the order through the ACCEPTED state and notifies the customer.
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
exports.rejectDeliveryAssignment = exports.acceptDeliveryAssignment = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const utils_1 = require("../utils");
exports.acceptDeliveryAssignment = (0, https_1.onCall)({ region: 'asia-south1', cors: true }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required.');
    }
    const uid = request.auth.uid;
    const role = request.auth.token.role;
    if (role !== 'delivery_partner') {
        throw new https_1.HttpsError('permission-denied', 'Only delivery partners can accept assignments.');
    }
    const { assignmentId } = request.data;
    if (!assignmentId) {
        throw new https_1.HttpsError('invalid-argument', 'assignmentId is required.');
    }
    const db = admin.firestore();
    const assignmentRef = db.collection(utils_1.C.DELIVERY_ASSIGNMENTS).doc(assignmentId);
    const assignmentSnap = await assignmentRef.get();
    if (!assignmentSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Assignment not found.');
    }
    const assignment = assignmentSnap.data();
    // Verify this assignment belongs to this partner
    if (assignment.partnerId !== uid) {
        throw new https_1.HttpsError('permission-denied', 'This assignment was not sent to you.');
    }
    // Verify assignment is still pending
    if (assignment.status !== 'pending') {
        throw new https_1.HttpsError('failed-precondition', `Assignment is already ${assignment.status}. It may have been cancelled or another partner was assigned.`);
    }
    const now = new Date().toISOString();
    // Accept the assignment
    await assignmentRef.update({
        status: 'accepted',
        acceptedAt: now,
    });
    // Update partner status to busy
    await db.collection(utils_1.C.DELIVERY_PARTNERS).doc(uid).update({
        currentStatus: 'busy',
        activeOrderId: assignment.orderId,
        activeDeliveryStage: 'ACCEPTED',
    });
    // Update order status
    await db.collection(utils_1.C.ORDERS).doc(assignment.orderId).update({
        orderStatus: 'ACCEPTED',
        statusHistory: admin.firestore.FieldValue.arrayUnion({
            status: 'ACCEPTED',
            timestamp: now,
            actorId: uid,
            note: `Delivery partner ${assignment.partnerName} accepted the order`,
        }),
    });
    // Initialize delivery tracking document
    await db.collection(utils_1.C.DELIVERY_TRACKING).doc(assignmentId).set({
        assignmentId,
        partnerId: uid,
        orderId: assignment.orderId,
        currentLat: 0,
        currentLng: 0,
        updatedAt: now,
        isActive: true,
    });
    // Notify customer
    await Promise.allSettled([
        (0, utils_1.createNotificationRecord)({
            recipientId: assignment.customerId || '',
            recipientType: 'customer',
            type: 'DELIVERY_ASSIGNED',
            title: '🚀 Delivery Partner Assigned!',
            message: `${assignment.partnerName} is heading to pick up your order and will deliver it shortly.`,
            orderId: assignment.orderId,
            deepLink: `/orders/${assignment.orderId}`,
        }),
        (0, utils_1.sendFcmToUser)(assignment.customerId || '', {
            title: '🚀 Delivery Partner Assigned!',
            body: `${assignment.partnerName} will deliver your order.`,
        }, { orderId: assignment.orderId }),
    ]);
    await (0, utils_1.writeAuditLog)({
        actorId: uid,
        actorName: assignment.partnerName,
        actorRole: 'delivery_partner',
        action: 'DELIVERY_COMPLETED',
        targetCollection: utils_1.C.DELIVERY_ASSIGNMENTS,
        targetId: assignmentId,
        description: `Partner ${assignment.partnerName} accepted delivery for order #${assignment.orderNumber}`,
        orderId: assignment.orderId,
    });
    return {
        success: true,
        storeAddress: assignment.storeAddress,
        storeLatitude: assignment.storeLatitude,
        storeLongitude: assignment.storeLongitude,
        orderNumber: assignment.orderNumber,
        itemCount: assignment.itemCount || 0,
        estimatedEarnings: assignment.estimatedEarnings,
        message: 'Assignment accepted! Head to the store to pick up the order.',
    };
});
/**
 * Cloud Function: rejectDeliveryAssignment
 * Partner rejects the delivery — system will try the next available partner.
 */
exports.rejectDeliveryAssignment = (0, https_1.onCall)({ region: 'asia-south1', cors: true }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required.');
    }
    const uid = request.auth.uid;
    if (request.auth.token.role !== 'delivery_partner') {
        throw new https_1.HttpsError('permission-denied', 'Only delivery partners can reject assignments.');
    }
    const { assignmentId, reason } = request.data;
    const db = admin.firestore();
    const assignmentRef = db.collection(utils_1.C.DELIVERY_ASSIGNMENTS).doc(assignmentId);
    const snap = await assignmentRef.get();
    if (!snap.exists || snap.data()?.partnerId !== uid) {
        throw new https_1.HttpsError('not-found', 'Assignment not found or not yours.');
    }
    if (snap.data()?.status !== 'pending') {
        throw new https_1.HttpsError('failed-precondition', 'Assignment is no longer pending.');
    }
    await assignmentRef.update({
        status: 'rejected',
        rejectedAt: new Date().toISOString(),
        rejectionReason: reason || 'Partner rejected',
    });
    // Note: The Firestore trigger `onOrderReadyForPickup` will detect this
    // rejection and try to assign the next available partner.
    return { success: true };
});
//# sourceMappingURL=acceptAssignment.js.map