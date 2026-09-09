"use strict";
/**
 * Cloud Function: assignDeliveryPartner
 *
 * Triggered by Firestore when an order transitions to READY_FOR_PICKUP status.
 * Finds the nearest available delivery partner, creates a delivery assignment,
 * and sends FCM to the partner with a 25-second acceptance window.
 *
 * Trigger: onDocumentUpdated orders/{orderId}
 * - Fires when orderStatus changes to 'READY_FOR_PICKUP'
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
exports.assignDeliveryPartner = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
const utils_1 = require("../utils");
exports.assignDeliveryPartner = (0, firestore_1.onDocumentUpdated)({ document: 'orders/{orderId}', region: 'asia-south1' }, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    // Only trigger when status transitions to READY_FOR_PICKUP
    if (!before || !after)
        return;
    if (before.orderStatus === after.orderStatus ||
        after.orderStatus !== 'READY_FOR_PICKUP') {
        return;
    }
    const orderId = event.params.orderId;
    const db = admin.firestore();
    const config = await (0, utils_1.getStoreConfig)();
    console.log(`[AssignPartner] Order ${orderId} ready for pickup. Finding partner...`);
    // Fetch all online delivery partners
    const partnersSnap = await db
        .collection(utils_1.C.DELIVERY_PARTNERS)
        .where('currentStatus', '==', 'online')
        .where('verificationStatus', '==', 'verified')
        .get();
    if (partnersSnap.empty) {
        console.warn(`[AssignPartner] No online partners available for order ${orderId}`);
        await notifyAdminNoPartner(db, orderId, after.orderNumber, after.storeId || utils_1.STORE_ID);
        return;
    }
    // Sort partners by distance to store
    const partners = partnersSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((p) => !p.activeOrderId) // Skip partners already on a delivery
        .sort((a, b) => {
        const distA = (0, utils_1.haversineKm)(config.latitude, config.longitude, a.currentLocation?.latitude || config.latitude, a.currentLocation?.longitude || config.longitude);
        const distB = (0, utils_1.haversineKm)(config.latitude, config.longitude, b.currentLocation?.latitude || config.latitude, b.currentLocation?.longitude || config.longitude);
        return distA - distB;
    });
    if (partners.length === 0) {
        console.warn(`[AssignPartner] All online partners are busy for order ${orderId}`);
        await notifyAdminNoPartner(db, orderId, after.orderNumber, after.storeId || utils_1.STORE_ID);
        return;
    }
    // Try to assign to the closest available partner
    const selectedPartner = partners[0];
    // Calculate estimated earnings
    const deliveryLat = after.address?.latitude || after.deliveryAddress?.latitude;
    const deliveryLng = after.address?.longitude || after.deliveryAddress?.longitude;
    const distanceKm = deliveryLat && deliveryLng
        ? (0, utils_1.haversineKm)(config.latitude, config.longitude, deliveryLat, deliveryLng)
        : 2;
    const estimatedEarnings = 30 + Math.round(distanceKm * 5); // ₹30 base + ₹5/km
    // Generate OTPs
    const pickupOtp = String(1000 + Math.floor(Math.random() * 9000));
    const assignmentId = (0, utils_1.newId)('da');
    const deliveryAddress = after.address || after.deliveryAddress || {};
    const now = new Date().toISOString();
    // Create delivery assignment
    await db.collection(utils_1.C.DELIVERY_ASSIGNMENTS).doc(assignmentId).set({
        assignmentId,
        orderId,
        orderNumber: after.orderNumber,
        storeId: after.storeId || utils_1.STORE_ID,
        storeName: after.storeName || 'PocketKirana',
        storeAddress: 'PocketKirana Store, Neral, Maharashtra',
        storeLatitude: config.latitude,
        storeLongitude: config.longitude,
        partnerId: selectedPartner.id,
        partnerName: selectedPartner.name,
        partnerPhone: selectedPartner.phone,
        customerId: after.customerId,
        customerName: after.customerName,
        customerPhone: after.customerPhone,
        deliveryAddress: deliveryAddress.addressLine1 || '',
        deliveryLatitude: deliveryLat || 0,
        deliveryLongitude: deliveryLng || 0,
        status: 'pending',
        pickupOtp,
        customerOtp: after.deliveryOtp,
        estimatedDistanceKm: distanceKm,
        estimatedEarnings,
        dispatchedAt: now,
        paymentMethod: after.paymentMethod,
        total: after.total,
        itemCount: (after.items || []).length,
        earnings: {
            baseFee: 30,
            distanceFee: Math.round(distanceKm * 5),
            peakBonus: 0,
            total: estimatedEarnings,
        },
    });
    // Update order with assignment info
    await db.collection(utils_1.C.ORDERS).doc(orderId).update({
        orderStatus: 'ASSIGNED',
        partnerId: selectedPartner.id,
        partnerName: selectedPartner.name,
        partnerPhone: selectedPartner.phone,
        deliveryAssignmentId: assignmentId,
        assignedAt: now,
        statusHistory: admin.firestore.FieldValue.arrayUnion({
            status: 'ASSIGNED',
            timestamp: now,
            actorId: 'system',
            note: `Assigned to ${selectedPartner.name}`,
        }),
    });
    // Notify delivery partner with pickup OTP
    await Promise.allSettled([
        (0, utils_1.createNotificationRecord)({
            recipientId: selectedPartner.id,
            recipientType: 'delivery_partner',
            type: 'PARTNER_NEW_DELIVERY',
            title: '🛵 New Delivery Request!',
            message: `Order #${after.orderNumber} • ${(after.items || []).length} items • ₹${estimatedEarnings} • ${distanceKm.toFixed(1)} km`,
            orderId,
            meta: { assignmentId, pickupOtp, estimatedEarnings },
        }),
        (0, utils_1.sendFcmToUser)(selectedPartner.id, {
            title: '🛵 New Delivery Request!',
            body: `Order #${after.orderNumber} • ₹${estimatedEarnings} earnings • Accept within 25 seconds!`,
        }, {
            assignmentId,
            orderId,
            orderNumber: after.orderNumber,
            estimatedEarnings: String(estimatedEarnings),
        }),
    ]);
    console.log(`[AssignPartner] Assigned order ${orderId} to partner ${selectedPartner.name} (${selectedPartner.id})`);
});
async function notifyAdminNoPartner(db, orderId, orderNumber, storeId) {
    await (0, utils_1.createNotificationRecord)({
        recipientId: 'admin',
        recipientType: 'admin',
        type: 'ADMIN_PARTNER_OFFLINE',
        title: '⚠️ No Delivery Partner Available',
        message: `Order #${orderNumber} is ready but no delivery partner is available. Manual assignment needed.`,
        orderId,
    });
    await (0, utils_1.sendFcmToRole)('admin', storeId, {
        title: '⚠️ No Partner Available',
        body: `Order #${orderNumber} needs manual partner assignment.`,
    }, { orderId, orderNumber });
}
//# sourceMappingURL=assignPartner.js.map