import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { getRazorpayConfig, isRazorpaySimulationMode } from '@/lib/razorpayConfig';

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

    // Simulation ONLY when explicitly enabled via RAZORPAY_SIMULATION_MODE=true
    // (never implicitly from missing credentials — fail closed instead).
    if (isRazorpaySimulationMode()) {
      const razorpayOrderId = `order_rzp_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
      return NextResponse.json({
        success: true,
        data: {
          razorpayOrderId,
          keyId: 'sim',
          amount: Math.round(amount * 100),
          currency: 'INR',
          isSimulation: true
        },
      });
    }

    // Real gateway credentials are mandatory beyond this point
    const config = getRazorpayConfig();
    if (!config) {
      console.error('[Razorpay Create] Missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET — refusing to create order. Set credentials or RAZORPAY_SIMULATION_MODE=true for local dev.');
      return NextResponse.json(
        { success: false, error: 'Payment gateway is not configured. Please contact support.' },
        { status: 503 }
      );
    }

    const instance = new Razorpay({
      key_id: config.keyId,
      key_secret: config.keySecret,
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
        keyId: config.keyId,
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
