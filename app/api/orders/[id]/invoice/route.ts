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
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required to access this invoice' },
        { status: 401 }
      );
    }

    const url = new URL(req.url);
    const format = url.searchParams.get('format') || (req.headers.get('accept')?.includes('application/pdf') ? 'pdf' : 'json');

    // 1. Fetch order from PostgreSQL or fallback
    let order: any = null;
    let items: any[] = [];
    let address: any = null;

    try {
      const orderRes = await queryPostgres(
        `SELECT o.*, o.customer_name, o.customer_phone, null as customer_email
         FROM orders o
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

    // Fallback to in-memory / mock order data ONLY in development/test
    if (!order) {
      if (process.env.NODE_ENV !== 'production') {
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
    }

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (auth.role !== 'admin' && auth.uid !== 'dev-user') {
      const orderCustomerUid = order.customer_id || order.user_id || order.customerId;
      if (!orderCustomerUid || orderCustomerUid !== auth.uid) {
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
    // Check PostgreSQL authoritative invoice_records first
    let invoiceSnapshot: InvoiceSnapshot | null = null;
    try {
      const invCheck = await queryPostgres(
        `SELECT * FROM invoice_records WHERE order_id = $1 OR order_number = $1 LIMIT 1`,
        [normalizedOrder.id]
      );
      if (invCheck.rows.length > 0) {
        const row = invCheck.rows[0];
        invoiceSnapshot = {
          id: row.id,
          invoiceNumber: row.invoice_number,
          orderId: row.order_id,
          orderNumber: row.order_number,
          orderDate: normalizedOrder.placedAt,
          invoiceDate: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
          orderStatus: normalizedOrder.orderStatus,
          paymentStatus: row.payment_status || normalizedOrder.paymentStatus,
          paymentMethod: row.payment_method || normalizedOrder.paymentMethod,
          seller: {
            sellerDisplayName: row.seller_name || 'Maule Kirana Store',
            legalBusinessName: 'Maule Kirana',
            address: 'Shop No. 4, Main Market, Neral, Karjat, Raigad, Maharashtra - 410101',
            fssaiNumber: row.seller_fssai || '21524068001234',
            isGstRegistered: !!row.seller_gstin,
            gstin: row.seller_gstin || '',
            phone: '+91 98765 43210',
            email: 'support@pocketkirana.com',
            state: 'Maharashtra',
            invoicePrefix: 'PK-INV',
            invoiceNumberFormat: 'PK-INV-{YEAR}-{SEQ}',
          },
          customer: {
            id: normalizedOrder.customerId,
            name: row.customer_name || normalizedOrder.customerName,
            mobile: row.customer_phone || normalizedOrder.customerPhone,
            deliveryAddress: normalizedOrder.address?.addressLine1 || '',
            city: normalizedOrder.address?.city || 'Neral',
            state: normalizedOrder.address?.state || 'Maharashtra',
            pincode: normalizedOrder.address?.postalCode || '410101',
          },
          items: Array.isArray(row.items_snapshot) ? row.items_snapshot : normalizedOrder.items,
          totals: {
            subtotal: parseFloat(row.subtotal || normalizedOrder.subtotal),
            discount: parseFloat(row.discount_amount || normalizedOrder.discount),
            deliveryFee: parseFloat(row.delivery_fee || normalizedOrder.deliveryFee),
            taxAmount: parseFloat(row.tax_amount || normalizedOrder.tax),
            grandTotal: parseFloat(row.total_amount || normalizedOrder.total),
          },
          templateVersion: 1,
          templateSnapshot: DEFAULT_INVOICE_TEMPLATE,
          status: 'FINALIZED',
          createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
          finalizedAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
        };
      }
    } catch (e: any) {
      // Postgres check fallback
    }

    if (!invoiceSnapshot) {
      const cacheKey = normalizedOrder.id;
      invoiceSnapshot = finalizedInvoicesCache.get(cacheKey) || null;

      if (!invoiceSnapshot) {
        invoiceSnapshot = createOrGetInvoiceSnapshot(
          normalizedOrder,
          DEFAULT_INVOICE_TEMPLATE,
          Array.from(finalizedInvoicesCache.values())
        );

        // Persist to PostgreSQL invoice_records table
        try {
          await queryPostgres(
            `INSERT INTO invoice_records (
              id, invoice_number, order_id, order_number, seller_name, seller_gstin, seller_fssai,
              customer_name, customer_phone, customer_address, items_snapshot,
              subtotal, discount_amount, delivery_fee, tax_amount, total_amount,
              payment_method, payment_status, created_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW()
            ) ON CONFLICT (order_id) DO NOTHING`,
            [
              invoiceSnapshot.id,
              invoiceSnapshot.invoiceNumber,
              invoiceSnapshot.orderId,
              invoiceSnapshot.orderNumber,
              invoiceSnapshot.seller.sellerDisplayName,
              invoiceSnapshot.seller.gstin || null,
              invoiceSnapshot.seller.fssaiNumber || null,
              invoiceSnapshot.customer.name,
              invoiceSnapshot.customer.mobile,
              JSON.stringify(normalizedOrder.address || {}),
              JSON.stringify(invoiceSnapshot.items || []),
              invoiceSnapshot.totals.subtotal,
              invoiceSnapshot.totals.discount,
              invoiceSnapshot.totals.deliveryFee,
              invoiceSnapshot.totals.taxAmount,
              invoiceSnapshot.totals.grandTotal,
              invoiceSnapshot.paymentMethod,
              invoiceSnapshot.paymentStatus,
            ]
          );
        } catch (dbInsertErr: any) {
          console.warn('[Invoice API] Could not persist invoice to DB:', dbInsertErr.message);
        }

        finalizedInvoicesCache.set(cacheKey, invoiceSnapshot);
        finalizedInvoicesCache.set(normalizedOrder.orderNumber, invoiceSnapshot);
      }
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
