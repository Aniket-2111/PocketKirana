import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/routeAuth';
import { INITIAL_ORDERS } from '@/lib/mockData';

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized: Admin role required.' }, { status: 403 });

  const headers = ['Order Number', 'Customer Name', 'Status', 'Payment Method', 'Amount (INR)', 'Date'];
  const rows = INITIAL_ORDERS.map((o) => [
    o.orderNumber,
    `"${o.customerName}"`,
    o.orderStatus,
    o.paymentMethod,
    o.total,
    o.placedAt,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="PocketKirana_Sales_Report.csv"',
    },
  });
}
