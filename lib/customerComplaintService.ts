/**
 * PocketKirana — Customer Complaint & Issue Service
 * Handles complaint creation (damaged, expired, wrong product, etc.), evidence uploads,
 * SLA window checking (48h default), and Admin resolution (refund / replacement).
 */

import { OrderIssueReport, OrderIssueType, OrderIssueStatus, OrderIssueResolution, Order } from '@/types';
import { getPostgresPool } from './postgres';
import { db, isFirebaseConfigured } from './firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { recordOrderAuditLog } from './orderStateMachine';

export const DEFAULT_COMPLAINT_WINDOW_HOURS = 48;

export function calculateComplaintSlaStatus(createdAt: string, status: OrderIssueStatus): {
  isBreached: boolean;
  hoursRemaining: number;
} {
  if (['RESOLVED', 'CLOSED', 'REPLACED', 'REJECTED'].includes(status)) {
    return { isBreached: false, hoursRemaining: 0 };
  }
  const createdTime = new Date(createdAt).getTime();
  const elapsedHours = (Date.now() - createdTime) / (1000 * 60 * 60);
  const targetSlaHours = 4; // 4 hours admin response SLA for quick grocery delivery complaints
  const hoursRemaining = Math.max(0, targetSlaHours - elapsedHours);
  const isBreached = elapsedHours > targetSlaHours;
  return { isBreached, hoursRemaining: Math.round(hoursRemaining * 10) / 10 };
}

