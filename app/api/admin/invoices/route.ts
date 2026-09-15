import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuth } from '@/lib/routeAuth';
import { INITIAL_ORDERS } from '@/lib/mockData';
import {
  createOrGetInvoiceSnapshot,
  DEFAULT_INVOICE_TEMPLATE,
  InvoiceSnapshot,
} from '@/lib/invoiceEngine';

// Global cache of finalized invoices
const adminInvoicesStore: InvoiceSnapshot[] = [];

// Populate from initial mock data if empty
if (adminInvoicesStore.length === 0) {
  INITIAL_ORDERS.forEach((ord: any) => {
    try {
      const inv = createOrGetInvoiceSnapshot(ord, DEFAULT_INVOICE_TEMPLATE, adminInvoicesStore);
      adminInvoicesStore.push(inv);
    } catch (_) {}
  });
}

export async function GET(req: NextRequest) {
  try {
    const auth = getRouteAuth(req);
    // Role check: Admin only (allow dev-user in local dev)
    if (auth && auth.role !== 'admin' && auth.uid !== 'dev-user') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get('search') || '').toLowerCase().trim();
    const status = (searchParams.get('status') || '').toLowerCase().trim();
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let filtered = [...adminInvoicesStore];

    if (search) {
      filtered = filtered.filter(
        (inv) =>
          inv.invoiceNumber.toLowerCase().includes(search) ||
          inv.orderNumber.toLowerCase().includes(search) ||
          inv.customer.name.toLowerCase().includes(search) ||
          inv.customer.mobile.includes(search)
      );
    }

    if (status && status !== 'all') {
      filtered = filtered.filter((inv) => inv.orderStatus.toLowerCase() === status);
    }

    if (startDate) {
      const startMs = new Date(startDate).getTime();
      filtered = filtered.filter((inv) => new Date(inv.invoiceDate).getTime() >= startMs);
    }

    if (endDate) {
      const endMs = new Date(endDate).getTime();
      filtered = filtered.filter((inv) => new Date(inv.invoiceDate).getTime() <= endMs);
    }

    return NextResponse.json({
      success: true,
      total: filtered.length,
      invoices: filtered,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
