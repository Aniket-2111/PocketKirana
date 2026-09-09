/**
 * Cloud Function: releaseExpiredReservations
 *
 * Scheduled function that runs every 5 minutes to:
 * 1. Find all stockReservations with status='reserved' and expiresAt < now
 * 2. For each expired reservation: atomically release reserved stock back
 *    to available, and mark the reservation as 'released'
 * 3. If the associated order is still in CREATED or PAYMENT_PENDING state,
 *    cancel it (customer did not complete payment in time)
 *
 * This prevents stock from being permanently locked when:
 * - A customer abandons checkout
 * - An online payment fails or times out
 * - A session is lost
 *
 * Schedule: every 5 minutes via Cloud Scheduler
 * Region:   asia-south1
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { C, writeAuditLog, createNotificationRecord, STORE_ID } from '../utils';

// Order statuses that can be auto-cancelled on reservation expiry
const CANCELLABLE_STATUSES = new Set(['CREATED', 'PAYMENT_PENDING', 'PAYMENT_FAILED']);

export const releaseExpiredReservations = onSchedule(
  {
    schedule: 'every 5 minutes',
    region: 'asia-south1',
    timeoutSeconds: 120,
    memory: '256MiB',
  },
  async () => {
    const db = admin.firestore();
    const now = new Date().toISOString();

    console.log(`[ReleaseExpiredReservations] Running at ${now}`);

    // ── Find expired reservations ────────────────────────────────────
    const expiredSnap = await db
      .collection(C.STOCK_RESERVATIONS)
      .where('status', '==', 'reserved')
      .where('expiresAt', '<', now)
      .limit(50) // Process in batches to avoid timeout
      .get();

    if (expiredSnap.empty) {
      console.log('[ReleaseExpiredReservations] No expired reservations found.');
      return;
    }

    console.log(`[ReleaseExpiredReservations] Found ${expiredSnap.size} expired reservations.`);

    // ── Process each expired reservation ────────────────────────────
    const results = await Promise.allSettled(
      expiredSnap.docs.map((resDoc) => releaseReservation(db, resDoc, now))
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    console.log(`[ReleaseExpiredReservations] Done. Released: ${succeeded}, Failed: ${failed}`);
  }
);

// ── Helper: Release a single reservation atomically ──────────────────────────

async function releaseReservation(
  db: FirebaseFirestore.Firestore,
  resDoc: FirebaseFirestore.QueryDocumentSnapshot,
  now: string
): Promise<void> {
  const reservation = resDoc.data();
  const { orderId, customerId, storeId, items } = reservation;

  try {
    await db.runTransaction(async (tx) => {
      // Re-read reservation inside transaction to prevent double-processing
      const freshResSnap = await tx.get(resDoc.ref);
      if (!freshResSnap.exists || freshResSnap.data()?.status !== 'reserved') {
        // Already processed by a concurrent invocation — skip
        return;
      }

      // Release stock for each item
      for (const item of items as Array<{ inventoryId: string; quantity: number }>) {
        const invRef = db.collection(C.INVENTORY).doc(item.inventoryId);
        const invSnap = await tx.get(invRef);
        if (!invSnap.exists) continue;

        const inv = invSnap.data()!;
        const currentReserved = inv.reservedQuantity || 0;
        const newReserved = Math.max(0, currentReserved - item.quantity);
        const newAvailable = (inv.quantity || 0) - newReserved - (inv.damagedQuantity || 0);

        tx.update(invRef, {
          reservedQuantity: newReserved,
          availableQuantity: Math.max(0, newAvailable),
          updatedAt: now,
        });
      }

      // Mark reservation as released
      tx.update(resDoc.ref, {
        status: 'released',
        releasedAt: now,
        releaseReason: 'expired',
      });

      // If order is still in a pre-payment status, auto-cancel it
      if (orderId) {
        const orderRef = db.collection(C.ORDERS).doc(orderId);
        const orderSnap = await tx.get(orderRef);
        if (orderSnap.exists) {
          const order = orderSnap.data()!;
          if (CANCELLABLE_STATUSES.has(order.orderStatus)) {
            tx.update(orderRef, {
              orderStatus: 'CANCELLED',
              cancelledAt: now,
              cancelReason: 'Payment timeout — stock reservation expired after 30 minutes.',
              statusHistory: admin.firestore.FieldValue.arrayUnion({
                status: 'CANCELLED',
                timestamp: now,
                actorId: 'system',
                note: 'Auto-cancelled: payment not completed within 30 minutes.',
              }),
            });
          }
        }
      }
    });

    // ── Post-transaction: notify customer ────────────────────────────
    if (customerId && orderId) {
      await createNotificationRecord({
        recipientId: customerId,
        recipientType: 'customer',
        type: 'ORDER_CANCELLED',
        title: '⏰ Order Cancelled — Payment Timeout',
        message: 'Your order has been cancelled because payment was not completed within 30 minutes. Your cart items are still available to reorder.',
        orderId,
        deepLink: `/orders/${orderId}`,
      }).catch((err) => console.error('[ReleaseExpiredReservations] Notification error:', err));

      await writeAuditLog({
        actorId: 'system',
        actorName: 'System',
        actorRole: 'system',
        action: 'STOCK_RELEASED',
        targetCollection: C.STOCK_RESERVATIONS,
        targetId: resDoc.id,
        description: `Expired reservation released for order ${orderId}. Stock returned to available.`,
        orderId,
        storeId: storeId || STORE_ID,
      }).catch((err) => console.error('[ReleaseExpiredReservations] Audit log error:', err));
    }

    console.log(`[ReleaseExpiredReservations] Released reservation for order: ${orderId}`);
  } catch (err) {
    console.error(`[ReleaseExpiredReservations] Failed for reservation ${resDoc.id}:`, err);
    throw err; // Re-throw so Promise.allSettled counts it as failed
  }
}