export async function createCustomerComplaint(params: {
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  orderItemId?: string;
  productId?: string;
  productName: string;
  variantName?: string;
  issueType: OrderIssueType;
  description: string;
  photos?: string[];
  customerRequestedResolution?: 'REFUND' | 'REPLACEMENT' | 'STORE_CREDIT';
  batchNumber?: string;
  expiryDate?: string;
}): Promise<{ success: boolean; issue?: OrderIssueReport; error?: string }> {
  const issueId = `iss_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const ticketNumber = `CR-${params.orderNumber || params.orderId}-${Date.now().toString().slice(-4)}`;
  const nowIso = new Date().toISOString();

  // 1. Verify Order Delivery Status and Complaint Window
  if (isFirebaseConfigured() && db) {
    const orderRef = doc(db, 'orders', params.orderId);
    const snap = await getDoc(orderRef);
    if (!snap.exists()) {
      return { success: false, error: 'Order not found' };
    }
    const order = snap.data() as Order;

    // Check delivered
    const isDelivered = order.orderStatus === 'DELIVERED' || order.orderStatus === 'COMPLETED' || order.status === 'delivered';
    if (!isDelivered) {
      return { success: false, error: 'Complaints can only be filed after the order has been delivered.' };
    }

    // Check 48h complaint window
    const deliveredAt = order.deliveredAt || order.updatedAt || order.placedAt;
    if (deliveredAt) {
      const deliveredTime = new Date(deliveredAt).getTime();
      const elapsedHours = (Date.now() - deliveredTime) / (1000 * 60 * 60);
      if (elapsedHours > DEFAULT_COMPLAINT_WINDOW_HOURS) {
        return {
          success: false,
          error: `The complaint window for this order has expired (${DEFAULT_COMPLAINT_WINDOW_HOURS} hours policy).`
        };
      }
    }
  }

  const issueReport: OrderIssueReport = {
    id: issueId,
    ticketNumber,
    orderId: params.orderId,
    orderNumber: params.orderNumber,
    customerId: params.customerId,
    customerName: params.customerName,
    customerPhone: params.customerPhone,
    orderItemId: params.orderItemId,
    productId: params.productId,
    productName: params.productName,
    variantName: params.variantName,
    issueType: params.issueType,
    description: params.description,
    photos: params.photos || [],
    customerRequestedResolution: params.customerRequestedResolution || 'REFUND',
    status: 'OPEN',
    batchNumber: params.batchNumber,
    expiryDate: params.expiryDate,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  try {
    // 1. Save to Firestore
    if (isFirebaseConfigured() && db) {
      await setDoc(doc(db, 'order_issue_reports', issueId), issueReport);

      // Audit log
      await recordOrderAuditLog({
        orderId: params.orderId,
        orderNumber: params.orderNumber,
        actorId: params.customerId,
        actorRole: 'customer',
        action: 'CUSTOMER_COMPLAINT_CREATED',
        reason: `${params.issueType}: ${params.description.slice(0, 100)}`,
        metadata: {
          ticketNumber,
          productName: params.productName,
          issueType: params.issueType,
          requestedResolution: params.customerRequestedResolution
        }
      });
    }

    // 2. Save to PostgreSQL
    try {
      const pool = getPostgresPool();
      if (pool) {
        await pool.query(
          `INSERT INTO order_issue_reports 
           (id, ticket_number, order_id, order_number, customer_id, customer_name, customer_phone, order_item_id, product_id, product_name, variant_name, issue_type, description, photos, customer_requested_resolution, status, batch_number, expiry_date, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW())
           ON CONFLICT (id) DO NOTHING`,
          [
            issueId,
            ticketNumber,
            params.orderId,
            params.orderNumber,
            params.customerId,
            params.customerName || null,
            params.customerPhone || null,
            params.orderItemId || null,
            params.productId || null,
            params.productName,
            params.variantName || null,
            params.issueType,
            params.description,
            JSON.stringify(params.photos || []),
            params.customerRequestedResolution || 'REFUND',
            'OPEN',
            params.batchNumber || null,
            params.expiryDate || null
          ]
        );
      }
    } catch (err: any) {
      console.warn('[Postgres createCustomerComplaint Non-Fatal]', err.message);
    }

    return { success: true, issue: issueReport };
  } catch (error: any) {
    console.error('[createCustomerComplaint Error]', error);
    return { success: false, error: error.message || 'Failed to submit complaint' };
  }
}

export async function fetchCustomerIssuesFS(filter?: {
  customerId?: string;
  orderId?: string;
  status?: OrderIssueStatus;
}): Promise<OrderIssueReport[]> {
  if (!isFirebaseConfigured() || !db) return [];
  try {
    const col = collection(db, 'order_issue_reports');
    let q = query(col, orderBy('createdAt', 'desc'), limit(100));

    if (filter?.customerId) {
      q = query(col, where('customerId', '==', filter.customerId), orderBy('createdAt', 'desc'), limit(50));
    } else if (filter?.orderId) {
      q = query(col, where('orderId', '==', filter.orderId), orderBy('createdAt', 'desc'), limit(50));
    }

    const snap = await getDocs(q);
    let results = snap.docs.map((d) => ({ id: d.id, ...d.data() } as OrderIssueReport));

    if (filter?.status) {
      results = results.filter((r) => r.status === filter.status);
    }

    return results;
  } catch (err) {
    console.warn('[fetchCustomerIssuesFS Error]', err);
    return [];
  }
}

export async function resolveCustomerIssueFS(params: {
  issueId: string;
  adminId: string;
  adminName: string;
  action: 'APPROVE_REFUND' | 'APPROVE_REPLACEMENT' | 'REJECT';
  refundAmount?: number;
  adminNotes?: string;
  rejectionReason?: string;
}): Promise<{ success: boolean; replacementOrderId?: string; error?: string }> {
  const nowIso = new Date().toISOString();

  try {
    if (!isFirebaseConfigured() || !db) {
      return { success: false, error: 'Database not connected' };
    }

    const issueRef = doc(db, 'order_issue_reports', params.issueId);
    const issueSnap = await getDoc(issueRef);
    if (!issueSnap.exists()) {
      return { success: false, error: 'Complaint issue not found' };
    }

    const issueData = issueSnap.data() as OrderIssueReport;
    let newStatus: OrderIssueStatus = 'UNDER_REVIEW';
    let resolutionType: OrderIssueResolution = 'NO_ACTION';
    let replacementOrderId: string | undefined = undefined;

    if (params.action === 'APPROVE_REFUND') {
      newStatus = 'REFUND_PENDING';
      resolutionType = 'REFUND';

      // Create refund record
      const refundId = `ref_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await setDoc(doc(db, 'refunds', refundId), {
        id: refundId,
        orderId: issueData.orderId,
        orderNumber: issueData.orderNumber,
        issueId: params.issueId,
        ticketNumber: issueData.ticketNumber,
        amount: params.refundAmount || 0,
        reason: issueData.description,
        status: 'initiated',
        createdAt: nowIso
      });

      // Update parent order
      await updateDoc(doc(db, 'orders', issueData.orderId), {
        paymentStatus: 'refunded',
        refundStatus: 'PENDING',
        updatedAt: nowIso
      });
    } else if (params.action === 'APPROVE_REPLACEMENT') {
      newStatus = 'REPLACEMENT_PENDING';
      resolutionType = 'REPLACEMENT';
      replacementOrderId = `repl_${Date.now()}_${issueData.orderNumber}`;

      // Update parent order
      await updateDoc(doc(db, 'orders', issueData.orderId), {
        replacementOrderId,
        replacementStatus: 'PENDING',
        updatedAt: nowIso
      });
    } else if (params.action === 'REJECT') {
      newStatus = 'REJECTED';
      resolutionType = 'NO_ACTION';
    }

    // Update issue document
    await updateDoc(issueRef, {
      status: newStatus,
      resolutionType,
      refundAmount: params.refundAmount || 0,
      replacementOrderId: replacementOrderId || null,
      adminNotes: params.adminNotes || params.rejectionReason || null,
      resolvedBy: params.adminName,
      resolvedAt: nowIso,
      updatedAt: nowIso
    });

    // Audit log
    await recordOrderAuditLog({
      orderId: issueData.orderId,
      orderNumber: issueData.orderNumber,
      actorId: params.adminId,
      actorRole: 'admin',
      action: `CUSTOMER_ISSUE_${params.action}`,
      oldStatus: issueData.status,
      newStatus,
      reason: params.adminNotes || params.rejectionReason,
      metadata: {
        issueId: params.issueId,
        ticketNumber: issueData.ticketNumber,
        action: params.action,
        refundAmount: params.refundAmount,
        replacementOrderId
      }
    });

    // Sync to PostgreSQL
    try {
      const pool = getPostgresPool();
      if (pool) {
        await pool.query(
          `UPDATE order_issue_reports 
           SET status = $1, resolution_type = $2, refund_amount = $3, replacement_order_id = $4, admin_notes = $5, resolved_by = $6, resolved_at = NOW(), updated_at = NOW()
           WHERE id = $7`,
          [
            newStatus,
            resolutionType,
            params.refundAmount || 0,
            replacementOrderId || null,
            params.adminNotes || params.rejectionReason || null,
            params.adminName,
            params.issueId
          ]
        );
      }
    } catch (err: any) {
      console.warn('[Postgres resolveCustomerIssue Non-Fatal]', err.message);
    }

    return { success: true, replacementOrderId };
  } catch (error: any) {
    console.error('[resolveCustomerIssueFS Error]', error);
    return { success: false, error: error.message || 'Failed to update issue' };
  }
}
