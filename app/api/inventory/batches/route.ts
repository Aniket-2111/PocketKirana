/**
 * /api/inventory/batches
 *
 * GET:  List inventory batches with expiry dates and live balances
 * POST: Inward / Receive new stock batch. Atomically updates:
 *       1. inventory_batches
 *       2. inventory_balances
 *       3. expiry_records (if expiry_date provided)
 *       4. inventory_events (ledger entry: RECEIVED)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres';
import { requireRole } from '@/lib/routeAuth';
import { recordInventoryEvent } from '@/lib/fefo';
import { randomUUID } from 'crypto';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const variantId = searchParams.get('variant_id');
    const warehouseId = searchParams.get('warehouse_id');
    const status = searchParams.get('status') || 'ACTIVE';

    const pool = getPostgresPool();

    let query = `
      SELECT 
        ib.*,
        bal.available_qty,
        bal.reserved_qty,
        bal.damaged_qty,
        bal.expired_qty,
        pv.variant_name,
        pv.sku,
        p.name AS product_name,
        w.name AS warehouse_name
      FROM inventory_batches ib
      JOIN inventory_balances bal ON bal.batch_id = ib.id
      JOIN product_variants pv ON pv.id = ib.variant_id
      JOIN products p ON p.id = pv.product_id
      JOIN warehouses w ON w.id = ib.warehouse_id
      WHERE 1=1
    `;

    const params: any[] = [];
    let idx = 1;

    if (variantId) {
      query += ` AND ib.variant_id = $${idx++}`;
      params.push(variantId);
    }
    if (warehouseId) {
      query += ` AND ib.warehouse_id = $${idx++}`;
      params.push(warehouseId);
    }
    if (status !== 'ALL') {
      query += ` AND ib.status = $${idx++}`;
      params.push(status);
    }

    query += ` ORDER BY ib.expiry_date ASC NULLS LAST, ib.received_at DESC LIMIT 100`;

    const res = await pool.query(query, params);

    return NextResponse.json({
      success: true,
      count: res.rowCount,
      data: res.rows,
    });
  } catch (error: any) {
    console.error('[GET /api/inventory/batches]', error.message);
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
      warehouse_id,
      variant_id,
      batch_number,
      manufacture_date,
      expiry_date,
      mrp_at_receipt,
      received_qty,
      notes,
    } = body;

    if (!warehouse_id || !variant_id || typeof received_qty !== 'number' || received_qty <= 0) {
      return NextResponse.json(
        { error: 'warehouse_id, variant_id, and positive received_qty are required' },
        { status: 400 }
      );
    }

    const pool = getPostgresPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const batchId = randomUUID();
      const balanceId = randomUUID();

      // 1. Insert into inventory_batches
      const batchRes = await client.query(
        `INSERT INTO inventory_batches
           (id, warehouse_id, variant_id, batch_number, manufacture_date,
            expiry_date, mrp_at_receipt, received_qty, status, received_at, created_by, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE', NOW(), $9, $10)
         RETURNING *`,
        [
          batchId,
          warehouse_id,
          variant_id,
          batch_number || null,
          manufacture_date || null,
          expiry_date || null,
          mrp_at_receipt || null,
          received_qty,
          auth.uid,
          notes || null,
        ]
      );

      // 2. Insert into inventory_balances
      await client.query(
        `INSERT INTO inventory_balances
           (id, warehouse_id, variant_id, batch_id, available_qty, reserved_qty, damaged_qty, expired_qty, updated_at)
         VALUES ($1, $2, $3, $4, $5, 0, 0, 0, NOW())`,
        [balanceId, warehouse_id, variant_id, batchId, received_qty]
      );

      // 3. Create expiry_record if expiry date provided
      if (expiry_date) {
        const expiryRecordId = randomUUID();
        await client.query(
          `INSERT INTO expiry_records
             (id, batch_id, warehouse_id, variant_id, expiry_date,
              quantity_at_receipt, current_quantity, status, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'FRESH', NOW())`,
          [
            expiryRecordId,
            batchId,
            warehouse_id,
            variant_id,
            expiry_date,
            received_qty,
            received_qty,
          ]
        );
      }

      // 4. Calculate total variant available balance after this inwarding
      const totalRes = await client.query(
        `SELECT COALESCE(SUM(available_qty), 0) AS total_avail
         FROM inventory_balances
         WHERE warehouse_id = $1 AND variant_id = $2`,
        [warehouse_id, variant_id]
      );
      const balanceAfter = parseInt(totalRes.rows[0].total_avail, 10);

      // 5. Append to inventory_events ledger
      await recordInventoryEvent(client, {
        warehouseId: warehouse_id,
        variantId: variant_id,
        batchId: batchId,
        eventType: 'RECEIVED',
        quantity: received_qty,
        balanceAfter: balanceAfter,
        referenceType: 'STOCK_INWARD',
        referenceId: batch_number || batchId,
        performedBy: auth.uid,
        performedByRole: auth.role,
        notes: notes || `Batch received: ${received_qty} units`,
      });

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        message: 'Batch received and inventory ledger updated successfully',
        batch: batchRes.rows[0],
        totalAvailable: balanceAfter,
      }, { status: 201 });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[POST /api/inventory/batches]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
