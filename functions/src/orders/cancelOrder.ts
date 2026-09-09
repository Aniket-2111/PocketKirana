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

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import {
  C,
  writeAuditLog,
  createNotificationRecord,
  sendFcmToUser,
  sendFcmToRole,
  newId,
  STORE_ID,
} from '../utils';

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

export const cancelOrder = onCall(
  { region: 'asia-south1', cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required.');
    }

    const uid = request.auth.uid;
    const role = request.auth.token.role || 'customer';

    const { orderId, reason } = request.data as {
      orderId: string;
      reason?: string;
    };

    if (!orderId) {
      throw new HttpsError('invalid-argument', 'orderId is required.');
    }

    const db = admin.firestore();
    const orderRef = db.collection(C.ORDERS).doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      throw new HttpsError('not-found', 'Order not found.');
    }

    const order = orderSnap.data()!;

    // Ownership check — customer can only cancel their own orders
    if (role === 'customer' && order.customerId !== uid) {
      throw new HttpsError('permission-denied', 'You can only cancel your own orders.');
    }

    const currentStatus = order.orderStatus;

    // Check if cancellation is allowed
    if (role === 'customer') {
      if (!CUSTOMER_CANCELLABLE_STATUSES.has(currentStatus)) {
        if (ADMIN_CANCELLABLE_STATUSES.has(currentStatus)) {
          throw new HttpsError(
            'failed-precondition',
            `Your order is currently being prepared. Please contact support to request cancellation.`
          );
        }
        throw new HttpsError(
          'failed-precondition',
          `Order cannot be cancelled at status: ${currentStatus}. The order is already out for delivery or delivered.`
        );
      }
    } else if (role !== 'admin') {
      throw new HttpsError('permission-denied', 'Only customers and admins can cancel orders.');
    }

    const now = new Date().toISOString();

    // ── RELEASE STOCK RESERVATION ──────────────────────────────────
    const reservationSnap = await db
      .collection(C.STOCK_RESERVATIONS)
      .doc(orderId)
      .get();

    if (reservationSnap.exists) {
      const reservation = reservationSnap.data()!;
      if (reservation.status === 'reserved') {
        await db.runTransaction(async (tx) => {
          // Release reserved quantities for each item
          for (const item of (reservation.items || [])) {
            const invRef = db.collection(C.INVENTORY).doc(item.inventoryId);
            const invSnap = await tx.get(invRef);
            if (invSnap.exists) {
              const inv = invSnap.data()!;
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
          tx.update(db.collection(C.STOCK_RESERVATIONS).doc(orderId), {
            status: 'released',
            releasedAt: now,
          });
        });
      }
    }

    // ── CREATE REFUND RECORD (if online payment was completed) ──────
    let refundId: string | null = null;
    if (order.paymentStatus === 'completed' && order.paymentMethod !== 'cod') {
      refundId = newId('ref');
      await db.collection(C.REFUNDS).doc(refundId).set({
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
      await db.collection(C.PICKING_TASKS).doc(order.pickingTaskId).update({
        status: 'cancelled',
        cancelledAt: now,
      });
    }

    // ── NOTIFICATIONS ─────────────────────────────────────────────
    const refundMsg = refundId
      ? `A refund of ₹${order.total} will be processed within 3-5 business days.`
      : '';

    await Promise.allSettled([
      createNotificationRecord({
        recipientId: order.customerId,
        recipientType: 'customer',
        type: 'ORDER_CANCELLED',
        title: '❌ Order Cancelled',
        message: `Order #${order.orderNumber} has been cancelled. ${refundMsg}`,
        orderId,
      }),
      sendFcmToUser(order.customerId, {
        title: '❌ Order Cancelled',
        body: `Order #${order.orderNumber} cancelled. ${refundMsg}`,
      }, { orderId }),
      createNotificationRecord({
        recipientId: 'admin',
        recipientType: 'admin',
        type: 'ADMIN_ORDER_CANCELLED',
        title: `🚫 Order Cancelled: #${order.orderNumber}`,
        message: `Cancelled by ${role === 'admin' ? 'Admin' : 'Customer'}. Reason: ${reason || 'No reason'}`,
        orderId,
      }),
      sendFcmToRole('admin', order.storeId || STORE_ID, {
        title: `🚫 Order Cancelled: #${order.orderNumber}`,
        body: `Reason: ${reason || 'No reason provided'}`,
      }, { orderId }),
    ]);

    // ── AUDIT LOG ─────────────────────────────────────────────────
    await writeAuditLog({
      actorId: uid,
      actorName: order.customerName || uid,
      actorRole: role,
      action: 'ORDER_CANCELLED',
      targetCollection: C.ORDERS,
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
  }
);
