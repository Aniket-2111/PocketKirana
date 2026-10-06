/**
 * PocketKirana — FEFO (First Expiry, First Out) Inventory & Batch Utility
 *
 * Provides batch recommendations prioritized by earliest expiration date.
 * Also manages ledger entries in inventory_events and transactional reservations.
 */

import { PoolClient } from 'pg';
import { getPostgresPool } from './postgres';

export interface BatchCandidate {
  id: string;
  batchNumber: string | null;
  expiryDate: string | Date | null; // YYYY-MM-DD, Date or null
  availableQty: number;
  receivedAt?: string | Date | null;
  status?: string;
}

export interface BatchPickRecommendation {
  batchId: string;
  batchNumber: string | null;
  expiryDate: string | null;
  availableQty: number;
  pickQty: number;
  reason: 'earliest_expiry' | 'fifo_fallback' | 'no_expiry';
}

export interface FefoResult {
  variantId: string;
  warehouseId?: string;
  requestedQty: number;
  fulfilledQty: number;
  isFullyFulfilled: boolean;
  allocations: BatchPickRecommendation[];
}

/**
 * Pure FEFO allocation algorithm.
 * Filters out expired batches, sorts by earliest expiry (NULLS LAST) and FIFO receipt date,
 * and allocates requested quantity across matching batches.
 */
export function allocateFefoBatches(
  batches: BatchCandidate[],
  requestedQty: number,
  currentDate: Date = new Date()
): { fulfilledQty: number; isFullyFulfilled: boolean; allocations: BatchPickRecommendation[] } {
  const todayStr = currentDate.toISOString().split('T')[0];

  // 1. Filter out expired batches & inactive batches
  const validBatches = batches.filter((b) => {
    if (b.status && b.status !== 'ACTIVE') return false;
    if (b.availableQty <= 0) return false;
    if (b.expiryDate) {
      const expStr = typeof b.expiryDate === 'string'
        ? b.expiryDate.split('T')[0]
        : b.expiryDate.toISOString().split('T')[0];
      if (expStr < todayStr) return false; // Expired
    }
    return true;
  });

  // 2. Sort: Earliest expiry first (NULLS LAST), then receivedAt ASC (FIFO fallback)
  validBatches.sort((a, b) => {
    if (a.expiryDate && b.expiryDate) {
      const aExp = new Date(a.expiryDate).getTime();
      const bExp = new Date(b.expiryDate).getTime();
      if (aExp !== bExp) return aExp - bExp;
    } else if (a.expiryDate && !b.expiryDate) {
      return -1; // non-null expiry comes before null expiry
    } else if (!a.expiryDate && b.expiryDate) {
      return 1;
    }

    // FIFO secondary sort
    const aRec = a.receivedAt ? new Date(a.receivedAt).getTime() : 0;
    const bRec = b.receivedAt ? new Date(b.receivedAt).getTime() : 0;
    return aRec - bRec;
  });

  let remaining = requestedQty;
  const allocations: BatchPickRecommendation[] = [];

  for (const b of validBatches) {
    if (remaining <= 0) break;

    const pickQty = Math.min(b.availableQty, remaining);
    const expStr = b.expiryDate
      ? (typeof b.expiryDate === 'string' ? b.expiryDate.split('T')[0] : b.expiryDate.toISOString().split('T')[0])
      : null;

    allocations.push({
      batchId: b.id,
      batchNumber: b.batchNumber,
      expiryDate: expStr,
      availableQty: b.availableQty,
      pickQty,
      reason: expStr ? 'earliest_expiry' : 'fifo_fallback',
    });

    remaining -= pickQty;
  }

  return {
    fulfilledQty: requestedQty - remaining,
    isFullyFulfilled: remaining === 0,
    allocations,
  };
}

/**
 * Recommends which inventory batches to pick for a given variant and warehouse using FEFO in PostgreSQL.
 */
