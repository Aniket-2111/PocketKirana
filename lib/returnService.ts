/**
 * PocketKirana — Return & Inventory Safety Inspection Service
 * 
 * Manages physical return workflows, hub receipt, and grocery inventory inspections.
 * CRITICAL GROCERY SAFETY RULE: Returned inventory does NOT automatically become sellable.
 * Only verified RESTOCKABLE items (unexpired and undamaged) are returned to available stock.
 */

import { OrderReturn, ReturnItemInspection, ItemInspectionDisposition, ReturnStatus } from '@/types';
import { getPostgresPool } from './postgres';
import { db, isFirebaseConfigured } from './firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { recordOrderAuditLog } from './orderStateMachine';

export async function fetchOrderReturnsFS(filter?: {
  status?: ReturnStatus;
  partnerId?: string;
}): Promise<OrderReturn[]> {
  if (!isFirebaseConfigured() || !db) return [];
  try {
    const col = collection(db, 'order_returns');
    let q = query(col, orderBy('createdAt', 'desc'), limit(100));

    if (filter?.partnerId) {
      q = query(col, where('assignedPartnerId', '==', filter.partnerId), orderBy('createdAt', 'desc'), limit(50));
    }

    const snap = await getDocs(q);
    let results = snap.docs.map((d) => ({ id: d.id, ...d.data() } as OrderReturn));

    if (filter?.status) {
      results = results.filter((r) => r.status === filter.status);
    }

    return results;
  } catch (err) {
    console.warn('[fetchOrderReturnsFS Error]', err);
    return [];
  }
}

export async function updateReturnStatusFS(params: {
  returnId: string;
  status: ReturnStatus;
  actorId: string;
  actorName: string;
  actorRole: 'admin' | 'delivery_partner' | 'picker';
  assignedPartnerId?: string;
  assignedPartnerName?: string;
}): Promise<{ success: boolean; error?: string }> {
  const nowIso = new Date().toISOString();

  try {
    if (!isFirebaseConfigured() || !db) {
      return { success: false, error: 'Database not connected' };
    }

    const returnRef = doc(db, 'order_returns', params.returnId);
    const returnSnap = await getDoc(returnRef);
    if (!returnSnap.exists()) {
      return { success: false, error: 'Return record not found' };
    }

    const returnData = returnSnap.data() as OrderReturn;
    const updates: Partial<OrderReturn> = {
      status: params.status,
      updatedAt: nowIso
    };

    if (params.status === 'ASSIGNED' && params.assignedPartnerId) {
      updates.assignedPartnerId = params.assignedPartnerId;
      updates.assignedPartnerName = params.assignedPartnerName || 'Delivery Partner';
    } else if (params.status === 'IN_TRANSIT') {
      updates.pickedUpAt = nowIso;
    } else if (params.status === 'RECEIVED') {
      updates.receivedAt = nowIso;
      updates.receivedBy = params.actorName;
    }

    await updateDoc(returnRef, updates);

    // Update parent order status if appropriate
    const orderRef = doc(db, 'orders', returnData.orderId);
    if (params.status === 'IN_TRANSIT') {
      await updateDoc(orderRef, { orderStatus: 'RETURN_IN_TRANSIT', returnStatus: 'IN_TRANSIT', updatedAt: nowIso });
    } else if (params.status === 'RECEIVED') {
      await updateDoc(orderRef, { orderStatus: 'RETURNED', returnStatus: 'RECEIVED', updatedAt: nowIso });
    }

    // Audit log
    await recordOrderAuditLog({
      orderId: returnData.orderId,
      orderNumber: returnData.orderNumber,
      actorId: params.actorId,
      actorRole: params.actorRole,
      action: `RETURN_STATUS_${params.status}`,
      oldStatus: returnData.status,
      newStatus: params.status,
      metadata: { returnId: params.returnId, returnNumber: returnData.returnNumber }
    });

    // PostgreSQL sync
    try {
      const pool = getPostgresPool();
      if (pool) {
        await pool.query(
          `UPDATE order_returns 
           SET status = $1, assigned_partner_id = COALESCE($2, assigned_partner_id), assigned_partner_name = COALESCE($3, assigned_partner_name), updated_at = NOW()
           WHERE id = $4`,
          [params.status, params.assignedPartnerId || null, params.assignedPartnerName || null, params.returnId]
        );
      }
    } catch (err: any) {
      console.warn('[Postgres updateReturnStatus Non-Fatal]', err.message);
    }

    return { success: true };
  } catch (err: any) {
    console.error('[updateReturnStatusFS Error]', err);
    return { success: false, error: err.message };
  }
}

