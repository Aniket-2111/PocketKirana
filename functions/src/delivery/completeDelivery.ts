/**
 * Cloud Function: completeDelivery
 *
 * Called by delivery partner when they hand over the order to the customer.
 * Validates customer OTP (or records failed delivery if OTP rejected).
 *
 * On success:
 * 1. Validates customer OTP
 * 2. Records COD collection if applicable
 * 3. Transitions order to DELIVERED → schedules auto-complete in 24h
 * 4. Updates partner: status=online, increments completedDeliveries, credits earnings
 * 5. Stores proof of delivery
 * 6. Sends notifications to customer and admin
 * 7. Writes audit log
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import {
  C,
  writeAuditLog,
  createNotificationRecord,
  sendFcmToUser,
  sendFcmToRole,
  STORE_ID,
} from '../utils';

export const completeDelivery = onCall(
  { region: 'asia-south1', cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required.');
    }

    const uid = request.auth.uid;
    if (request.auth.token.role !== 'delivery_partner') {
      throw new HttpsError('permission-denied', 'Only delivery partners can complete deliveries.');
    }

    const {
      assignmentId,
      customerOtp,
      codAmountCollected,
      proofPhotoUrl,
      latitude,
      longitude,
    } = request.data as {
      assignmentId: string;
      customerOtp: string;
      codAmountCollected?: number;
      proofPhotoUrl?: string;
      latitude?: number;
      longitude?: number;
    };

    if (!assignmentId || !customerOtp) {
      throw new HttpsError('invalid-argument', 'assignmentId and customerOtp are required.');
    }

    const db = admin.firestore();
    const assignmentRef = db.collection(C.DELIVERY_ASSIGNMENTS).doc(assignmentId);
    const snap = await assignmentRef.get();

    if (!snap.exists) {
      throw new HttpsError('not-found', 'Assignment not found.');
    }

    const assignment = snap.data()!;

    if (assignment.partnerId !== uid) {
      throw new HttpsError('permission-denied', 'This assignment does not belong to you.');
    }

    if (!['picked_up', 'out_for_delivery', 'arrived_customer'].includes(assignment.status)) {
      throw new HttpsError(
        'failed-precondition',
        `Cannot complete delivery at status: ${assignment.status}`
      );
    }

    // ── VALIDATE CUSTOMER OTP ──────────────────────────────────────
    if (assignment.customerOtp !== customerOtp.trim()) {
      throw new HttpsError(
        'invalid-argument',
        'Incorrect customer OTP. Please ask the customer to check their order details.'
      );
    }

    const now = new Date().toISOString();
    const storeId = assignment.storeId || STORE_ID;

    // ── CALCULATE EARNINGS ────────────────────────────────────────
    const earnings = assignment.earnings || {
      baseFee: 30,
      distanceFee: 0,
      peakBonus: 0,
      total: 30,
    };

    // ── UPDATE ASSIGNMENT ─────────────────────────────────────────
    await assignmentRef.update({
      status: 'delivered',
      deliveredAt: now,
      codCollected: !!codAmountCollected,
      codAmount: codAmountCollected || 0,
      proofOfDeliveryUrl: proofPhotoUrl || null,
      proofOfDelivery: {
        type: 'otp',
        otpEntered: customerOtp,
        timestamp: now,
        ...(proofPhotoUrl && { photoUrl: proofPhotoUrl }),
      },
    });

    // ── UPDATE ORDER STATUS ───────────────────────────────────────
    await db.collection(C.ORDERS).doc(assignment.orderId).update({
      orderStatus: 'DELIVERED',
      deliveredAt: now,
      ...(codAmountCollected && { codAmountCollected }),
      ...(assignment.paymentMethod === 'cod' && { paymentStatus: 'paid' }),
      statusHistory: admin.firestore.FieldValue.arrayUnion({
        status: 'DELIVERED',
        timestamp: now,
        actorId: uid,
        note: `Delivered by ${assignment.partnerName}. OTP verified.`,
      }),
    });

    // ── UPDATE PARTNER: online + earnings ─────────────────────────
    await db.collection(C.DELIVERY_PARTNERS).doc(uid).update({
      currentStatus: 'online',
      activeOrderId: null,
      activeDeliveryStage: null,
      completedDeliveries: admin.firestore.FieldValue.increment(1),
      todayEarnings: admin.firestore.FieldValue.increment(earnings.total),
      walletBalance: admin.firestore.FieldValue.increment(earnings.total),
      weekEarnings: admin.firestore.FieldValue.increment(earnings.total),
      monthEarnings: admin.firestore.FieldValue.increment(earnings.total),
      ...(latitude && longitude && {
        currentLocation: { latitude, longitude, lastUpdated: now },
      }),
    });

    // Deactivate tracking
    await db.collection(C.DELIVERY_TRACKING).doc(assignmentId).update({
      isActive: false,
      updatedAt: now,
    });

    // ── FOR COD: RECORD PAYMENT ───────────────────────────────────
    if (assignment.paymentMethod === 'cod' && codAmountCollected) {
      const paymentId = `pay-cod-${assignment.orderId}`;
      await db.collection(C.PAYMENTS).doc(paymentId).set({
        paymentId,
        orderId: assignment.orderId,
        customerId: assignment.customerId || '',
        amount: codAmountCollected,
        currency: 'INR',
        method: 'cod',
        status: 'completed',
        gateway: 'cod',
        paidAt: now,
        createdAt: now,
        collectedBy: uid,
        collectedByName: assignment.partnerName,
      });
    }

    // ── NOTIFICATIONS ─────────────────────────────────────────────
    const customerId = assignment.customerId || '';
    await Promise.allSettled([
      createNotificationRecord({
        recipientId: customerId,
        recipientType: 'customer',
        type: 'ORDER_DELIVERED',
        title: '✅ Order Delivered!',
        message: `Your order #${assignment.orderNumber} has been delivered. Thank you for shopping with PocketKirana! 🛒`,
        orderId: assignment.orderId,
        deepLink: `/orders/${assignment.orderId}`,
      }),
      sendFcmToUser(customerId, {
        title: '✅ Order Delivered!',
        body: `Order #${assignment.orderNumber} delivered successfully. Rate your experience!`,
      }, { orderId: assignment.orderId }),
      createNotificationRecord({
        recipientId: uid,
        recipientType: 'delivery_partner',
        type: 'PARTNER_EARNINGS_CREDITED',
        title: `💰 ₹${earnings.total} Earned!`,
        message: `Delivery for Order #${assignment.orderNumber} completed. ₹${earnings.total} credited to your wallet.`,
        orderId: assignment.orderId,
      }),
      sendFcmToUser(uid, {
        title: `💰 ₹${earnings.total} Earned!`,
        body: `Order #${assignment.orderNumber} delivered. Earnings credited!`,
      }, { orderId: assignment.orderId }),
      sendFcmToRole('admin', storeId, {
        title: `📦 Order Delivered: #${assignment.orderNumber}`,
        body: `Delivered by ${assignment.partnerName} • ₹${earnings.total} earnings`,
      }, { orderId: assignment.orderId }),
    ]);

    // ── AUDIT LOG ─────────────────────────────────────────────────
    await writeAuditLog({
      actorId: uid,
      actorName: assignment.partnerName,
      actorRole: 'delivery_partner',
      action: 'DELIVERY_COMPLETED',
      targetCollection: C.ORDERS,
      targetId: assignment.orderId,
      description: `Order #${assignment.orderNumber} delivered by ${assignment.partnerName}. Earnings: ₹${earnings.total}`,
      orderId: assignment.orderId,
      storeId,
      newValue: { orderStatus: 'DELIVERED', earnings },
    });

    return {
      success: true,
      earningsTotal: earnings.total,
      message: `Delivery complete! ₹${earnings.total} has been added to your wallet.`,
    };
  }
);

/**
 * Cloud Function: recordDeliveryFailure
 * Partner marks customer as unavailable/delivery failed.
 */
