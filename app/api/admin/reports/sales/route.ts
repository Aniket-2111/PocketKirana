import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/routeAuth';
import { getPostgresPool } from '@/lib/postgres';

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized: Admin role required.' }, { status: 403 });

  try {
    const pool = getPostgresPool();
    const result = await pool.query(`
      SELECT 
        order_number,
        COALESCE(customer_name, 'Customer') as customer_name,
        order_status,
        payment_method,
        total_amount,
        TO_CHAR(COALESCE(placed_at, updated_at, NOW()), 'YYYY-MM-DD HH24:MI:SS') as placed_date
      FROM orders
      ORDER BY COALESCE(placed_at, updated_at) DESC NULLS LAST
      LIMIT 5000
    `);

    const headers = ['Order Number', 'Customer Name', 'Status', 'Payment Method', 'Amount (INR)', 'Date'];
    const rows = result.rows.map((o: any) => [
      o.order_number,
      `"${String(o.customer_name).replace(/"/g, '""')}"`,
      o.order_status,
      o.payment_method,
      o.total_amount,
      o.placed_date,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="PocketKirana_Sales_Report.csv"',
      },
    });
  } catch (error: any) {
    console.error('[Admin Sales Report Error]', error);
    return NextResponse.json({ error: 'Failed to generate sales report' }, { status: 500 });
  }
}
