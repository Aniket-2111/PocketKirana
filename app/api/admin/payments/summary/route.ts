import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/routeAuth';
import { getPostgresPool } from '@/lib/postgres';
import { handleCorsPreflight } from '@/lib/cors';

export async function OPTIONS(req: NextRequest) {
  return handleCorsPreflight(req);
}

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin']);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized: Admin role required.' }, { status: 403 });
  }

  try {
    const pool = getPostgresPool();

    const [ordersRes, refundsRes] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE(SUM(total_amount) FILTER (WHERE payment_status IN ('PAID', 'paid', 'completed')), 0) as total_collection,
          COALESCE(SUM(total_amount) FILTER (WHERE payment_status IN ('PAID', 'paid', 'completed') AND (payment_method ILIKE '%online%' OR payment_method ILIKE '%phonepe%' OR payment_method ILIKE '%card%')), 0) as online_collection,
          COALESCE(SUM(total_amount) FILTER (WHERE payment_status IN ('PAID', 'paid', 'completed') AND payment_method ILIKE '%cash%'), 0) as cod_cash_collection,
          COALESCE(SUM(total_amount) FILTER (WHERE payment_status IN ('PAID', 'paid', 'completed') AND payment_method ILIKE '%upi%'), 0) as cod_upi_collection,
          COALESCE(SUM(total_amount) FILTER (WHERE payment_status NOT IN ('PAID', 'paid', 'completed') AND payment_method ILIKE '%cod%'), 0) as pending_cod
        FROM orders
      `),
      pool.query(`
        SELECT COALESCE(SUM(amount), 0) as refunds 
        FROM refunds 
        WHERE status IN ('COMPLETED', 'SUCCESS', 'completed', 'success')
      `),
    ]);

    const oRow = ordersRes.rows[0] || {};
    const totalCollection = Math.round(parseFloat(oRow.total_collection || '0') * 100) / 100;
    const onlineCollection = Math.round(parseFloat(oRow.online_collection || '0') * 100) / 100;
    const codCashCollection = Math.round(parseFloat(oRow.cod_cash_collection || '0') * 100) / 100;
    const codUpiCollection = Math.round(parseFloat(oRow.cod_upi_collection || '0') * 100) / 100;
    const pendingCod = Math.round(parseFloat(oRow.pending_cod || '0') * 100) / 100;
    const refunds = Math.round(parseFloat(refundsRes.rows[0]?.refunds || '0') * 100) / 100;
    const pendingSettlement = codCashCollection;
    const netCollection = Math.max(0, totalCollection - refunds);

    return NextResponse.json({
      success: true,
      summary: {
        totalCollection,
        onlineCollection,
        codCashCollection,
        codUpiCollection,
        pendingCod,
        pendingSettlement,
        refunds,
        netCollection,
      },
    });
  } catch (error: any) {
    console.error('[Admin Payments Summary Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch payment summary from database' },
      { status: 500 }
    );
  }
}
