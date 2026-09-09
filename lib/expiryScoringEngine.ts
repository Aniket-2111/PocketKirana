/**
 * PocketKirana — Loss-Reduction Smart Inventory & Expiry Scoring Engine (v1.1.0)
 *
 * Evaluates inventory batches for expiry risk, generates commercial clearance recommendations,
 * creates targeted batch clearance promotions, and enforces 3-level expired stock blocking.
 */

import { PoolClient } from 'pg';
import { randomUUID } from 'crypto';
import { emitBusinessEvent } from './businessEventDispatcher';

export type ExpiryRiskLevel = 'NORMAL' | 'WATCH' | 'WARNING' | 'CLEARANCE_CANDIDATE' | 'EXPIRED';

export interface BatchExpiryRisk {
  batchId: string;
  batchNumber: string;
  variantId: string;
  productName: string;
  warehouseId: string;
  expiryDate: string;
  daysRemaining: number;
  availableStock: number;
  basePrice: number;
  riskLevel: ExpiryRiskLevel;
  recommendedDiscountPercent: number;
  recommendedClearancePrice: number;
  estimatedLossAvoidance: number;
  status: string;
}

/**
 * Calculates the expiry risk score and recommended clearance discount for a batch.
 */
export function evaluateBatchExpiryRisk(params: {
  batchId: string;
  batchNumber: string;
  variantId: string;
  productName: string;
  warehouseId: string;
  expiryDate: string;
  availableStock: number;
  basePrice: number;
  dailySalesVelocity?: number;
}): BatchExpiryRisk {
  const {
    batchId,
    batchNumber,
    variantId,
    productName,
    warehouseId,
    expiryDate,
    availableStock,
    basePrice,
    dailySalesVelocity = 2,
  } = params;

  const now = new Date();
  const exp = new Date(expiryDate);
  const diffTime = exp.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let riskLevel: ExpiryRiskLevel = 'NORMAL';
  let recommendedDiscountPercent = 0;

  if (daysRemaining <= 0) {
    riskLevel = 'EXPIRED';
    recommendedDiscountPercent = 0; // Expired stock cannot be sold at any price
  } else if (daysRemaining < 7) {
    riskLevel = 'CLEARANCE_CANDIDATE';
    // High urgency: 30% discount to clear before expiry
    recommendedDiscountPercent = 30;
  } else if (daysRemaining <= 14) {
    riskLevel = 'WARNING';
    // Medium urgency: 15% discount
    recommendedDiscountPercent = 15;
  } else if (daysRemaining <= 30) {
    riskLevel = 'WATCH';
    recommendedDiscountPercent = 0;
  } else {
    riskLevel = 'NORMAL';
    recommendedDiscountPercent = 0;
  }

  const recommendedClearancePrice = Math.max(
    0,
    Math.round(basePrice * (1 - recommendedDiscountPercent / 100))
  );
  const estimatedLossAvoidance = Math.round(
    availableStock * recommendedClearancePrice
  );

  return {
    batchId,
    batchNumber,
    variantId,
    productName,
    warehouseId,
    expiryDate,
    daysRemaining,
    availableStock,
    basePrice,
    riskLevel,
    recommendedDiscountPercent,
    recommendedClearancePrice,
    estimatedLossAvoidance,
    status: riskLevel === 'EXPIRED' ? 'EXPIRED' : riskLevel === 'CLEARANCE_CANDIDATE' ? 'CLEARANCE' : 'ACTIVE',
  };
}

/**
 * Admin Action: Approve and publish a clearance promotion for an expiring batch.
 */
export async function approveBatchClearance(
  client: PoolClient,
  params: {
    batchId: string;
    variantId: string;
    productName: string;
    discountPercent: number;
    approvedBy: string;
  }
): Promise<{ promotionId: string; newPrice: number }> {
  const { batchId, variantId, productName, discountPercent, approvedBy } = params;
  const promoId = `promo_clearance_${batchId}`;

  // 1. Fetch current price
  const priceRes = await client.query(
    `SELECT selling_price FROM product_variants WHERE id = $1`,
    [variantId]
  );
  const basePrice = parseFloat(priceRes.rows[0]?.selling_price || '50');
  const clearancePrice = Math.round(basePrice * (1 - discountPercent / 100));

  // 2. Insert or update targeted clearance promotion in promotions table
  await client.query(
    `INSERT INTO promotions 
       (id, name, type, value, applies_to, target_id, start_date, end_date, is_active, customer_segment, stacking_rule)
     VALUES ($1, $2, 'PERCENTAGE', $3, 'PRODUCT', $4, NOW(), NOW() + INTERVAL '7 days', TRUE, 'ALL', 'NO_STACK')
     ON CONFLICT (id) DO UPDATE 
     SET value = EXCLUDED.value, is_active = TRUE, updated_at = NOW()`,
    [
      promoId,
      `Clearance Deal: ${productName} (${discountPercent}% OFF)`,
      discountPercent,
      variantId,
    ]
  );

  // 3. Update inventory_batches status to 'CLEARANCE'
  await client.query(
    `UPDATE inventory_batches SET status = 'CLEARANCE' WHERE id = $1`,
    [batchId]
  );

  // 4. Record audit event
  await emitBusinessEvent({
    eventType: 'CLEARANCE_PROMOTION_CREATED',
    actorId: approvedBy,
    actorRole: 'admin',
    metadata: { batchId, variantId, discountPercent, clearancePrice },
  });

  return { promotionId: promoId, newPrice: clearancePrice };
}

/**
 * Admin Action: Quarantine and Dispose of an Expired Batch
 */
export async function disposeExpiredBatch(
  client: PoolClient,
  params: {
    batchId: string;
    variantId: string;
    warehouseId: string;
    quantity: number;
    disposedBy: string;
    reason: 'EXPIRED' | 'DAMAGED' | 'SUPPLIER_RETURN';
    notes?: string;
  }
): Promise<string> {
  const { batchId, variantId, warehouseId, quantity, disposedBy, reason, notes } = params;
  const disposalId = randomUUID();

  // 1. Mark batch as EXPIRED / DISPOSED
  await client.query(
    `UPDATE inventory_batches SET status = 'DISPOSED' WHERE id = $1`,
    [batchId]
  );

  // 2. Zero out available stock in inventory_balances
  await client.query(
    `UPDATE inventory_balances 
     SET available_qty = 0, expired_qty = expired_qty + $1, updated_at = NOW()
     WHERE warehouse_id = $2 AND variant_id = $3 AND batch_id = $4`,
    [quantity, warehouseId, variantId, batchId]
  );

  // 3. Record in stock_disposals
  await client.query(
    `INSERT INTO stock_disposals 
       (id, batch_id, variant_id, warehouse_id, quantity, reason, notes, disposed_by, disposed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
    [disposalId, batchId, variantId, warehouseId, quantity, reason, notes || null, disposedBy]
  );

  // 4. Log in immutable inventory_events ledger
  await client.query(
    `INSERT INTO inventory_events 
       (warehouse_id, variant_id, batch_id, event_type, quantity, balance_after, reference_type, reference_id, performed_by_role)
     VALUES ($1, $2, $3, 'DISPOSED', $4, 0, 'STOCK_DISPOSAL', $5, 'ADMIN')`,
    [warehouseId, variantId, batchId, -quantity, disposalId]
  );

  // 5. Emit business event
  await emitBusinessEvent({
    eventType: 'STOCK_DISPOSED',
    actorId: disposedBy,
    actorRole: 'admin',
    metadata: { batchId, variantId, quantity, reason },
  });

  return disposalId;
}
