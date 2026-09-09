/**
 * GET /api/orders/[id]
 *
 * Fetches order details by order ID or order number, including:
 *   - Line items with product names and picked/packed quantities
 *   - Order address details
 *   - Status history
 *   - Active delivery assignment & partner info
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres';
import { requireAuth } from '@/lib/routeAuth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = requireAuth(req);

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pool = getPostgresPool();

    // 1. Fetch Order Master
    const orderRes = await pool.query(
      `SELECT o.*, s.name AS store_name, s.code AS store_code
       FROM orders o
       LEFT JOIN stores s ON s.id = o.store_id
       WHERE o.id = $1 OR o.order_number = $1`,
      [id]
    );

    if (orderRes.rowCount === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const order = orderRes.rows[0];

    // Customer can only view their own orders; admin/picker/delivery can view all
    if (auth.role === 'customer' && order.firebase_uid !== auth.uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 2. Fetch Order Items
    const itemsRes = await pool.query(
      `SELECT oi.*, p.slug AS product_slug, p.product_code
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1`,
      [order.id]
    );

    // 3. Fetch Delivery Assignment & Partner (if assigned)
    const deliveryRes = await pool.query(
      `SELECT da.*, dp.name AS partner_name, dp.phone AS partner_phone, dp.vehicle_type, dp.vehicle_number
       FROM delivery_assignments da
       JOIN delivery_partners dp ON dp.id = da.delivery_partner_id
       WHERE da.order_id = $1
       ORDER BY da.assigned_at DESC
       LIMIT 1`,
      [order.id]
    );

    // 4. Fetch Status History
    const historyRes = await pool.query(
      `SELECT * FROM order_status_history
       WHERE order_id = $1
       ORDER BY created_at ASC`,
      [order.id]
    );

    // 5. Fetch Shipping Address
    const addressRes = await pool.query(
      `SELECT * FROM order_addresses
       WHERE order_id = $1
       LIMIT 1`,
      [order.id]
    );

    return NextResponse.json({
      success: true,
      data: {
        ...order,
        items: itemsRes.rows,
        delivery: deliveryRes.rows[0] || null,
        address: addressRes.rows[0] || null,
        statusHistory: historyRes.rows,
      },
    });
  } catch (error: any) {
    console.error('[GET /api/orders/[id]]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
