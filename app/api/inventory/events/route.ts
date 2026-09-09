/**
 * GET /api/inventory/events
 *
 * Immutable Inventory Audit Ledger.
 * Returns chronological ledger of all stock mutations (RECEIVED, RESERVED, PICKED, SOLD, DAMAGED, EXPIRED, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres';
import { requireRole } from '@/lib/routeAuth';

export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['admin', 'store_manager']);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const variantId = searchParams.get('variant_id');
    const warehouseId = searchParams.get('warehouse_id');
    const eventType = searchParams.get('event_type');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const pool = getPostgresPool();

    let query = `
      SELECT 
        ie.*,
        pv.variant_name,
        pv.sku,
        p.name AS product_name,
        w.name AS warehouse_name,
        ib.batch_number
      FROM inventory_events ie
      LEFT JOIN product_variants pv ON pv.id = ie.variant_id
      LEFT JOIN products p ON p.id = pv.product_id
      LEFT JOIN warehouses w ON w.id = ie.warehouse_id
      LEFT JOIN inventory_batches ib ON ib.id = ie.batch_id
      WHERE 1=1
    `;

    const params: any[] = [];
    let idx = 1;

    if (variantId) {
      query += ` AND ie.variant_id = $${idx++}`;
      params.push(variantId);
    }
    if (warehouseId) {
      query += ` AND ie.warehouse_id = $${idx++}`;
      params.push(warehouseId);
    }
    if (eventType) {
      query += ` AND ie.event_type = $${idx++}`;
      params.push(eventType.toUpperCase());
    }

    query += ` ORDER BY ie.created_at DESC, ie.id DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);

    const res = await pool.query(query, params);

    return NextResponse.json({
      success: true,
      count: res.rowCount,
      data: res.rows,
    });
  } catch (error: any) {
    console.error('[GET /api/inventory/events]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
