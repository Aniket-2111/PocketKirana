/**
 * PATCH /api/orders/[id]/status
 *
 * Role-guarded order state transition endpoint.
 * Validates allowed state transitions, updates PostgreSQL `orders` and `order_status_history`,
 * and asynchronously dispatches push notifications to customer and operations staff.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres';
import { requireRole } from '@/lib/routeAuth';
import { dispatchNotification, OrderNotificationEvent } from '@/lib/notificationDispatcher';
import { randomUUID } from 'crypto';

// Allowed status transitions map
const VALID_TRANSITIONS: Record<string, string[]> = {
  placed: ['confirmed', 'cancelled'],
  confirmed: ['picking', 'cancelled'],
  picking: ['packing', 'cancelled'],
  packing: ['ready_for_pickup', 'cancelled'],
  ready_for_pickup: ['assigned', 'cancelled'],
  assigned: ['accepted', 'ready_for_pickup', 'cancelled'],
  accepted: ['arrived_at_store', 'picked_up', 'cancelled'],
  arrived_at_store: ['picked_up', 'cancelled'],
  picked_up: ['out_for_delivery', 'delivered', 'cancelled'],
  out_for_delivery: ['arrived_at_customer', 'delivered', 'cancelled'],
  arrived_at_customer: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const auth = requireRole(req, ['admin', 'store_manager', 'delivery_partner', 'picker']);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized or insufficient privileges' }, { status: 401 });
    }

    const body = await req.json();
    const { status, notes } = body;

    if (!status || typeof status !== 'string') {
      return NextResponse.json({ error: 'status is required' }, { status: 400 });
    }

    const targetStatus = status.toLowerCase().trim();
    const pool = getPostgresPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Fetch current order state
      const orderRes = await client.query(
        `SELECT id, order_number, order_status, firebase_uid, total_amount
         FROM orders
         WHERE id = $1 OR order_number = $1
         FOR UPDATE`,
        [orderId]
      );

      if (orderRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      const order = orderRes.rows[0];
      const currentStatus = (order.order_status || 'placed').toLowerCase();

      // Validate transition if not admin override
      if (auth.role !== 'admin') {
        const allowed = VALID_TRANSITIONS[currentStatus] || [];
        if (!allowed.includes(targetStatus)) {
          await client.query('ROLLBACK');
          return NextResponse.json(
            { error: `Cannot transition order from '${currentStatus}' to '${targetStatus}'.` },
            { status: 400 }
          );
        }
      }

      // 2. Update order status and timestamp columns
      let timestampUpdate = '';
      if (targetStatus === 'confirmed') timestampUpdate = ', confirmed_at = NOW()';
      else if (targetStatus === 'delivered') timestampUpdate = ', delivered_at = NOW(), delivery_status = \'delivered\'';
      else if (targetStatus === 'cancelled') timestampUpdate = ', cancelled_at = NOW(), cancellation_reason = $3';

      const updateQuery = `
        UPDATE orders
        SET order_status = $1,
            updated_at = NOW()
            ${timestampUpdate}
        WHERE id = $2
        RETURNING *
      `;

      const updateParams = targetStatus === 'cancelled'
        ? [targetStatus, order.id, notes || 'Cancelled by admin']
        : [targetStatus, order.id];

      const updatedRes = await client.query(updateQuery, updateParams);

      // 3. Log into order_status_history
      const historyId = randomUUID();
      await client.query(
        `INSERT INTO order_status_history
           (id, order_id, old_status, new_status, changed_by, changed_by_role, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          historyId,
          order.id,
          currentStatus,
          targetStatus,
          auth.uid,
          auth.role,
          notes || `Status changed to ${targetStatus}`,
        ]
      );

      await client.query('COMMIT');

      // 4. Dispatch FCM Push Notification as asynchronous side-effect
      if (order.firebase_uid) {
        let notifEvent: OrderNotificationEvent | null = null;
        if (targetStatus === 'confirmed') notifEvent = 'PAYMENT_CONFIRMED';
        else if (targetStatus === 'picking') notifEvent = 'PICKING_STARTED';
        else if (targetStatus === 'packing') notifEvent = 'PACKED';
        else if (targetStatus === 'ready_for_pickup') notifEvent = 'READY_FOR_PICKUP';
        else if (targetStatus === 'out_for_delivery') notifEvent = 'OUT_FOR_DELIVERY';
        else if (targetStatus === 'delivered') notifEvent = 'DELIVERED';
        else if (targetStatus === 'cancelled') notifEvent = 'ORDER_CANCELLED';

        if (notifEvent) {
          dispatchNotification({
            recipientUid: order.firebase_uid,
            event: notifEvent,
            orderId: order.id,
            orderNumber: order.order_number,
            context: {
              totalAmount: `₹${order.total_amount}`,
            },
          }).catch((err) => console.warn('[Notification Error]', err.message));
        }
      }

      return NextResponse.json({
        success: true,
        message: `Order status successfully updated to ${targetStatus}`,
        order: updatedRes.rows[0],
      });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[PATCH /api/orders/[id]/status]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
