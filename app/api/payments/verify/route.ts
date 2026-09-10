import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getRazorpayConfig, isRazorpaySimulationMode } from '@/lib/razorpayConfig';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = body;

    // Simulation ONLY when explicitly enabled via RAZORPAY_SIMULATION_MODE=true
    // (never implicitly from missing credentials — fail closed instead).
    if (isRazorpaySimulationMode()) {
      return NextResponse.json({
        success: true,
        data: {
          verified: true,
          transactionId: razorpayPaymentId || `tx_sim_${Date.now()}`,
          isSimulation: true
        },
      });
    }

    // Real gateway credentials are mandatory beyond this point
    const config = getRazorpayConfig();
    if (!config) {
      console.error('[Razorpay Verify] Missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET — refusing to verify. Set credentials or RAZORPAY_SIMULATION_MODE=true for local dev.');
      return NextResponse.json(
        { success: false, error: 'Payment gateway is not configured. Please contact support.' },
        { status: 503 }
      );
    }

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return NextResponse.json(
        { success: false, error: 'Missing payment signature verification parameters' },
        { status: 400 }
      );
    }

    const generatedSignature = crypto
      .createHmac('sha256', config.keySecret)
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
