import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/routeAuth';
import { fetchOrderReturnsFS, updateReturnStatusFS } from '@/lib/returnService';

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['admin']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized: Admin role required.' }, { status: 403 });
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as any;
    const partnerId = searchParams.get('partnerId') || undefined;

    const returns = await fetchOrderReturnsFS({ status, partnerId });
    return NextResponse.json({ success: true, data: returns });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Server error fetching returns' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, ['admin']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized: Admin role required.' }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({}));
    const { returnId, status, actorName, assignedPartnerId, assignedPartnerName } = body;

    // Use verified auth context — never trust client-supplied actorId/actorRole
    const actorId = auth.uid;
    const actorRole = auth.role;

    if (!returnId || !status || !actorId) {
      return NextResponse.json(
        { success: false, error: 'Return ID and Status are required' },
        { status: 400 }
      );
    }

    const result = await updateReturnStatusFS({
      returnId,
      status,
      actorId,
      actorName: actorName || auth.name || 'Admin',
      actorRole: actorRole as 'picker' | 'delivery_partner' | 'admin',
      assignedPartnerId,
      assignedPartnerName,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Server error updating return status' },
      { status: 500 }
    );
  }
}
