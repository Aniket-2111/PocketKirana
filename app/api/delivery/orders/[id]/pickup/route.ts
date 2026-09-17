import { NextRequest, NextResponse } from 'next/server';
import { transitionOrderStatus } from '@/lib/orderOrchestrator';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const { partnerId = 'rider_default', partnerName = 'Delivery Partner', qrCodeVerified = true } = body;

    const result = await transitionOrderStatus({
      orderId: id,
      eventType: 'ORDER_PICKED_UP',
      targetStatus: 'ORDER_PICKED_UP',
      actorId: partnerId,
      actorType: 'delivery_partner',
      metadata: {
        partnerId,
        partnerName,
        qrCodeVerified,
        pickedUpAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to pickup order' },
      { status: 500 }
    );
  }
}