export async function getFefoRecommendation(
  variantId: string,
  warehouseId: string,
  requestedQty: number,
  client?: PoolClient
): Promise<FefoResult> {
  const pool = client || getPostgresPool();

  const query = `
    SELECT 
      ib.id AS batch_id,
      ib.batch_number,
      ib.expiry_date::text AS expiry_date,
      ib.received_at,
      bal.available_qty
    FROM inventory_balances bal
    JOIN inventory_batches ib ON ib.id = bal.batch_id
    WHERE bal.warehouse_id = $1
      AND bal.variant_id = $2
      AND bal.available_qty > 0
      AND ib.status = 'ACTIVE'
      AND (ib.expiry_date IS NULL OR ib.expiry_date >= CURRENT_DATE)
    ORDER BY 
      ib.expiry_date ASC NULLS LAST,
      ib.received_at ASC
  `;

  const res = await pool.query(query, [warehouseId, variantId]);

  const candidates: BatchCandidate[] = res.rows.map((row) => ({
    id: row.batch_id,
    batchNumber: row.batch_number,
    expiryDate: row.expiry_date,
    availableQty: parseInt(row.available_qty, 10),
    receivedAt: row.received_at,
  }));

  const allocationResult = allocateFefoBatches(candidates, requestedQty);

  return {
    variantId,
    warehouseId,
    requestedQty,
    ...allocationResult,
  };
}

export type InventoryEventType =
  | 'RECEIVED'
  | 'RESERVED'
  | 'RELEASED'
  | 'PICKED'
  | 'PACKED'
  | 'SOLD'
  | 'DAMAGED'
  | 'EXPIRED'
  | 'DISPOSED'
  | 'ADJUSTED'
  | 'RETURNED'
  | 'TRANSFERRED';

export interface InventoryEventInput {
  warehouseId?: string;
  variantId?: string;
  batchId?: string;
  eventType: InventoryEventType;
  quantity: number;
  balanceAfter?: number;
  referenceType?: string;
  referenceId?: string;
  performedBy?: string;
  performedByRole?: string;
  notes?: string;
}

/**
 * Records an immutable event in the inventory_events ledger.
 * Must be executed within an active database transaction/client.
 */
export async function recordInventoryEvent(
  client: PoolClient,
  event: InventoryEventInput
): Promise<number> {
  const res = await client.query(
    `INSERT INTO inventory_events
       (warehouse_id, variant_id, batch_id, event_type, quantity,
        balance_after, reference_type, reference_id, performed_by, performed_by_role, notes, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
     RETURNING id`,
    [
      event.warehouseId || null,
      event.variantId || null,
      event.batchId || null,
      event.eventType,
      Math.abs(event.quantity),
      event.balanceAfter ?? null,
      event.referenceType || null,
      event.referenceId || null,
      event.performedBy || null,
      event.performedByRole || null,
      event.notes || null,
    ]
  );

  return parseInt(res.rows[0].id, 10);
}

/**
 * Atomically releases all stock reservations for an order and logs 'RELEASED' ledger entries.
 */
export async function releaseFefoReservation(
  client: PoolClient,
  orderId: string,
  reason: 'expired' | 'cancelled' | 'rejected' = 'cancelled'
): Promise<number> {
  // 1. Fetch active reservations for order
  const resQuery = `
    SELECT id, store_id, variant_id, quantity
    FROM stock_reservations
    WHERE order_id = $1 AND status = 'reserved'
    FOR UPDATE
  `;
  const reservations = await client.query(resQuery, [orderId]);
  if (reservations.rowCount === 0) return 0;

  let totalReleased = 0;

  for (const row of reservations.rows) {
    const { id, store_id, variant_id, quantity } = row;

    // 2. Return reserved stock back to available in inventory
    await client.query(
      `UPDATE inventory
       SET reserved_quantity = GREATEST(0, reserved_quantity - $1)
       WHERE (variant_id = $2 OR id = $2) AND store_id = $3`,
      [quantity, variant_id, store_id]
    );

    // Also update inventory_balances if table exists
    try {
      await client.query(
        `UPDATE inventory_balances
         SET reserved_qty = GREATEST(0, reserved_qty - $1),
             available_qty = available_qty + $1
         WHERE variant_id = $2`,
        [quantity, variant_id]
      );
    } catch {
      // safe fallback
    }

    // 3. Mark reservation as released
    await client.query(
      `UPDATE stock_reservations
       SET status = 'released'
       WHERE id = $1`,
      [id]
    );

    // 4. Record ledger entry
    try {
      await recordInventoryEvent(client, {
        variantId: variant_id,
        eventType: 'RELEASED',
        quantity,
        referenceType: 'ORDER',
        referenceId: orderId,
        notes: `Stock reservation released: ${reason}`,
      });
    } catch {
      // safe fallback
    }

    totalReleased += quantity;
  }

  return totalReleased;
}
