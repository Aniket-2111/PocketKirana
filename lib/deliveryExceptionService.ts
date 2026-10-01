/**
 * PocketKirana — Delivery Exception Service
 * Handles delivery partner arrival, waiting timer, call attempts, and failed delivery exception logging.
 */

import { DeliveryExceptionRecord, DeliveryExceptionType, OrderReturn } from '@/types';
import { getPostgresPool } from './postgres';
import { db, isFirebaseConfigured } from './firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { recordOrderAuditLog } from './orderStateMachine';

export async function recordDeliveryArrival(params: {
  orderId: string;
  partnerId: string;
  partnerName?: string;
  latitude?: number;
  longitude?: number;
}): Promise<{ success: boolean; arrivedAt: string; error?: string }> {
  const arrivedAt = new Date().toISOString();

  try {
    // 1. Update Firestore Order & active assignment
    if (isFirebaseConfigured() && db) {
      const orderRef = doc(db, 'orders', params.orderId);
      const snap = await getDoc(orderRef);
      if (snap.exists()) {
        const orderData = snap.data();
        await updateDoc(orderRef, {
          orderStatus: 'ARRIVED_AT_CUSTOMER',
          arrivedAtCustomerTimestamp: arrivedAt,
          updatedAt: arrivedAt
        });

        await recordOrderAuditLog({
          orderId: params.orderId,
          orderNumber: orderData.orderNumber || params.orderId,
          actorId: params.partnerId,
          actorRole: 'delivery_partner',
          action: 'DELIVERY_PARTNER_ARRIVED_AT_CUSTOMER',
          oldStatus: orderData.orderStatus,
          newStatus: 'ARRIVED_AT_CUSTOMER',
          metadata: { latitude: params.latitude, longitude: params.longitude, arrivedAt }
        });
      }
    }

    // 2. Update PostgreSQL orders table
    try {
      const pool = getPostgresPool();
      if (pool) {
        await pool.query(
          `UPDATE orders SET order_status = 'ARRIVED_AT_CUSTOMER', delivery_status = 'arrived_at_customer', updated_at = NOW() WHERE id = $1`,
          [params.orderId]
        );
      }
    } catch (err: any) {
      console.warn('[Postgres recordDeliveryArrival Non-Fatal]', err.message);
    }

    return { success: true, arrivedAt };
  } catch (error: any) {
    console.error('[recordDeliveryArrival Error]', error);
    return { success: false, arrivedAt, error: error.message || 'Failed to record arrival' };
  }
}

