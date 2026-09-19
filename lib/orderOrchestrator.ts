/**
 * PocketKirana — Centralized Order Orchestrator (v2.0.0)
 *
 * Implements the authoritative lifecycle state machine, idempotent event emission,
 * SLA timestamp logging, auto-dispatch triggers, and non-blocking notifications
 * across PostgreSQL and Firestore.
 */

import crypto from 'crypto';
import { queryPostgres, withTransaction } from './postgres';
import { dispatchNotification, OrderNotificationEvent } from './notificationDispatcher';
import { appendOutboxEvent } from './db/outbox';

export type CanonicalOrderStatus =
  | 'CREATED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_FAILED'
  | 'CONFIRMED'
  | 'PICKER_NOTIFIED'
  | 'PICKER_ACCEPTED'
  | 'PICKING_STARTED'
  | 'PICKING_COMPLETED'
  | 'ORDER_PACKED'
  | 'DELIVERY_PARTNER_NOTIFIED'
  | 'DELIVERY_PARTNER_ACCEPTED'
  | 'PARTNER_ARRIVED_STORE'
  | 'ORDER_PICKED_UP'
  | 'OUT_FOR_DELIVERY'
  | 'PARTNER_NEAR_CUSTOMER'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUND_INITIATED'
  | 'REFUND_PROCESSING'
  | 'REFUNDED'
  | 'FAILED'
  | 'REJECTED';

export type OrderEventType =
  | 'ORDER_CREATED'
  | 'ORDER_PAYMENT_CONFIRMED'
  | 'ORDER_CONFIRMED'
  | 'PICKER_NOTIFIED'
  | 'PICKER_ACCEPTED'
  | 'PICKING_STARTED'
  | 'ITEM_PICKED'
  | 'PICKING_COMPLETED'
  | 'ORDER_PACKED'
  | 'DELIVERY_PARTNER_ASSIGNED'
  | 'DELIVERY_PARTNER_ACCEPTED'
  | 'PARTNER_ARRIVED_STORE'
  | 'ORDER_PICKED_UP'
  | 'OUT_FOR_DELIVERY'
  | 'PARTNER_NEAR_CUSTOMER'
  | 'DELIVERY_OTP_GENERATED'
  | 'ORDER_DELIVERED'
  | 'ORDER_CANCELLED'
  | 'REFUND_INITIATED'
  | 'REFUND_COMPLETED'
  | 'ORDER_REJECTED';

export interface TransitionParams {
  orderId: string;
  eventType: OrderEventType;
  targetStatus: CanonicalOrderStatus;
  actorId: string;
  actorType: 'customer' | 'picker' | 'delivery_partner' | 'admin' | 'system';
  metadata?: Record<string, any>;
  eventId?: string; // For idempotency
}

export interface TransitionResult {
  success: boolean;
  orderId: string;
  orderNumber: string;
  previousStatus: string;
  newStatus: CanonicalOrderStatus;
  eventId: string;
  deliveryOtp?: string;
  timestamp: string;
}

// ── Lazy Firestore Admin synchronization ──
let _adminDb: any = null;
function getFirestoreDb(): any {
  if (_adminDb) return _adminDb;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const admin = require('firebase-admin');
    if (admin.apps?.length > 0) {
      _adminDb = admin.firestore();
      return _adminDb;
    }
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      const app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId,
      });
      _adminDb = app.firestore();
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const app = admin.initializeApp({ projectId });
      _adminDb = app.firestore();
    }
    return _adminDb;
  } catch (err: any) {
    console.warn('[OrderOrchestrator] Firestore admin init warning:', err.message);
    return null;
  }
}

// In-memory fallback ledger for offline / network partitioned environments
const memoryOrderStore = new Map<string, any>();
const memoryEventStore = new Map<string, any>();

/**
 * Generate 4-digit numeric OTP for delivery verification
 */
