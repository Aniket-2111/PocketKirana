/**
 * GET & POST /api/inventory/expiry/clearance
 *
 * Expiry Center & Clearance Management Endpoint
 *
 * GET: Returns all inventory batches classified by expiry risk level
 *      (NORMAL, WATCH, WARNING, CLEARANCE_CANDIDATE, EXPIRED) with recommended discounts.
 *
 * POST: Approves clearance promotions or triggers batch disposal.
 *       Body: {
 *         action: 'APPROVE_CLEARANCE' | 'DISPOSE_BATCH',
 *         batchId: string,
 *         variantId: string,
 *         discountPercent?: number,
 *         warehouseId?: string,
 *         quantity?: number,
 *         reason?: 'EXPIRED' | 'DAMAGED' | 'SUPPLIER_RETURN',
 *         notes?: string
 *       }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool, withTransaction } from '@/lib/postgres';
import { requireRole } from '@/lib/routeAuth';
import { evaluateBatchExpiryRisk, approveBatchClearance, disposeExpiredBatch } from '@/lib/expiryScoringEngine';

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'store_manager']);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized: Admin or Store Manager role required.' }, { status: 403 });
  }

  try {
    const pool = getPostgresPool();
    const result = await pool.query(`
      SELECT 
        b.id as batch_id,
        b.batch_number,
        b.variant_id,
        p.name as product_name,
        b.warehouse_id,
        b.expiry_date::text as expiry_date,
        COALESCE(bal.available_qty, 0) as available_stock,
        COALESCE(pv.selling_price, p.selling_price, 50) as base_price,
        b.status
      FROM inventory_batches b
      JOIN product_variants pv ON pv.id = b.variant_id
      JOIN products p ON p.id = pv.product_id
      LEFT JOIN inventory_balances bal ON bal.batch_id = b.id AND bal.warehouse_id = b.warehouse_id
      WHERE b.status != 'DISPOSED'
      ORDER BY b.expiry_date ASC
    `);

    const evaluatedBatches = result.rows.map((row) =>
      evaluateBatchExpiryRisk({
        batchId: row.batch_id,
        batchNumber: row.batch_number,
        variantId: row.variant_id,
        productName: row.product_name,
        warehouseId: row.warehouse_id,
        expiryDate: row.expiry_date,
        availableStock: parseInt(row.available_stock, 10),
        basePrice: parseFloat(row.base_price),
      })
    );

    const counts = {
      total: evaluatedBatches.length,
      expired: evaluatedBatches.filter((b) => b.riskLevel === 'EXPIRED').length,
      clearanceCandidates: evaluatedBatches.filter((b) => b.riskLevel === 'CLEARANCE_CANDIDATE').length,
      warning7Days: evaluatedBatches.filter((b) => b.riskLevel === 'WARNING').length,
      watch30Days: evaluatedBatches.filter((b) => b.riskLevel === 'WATCH').length,
      normal: evaluatedBatches.filter((b) => b.riskLevel === 'NORMAL').length,
    };

    return NextResponse.json({ success: true, counts, data: evaluatedBatches });
  } catch (err: any) {
    console.error('[Clearance API GET Error]', err.message);
    return NextResponse.json({ error: 'Failed to fetch expiry risk data.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'store_manager']);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized: Admin or Store Manager role required.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { action, batchId, variantId, discountPercent = 25, warehouseId, quantity = 0, reason = 'EXPIRED', notes } = body;

    if (!action || !batchId || !variantId) {
      return NextResponse.json({ error: 'Missing required parameters (action, batchId, variantId).' }, { status: 400 });
    }

    if (action === 'APPROVE_CLEARANCE') {
      const res = await withTransaction(async (client) => {
        // Fetch product name
        const pRes = await client.query(
          `SELECT p.name FROM product_variants pv JOIN products p ON p.id = pv.product_id WHERE pv.id = $1`,
          [variantId]
        );
        const productName = pRes.rows[0]?.name || 'Product';

        return await approveBatchClearance(client, {
          batchId,
          variantId,
          productName,
          discountPercent,
          approvedBy: auth.uid || 'admin',
        });
      });

      return NextResponse.json({ success: true, message: 'Clearance promotion published successfully.', data: res });
    } else if (action === 'DISPOSE_BATCH') {
      if (!warehouseId) {
        return NextResponse.json({ error: 'warehouseId required for batch disposal.' }, { status: 400 });
      }

      const disposalId = await withTransaction(async (client) => {
        return await disposeExpiredBatch(client, {
          batchId,
          variantId,
          warehouseId,
          quantity,
          disposedBy: auth.uid || 'admin',
          reason,
          notes,
        });
      });

      return NextResponse.json({ success: true, message: 'Expired batch disposed & ledger updated.', disposalId });
    } else {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    console.error('[Clearance API POST Error]', err.message);
    return NextResponse.json({ error: 'Failed to process clearance/disposal action.', details: err.message }, { status: 500 });
  }
}
