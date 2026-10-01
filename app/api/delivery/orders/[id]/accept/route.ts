import { NextRequest, NextResponse } from 'next/server';
import { transitionOrderStatus } from '@/lib/orderOrchestrator';

import { getRouteAuth } from '@/lib/routeAuth';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const auth = getRouteAuth(req);
    if (auth && auth.role !== 'delivery_partner' && auth.role !== 'admin' && auth.uid !== 'dev-user') {
      return NextResponse.json({ error: 'Forbidden: Delivery partner role required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const partnerId = auth?.uid || body.partnerId || 'rider_default';
    const partnerName = body.partnerName || (auth?.role === 'delivery_partner' ? 'Delivery Partner' : 'Fleet Staff');

    const result = await transitionOrderStatus({
      orderId: id,
      eventType: 'DELIVERY_PARTNER_ACCEPTED',
      targetStatus: 'DELIVERY_PARTNER_ACCEPTED',
      actorId: partnerId,
      actorType: 'delivery_partner',
      metadata: {
        partnerId,
        partnerName,
        acceptedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to accept delivery' },
      { status: 500 }
    );
  }
}
