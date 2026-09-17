import { NextRequest, NextResponse } from 'next/server';
import { transitionOrderStatus } from '@/lib/orderOrchestrator';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const { pickerId = 'picker_default', pickerName = 'Picker Staff' } = body;

    const result = await transitionOrderStatus({
      orderId: id,
      eventType: 'PICKER_ACCEPTED',
      targetStatus: 'PICKER_ACCEPTED',
      actorId: pickerId,
      actorType: 'picker',
      metadata: {
        pickerId,
        pickerName,
        acceptedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to accept order' },
      { status: 500 }
    );
  }
}
