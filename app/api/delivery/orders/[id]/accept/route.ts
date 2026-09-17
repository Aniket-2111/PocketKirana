import { NextRequest, NextResponse } from 'next/server';
import { transitionOrderStatus } from '@/lib/orderOrchestrator';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const { partnerId = 'rider_default', partnerName = 'Delivery Partner' } = body;

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