export async function recordReturnInspectionFS(params: {
  returnId: string;
  inspectedBy: string;
  inspectedByName: string;
  items: Array<{
    orderItemId?: string;
    productId?: string;
    variantId?: string;
    productName: string;
    quantity: number;
    batchId?: string;
    expiryDate?: string;
    disposition: ItemInspectionDisposition;
    notes?: string;
  }>;
}): Promise<{ success: boolean; error?: string }> {
  const nowIso = new Date().toISOString();

  try {
    if (!isFirebaseConfigured() || !db) {
      return { success: false, error: 'Database not connected' };
    }

    const returnRef = doc(db, 'order_returns', params.returnId);
    const returnSnap = await getDoc(returnRef);
    if (!returnSnap.exists()) {
      return { success: false, error: 'Return record not found' };
    }

    const returnData = returnSnap.data() as OrderReturn;

    // Save each item inspection
    for (const item of params.items) {
      const inspId = `insp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const inspectionRecord: ReturnItemInspection = {
        id: inspId,
        returnId: params.returnId,
        orderItemId: item.orderItemId,
        productId: item.productId,
        variantId: item.variantId,
        productName: item.productName,
        quantity: item.quantity,
        batchId: item.batchId,
        expiryDate: item.expiryDate,
        disposition: item.disposition,
        notes: item.notes,
        inspectedBy: params.inspectedByName,
        inspectedAt: nowIso
      };

      await setDoc(doc(db, 'return_item_inspections', inspId), inspectionRecord);

      // CRITICAL INVENTORY SAFETY CHECK:
      // If RESTOCKABLE, increment stock safely.
      // If DAMAGED, EXPIRED, or DISPOSED, do NOT increment available inventory.
      if (item.disposition === 'RESTOCKABLE' && item.productId) {
        try {
          const prodRef = doc(db, 'products', item.productId);
          const prodSnap = await getDoc(prodRef);
          if (prodSnap.exists()) {
            const currentStock = prodSnap.data().stock || 0;
            await updateDoc(prodRef, {
              stock: currentStock + item.quantity,
              updatedAt: nowIso
            });
          }
        } catch (stockErr) {
          console.warn('[Stock Restock Non-Fatal Warning]', stockErr);
        }
      }
    }

    // Update return record to INSPECTED / COMPLETED
    await updateDoc(returnRef, {
      inspectionStatus: 'COMPLETED',
      status: 'INSPECTED',
      updatedAt: nowIso
    });

    // Audit log
    await recordOrderAuditLog({
      orderId: returnData.orderId,
      orderNumber: returnData.orderNumber,
      actorId: params.inspectedBy,
      actorRole: 'admin',
      action: 'RETURN_INSPECTION_COMPLETED',
      metadata: {
        returnId: params.returnId,
        returnNumber: returnData.returnNumber,
        itemCount: params.items.length,
        dispositions: params.items.map((i) => ({ name: i.productName, disposition: i.disposition, qty: i.quantity }))
      }
    });

    return { success: true };
  } catch (err: any) {
    console.error('[recordReturnInspectionFS Error]', err);
    return { success: false, error: err.message };
  }
}

export function isGroceryItemRestockable(disposition: ItemInspectionDisposition, expiryDate?: string): boolean {
  if (disposition !== 'RESTOCKABLE') return false;
  if (expiryDate) {
    const expTime = new Date(expiryDate).getTime();
    if (expTime < Date.now()) return false;
  }
  return true;
}

export function categorizeReturnDisposition(disposition: ItemInspectionDisposition): 'RESTOCK' | 'WRITE_OFF_DAMAGED' | 'WRITE_OFF_EXPIRED' | 'DISPOSE' {
  switch (disposition) {
    case 'RESTOCKABLE':
      return 'RESTOCK';
    case 'DAMAGED':
      return 'WRITE_OFF_DAMAGED';
    case 'EXPIRED':
      return 'WRITE_OFF_EXPIRED';
    case 'DISPOSED':
    default:
      return 'DISPOSE';
  }
}
