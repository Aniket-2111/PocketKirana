/**
 * PocketKirana — Order State Machine, Exception Handling & Audit Engine
 * 
 * Enforces strict, server-authoritative state transitions, idempotency guards,
 * audit trails, and inventory safety for returns and complaints.
 */

import { OrderStatus, OrderAuditLog, DeliveryExceptionRecord, OrderIssueReport, OrderReturn, ReturnItemInspection } from '@/types';
import { getPostgresPool } from './postgres';
import { db, isFirebaseConfigured } from './firebase';
import { collection, doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

// ── State Transition Map ────────────────────────────────────────────────────────
const VALID_TRANSITIONS: Record<string, string[]> = {
  CREATED: ['PAYMENT_PENDING', 'PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED'],
  PAYMENT_PENDING: ['CONFIRMED', 'PAYMENT_FAILED', 'CANCELLED'],
  PENDING_PAYMENT: ['CONFIRMED', 'PAYMENT_FAILED', 'CANCELLED'],
  CONFIRMED: ['STOCK_RESERVED', 'PICKING', 'CANCELLED'],
  STOCK_RESERVED: ['PICKING', 'CANCELLED'],
  PICKING: ['PICKED', 'PICKING_FAILED', 'CANCELLED'],
  PICKED: ['PACKING', 'PACKED', 'CANCELLED'],
  PACKING: ['PACKED', 'CANCELLED'],
  PACKED: ['WAITING_FOR_DELIVERY', 'ASSIGNED_TO_DELIVERY', 'READY_FOR_PICKUP', 'ASSIGNED', 'OUT_FOR_DELIVERY'],
  WAITING_FOR_DELIVERY: ['ASSIGNED_TO_DELIVERY', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'CANCELLED'],
  ASSIGNED_TO_DELIVERY: ['ASSIGNED', 'ACCEPTED', 'ARRIVED_AT_STORE', 'PICKED_UP', 'OUT_FOR_DELIVERY'],
  ASSIGNED: ['ACCEPTED', 'ARRIVED_AT_STORE', 'PICKED_UP', 'OUT_FOR_DELIVERY'],
  ACCEPTED: ['ARRIVED_AT_STORE', 'PICKED_UP', 'OUT_FOR_DELIVERY'],
  ARRIVED_AT_STORE: ['PICKED_UP', 'OUT_FOR_DELIVERY'],
  READY_FOR_PICKUP: ['PICKED_UP', 'OUT_FOR_DELIVERY'],
  PICKED_UP: ['OUT_FOR_DELIVERY', 'ARRIVED_AT_CUSTOMER', 'DELIVERED'],
  OUT_FOR_DELIVERY: ['ARRIVED_AT_CUSTOMER', 'DELIVERY_ATTEMPTED', 'DELIVERY_FAILED', 'CUSTOMER_UNAVAILABLE', 'DELIVERED'],
  ARRIVED_AT_CUSTOMER: ['DELIVERY_ATTEMPTED', 'DELIVERY_FAILED', 'CUSTOMER_UNAVAILABLE', 'DELIVERED'],
  DELIVERY_ATTEMPTED: ['DELIVERY_FAILED', 'DELIVERED', 'RETURN_PENDING', 'RETURN_REQUESTED'],
  DELIVERY_FAILED: ['RETURN_PENDING', 'RETURN_REQUESTED', 'RETURN_IN_TRANSIT', 'RETURNED', 'CANCELLED'],
  DELIVERED: ['COMPLETED', 'RETURN_REQUESTED', 'RETURN_APPROVED', 'REFUND_PENDING'],
  COMPLETED: ['RETURN_REQUESTED', 'RETURN_APPROVED', 'REFUND_PENDING'],
  RETURN_REQUESTED: ['RETURN_APPROVED', 'RETURN_PICKUP_ASSIGNED', 'RETURN_PENDING', 'RETURN_IN_TRANSIT', 'CANCELLED'],
  RETURN_APPROVED: ['RETURN_PICKUP_ASSIGNED', 'RETURN_PENDING', 'RETURN_IN_TRANSIT', 'CANCELLED'],
  RETURN_PICKUP_ASSIGNED: ['RETURN_IN_TRANSIT', 'RETURNED', 'CANCELLED'],
  RETURN_PENDING: ['RETURN_IN_TRANSIT', 'RETURNED', 'CANCELLED'],
  RETURN_IN_TRANSIT: ['RETURNED', 'CANCELLED'],
  RETURNED: ['REFUND_PENDING', 'REFUNDED'],
  REFUND_PENDING: ['REFUNDED', 'CANCELLED'],
  REFUNDED: [],
  CANCELLED: ['REFUND_PENDING', 'REFUNDED'],
  // Legacy aliases
  placed: ['accepted', 'preparing', 'packed', 'CONFIRMED', 'PICKING', 'cancelled'],
  accepted: ['preparing', 'packed', 'ready', 'CONFIRMED', 'PACKED', 'cancelled'],
  preparing: ['packed', 'ready', 'PACKED', 'cancelled'],
  packed: ['ready', 'partner_assigned', 'picked_up', 'out_for_delivery', 'OUT_FOR_DELIVERY'],
  ready: ['partner_assigned', 'picked_up', 'out_for_delivery', 'OUT_FOR_DELIVERY'],
  partner_assigned: ['picked_up', 'out_for_delivery', 'OUT_FOR_DELIVERY'],
  picked_up: ['out_for_delivery', 'delivered', 'DELIVERED'],
  out_for_delivery: ['delivered', 'DELIVERY_FAILED', 'DELIVERED', 'cancelled'],
  delivered: ['RETURN_REQUESTED', 'REFUND_PENDING'],
  cancelled: ['REFUND_PENDING', 'REFUNDED']
};

export function canTransitionOrder(currentStatus: string, targetStatus: string): boolean {
  if (!currentStatus || !targetStatus) return false;
  if (currentStatus === targetStatus) return true; // Idempotent same-state check
  const allowed = VALID_TRANSITIONS[currentStatus] || [];
  return allowed.includes(targetStatus);
}

export const VALID_ORDER_TRANSITIONS = VALID_TRANSITIONS;
export const isAllowedTransition = canTransitionOrder;

export function assertOrderTransition(currentStatus: string, targetStatus: string, orderId?: string): void {
  if (!canTransitionOrder(currentStatus, targetStatus)) {
    throw new Error(`Illegal order transition from ${currentStatus} to ${targetStatus} for order ${orderId || 'unknown'}`);
  }
}

// ── Append-Only Audit Logging ──────────────────────────────────────────────────
export async function recordOrderAuditLog(params: {
  orderId: string;
  orderNumber: string;
  actorId: string;
  actorRole: string;
  action: string;
  oldStatus?: string;
  newStatus?: string;
  reason?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  const auditId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const auditEntry: OrderAuditLog = {
    id: auditId,
    orderId: params.orderId,
    orderNumber: params.orderNumber,
    actorId: params.actorId || 'system',
    actorRole: params.actorRole || 'system',
    action: params.action,
    oldStatus: params.oldStatus,
    newStatus: params.newStatus,
    reason: params.reason,
    metadata: params.metadata,
    createdAt: new Date().toISOString()
  };

  // 1. Write to PostgreSQL audit_logs & order_audit_logs if available
  try {
    const pool = getPostgresPool();
    if (pool) {
      await pool.query(
        `INSERT INTO order_audit_logs 
         (id, order_id, order_number, actor_id, actor_role, action, old_status, new_status, reason, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [
          auditId,
          params.orderId,
          params.orderNumber,
          params.actorId || 'system',
          params.actorRole || 'system',
          params.action,
          params.oldStatus || null,
          params.newStatus || null,
          params.reason || null,
          JSON.stringify(params.metadata || {})
        ]
      );
    }
  } catch (err: any) {
    console.warn('[Audit Log Postgres Non-Fatal Error]', err.message);
  }

  // 2. Write to Firestore order_audit_logs
  try {
    if (isFirebaseConfigured() && db) {
      await setDoc(doc(db, 'order_audit_logs', auditId), auditEntry);
    }
  } catch (err: any) {
    console.warn('[Audit Log Firestore Non-Fatal Error]', err.message);
  }
}
