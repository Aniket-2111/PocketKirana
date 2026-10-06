import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/routeAuth';
import { getPostgresPool } from '@/lib/postgres';

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'store_manager']);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized: Admin or Store Manager role required.' }, { status: 403 });
  }

  try {
    const pool = getPostgresPool();

    const [ordersRes, stockRes, partnersRes, monthlyRes] = await Promise.all([
      pool.query(`
        SELECT 
          COUNT(*)::int as total_orders,
          COALESCE(SUM(total_amount) FILTER (WHERE order_status != 'cancelled'), 0) as total_sales,
          COUNT(*) FILTER (WHERE order_status NOT IN ('delivered', 'cancelled'))::int as pending_orders
        FROM orders
      `),
      pool.query(`
        SELECT COUNT(*)::int as low_stock_count
        FROM product_variants
        WHERE stock_quantity <= COALESCE(low_stock_threshold, 5) AND is_active = true
      `),
      pool.query(`
        SELECT COUNT(*)::int as active_partners
        FROM delivery_partners
        WHERE current_status = 'online' AND is_active = true
      `),
      pool.query(`
        WITH months AS (
          SELECT generate_series(
            DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months',
            DATE_TRUNC('month', CURRENT_DATE),
            INTERVAL '1 month'
          ) AS m
        )
        SELECT 
          TO_CHAR(m.m, 'Mon') as month,
          COALESCE(SUM(o.total_amount) FILTER (WHERE o.order_status != 'cancelled'), 0) as revenue
        FROM months m
        LEFT JOIN orders o ON DATE_TRUNC('month', COALESCE(o.placed_at, o.updated_at)) = m.m
        GROUP BY m.m
        ORDER BY m.m ASC
      `),
    ]);

    const orderRow = ordersRes.rows[0] || {};
    const totalOrders = parseInt(orderRow.total_orders || '0', 10);
    const totalSales = Math.round(parseFloat(orderRow.total_sales || '0') * 100) / 100;
    const pendingOrders = parseInt(orderRow.pending_orders || '0', 10);
    const lowStockCount = parseInt(stockRes.rows[0]?.low_stock_count || '0', 10);
    const activePartners = parseInt(partnersRes.rows[0]?.active_partners || '0', 10);
    const averageOrderValue = totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0;

    const revenueMonthly = monthlyRes.rows.map((r: any) => ({
      month: r.month,
      revenue: Math.round(parseFloat(r.revenue || '0') * 100) / 100,
    }));

    return NextResponse.json({
      success: true,
      data: {
        metrics: {
          totalSales,
          totalOrders,
          pendingOrders,
          lowStockCount,
          activePartners,
          averageOrderValue,
        },
        charts: {
          revenueMonthly,
        },
      },
    });
  } catch (error: any) {
    console.error('[Admin Analytics Overview Error]', error);
    return NextResponse.json(
      { success: false, error: 'Database error fetching analytics overview', details: error?.message },
      { status: 500 }
    );
  }
}
