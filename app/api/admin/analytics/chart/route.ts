import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/routeAuth';
import { getPostgresPool } from '@/lib/postgres';

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'store_manager']);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized: Admin or Store Manager role required.' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const tfParam = searchParams.get('timeframe') || '30d';
    const days = tfParam === '7d' ? 7 : tfParam === '90d' ? 90 : 30;

    const pool = getPostgresPool();

    const query = `
      WITH date_series AS (
        SELECT generate_series(
          CURRENT_DATE - ($1::int || ' days')::INTERVAL + INTERVAL '1 day',
          CURRENT_DATE,
          INTERVAL '1 day'
        )::DATE AS d
      ),
      curr_period AS (
        SELECT
          ds.d,
          COALESCE(SUM(o.total_amount) FILTER (WHERE o.order_status != 'cancelled'), 0) AS revenue,
          COUNT(o.id) FILTER (WHERE o.order_status != 'cancelled')::int AS orders
        FROM date_series ds
        LEFT JOIN orders o ON DATE_TRUNC('day', COALESCE(o.placed_at, o.updated_at)) = ds.d
        GROUP BY ds.d
      ),
      prev_period AS (
        SELECT
          (ds.d + ($1::int || ' days')::INTERVAL)::DATE AS future_match_d,
          COALESCE(SUM(o.total_amount) FILTER (WHERE o.order_status != 'cancelled'), 0) AS prev_revenue
        FROM (
          SELECT generate_series(
            CURRENT_DATE - (2 * $1::int || ' days')::INTERVAL + INTERVAL '1 day',
            CURRENT_DATE - ($1::int || ' days')::INTERVAL,
            INTERVAL '1 day'
          )::DATE AS d
        ) ds
        LEFT JOIN orders o ON DATE_TRUNC('day', COALESCE(o.placed_at, o.updated_at)) = ds.d
        GROUP BY ds.d
      )
      SELECT
        cp.d::TEXT AS date_key,
        TO_CHAR(cp.d, 'DD Mon') AS date_label,
        TO_CHAR(cp.d, 'DD') AS short_date,
        cp.revenue,
        cp.orders,
        COALESCE(pp.prev_revenue, 0) AS prev_revenue
      FROM curr_period cp
      LEFT JOIN prev_period pp ON pp.future_match_d = cp.d
      ORDER BY cp.d ASC;
    `;

    const res = await pool.query(query, [days]);

    const data = res.rows.map((row: any) => {
      const rev = Math.round(parseFloat(row.revenue || '0') * 100) / 100;
      const prevRev = Math.round(parseFloat(row.prev_revenue || '0') * 100) / 100;
      const ords = parseInt(row.orders || '0', 10);
      return {
        date: row.date_label,
        shortDate: row.short_date,
        revenue: rev,
        orders: ords,
        expenses: 0,
        profit: rev,
        prevRevenue: prevRev,
      };
    });

    return NextResponse.json({
      success: true,
      timeframe: tfParam,
      data,
    });
  } catch (error: any) {
    console.error('[Admin Analytics Chart Error]', error);
    return NextResponse.json(
      { success: false, error: 'Database error fetching sales chart data', details: error?.message },
      { status: 500 }
    );
  }
}
