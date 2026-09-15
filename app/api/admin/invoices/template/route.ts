import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuth } from '@/lib/routeAuth';
import { DEFAULT_INVOICE_TEMPLATE, InvoiceTemplateSettings } from '@/lib/invoiceEngine';

// Active global template settings
let activeTemplate: InvoiceTemplateSettings = { ...DEFAULT_INVOICE_TEMPLATE };

export async function GET(req: NextRequest) {
  try {
    const auth = getRouteAuth(req);
    if (auth && auth.role !== 'admin' && auth.uid !== 'dev-user') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      template: activeTemplate,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = getRouteAuth(req);
    if (auth && auth.role !== 'admin' && auth.uid !== 'dev-user') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid template payload' }, { status: 400 });
    }

    // Increment version when template changes to preserve historical immutability
    const newVersion = (activeTemplate.version || 1) + 1;
    activeTemplate = {
      ...activeTemplate,
      ...body,
      id: `tmpl-v${newVersion}`,
      version: newVersion,
      updatedAt: new Date().toISOString(),
      updatedBy: auth?.uid || 'admin',
    };

    return NextResponse.json({
      success: true,
      message: 'Invoice template updated successfully. Future invoices will use Template v' + newVersion,
      template: activeTemplate,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
