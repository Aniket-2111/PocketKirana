import { NextResponse } from 'next/server';
import { fetchOrderReturnsFS, updateReturnStatusFS } from '@/lib/returnService';

export async function GET(request: Request) {
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

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { returnId, status, actorId, actorName, actorRole = 'admin', assignedPartnerId, assignedPartnerName } = body;

    if (!returnId || !status || !actorId) {
      return NextResponse.json(
        { success: false, error: 'Return ID, Status, and Actor ID are required' },
        { status: 400 }
      );
    }

    const result = await updateReturnStatusFS({
      returnId,
      status,
      actorId,
      actorName: actorName || 'Admin',
      actorRole,
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
