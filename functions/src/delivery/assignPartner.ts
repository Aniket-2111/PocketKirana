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

import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import {
  C,
  haversineKm,
  getStoreConfig,
  createNotificationRecord,
  sendFcmToUser,
  sendFcmToRole,
  newId,
  STORE_ID,
} from '../utils';

export const assignDeliveryPartner = onDocumentUpdated(
  { document: 'orders/{orderId}', region: 'asia-south1' },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    // Only trigger when status transitions to READY_FOR_PICKUP
    if (!before || !after) return;
    if (
      before.orderStatus === after.orderStatus ||
      after.orderStatus !== 'READY_FOR_PICKUP'
    ) {
      return;
    }

    const orderId = event.params.orderId;
    const db = admin.firestore();
    const config = await getStoreConfig();

    console.log(`[AssignPartner] Order ${orderId} ready for pickup. Finding partner...`);

    // Fetch all online delivery partners
    const partnersSnap = await db
      .collection(C.DELIVERY_PARTNERS)
      .where('currentStatus', '==', 'online')
      .where('verificationStatus', '==', 'verified')
      .get();

    if (partnersSnap.empty) {
      console.warn(`[AssignPartner] No online partners available for order ${orderId}`);
      await notifyAdminNoPartner(db, orderId, after.orderNumber, after.storeId || STORE_ID);
      return;
    }

    // Sort partners by distance to store
    const partners = partnersSnap.docs
      .map((d) => ({ id: d.id, ...d.data() } as any))
      .filter((p) => !p.activeOrderId) // Skip partners already on a delivery
      .sort((a, b) => {
        const distA = haversineKm(
          config.latitude, config.longitude,
          a.currentLocation?.latitude || config.latitude,
          a.currentLocation?.longitude || config.longitude
        );
        const distB = haversineKm(
          config.latitude, config.longitude,
          b.currentLocation?.latitude || config.latitude,
          b.currentLocation?.longitude || config.longitude
        );
        return distA - distB;
      });

    if (partners.length === 0) {
      console.warn(`[AssignPartner] All online partners are busy for order ${orderId}`);
      await notifyAdminNoPartner(db, orderId, after.orderNumber, after.storeId || STORE_ID);
      return;
    }

    // Try to assign to the closest available partner
    const selectedPartner = partners[0];

    // Calculate estimated earnings
    const deliveryLat = after.address?.latitude || after.deliveryAddress?.latitude;
    const deliveryLng = after.address?.longitude || after.deliveryAddress?.longitude;
    const distanceKm = deliveryLat && deliveryLng
      ? haversineKm(config.latitude, config.longitude, deliveryLat, deliveryLng)
      : 2;
    const estimatedEarnings = 30 + Math.round(distanceKm * 5); // ₹30 base + ₹5/km

    // Generate OTPs
    const pickupOtp = String(1000 + Math.floor(Math.random() * 9000));
    const assignmentId = newId('da');

    const deliveryAddress = after.address || after.deliveryAddress || {};
    const now = new Date().toISOString();

    // Create delivery assignment
    await db.collection(C.DELIVERY_ASSIGNMENTS).doc(assignmentId).set({
      assignmentId,
      orderId,
      orderNumber: after.orderNumber,
      storeId: after.storeId || STORE_ID,
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
    await db.collection(C.ORDERS).doc(orderId).update({
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
      createNotificationRecord({
        recipientId: selectedPartner.id,
        recipientType: 'delivery_partner',
        type: 'PARTNER_NEW_DELIVERY',
        title: '🛵 New Delivery Request!',
        message: `Order #${after.orderNumber} • ${(after.items || []).length} items • ₹${estimatedEarnings} • ${distanceKm.toFixed(1)} km`,
        orderId,
        meta: { assignmentId, pickupOtp, estimatedEarnings },
      }),
      sendFcmToUser(selectedPartner.id, {
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
  }
);

async function notifyAdminNoPartner(
  db: FirebaseFirestore.Firestore,
  orderId: string,
  orderNumber: string,
  storeId: string
): Promise<void> {
  await createNotificationRecord({
    recipientId: 'admin',
    recipientType: 'admin',
    type: 'ADMIN_PARTNER_OFFLINE',
    title: '⚠️ No Delivery Partner Available',
    message: `Order #${orderNumber} is ready but no delivery partner is available. Manual assignment needed.`,
    orderId,
  });
  await sendFcmToRole('admin', storeId, {
    title: '⚠️ No Partner Available',
    body: `Order #${orderNumber} needs manual partner assignment.`,
  }, { orderId, orderNumber });
}
