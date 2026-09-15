import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuth } from '@/lib/routeAuth';
import { queryPostgres } from '@/lib/postgres';
import { INITIAL_ORDERS } from '@/lib/mockData';
import {
  createOrGetInvoiceSnapshot,
  generateInvoicePDF,
  DEFAULT_INVOICE_TEMPLATE,
  InvoiceSnapshot,
  InvoiceTemplateSettings
} from '@/lib/invoiceEngine';

// In-memory / cache store for finalized invoices if database is unavailable
const finalizedInvoicesCache = new Map<string, InvoiceSnapshot>();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const auth = getRouteAuth(req);
    const url = new URL(req.url);
    const format = url.searchParams.get('format') || (req.headers.get('accept')?.includes('application/pdf') ? 'pdf' : 'json');

    // 1. Fetch order from PostgreSQL or fallback
    let order: any = null;
    let items: any[] = [];
    let address: any = null;

    try {
      const orderRes = await queryPostgres(
        `SELECT o.*, u.full_name as customer_name, u.phone_number as customer_phone, u.email as customer_email
         FROM orders o
         LEFT JOIN users u ON o.customer_id = u.id
         WHERE o.id = $1 OR o.order_number = $1
         LIMIT 1`,
        [id]
      );

      if (orderRes.rows.length > 0) {
        order = orderRes.rows[0];

        // Fetch order items
        const itemsRes = await queryPostgres(
          `SELECT oi.*, p.name as product_name, p.hsn_code, p.unit, p.brand, p.selling_price
           FROM order_items oi
           LEFT JOIN products p ON oi.product_id = p.id
           WHERE oi.order_id = $1`,
          [order.id]
        );
        items = itemsRes.rows;

        // Fetch address snapshot
        const addrRes = await queryPostgres(
          `SELECT * FROM order_addresses WHERE order_id = $1 LIMIT 1`,
          [order.id]
        );
        address = addrRes.rows[0] || null;
      }
    } catch (dbErr: any) {
      console.warn('[Invoice API] DB Query fallback:', dbErr.message);
    }

    // Fallback to in-memory / mock order data
    if (!order) {
      const mockOrder = INITIAL_ORDERS.find((o) => o.id === id || o.orderNumber === id);
      if (mockOrder) {
        order = {
          id: mockOrder.id,
          order_number: mockOrder.orderNumber,
          created_at: mockOrder.placedAt,
          status: mockOrder.orderStatus,
          total_amount: mockOrder.total,
          subtotal: mockOrder.subtotal || mockOrder.total - (mockOrder.deliveryFee || 0),
          discount_amount: mockOrder.discount || 0,
          delivery_fee: mockOrder.deliveryFee ?? mockOrder.deliveryCharge ?? 0,
          tax_amount: mockOrder.tax || 0,
          payment_method: mockOrder.paymentMethod || 'Online Paid',
          payment_status: mockOrder.paymentStatus || 'paid',
          customer_name: mockOrder.customerName || 'Valued Customer',
          customer_phone: mockOrder.customerPhone || '+91 98765 43210',
          customer_id: mockOrder.customerId,
        };
        items = mockOrder.items.map((it: any, idx: number) => ({
          id: `item_${idx}`,
          product_name: it.product?.name || it.productName || 'Grocery Item',
          quantity: it.quantity || 1,
          unit_price: it.price || it.product?.sellingPrice || 100,
          total_price: (it.price || it.product?.sellingPrice || 100) * (it.quantity || 1),
          unit: it.product?.unit || it.unit || '1 unit',
          hsn_code: it.product?.hsnCode || '0910',
          sku: it.sku || `SKU-${idx + 1}`,
        }));
        address = mockOrder.address || {
          house_no: 'Flat 302',
          street: 'Main Market Road',
          area: 'Neral',
          city: 'Neral',
          state: 'Maharashtra',
          pincode: '410101',
        };
      }
    }

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // 2. Strict Security Ownership Check
    // If authenticated as customer, customer must own this order. Admin has access.
    if (auth && auth.role !== 'admin' && auth.uid !== 'dev-user') {
      const orderCustomerUid = order.customer_id || order.user_id;
      if (orderCustomerUid && orderCustomerUid !== auth.uid) {
        return NextResponse.json(
          { error: 'Forbidden: You do not have permission to access this invoice' },
          { status: 403 }
        );
      }
    }

    // 3. Normalise Order Object for Invoice Engine
    const normalizedOrder: any = {
      id: order.id,
      orderNumber: order.order_number || order.orderNumber || order.id,
      customerId: order.customer_id || order.customerId || 'cust-1',
      customerName: order.customer_name || order.customerName || 'Customer',
      customerPhone: order.customer_phone || order.customerPhone || '',
      placedAt: order.created_at || order.placedAt || new Date().toISOString(),
      orderStatus: order.status || order.orderStatus || 'DELIVERED',
      paymentStatus: order.payment_status || order.paymentStatus || 'paid',
      paymentMethod: order.payment_method || order.paymentMethod || 'Online Paid',
      subtotal: parseFloat(order.subtotal || order.total_amount || 0),
      discount: parseFloat(order.discount_amount || order.discount || 0),
      deliveryFee: parseFloat(order.delivery_fee || order.deliveryCharge || 0),
      tax: parseFloat(order.tax_amount || order.tax || 0),
      total: parseFloat(order.total_amount || order.total || 0),
      address: {
        fullName: order.customer_name || (address?.name || address?.full_name || 'Customer'),
        phone: order.customer_phone || address?.phone || '',
        addressLine1: address?.addressLine1 || address?.house_no ? `${address?.house_no || ''} ${address?.street || address?.addressLine1 || ''}`.trim() : 'Neral Market',
        addressLine2: address?.addressLine2 || address?.area || '',
        city: address?.city || 'Neral',
        state: address?.state || 'Maharashtra',
        postalCode: address?.postalCode || address?.pincode || '410101',
      },
      items: items.map((it: any) => ({
        id: it.id,
        productId: it.product_id || it.productId || it.id,
        productName: it.product_name || it.name || 'Grocery Item',
        quantity: it.quantity || 1,
        unitPrice: parseFloat(it.unit_price || it.price || it.selling_price || 0),
        unit: it.unit || '1 unit',
        sku: it.sku || `SKU-${it.id}`,
        hsnCode: it.hsn_code || '',
        discount: 0,
        taxPercentage: 0,
      })),
    };

    // 4. Retrieve or Create Finalized Snapshot
    const cacheKey = normalizedOrder.id;
    let invoiceSnapshot = finalizedInvoicesCache.get(cacheKey);

    if (!invoiceSnapshot) {
      invoiceSnapshot = createOrGetInvoiceSnapshot(
        normalizedOrder,
        DEFAULT_INVOICE_TEMPLATE,
        Array.from(finalizedInvoicesCache.values())
      );
      finalizedInvoicesCache.set(cacheKey, invoiceSnapshot);
      finalizedInvoicesCache.set(normalizedOrder.orderNumber, invoiceSnapshot);
    }

    // 5. Return PDF or JSON based on request
    if (format === 'pdf') {
      const { doc, filename } = generateInvoicePDF(invoiceSnapshot, { saveAsFile: false });
      const pdfArrayBuffer = doc.output('arraybuffer');
      const pdfBuffer = Buffer.from(pdfArrayBuffer);

      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': String(pdfBuffer.length),
          'Cache-Control': 'public, max-age=3600, immutable',
        },
      });
    }

    return NextResponse.json({
      success: true,
      invoice: invoiceSnapshot,
    });
  } catch (error: any) {
    console.error('[Invoice API Error]:', error);
    return NextResponse.json(
      { error: 'Internal Server Error while generating invoice', details: error.message },
      { status: 500 }
    );
  }
}