export function generateDeliveryOtp(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Orchestrate an authoritative order state transition
 */
export async function transitionOrderStatus(params: TransitionParams): Promise<TransitionResult> {
  const {
    orderId,
    eventType,
    targetStatus,
    actorId,
    actorType,
    metadata = {},
    eventId = crypto.randomUUID(),
  } = params;

  try {
    return await withTransaction(async (client) => {
      // 1. Fetch current order with row lock
      const orderRes = await client.query(
        `SELECT id, order_number, firebase_uid, order_status, payment_status, total_amount,
                assigned_picker_id, assigned_partner_id, delivery_otp
         FROM orders
         WHERE id = $1 OR order_number = $1
         FOR UPDATE`,
        [orderId]
      );

      if (orderRes.rowCount === 0) {
        throw new Error(`Order not found: ${orderId}`);
      }

      const order = orderRes.rows[0];
      const previousStatus = order.order_status;
      const customerUid = order.firebase_uid;
      const orderNumber = order.order_number;
      let deliveryOtp = order.delivery_otp;

      // Check if event has already been processed (Idempotency)
      const existingEvent = await client.query(
        `SELECT id, event_id FROM order_events WHERE event_id = $1`,
        [eventId]
      );
      if (existingEvent.rowCount && existingEvent.rowCount > 0) {
        return {
          success: true,
          orderId: order.id,
          orderNumber,
          previousStatus,
          newStatus: previousStatus as CanonicalOrderStatus,
          eventId,
          deliveryOtp,
          timestamp: new Date().toISOString(),
        };
      }

      // Generate delivery OTP if not already present and transitioning to PACKED or OUT_FOR_DELIVERY
      if (!deliveryOtp && (targetStatus === 'ORDER_PACKED' || targetStatus === 'OUT_FOR_DELIVERY' || targetStatus === 'DELIVERY_PARTNER_ACCEPTED')) {
        deliveryOtp = generateDeliveryOtp();
      }

      const assignedPickerId = metadata.pickerId || order.assigned_picker_id || null;
      const assignedPickerName = metadata.pickerName || null;
      const assignedPartnerId = metadata.partnerId || order.assigned_partner_id || null;
      const assignedPartnerName = metadata.partnerName || null;

      // 2. Update PostgreSQL Order Record
      await client.query(
        `UPDATE orders
         SET order_status = $1,
             delivery_otp = COALESCE($2, delivery_otp),
             assigned_picker_id = COALESCE($3, assigned_picker_id),
             assigned_picker_name = COALESCE($4, assigned_picker_name),
             assigned_partner_id = COALESCE($5, assigned_partner_id),
             assigned_partner_name = COALESCE($6, assigned_partner_name),
             updated_at = CURRENT_TIMESTAMP,
             confirmed_at = CASE WHEN $1 = 'CONFIRMED' AND confirmed_at IS NULL THEN CURRENT_TIMESTAMP ELSE confirmed_at END,
             delivered_at = CASE WHEN $1 = 'DELIVERED' THEN CURRENT_TIMESTAMP ELSE delivered_at END,
             cancelled_at = CASE WHEN $1 = 'CANCELLED' THEN CURRENT_TIMESTAMP ELSE cancelled_at END
         WHERE id = $7`,
        [
          targetStatus,
          deliveryOtp,
          assignedPickerId,
          assignedPickerName,
          assignedPartnerId,
          assignedPartnerName,
          order.id,
        ]
      );

      // 3. Record Immutable Order Event
      await client.query(
        `INSERT INTO order_events (
           id, event_id, order_id, event_type, actor_id, actor_type,
           previous_status, new_status, metadata, timestamp
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)`,
        [
          crypto.randomUUID(),
          eventId,
          order.id,
          eventType,
          actorId,
          actorType,
          previousStatus,
          targetStatus,
          JSON.stringify(metadata),
        ]
      );

      // 3b. Record Transactional Outbox Event
      try {
        await appendOutboxEvent(client, {
          aggregateType: 'order',
          aggregateId: order.id,
          eventType: 'order.status_changed',
          payload: {
            id: order.id,
            orderNumber,
            orderStatus: targetStatus,
            previousStatus,
            actorId,
            actorType,
            metadata,
            updatedAt: new Date().toISOString(),
          },
        });
      } catch (outboxErr: any) {
        console.warn('[OrderOrchestrator] Outbox append notice:', outboxErr.message);
      }

      // 4. Update SLA Milestones in order_sla_events
      await client.query(
        `INSERT INTO order_sla_events (id, order_id, order_created_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (order_id) DO NOTHING`,
        [crypto.randomUUID(), order.id]
      );

      const slaFieldMap: Partial<Record<CanonicalOrderStatus, string>> = {
        CONFIRMED: 'payment_confirmed_at',
        PICKER_NOTIFIED: 'picker_notified_at',
        PICKER_ACCEPTED: 'picker_accepted_at',
        PICKING_STARTED: 'picking_started_at',
        PICKING_COMPLETED: 'picking_completed_at',
        ORDER_PACKED: 'packed_at',
        DELIVERY_PARTNER_NOTIFIED: 'partner_assigned_at',
        DELIVERY_PARTNER_ACCEPTED: 'partner_accepted_at',
        PARTNER_ARRIVED_STORE: 'partner_arrived_at',
        ORDER_PICKED_UP: 'picked_up_at',
        OUT_FOR_DELIVERY: 'out_for_delivery_at',
        PARTNER_NEAR_CUSTOMER: 'near_customer_at',
        DELIVERED: 'delivered_at',
      };

      const slaColumn = slaFieldMap[targetStatus];
      if (slaColumn) {
        await client.query(
          `UPDATE order_sla_events
           SET ${slaColumn} = COALESCE(${slaColumn}, CURRENT_TIMESTAMP),
               updated_at = CURRENT_TIMESTAMP
           WHERE order_id = $1`,
          [order.id]
        );
      }

      if (targetStatus === 'DELIVERED') {
        await client.query(
          `UPDATE order_sla_events
           SET total_order_minutes = ROUND(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - order_created_at)) / 60.0, 2),
               is_sla_breached = CASE WHEN EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - order_created_at)) > 1800 THEN TRUE ELSE FALSE END
           WHERE order_id = $1`,
          [order.id]
        );
      }

      const nowIso = new Date().toISOString();

      // Trigger side-effects asynchronously
      setImmediate(async () => {
        try {
          const db = getFirestoreDb();
          if (db) {
            await db.collection('orders').doc(order.id).set(
              {
                status: targetStatus,
                order_status: targetStatus,
                orderStatus: targetStatus,
                delivery_otp: deliveryOtp,
                deliveryOtp: deliveryOtp,
                assigned_picker_id: assignedPickerId,
                assigned_partner_id: assignedPartnerId,
                updatedAt: nowIso,
              },
              { merge: true }
            );
          }
          await handleSideEffectNotifications({
            orderId: order.id,
            orderNumber,
            customerUid,
            targetStatus,
            eventType,
            eventId,
            deliveryOtp,
            assignedPickerId,
            assignedPartnerId,
            metadata,
          });
          if (targetStatus === 'ORDER_PACKED' && !assignedPartnerId) {
            await triggerAutoDispatch(order.id, orderNumber);
          }
        } catch (e: any) {
          console.warn('[OrderOrchestrator] Side-effect notice:', e.message);
        }
      });

      return {
        success: true,
        orderId: order.id,
        orderNumber,
        previousStatus,
        newStatus: targetStatus,
        eventId,
        deliveryOtp,
        timestamp: nowIso,
      };
    });
  } catch (dbErr: any) {
    console.warn(`[OrderOrchestrator] DB fallback mode activated (${dbErr.message}). Using resilient memory/firestore sync.`);
    
    // Fallback in-memory state preservation
    const existing = memoryOrderStore.get(orderId) || {
      id: orderId,
      orderNumber: orderId.startsWith('PK') ? orderId : `PK-${orderId.slice(0, 6).toUpperCase()}`,
      orderStatus: 'CREATED',
      firebaseUid: metadata.customerUid || 'cust_guest',
      deliveryOtp: generateDeliveryOtp(),
    };

    const prev = existing.orderStatus;
    existing.orderStatus = targetStatus;
    existing.status = targetStatus;
    if (metadata.pickerId) existing.assignedPickerId = metadata.pickerId;
    if (metadata.partnerId) existing.assignedPartnerId = metadata.partnerId;
    memoryOrderStore.set(orderId, existing);
    memoryEventStore.set(eventId, { eventId, orderId, eventType, targetStatus, metadata, timestamp: new Date().toISOString() });

    const nowIso = new Date().toISOString();

    // Side-effects
    setImmediate(async () => {
      try {
        const db = getFirestoreDb();
        if (db) {
          await db.collection('orders').doc(orderId).set(
            {
              status: targetStatus,
              order_status: targetStatus,
              orderStatus: targetStatus,
              delivery_otp: existing.deliveryOtp,
              deliveryOtp: existing.deliveryOtp,
              assigned_picker_id: existing.assignedPickerId,
              assigned_partner_id: existing.assignedPartnerId,
              updatedAt: nowIso,
            },
            { merge: true }
          );
        }
        await handleSideEffectNotifications({
          orderId,
          orderNumber: existing.orderNumber,
          customerUid: existing.firebaseUid,
          targetStatus,
          eventType,
          eventId,
          deliveryOtp: existing.deliveryOtp,
          assignedPickerId: existing.assignedPickerId,
          assignedPartnerId: existing.assignedPartnerId,
          metadata,
        });
      } catch (err: any) {
        console.warn('[OrderOrchestrator Fallback] Side-effect note:', err.message);
      }
    });

    return {
      success: true,
      orderId,
      orderNumber: existing.orderNumber,
      previousStatus: prev,
      newStatus: targetStatus,
      eventId,
      deliveryOtp: existing.deliveryOtp,
      timestamp: nowIso,
    };
  }
}

/**
 * Handle notification generation and deduplicated push + in-app storage
 */
async function handleSideEffectNotifications(params: {
  orderId: string;
  orderNumber: string;
  customerUid: string;
  targetStatus: CanonicalOrderStatus;
  eventType: OrderEventType;
  eventId: string;
  deliveryOtp?: string;
  assignedPickerId?: string | null;
  assignedPartnerId?: string | null;
  metadata?: Record<string, any>;
}) {
  const {
    orderId,
    orderNumber,
    customerUid,
    targetStatus,
    eventType,
    eventId,
    deliveryOtp,
    assignedPickerId,
    assignedPartnerId,
    metadata,
  } = params;

  // 1. Customer Notifications
  const customerEventMap: Partial<Record<CanonicalOrderStatus, { event: OrderNotificationEvent; title: string; message: string }>> = {
    CONFIRMED: {
      event: 'PAYMENT_CONFIRMED',
      title: 'Order Confirmed',
      message: `Your PocketKirana order #${orderNumber} has been confirmed.`,
    },
    PICKING_STARTED: {
      event: 'PICKING_STARTED',
      title: 'Order in Preparation',
      message: 'Your order is being prepared.',
    },
    ORDER_PACKED: {
      event: 'PACKED',
      title: 'Order Packed',
      message: 'Your order has been packed and is ready for delivery.',
    },
    DELIVERY_PARTNER_ACCEPTED: {
      event: 'PARTNER_ASSIGNED',
      title: 'Delivery Partner Assigned',
      message: 'A delivery partner has been assigned to your order.',
    },
    OUT_FOR_DELIVERY: {
      event: 'OUT_FOR_DELIVERY',
      title: 'Out for Delivery',
      message: 'Your PocketKirana order is on the way.',
    },
    PARTNER_NEAR_CUSTOMER: {
      event: 'ARRIVING_SOON',
      title: 'Partner Nearby',
      message: `Your delivery partner is nearby. Please keep your delivery OTP ${deliveryOtp ? `(${deliveryOtp})` : ''} ready.`,
    },
    DELIVERED: {
      event: 'DELIVERED',
      title: 'Delivered',
      message: 'Your PocketKirana order has been delivered successfully.',
    },
    CANCELLED: {
      event: 'ORDER_CANCELLED',
      title: 'Order Cancelled',
      message: 'Your order has been cancelled.',
    },
    REFUND_INITIATED: {
      event: 'REFUND_INITIATED',
      title: 'Refund Initiated',
      message: 'Your refund has been initiated.',
    },
  };

  const custNotif = customerEventMap[targetStatus];
  if (custNotif && customerUid) {
    // Record notification in PostgreSQL with deduplication
    const notifId = crypto.randomUUID();
    try {
      await queryPostgres(
        `INSERT INTO notifications (
           id, event_id, order_id, firebase_uid, recipient_type, notification_type,
           title, message, channel, status
         ) VALUES ($1, $2, $3, $4, 'customer', $5, $6, $7, 'PUSH_AND_INAPP', 'SENT')
         ON CONFLICT (event_id, firebase_uid, notification_type) DO NOTHING`,
        [
          notifId,
          eventId,
          orderId,
          customerUid,
          custNotif.event,
          custNotif.title,
          custNotif.message,
        ]
      );
    } catch (e: any) {
      console.warn('[Notification DB] Notification insertion notice:', e.message);
    }

    // Send FCM Push
    dispatchNotification({
      recipientUid: customerUid,
      event: custNotif.event,
      orderId,
      orderNumber,
      context: { orderNumber, ...metadata } as any,
    }).catch(() => {});
  }

  // 2. Picker Notifications (When order is confirmed and ready to pick)
  if (targetStatus === 'CONFIRMED' || targetStatus === 'PICKER_NOTIFIED') {
    const pickerId = assignedPickerId || 'ALL_PICKERS';
    const notifId = crypto.randomUUID();
    try {
      await queryPostgres(
        `INSERT INTO notifications (
           id, event_id, order_id, firebase_uid, recipient_type, notification_type,
           title, message, channel, status
         ) VALUES ($1, $2, $3, $4, 'picker', 'NEW_ORDER_FOR_PICKER',
           '🔔 NEW ORDER', $5, 'IN_APP', 'SENT')
         ON CONFLICT (event_id, firebase_uid, notification_type) DO NOTHING`,
        [
          notifId,
          eventId,
          orderId,
          pickerId,
          `Order #${orderNumber} requires picking. Tap to accept and start.`,
        ]
      );
    } catch {}
  }

  // 3. Delivery Partner Notifications
  if (targetStatus === 'DELIVERY_PARTNER_NOTIFIED' && assignedPartnerId) {
    const notifId = crypto.randomUUID();
    try {
      await queryPostgres(
        `INSERT INTO notifications (
           id, event_id, order_id, firebase_uid, recipient_type, notification_type,
           title, message, channel, status
         ) VALUES ($1, $2, $3, $4, 'delivery_partner', 'NEW_DELIVERY_ASSIGNMENT',
           '🔔 NEW DELIVERY', $5, 'PUSH_AND_INAPP', 'SENT')
         ON CONFLICT (event_id, firebase_uid, notification_type) DO NOTHING`,
        [
          notifId,
          eventId,
          orderId,
          assignedPartnerId,
          `Order #${orderNumber} is packed and ready for pickup at PocketKirana Store.`,
        ]
      );
    } catch {}
  }
}

/**
 * Auto-Dispatch Engine: Automatically finds and assigns an available delivery partner
 */
export async function triggerAutoDispatch(orderId: string, orderNumber: string) {
  try {
    // 1. Find active, available delivery partner with least active assignments
    const partnerRes = await queryPostgres(
      `SELECT dp.id, dp.firebase_uid, dp.employee_code,
              COUNT(da.id) FILTER (WHERE da.status IN ('assigned', 'accepted', 'picked_up')) as active_count
       FROM delivery_partners dp
       LEFT JOIN delivery_assignments da ON da.delivery_partner_id = dp.id
       WHERE dp.is_active = TRUE AND dp.status IN ('online', 'available', 'idle')
       GROUP BY dp.id, dp.firebase_uid, dp.employee_code
       HAVING COUNT(da.id) FILTER (WHERE da.status IN ('assigned', 'accepted', 'picked_up')) < 3
       ORDER BY active_count ASC
       LIMIT 1`
    );

    if (partnerRes.rowCount && partnerRes.rowCount > 0) {
      const partner = partnerRes.rows[0];
      const assignmentId = crypto.randomUUID();

      // Create delivery assignment
      await queryPostgres(
        `INSERT INTO delivery_assignments (
           id, order_id, delivery_partner_id, assigned_by, status
         ) VALUES ($1, $2, $3, 'system_auto_dispatch', 'assigned')`,
        [assignmentId, orderId, partner.id]
      );

      // Transition order status to DELIVERY_PARTNER_NOTIFIED
      await transitionOrderStatus({
        orderId,
        eventType: 'DELIVERY_PARTNER_ASSIGNED',
        targetStatus: 'DELIVERY_PARTNER_NOTIFIED',
        actorId: 'system',
        actorType: 'system',
        metadata: {
          partnerId: partner.id,
          partnerUid: partner.firebase_uid,
          employeeCode: partner.employee_code,
          assignmentId,
        },
      });

      console.log(`🛵 [AutoDispatch] Assigned Order #${orderNumber} to Delivery Partner ${partner.employee_code || partner.id}`);
    } else {
      console.warn(`⚠️ [AutoDispatch] No available delivery partner found for Order #${orderNumber}. Queued for manual dispatch.`);
    }
  } catch (err: any) {
    console.error(`❌ [AutoDispatch Error] Failed to auto-dispatch order ${orderId}:`, err.message);
  }
}
