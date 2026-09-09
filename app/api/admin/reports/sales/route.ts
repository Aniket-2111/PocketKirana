import { NextResponse } from 'next/server';
import { INITIAL_ORDERS } from '@/lib/mockData';

export async function GET() {
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
