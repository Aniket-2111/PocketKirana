import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuth } from '@/lib/routeAuth';
import {
  DEFAULT_INVOICE_TEMPLATE,
  generateInvoicePDF,
  InvoiceSnapshot,
  InvoiceTemplateSettings,
} from '@/lib/invoiceEngine';

export async function POST(req: NextRequest) {
  try {
    const auth = getRouteAuth(req);
    if (auth && auth.role !== 'admin' && auth.uid !== 'dev-user') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const template: InvoiceTemplateSettings = {
      ...DEFAULT_INVOICE_TEMPLATE,
      ...body,
    };

    // Sample mock invoice snapshot strictly for preview
    const sampleInvoice: InvoiceSnapshot = {
      id: 'inv-preview-sample',
      invoiceNumber: `${template.seller?.invoicePrefix || 'PK-INV'}-2026-PREVIEW`,
      orderId: 'order-preview-sample',
      orderNumber: 'PK-000123',
      orderDate: new Date().toISOString(),
      invoiceDate: new Date().toISOString(),
      orderStatus: 'DELIVERED',
      paymentStatus: 'PAID',
      paymentMethod: 'UPI / Online',
      seller: { ...template.seller },
      customer: {
        id: 'cust-sample',
        name: 'Rahul Sharma',
        mobile: '+91 98765 43210',
        deliveryAddress: 'Flat 302, Rama Residence, Main Market Road, Neral, Maharashtra - 410101',
        city: 'Neral',
        state: 'Maharashtra',
        pincode: '410101',
      },
      items: [
        {
          id: 'it-1',
          productId: 'p-1',
          productName: 'Kolam Rice Premium',
          sku: 'SKU-RICE-01',
          hsnCode: '1006',
          quantity: 1,
          unit: '5 kg',
          unitPrice: 320,
          discount: 0,
          taxableValue: 320,
          taxRate: 0,
          taxAmount: 0,
          itemTotal: 320,
        },
        {
          id: 'it-2',
          productId: 'p-2',
          productName: 'Amul Taaza Toned Milk',
          sku: 'SKU-MILK-02',
          hsnCode: '0401',
          quantity: 2,
          unit: '500 ml',
          unitPrice: 60,
          discount: 0,
          taxableValue: 120,
          taxRate: 0,
          taxAmount: 0,
          itemTotal: 120,
        },
        {
          id: 'it-3',
          productId: 'p-3',
          productName: 'Parle-G Gold Biscuits',
          sku: 'SKU-BISC-03',
          hsnCode: '1905',
          quantity: 2,
          unit: '1 kg pack',
          unitPrice: 40,
          discount: 0,
          taxableValue: 80,
          taxRate: 0,
          taxAmount: 0,
          itemTotal: 80,
        },
      ],
      totals: {
        subtotal: 520,
        discount: 20,
        deliveryFee: 30,
        taxAmount: 0,
        grandTotal: 530,
      },
      templateVersion: template.version || 1,
      templateSnapshot: template,
      status: 'FINALIZED',
      createdAt: new Date().toISOString(),
      finalizedAt: new Date().toISOString(),
    };

    const { doc, filename } = generateInvoicePDF(sampleInvoice, { saveAsFile: false });
    const pdfArrayBuffer = doc.output('arraybuffer');
    const pdfBuffer = Buffer.from(pdfArrayBuffer);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
