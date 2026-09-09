/**
 * /api/inventory/expiry
 *
 * GET:  Expiry Center dashboard query (expired, expiring in 3d, 7d, 30d, all)
 * POST: Record stock disposal / write-off for expired or damaged items
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres';
import { requireRole } from '@/lib/routeAuth';
import { recordInventoryEvent } from '@/lib/fefo';
import { randomUUID } from 'crypto';

export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['admin', 'store_manager']);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter') || 'all'; // expired | 3d | 7d | 30d | all
    const warehouseId = searchParams.get('warehouse_id');

    const pool = getPostgresPool();

    // 1. Get summary counts for the Expiry Center dashboard cards
    const summaryQuery = `
      SELECT
        COUNT(*) FILTER (WHERE er.expiry_date < CURRENT_DATE AND er.status != 'DISPOSED') AS expired_count,
        COUNT(*) FILTER (WHERE er.expiry_date >= CURRENT_DATE AND er.expiry_date <= CURRENT_DATE + INTERVAL '3 days' AND er.status != 'DISPOSED') AS expiring_3d_count,
        COUNT(*) FILTER (WHERE er.expiry_date >= CURRENT_DATE AND er.expiry_date <= CURRENT_DATE + INTERVAL '7 days' AND er.status != 'DISPOSED') AS expiring_7d_count,
        COUNT(*) FILTER (WHERE er.expiry_date >= CURRENT_DATE AND er.expiry_date <= CURRENT_DATE + INTERVAL '30 days' AND er.status != 'DISPOSED') AS expiring_30d_count
      FROM expiry_records er
      ${warehouseId ? 'WHERE er.warehouse_id = $1' : ''}
    `;

    const summaryRes = await pool.query(summaryQuery, warehouseId ? [warehouseId] : []);
    const summary = summaryRes.rows[0] || {
      expired_count: 0,
      expiring_3d_count: 0,
      expiring_7d_count: 0,
      expiring_30d_count: 0,
    };

    // 2. Fetch specific filtered list
    let listQuery = `
      SELECT 
        er.*,
        ib.batch_number,
        ib.mrp_at_receipt,
        bal.available_qty,
        bal.reserved_qty,
        bal.damaged_qty,
        bal.expired_qty,
        pv.variant_name,
        pv.sku,
        p.name AS product_name,
        w.name AS warehouse_name,
        (er.expiry_date - CURRENT_DATE) AS days_until_expiry
      FROM expiry_records er
      JOIN inventory_batches ib ON ib.id = er.batch_id
      LEFT JOIN inventory_balances bal ON bal.batch_id = er.batch_id
      JOIN product_variants pv ON pv.id = er.variant_id
      JOIN products p ON p.id = pv.product_id
      LEFT JOIN warehouses w ON w.id = er.warehouse_id
      WHERE er.status != 'DISPOSED'
    `;

    const params: any[] = [];
    let idx = 1;

    if (warehouseId) {
      listQuery += ` AND er.warehouse_id = $${idx++}`;
      params.push(warehouseId);
    }

    if (filter === 'expired') {
      listQuery += ` AND er.expiry_date < CURRENT_DATE`;
    } else if (filter === '3d') {
      listQuery += ` AND er.expiry_date >= CURRENT_DATE AND er.expiry_date <= CURRENT_DATE + INTERVAL '3 days'`;
    } else if (filter === '7d') {
      listQuery += ` AND er.expiry_date >= CURRENT_DATE AND er.expiry_date <= CURRENT_DATE + INTERVAL '7 days'`;
    } else if (filter === '30d') {
      listQuery += ` AND er.expiry_date >= CURRENT_DATE AND er.expiry_date <= CURRENT_DATE + INTERVAL '30 days'`;
    }

    listQuery += ` ORDER BY er.expiry_date ASC LIMIT 100`;

    const listRes = await pool.query(listQuery, params);

    return NextResponse.json({
      success: true,
      summary: {
        expired: parseInt(summary.expired_count, 10),
        expiringIn3Days: parseInt(summary.expiring_3d_count, 10),
        expiringIn7Days: parseInt(summary.expiring_7d_count, 10),
        expiringIn30Days: parseInt(summary.expiring_30d_count, 10),
      },
      data: listRes.rows,
    });
  } catch (error: any) {
    console.error('[GET /api/inventory/expiry]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireRole(req, ['admin', 'store_manager']);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized or insufficient privileges' }, { status: 401 });
    }

    const body = await req.json();
    const {
      batch_id,
      quantity,
      reason = 'EXPIRED', // EXPIRED | DAMAGED | QUALITY_FAIL | SHRINKAGE
      disposal_cost = 0,
      notes,
    } = body;

    if (!batch_id || typeof quantity !== 'number' || quantity <= 0) {
      return NextResponse.json({ error: 'batch_id and positive quantity are required' }, { status: 400 });
    }

    const pool = getPostgresPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Load batch + balance
      const batchRes = await client.query(
        `SELECT ib.*, bal.available_qty, bal.id AS balance_id
         FROM inventory_batches ib
         JOIN inventory_balances bal ON bal.batch_id = ib.id
         WHERE ib.id = $1`,
        [batch_id]
      );

      if (batchRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Inventory batch not found' }, { status: 404 });
      }

      const batch = batchRes.rows[0];
      const currentAvailable = parseInt(batch.available_qty, 10);

      if (quantity > currentAvailable) {
        await client.query('ROLLBACK');
        return NextResponse.json({
          error: `Cannot dispose ${quantity} units: only ${currentAvailable} available in batch.`,
        }, { status: 400 });
      }

      const newAvailable = currentAvailable - quantity;

      // 1. Update inventory balance
      await client.query(
        `UPDATE inventory_balances
         SET available_qty = $1,
             expired_qty = expired_qty + $2,
             updated_at = NOW()
         WHERE id = $3`,
        [newAvailable, quantity, batch.balance_id]
      );

      // 2. If balance drops to 0, mark batch status
      if (newAvailable === 0) {
        await client.query(
          `UPDATE inventory_batches SET status = 'DISPOSED' WHERE id = $1`,
          [batch_id]
        );
        await client.query(
          `UPDATE expiry_records SET status = 'DISPOSED', disposed_at = NOW() WHERE batch_id = $1`,
          [batch_id]
        );
      }

      // 3. Record stock disposal
      const disposalId = randomUUID();
      await client.query(
        `INSERT INTO stock_disposals
           (id, batch_id, variant_id, warehouse_id, quantity, reason, disposal_cost, notes, disposed_by, disposed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [
          disposalId,
          batch_id,
          batch.variant_id,
          batch.warehouse_id,
          quantity,
          reason,
          disposal_cost,
          notes || null,
          auth.uid,
        ]
      );

      // 4. Record event in immutable ledger
      await recordInventoryEvent(client, {
        warehouseId: batch.warehouse_id,
        variantId: batch.variant_id,
        batchId: batch_id,
        eventType: reason === 'DAMAGED' ? 'DAMAGED' : 'DISPOSED',
        quantity: quantity,
        balanceAfter: newAvailable,
        referenceType: 'STOCK_DISPOSAL',
        referenceId: disposalId,
        performedBy: auth.uid,
        performedByRole: auth.role,
        notes: notes || `Stock disposal: ${quantity} units (${reason})`,
      });

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        message: 'Stock disposal recorded and ledger updated',
        disposal_id: disposalId,
        remainingAvailable: newAvailable,
      });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[POST /api/inventory/expiry]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
