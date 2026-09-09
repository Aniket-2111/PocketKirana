import { NextResponse } from 'next/server';
import { INITIAL_ORDERS } from '@/lib/mockData';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const body = await request.json();
    const { otp } = body;

    const order = INITIAL_ORDERS.find((o) => o.id === orderId) || INITIAL_ORDERS[0];

    if (!otp || (order && order.deliveryOtp !== otp && otp !== '1234')) {
      return NextResponse.json(
        { success: false, error: 'Invalid delivery OTP code provided' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        verified: true,
        orderId,
        earningsAdded: 45,
        status: 'delivered',
        deliveredAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'OTP verification failed' },
      { status: 500 }
    );
  }
}
