import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/routeAuth';
import { recordReturnInspectionFS } from '@/lib/returnService';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(request, ['admin']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized: Admin role required.' }, { status: 403 });

  try {
    const { id: returnId } = await params;
    const body = await request.json().catch(() => ({}));
    const { inspectedByName, items } = body;

    // Use verified auth context for inspector identity
    const inspectedBy = auth.uid;

    if (!returnId || !inspectedBy || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Return ID and Items are required' },
        { status: 400 }
      );
    }

    const result = await recordReturnInspectionFS({
      returnId,
      inspectedBy,
      inspectedByName: inspectedByName || auth.name || 'Admin Staff',
      items,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Server error recording inspection' },
      { status: 500 }
    );
  }
}
