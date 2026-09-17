import { NextRequest, NextResponse } from 'next/server';
import { transitionOrderStatus } from '@/lib/orderOrchestrator';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const { partnerId = 'rider_default', partnerName = 'Delivery Partner', estimatedMinutes = 15 } = body;

    const result = await transitionOrderStatus({
      orderId: id,
      eventType: 'OUT_FOR_DELIVERY',
      targetStatus: 'OUT_FOR_DELIVERY',
      actorId: partnerId,
      actorType: 'delivery_partner',
      metadata: {
        partnerId,
        partnerName,
        estimatedMinutes,
        outForDeliveryAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Order is out for delivery. Customer live tracking enabled.',
      data: result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to set out for delivery' },
      { status: 500 }
    );
  }
}
