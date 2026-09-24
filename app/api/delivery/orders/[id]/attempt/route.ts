import { NextResponse } from 'next/server';
import { recordDeliveryCallAttempt } from '@/lib/deliveryExceptionService';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const body = await request.json().catch(() => ({}));
    const { partnerId, attemptNumber = 1 } = body;

    if (!orderId || !partnerId) {
      return NextResponse.json(
        { success: false, error: 'Order ID and Delivery Partner ID are required' },
        { status: 400 }
      );
    }

    const result = await recordDeliveryCallAttempt({
      orderId,
      partnerId,
      attemptNumber,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Server error recording call attempt' },
      { status: 500 }
    );
  }
}
