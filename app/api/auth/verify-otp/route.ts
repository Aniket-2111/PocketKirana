import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, otp } = body;

    if (!otp || (otp !== '1234' && otp.length !== 4)) {
      return NextResponse.json(
        { success: false, error: 'Invalid 4-digit OTP code' },
        { status: 401 }
      );
    }

    const mockUser = {
      id: 'usr-cust-1',
      role: 'customer',
      firstName: 'Pocket',
      lastName: 'Customer',
      mobile: phone || '+91 9876543210',
      email: 'customer@pocketkirana.com',
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: {
        user: mockUser,
        token: 'pk_jwt_session_token_simulated_secure',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
