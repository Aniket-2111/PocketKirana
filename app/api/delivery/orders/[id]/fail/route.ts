import { NextResponse } from 'next/server';
import { recordDeliveryFailure } from '@/lib/deliveryExceptionService';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const body = await request.json().catch(() => ({}));
    const {
      orderNumber,
      partnerId,
      partnerName,
      exceptionType,
      reason,
      notes,
      callAttempts,
      arrivedAt,
      waitingSeconds,
      latitude,
      longitude,
      photoEvidenceUrl,
    } = body;

    if (!orderId || !partnerId || !reason || !exceptionType) {
      return NextResponse.json(
        { success: false, error: 'Order ID, Partner ID, Exception Type, and Reason are required' },
        { status: 400 }
      );
    }

    const result = await recordDeliveryFailure({
      orderId,
      orderNumber: orderNumber || orderId,
      partnerId,
      partnerName,
      exceptionType,
      reason,
      notes,
      callAttempts,
      arrivedAt,
      waitingSeconds,
      latitude,
      longitude,
      photoEvidenceUrl,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Server error recording delivery failure' },
      { status: 500 }
    );
  }
}
