import { NextResponse } from 'next/server';
import { recordReturnInspectionFS } from '@/lib/returnService';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: returnId } = await params;
    const body = await request.json().catch(() => ({}));
    const { inspectedBy, inspectedByName, items } = body;

    if (!returnId || !inspectedBy || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Return ID, Inspected By, and Items are required' },
        { status: 400 }
      );
    }

    const result = await recordReturnInspectionFS({
      returnId,
      inspectedBy,
      inspectedByName: inspectedByName || 'Admin Staff',
      items,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Server error recording inspection' },
      { status: 500 }
    );
  }
}
