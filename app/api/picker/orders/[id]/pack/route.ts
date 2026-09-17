import { NextRequest, NextResponse } from 'next/server';
import { transitionOrderStatus } from '@/lib/orderOrchestrator';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const { pickerId = 'picker_default', bagCount = 1, sealNumber } = body;

    const result = await transitionOrderStatus({
      orderId: id,
      eventType: 'ORDER_PACKED',
      targetStatus: 'ORDER_PACKED',
      actorId: pickerId,
      actorType: 'picker',
      metadata: {
        pickerId,
        bagCount,
        sealNumber,
        packedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Order marked PACKED and auto-dispatch triggered',
      data: result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to pack order' },
      { status: 500 }
    );
  }
}