export async function recordDeliveryCallAttempt(params: {
  orderId: string;
  partnerId: string;
  attemptNumber: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const timestamp = new Date().toISOString();
    if (isFirebaseConfigured() && db) {
      const orderRef = doc(db, 'orders', params.orderId);
      const snap = await getDoc(orderRef);
      if (snap.exists()) {
        const orderData = snap.data();
        const existingAttempts = orderData.callAttempts || 0;
        await updateDoc(orderRef, {
          callAttempts: existingAttempts + 1,
          lastCallAttemptAt: timestamp,
          updatedAt: timestamp
        });

        await recordOrderAuditLog({
          orderId: params.orderId,
          orderNumber: orderData.orderNumber || params.orderId,
          actorId: params.partnerId,
          actorRole: 'delivery_partner',
          action: 'CUSTOMER_CALL_ATTEMPTED',
          metadata: { attemptNumber: params.attemptNumber, timestamp }
        });
      }
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function recordDeliveryFailure(params: {
  orderId: string;
  orderNumber: string;
  partnerId: string;
  partnerName?: string;
  exceptionType: DeliveryExceptionType;
  reason: string;
  notes?: string;
  callAttempts?: number;
  arrivedAt?: string;
  waitingSeconds?: number;
  latitude?: number;
  longitude?: number;
  photoEvidenceUrl?: string;
}): Promise<{ success: boolean; exceptionId?: string; error?: string }> {
  const exceptionId = `dexc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const returnNumber = `RET-${params.orderNumber || params.orderId}-${Date.now().toString().slice(-4)}`;
  const returnId = `ret_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const nowIso = new Date().toISOString();

  const exceptionRecord: DeliveryExceptionRecord = {
    id: exceptionId,
    orderId: params.orderId,
    orderNumber: params.orderNumber,
    partnerId: params.partnerId,
    deliveryPartnerId: params.partnerId,
    partnerName: params.partnerName || 'Delivery Partner',
    deliveryPartnerName: params.partnerName || 'Delivery Partner',
    exceptionType: params.exceptionType,
    reason: params.reason,
    notes: params.notes,
    callAttempts: params.callAttempts || 0,
    arrivedAt: params.arrivedAt,
    waitingSeconds: params.waitingSeconds || 0,
    failedAt: nowIso,
    latitude: params.latitude,
    longitude: params.longitude,
    photoEvidenceUrl: params.photoEvidenceUrl,
    status: 'RETURN_INITIATED',
    createdAt: nowIso,
    updatedAt: nowIso
  };

  const returnRecord: OrderReturn = {
    id: returnId,
    returnNumber,
    orderId: params.orderId,
    orderNumber: params.orderNumber,
    returnType: 'FAILED_DELIVERY',
    status: 'PENDING',
    assignedPartnerId: params.partnerId,
    assignedPartnerName: params.partnerName || 'Delivery Partner',
    initiatedBy: params.partnerId,
    initiatedAt: nowIso,
    inspectionStatus: 'PENDING',
    totalItems: 1,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  try {
    // 1. Update Firestore
    if (isFirebaseConfigured() && db) {
      // Save exception
      await setDoc(doc(db, 'delivery_exceptions', exceptionId), exceptionRecord);
      // Save return
      await setDoc(doc(db, 'order_returns', returnId), returnRecord);

      // Transition order
      const orderRef = doc(db, 'orders', params.orderId);
      const orderSnap = await getDoc(orderRef);
      const oldStatus = orderSnap.exists() ? orderSnap.data().orderStatus : 'OUT_FOR_DELIVERY';

      await updateDoc(orderRef, {
        orderStatus: 'DELIVERY_FAILED',
        deliveryStatus: 'failed',
        deliveryExceptionId: exceptionId,
        returnId,
        returnStatus: 'PENDING',
        cancellationReason: `Delivery Failed: ${params.reason}`,
        updatedAt: nowIso
      });

      // Audit log
      await recordOrderAuditLog({
        orderId: params.orderId,
        orderNumber: params.orderNumber,
        actorId: params.partnerId,
        actorRole: 'delivery_partner',
        action: 'ORDER_DELIVERY_FAILED',
        oldStatus,
        newStatus: 'DELIVERY_FAILED',
        reason: params.reason,
        metadata: {
          exceptionType: params.exceptionType,
          callAttempts: params.callAttempts,
          waitingSeconds: params.waitingSeconds,
          returnNumber
        }
      });
    }

    // 2. Update PostgreSQL
    try {
      const pool = getPostgresPool();
      if (pool) {
        await pool.query(
          `INSERT INTO delivery_exceptions 
           (id, order_id, order_number, delivery_partner_id, delivery_partner_name, exception_type, reason, notes, call_attempts, arrived_at, waiting_seconds, failed_at, latitude, longitude, photo_evidence_url, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
           ON CONFLICT (id) DO NOTHING`,
          [
            exceptionId,
            params.orderId,
            params.orderNumber,
            params.partnerId,
            params.partnerName || 'Delivery Partner',
            params.exceptionType,
            params.reason,
            params.notes || null,
            params.callAttempts || 0,
            params.arrivedAt || null,
            params.waitingSeconds || 0,
            nowIso,
            params.latitude || null,
            params.longitude || null,
            params.photoEvidenceUrl || null,
            'RETURN_INITIATED'
          ]
        );

        await pool.query(
          `INSERT INTO order_returns 
           (id, return_number, order_id, order_number, return_type, status, assigned_partner_id, assigned_partner_name, initiated_by, initiated_at, inspection_status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
           ON CONFLICT (id) DO NOTHING`,
          [
            returnId,
            returnNumber,
            params.orderId,
            params.orderNumber,
            'FAILED_DELIVERY',
            'PENDING',
            params.partnerId,
            params.partnerName || 'Delivery Partner',
            params.partnerId,
            nowIso,
            'PENDING'
          ]
        );

        await pool.query(
          `UPDATE orders SET order_status = 'DELIVERY_FAILED', delivery_status = 'failed', cancellation_reason = $1, updated_at = NOW() WHERE id = $2`,
          [`Delivery Failed: ${params.reason}`, params.orderId]
        );
      }
    } catch (err: any) {
      console.warn('[Postgres recordDeliveryFailure Non-Fatal]', err.message);
    }

    return { success: true, exceptionId };
  } catch (error: any) {
    console.error('[recordDeliveryFailure Error]', error);
    return { success: false, error: error.message || 'Failed to record delivery failure' };
  }
}

export async function fetchDeliveryExceptionsFS(): Promise<DeliveryExceptionRecord[]> {
  if (!isFirebaseConfigured() || !db) return [];
  try {
    const q = query(collection(db, 'delivery_exceptions'), orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DeliveryExceptionRecord));
  } catch (err) {
    console.warn('[fetchDeliveryExceptionsFS Error]', err);
    return [];
  }
}
