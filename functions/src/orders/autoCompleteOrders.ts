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

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { C, writeAuditLog, STORE_ID } from '../utils';

const AUTO_COMPLETE_AFTER_HOURS = 24;

export const autoCompleteOrders = onSchedule(
  {
    schedule: 'every 60 minutes',
    region: 'asia-south1',
    timeoutSeconds: 120,
    memory: '256MiB',
  },
  async () => {
    const db = admin.firestore();
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - AUTO_COMPLETE_AFTER_HOURS * 60 * 60 * 1000).toISOString();

    console.log(`[AutoCompleteOrders] Running at ${now.toISOString()}, cutoff: ${cutoffTime}`);

    // ── Find DELIVERED orders older than 24 hours ────────────────────
    const deliveredSnap = await db
      .collection(C.ORDERS)
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

    const results = await Promise.allSettled(
      deliveredSnap.docs.map(async (orderDoc) => {
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
        const reservationRef = db.collection(C.STOCK_RESERVATIONS).doc(orderDoc.id);
        const resSnap = await reservationRef.get();
        if (resSnap.exists && resSnap.data()?.status === 'reserved') {
          batch.update(reservationRef, {
            status: 'committed',
            committedAt: nowIso,
          });
        }

        await batch.commit();

        // Audit log
        await writeAuditLog({
          actorId: 'system',
          actorName: 'System Scheduler',
          actorRole: 'system',
          action: 'ORDER_STATUS_CHANGED',
          targetCollection: C.ORDERS,
          targetId: orderDoc.id,
          description: `Order #${order.orderNumber} auto-completed after ${AUTO_COMPLETE_AFTER_HOURS}h.`,
          orderId: orderDoc.id,
          storeId: order.storeId || STORE_ID,
          oldValue: { orderStatus: 'DELIVERED' },
          newValue: { orderStatus: 'COMPLETED' },
        });

        console.log(`[AutoCompleteOrders] Completed order: ${order.orderNumber} (${orderDoc.id})`);
      })
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;
    console.log(`[AutoCompleteOrders] Done. Completed: ${succeeded}, Failed: ${failed}`);
  }
);