export const recordDeliveryFailure = onCall(
  { region: 'asia-south1', cors: true },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Auth required.');
    if (request.auth.token.role !== 'delivery_partner') {
      throw new HttpsError('permission-denied', 'Delivery partners only.');
    }

    const { assignmentId, reason } = request.data as {
      assignmentId: string;
      reason: string;
    };

    const db = admin.firestore();
    const snap = await db.collection(C.DELIVERY_ASSIGNMENTS).doc(assignmentId).get();
    if (!snap.exists || snap.data()?.partnerId !== request.auth.uid) {
      throw new HttpsError('not-found', 'Assignment not found.');
    }

    const assignment = snap.data()!;
    const now = new Date().toISOString();

    await db.collection(C.DELIVERY_ASSIGNMENTS).doc(assignmentId).update({
      status: 'failed',
      failedAt: now,
      failureReason: reason,
    });

    await db.collection(C.ORDERS).doc(assignment.orderId).update({
      orderStatus: 'CUSTOMER_UNAVAILABLE',
      statusHistory: admin.firestore.FieldValue.arrayUnion({
        status: 'CUSTOMER_UNAVAILABLE',
        timestamp: now,
        actorId: request.auth.uid,
        note: reason,
      }),
    });

    await db.collection(C.DELIVERY_PARTNERS).doc(request.auth.uid).update({
      currentStatus: 'online',
      activeOrderId: null,
      activeDeliveryStage: null,
    });

    // Notify admin to take action
    await sendFcmToRole('admin', assignment.storeId || STORE_ID, {
      title: `⚠️ Delivery Failed: #${assignment.orderNumber}`,
      body: `Reason: ${reason}. Admin action required.`,
    }, { orderId: assignment.orderId });

    return { success: true };
  }
);
