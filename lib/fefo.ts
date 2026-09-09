/**
 * PocketKirana — FEFO (First Expiry, First Out) Inventory & Batch Utility
 *
 * Provides batch recommendations prioritized by earliest expiration date.
 * Also manages ledger entries in inventory_events.
 */

import { PoolClient } from 'pg';
import { getPostgresPool } from './postgres';

export interface BatchPickRecommendation {
  batchId: string;
  batchNumber: string | null;
  expiryDate: string | null; // YYYY-MM-DD or null
  availableQty: number;
  pickQty: number;
  reason: 'earliest_expiry' | 'fifo_fallback' | 'no_expiry';
}

export interface FefoResult {
  variantId: string;
  warehouseId: string;
  requestedQty: number;
  fulfilledQty: number;
  isFullyFulfilled: boolean;
  allocations: BatchPickRecommendation[];
}

/**
 * Recommends which inventory batches to pick for a given variant and warehouse using FEFO.
 *
 * Rules:
 *   1. Exclude expired batches (expiry_date < TODAY) or status != 'ACTIVE'.
 *   2. Order by expiry_date ASC NULLS LAST (earliest expiry first).
 *   3. Secondary sort by received_at ASC (FIFO fallback for identical or null expiry dates).
 *   4. Allocate stock across batches until requested quantity is fulfilled.
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

  let remaining = requestedQty;
  const allocations: BatchPickRecommendation[] = [];

  for (const row of res.rows) {
    if (remaining <= 0) break;

    const available = parseInt(row.available_qty, 10);
    const pickQty = Math.min(available, remaining);

    let reason: 'earliest_expiry' | 'fifo_fallback' | 'no_expiry' = 'no_expiry';
    if (row.expiry_date) {
      reason = 'earliest_expiry';
    } else {
      reason = 'fifo_fallback';
    }

    allocations.push({
      batchId: row.batch_id,
      batchNumber: row.batch_number,
      expiryDate: row.expiry_date,
      availableQty: available,
      pickQty,
      reason,
    });

    remaining -= pickQty;
  }

  const fulfilledQty = requestedQty - remaining;

  return {
    variantId,
    warehouseId,
    requestedQty,
    fulfilledQty,
    isFullyFulfilled: remaining === 0,
    allocations,
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
