import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = body;

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_PocketKiranaKey';
    const secret = process.env.RAZORPAY_SECRET_KEY || 'pocketkirana_secret_test_key';

    if (keyId === 'rzp_test_PocketKiranaKey') {
      // Simulation verification success
      return NextResponse.json({
        success: true,
        data: {
          verified: true,
          transactionId: razorpayPaymentId || `tx_sim_${Date.now()}`,
          isSimulation: true
        },
      });
    }

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return NextResponse.json(
        { success: false, error: 'Missing payment signature verification parameters' },
        { status: 400 }
      );
    }

    const generatedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    const isVerified = generatedSignature === razorpaySignature;

    return NextResponse.json({
      success: true,
      data: {
        verified: isVerified,
        transactionId: razorpayPaymentId,
        isSimulation: false
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Payment verification failed' },
      { status: 500 }
    );
  }
}
