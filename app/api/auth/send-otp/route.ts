import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone } = body;

    if (!phone || phone.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Valid 10-digit mobile number required' },
        { status: 400 }
      );
    }

    // Dev simulation: OTP 1234
    return NextResponse.json({
      success: true,
      data: {
        otpSent: true,
        devOtp: '1234',
        message: 'OTP sent to mobile number via SMS gateway',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
