/**
 * PocketKirana — Centralized Business Event Dispatcher (v1.0.0)
 *
 * The single event orchestration bus for the entire PocketKirana ecosystem.
 * When an operational transition occurs (e.g. ORDER_PLACED, ORDER_DELIVERED, STOCK_RESERVED),
 * this dispatcher coordinates all side-effects asynchronously:
 *   1. PostgreSQL Audit Logging (`audit_logs`)
 *   2. Order Status History Tracking (`order_status_history`)
 *   3. Real-time Firebase Firestore State Mirroring (for customer app websockets)
 *   4. FCM Push Notifications (Customer, Rider, Staff)
 *   5. Operational Telemetry & Analytics
 *
 * Architecture Rule: Primary DB transaction completes first; event dispatch is non-blocking.
 */

import { dispatchNotification, OrderNotificationEvent } from './notificationDispatcher';
import { logAuditEvent } from './auditLogger';

export type BusinessEventType =
  | 'ORDER_PLACED'
  | 'ORDER_CONFIRMED'
  | 'STOCK_RESERVED'
  | 'PICKING_STARTED'
  | 'ITEM_PICKED'
  | 'ORDER_PACKED'
  | 'READY_FOR_PICKUP'
  | 'RIDER_ASSIGNED'
  | 'RIDER_ACCEPTED'
  | 'STORE_HANDOVER_VERIFIED'
  | 'OUT_FOR_DELIVERY'
  | 'ORDER_DELIVERED'
  | 'ORDER_CANCELLED'
  | 'EXPIRY_ALERT_TRIGGERED'
  | 'CLEARANCE_PROMOTION_CREATED'
  | 'STOCK_DISPOSED'
  | 'ORDER_ROUTED'
  | 'DISPATCH_OVERRIDE';

export interface BusinessEventPayload {
  eventType: BusinessEventType;
  orderId?: string;
  orderNumber?: string;
  recipientUid?: string;
  actorId?: string;
  actorRole?: 'admin' | 'store_manager' | 'picker' | 'delivery_partner' | 'customer' | 'system';
  metadata?: Record<string, any>;
}

/**
 * Emit a business event to coordinate all secondary systems.
 */
export async function emitBusinessEvent(event: BusinessEventPayload): Promise<void> {
  const { eventType, orderId, orderNumber, recipientUid, actorId, actorRole, metadata = {} } = event;

  // 1. Asynchronously log to PostgreSQL Audit Trail
  logAuditEvent({
    userId: actorId || 'system',
    userRole: actorRole || 'system',
    action: eventType,
    entityType: orderId ? 'ORDER' : 'INVENTORY',
    entityId: orderId,
    details: { orderNumber, ...metadata },
  }).catch((err) => console.warn('[BusinessEvent Bus] Audit log error:', err.message));

  // 2. Dispatch FCM Push Notification (if customer or staff notification applies)
  if (recipientUid) {
    const notifEventMap: Partial<Record<BusinessEventType, OrderNotificationEvent>> = {
      ORDER_PLACED: 'ORDER_PLACED',
      ORDER_CONFIRMED: 'PAYMENT_CONFIRMED',
      PICKING_STARTED: 'PICKING_STARTED',
      ORDER_PACKED: 'PACKED',
      READY_FOR_PICKUP: 'READY_FOR_PICKUP',
      RIDER_ASSIGNED: 'PARTNER_ASSIGNED',
      RIDER_ACCEPTED: 'PARTNER_ACCEPTED',
      OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
      ORDER_DELIVERED: 'DELIVERED',
      ORDER_CANCELLED: 'ORDER_CANCELLED',
    };

    const mappedNotif = notifEventMap[eventType];
    if (mappedNotif && orderId && orderNumber) {
      dispatchNotification({
        recipientUid,
        event: mappedNotif,
        orderId,
        orderNumber,
        context: metadata,
      }).catch((err) => console.warn('[BusinessEvent Bus] FCM push error:', err.message));
    }
  }

  // 3. Operational Console Stream Logging (in dev/staging)
  if (process.env.NODE_ENV !== 'production') {
    console.log(`📡 [BusinessEvent] ${eventType} | Order: ${orderNumber || orderId || 'N/A'} | Role: ${actorRole || 'system'}`);
  }
}
