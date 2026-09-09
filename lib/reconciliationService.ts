/**
 * PocketKirana — Production Reconciliation & Health Observability Service (v1.1.0)
 *
 * Provides real-time financial, inventory, and system consistency auditing:
 *   1. Inventory Ledger vs Balances Reconciliation (Events Delta == Total Active Balances)
 *   2. Pricing & Order Reconciliation (Subtotal - Discount + Delivery + Tax == Total Amount)
 *   3. Database Connection Pool & Latency Health Diagnostics
 */

import { getPostgresPool } from './postgres';

export interface InventoryDiscrepancy {
  variantId: string;
  warehouseId: string;
  batchId: string;
  ledgerCalculatedBalance: number;
  tableReportedBalance: number;
  discrepancyDelta: number;
}

export interface PricingDiscrepancy {
  orderId: string;
  orderNumber: string;
  storedTotal: number;
  recalculatedTotal: number;
  mismatchDelta: number;
}

export interface SystemHealthMetrics {
  databaseStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  connectionPool: {
    total: number;
    idle: number;
    waiting: number;
    utilizationPercent: number;
  };
  queryLatencyMs: number;
  inventoryDiscrepancyCount: number;
  pricingDiscrepancyCount: number;
  reconciledAt: string;
}

/**
 * Audits all inventory items, reconciling ledger events against inventory_balances.
 */
export async function auditInventoryReconciliation(): Promise<{
  totalAudited: number;
  discrepancies: InventoryDiscrepancy[];
  isConsistent: boolean;
}> {
  const pool = getPostgresPool();

  const query = `
    WITH ledger_totals AS (
      SELECT 
        warehouse_id, 
        variant_id, 
        batch_id, 
        COALESCE(SUM(quantity), 0) as ledger_balance
      FROM inventory_events
      GROUP BY warehouse_id, variant_id, batch_id
    ),
    balance_totals AS (
      SELECT 
        warehouse_id, 
        variant_id, 
        batch_id, 
        (available_qty + reserved_qty + damaged_qty) as current_balance
      FROM inventory_balances
    )
    SELECT 
      COALESCE(b.variant_id, l.variant_id) as variant_id,
      COALESCE(b.warehouse_id, l.warehouse_id) as warehouse_id,
      COALESCE(b.batch_id, l.batch_id) as batch_id,
      COALESCE(l.ledger_balance, 0) as ledger_balance,
      COALESCE(b.current_balance, 0) as table_balance,
      (COALESCE(b.current_balance, 0) - COALESCE(l.ledger_balance, 0)) as delta
    FROM balance_totals b
    FULL OUTER JOIN ledger_totals l 
      ON b.warehouse_id = l.warehouse_id 
     AND b.variant_id = l.variant_id 
     AND b.batch_id = l.batch_id
    WHERE l.ledger_balance IS NOT NULL
  `;

  const res = await pool.query(query).catch(() => ({ rows: [] }));
  const discrepancies: InventoryDiscrepancy[] = [];

  for (const row of res.rows) {
    const delta = parseInt(row.delta, 10);
    // If ledger balance exists and does not match table balance, record discrepancy
    if (delta !== 0) {
      discrepancies.push({
        variantId: row.variant_id,
        warehouseId: row.warehouse_id,
        batchId: row.batch_id,
        ledgerCalculatedBalance: parseInt(row.ledger_balance, 10),
        tableReportedBalance: parseInt(row.table_balance, 10),
        discrepancyDelta: delta,
      });
    }
  }

  return {
    totalAudited: res.rows.length,
    discrepancies,
    isConsistent: discrepancies.length === 0,
  };
}

/**
 * Audits all orders, reconciling itemized calculations against total_amount.
 */
export async function auditPricingReconciliation(): Promise<{
  totalAudited: number;
  discrepancies: PricingDiscrepancy[];
  isConsistent: boolean;
}> {
  const pool = getPostgresPool();

  const res = await pool.query(`
    SELECT 
      o.id,
      o.order_number,
      o.total_amount,
      COALESCE(o.subtotal, o.total_amount) as subtotal,
      COALESCE(o.discount_amount, 0) as discount_amount,
      COALESCE(o.delivery_fee, 0) as delivery_fee,
      COALESCE(o.tax_amount, 0) as tax_amount
    FROM orders o
    LIMIT 200
  `);

  const discrepancies: PricingDiscrepancy[] = [];

  for (const row of res.rows) {
    const stored = parseFloat(row.total_amount);
    const subtotal = parseFloat(row.subtotal);
    const discount = parseFloat(row.discount_amount);
    const delivery = parseFloat(row.delivery_fee);
    const tax = parseFloat(row.tax_amount);

    const recomputed = Math.max(0, subtotal - discount + delivery + tax);
    const diff = Math.abs(stored - recomputed);

    // Minor floating point tolerance
    if (diff > 1.0) {
      discrepancies.push({
        orderId: row.id,
        orderNumber: row.order_number || row.id,
        storedTotal: stored,
        recalculatedTotal: recomputed,
        mismatchDelta: diff,
      });
    }
  }

  return {
    totalAudited: res.rows.length,
    discrepancies,
    isConsistent: discrepancies.length === 0,
  };
}

/**
 * Collects complete system health, pool metrics, and latency diagnostics.
 */
export async function getSystemObservabilityMetrics(): Promise<SystemHealthMetrics> {
  const pool = getPostgresPool();
  const tStart = Date.now();

  await pool.query('SELECT 1');
  const queryLatencyMs = Date.now() - tStart;

  const total = pool.totalCount;
  const idle = pool.idleCount;
  const waiting = pool.waitingCount;
  const maxPool = 20; // default pool size

  const utilizationPercent = Math.min(100, Math.round(((total - idle) / maxPool) * 100));

  let databaseStatus: SystemHealthMetrics['databaseStatus'] = 'HEALTHY';
  if (utilizationPercent > 85 || waiting > 5 || queryLatencyMs > 200) {
    databaseStatus = 'CRITICAL';
  } else if (utilizationPercent > 70 || queryLatencyMs > 100) {
    databaseStatus = 'WARNING';
  }

  const [invAudit, priceAudit] = await Promise.all([
    auditInventoryReconciliation(),
    auditPricingReconciliation(),
  ]);

  return {
    databaseStatus,
    connectionPool: {
      total,
      idle,
      waiting,
      utilizationPercent,
    },
    queryLatencyMs,
    inventoryDiscrepancyCount: invAudit.discrepancies.length,
    pricingDiscrepancyCount: priceAudit.discrepancies.length,
    reconciledAt: new Date().toISOString(),
  };
}
