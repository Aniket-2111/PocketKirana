import { NextRequest, NextResponse } from 'next/server';
import { transitionOrderStatus, CanonicalOrderStatus, OrderEventType } from '@/lib/orderOrchestrator';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const {
      eventType,
      targetStatus,
      actorId = 'system',
      actorType = 'system',
      metadata = {},
      eventId,
    } = body;

    if (!eventType || !targetStatus) {
      return NextResponse.json(
        { success: false, error: 'eventType and targetStatus are required' },
        { status: 400 }
      );
    }

    const result = await transitionOrderStatus({
      orderId: id,
      eventType: eventType as OrderEventType,
      targetStatus: targetStatus as CanonicalOrderStatus,
      actorId,
      actorType,
      metadata,
      eventId,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[API /orders/:id/events] Error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to record event' },
      { status: 500 }
    );
  }
}
