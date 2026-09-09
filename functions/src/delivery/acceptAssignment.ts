/**
 * Cloud Function: acceptDeliveryAssignment
 *
 * Called by a delivery partner to accept an incoming delivery request.
 * Validates the assignment is still in 'pending' state (not expired/taken).
 * Transitions the order through the ACCEPTED state and notifies the customer.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import {
  C,
  writeAuditLog,
  createNotificationRecord,
  sendFcmToUser,
  newId,
} from '../utils';

export const acceptDeliveryAssignment = onCall(
  { region: 'asia-south1', cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required.');
    }

    const uid = request.auth.uid;
    const role = request.auth.token.role;

    if (role !== 'delivery_partner') {
      throw new HttpsError('permission-denied', 'Only delivery partners can accept assignments.');
    }

    const { assignmentId } = request.data as { assignmentId: string };

    if (!assignmentId) {
      throw new HttpsError('invalid-argument', 'assignmentId is required.');
    }

    const db = admin.firestore();
    const assignmentRef = db.collection(C.DELIVERY_ASSIGNMENTS).doc(assignmentId);
    const assignmentSnap = await assignmentRef.get();

    if (!assignmentSnap.exists) {
      throw new HttpsError('not-found', 'Assignment not found.');
    }

    const assignment = assignmentSnap.data()!;

    // Verify this assignment belongs to this partner
    if (assignment.partnerId !== uid) {
      throw new HttpsError('permission-denied', 'This assignment was not sent to you.');
    }

    // Verify assignment is still pending
    if (assignment.status !== 'pending') {
      throw new HttpsError(
        'failed-precondition',
        `Assignment is already ${assignment.status}. It may have been cancelled or another partner was assigned.`
      );
    }

    const now = new Date().toISOString();

    // Accept the assignment
    await assignmentRef.update({
      status: 'accepted',
      acceptedAt: now,
    });

    // Update partner status to busy
    await db.collection(C.DELIVERY_PARTNERS).doc(uid).update({
      currentStatus: 'busy',
      activeOrderId: assignment.orderId,
      activeDeliveryStage: 'ACCEPTED',
    });

    // Update order status
    await db.collection(C.ORDERS).doc(assignment.orderId).update({
      orderStatus: 'ACCEPTED',
      statusHistory: admin.firestore.FieldValue.arrayUnion({
        status: 'ACCEPTED',
        timestamp: now,
        actorId: uid,
        note: `Delivery partner ${assignment.partnerName} accepted the order`,
      }),
    });

    // Initialize delivery tracking document
    await db.collection(C.DELIVERY_TRACKING).doc(assignmentId).set({
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
      createNotificationRecord({
        recipientId: assignment.customerId || '',
        recipientType: 'customer',
        type: 'DELIVERY_ASSIGNED',
        title: '🚀 Delivery Partner Assigned!',
        message: `${assignment.partnerName} is heading to pick up your order and will deliver it shortly.`,
        orderId: assignment.orderId,
        deepLink: `/orders/${assignment.orderId}`,
      }),
      sendFcmToUser(assignment.customerId || '', {
        title: '🚀 Delivery Partner Assigned!',
        body: `${assignment.partnerName} will deliver your order.`,
      }, { orderId: assignment.orderId }),
    ]);

    await writeAuditLog({
      actorId: uid,
      actorName: assignment.partnerName,
      actorRole: 'delivery_partner',
      action: 'DELIVERY_COMPLETED',
      targetCollection: C.DELIVERY_ASSIGNMENTS,
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
  }
);

/**
 * Cloud Function: rejectDeliveryAssignment
 * Partner rejects the delivery — system will try the next available partner.
 */
export const rejectDeliveryAssignment = onCall(
  { region: 'asia-south1', cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required.');
    }

    const uid = request.auth.uid;
    if (request.auth.token.role !== 'delivery_partner') {
      throw new HttpsError('permission-denied', 'Only delivery partners can reject assignments.');
    }

    const { assignmentId, reason } = request.data as {
      assignmentId: string;
      reason?: string;
    };

    const db = admin.firestore();
    const assignmentRef = db.collection(C.DELIVERY_ASSIGNMENTS).doc(assignmentId);
    const snap = await assignmentRef.get();

    if (!snap.exists || snap.data()?.partnerId !== uid) {
      throw new HttpsError('not-found', 'Assignment not found or not yours.');
    }

    if (snap.data()?.status !== 'pending') {
      throw new HttpsError('failed-precondition', 'Assignment is no longer pending.');
    }

    await assignmentRef.update({
      status: 'rejected',
      rejectedAt: new Date().toISOString(),
      rejectionReason: reason || 'Partner rejected',
    });

    // Note: The Firestore trigger `onOrderReadyForPickup` will detect this
    // rejection and try to assign the next available partner.
    return { success: true };
  }
);
