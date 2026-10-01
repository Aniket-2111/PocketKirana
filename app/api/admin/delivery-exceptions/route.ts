import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/routeAuth';
import { fetchDeliveryExceptionsFS } from '@/lib/deliveryExceptionService';

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized: Admin role required.' }, { status: 403 });
  try {
    const exceptions = await fetchDeliveryExceptionsFS();
    return NextResponse.json({ success: true, data: exceptions });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Server error fetching delivery exceptions' },
      { status: 500 }
    );
  }
}
