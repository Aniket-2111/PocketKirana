import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { amount } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Valid amount required' },
        { status: 400 }
      );
    }

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_PocketKiranaKey';
    const keySecret = process.env.RAZORPAY_SECRET_KEY || 'pocketkirana_secret_test_key';

    // If using simulation defaults
    if (keyId === 'rzp_test_PocketKiranaKey') {
      const razorpayOrderId = `order_rzp_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
      return NextResponse.json({
        success: true,
        data: {
          razorpayOrderId,
          keyId,
          amount: Math.round(amount * 100),
          currency: 'INR',
          isSimulation: true
        },
      });
    }

    const instance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const options = {
      amount: Math.round(amount * 100), // amount in the smallest currency unit (paise)
      currency: 'INR',
      receipt: `receipt_order_${Date.now()}`,
    };

    const order = await instance.orders.create(options);

    return NextResponse.json({
      success: true,
      data: {
        razorpayOrderId: order.id,
        keyId,
        amount: order.amount,
        currency: order.currency,
        isSimulation: false
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Payment order creation failed' },
      { status: 500 }
    );
  }
}
