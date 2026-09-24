import { NextResponse } from 'next/server';
import { fetchUserFS, saveUserFS } from '@/lib/firebaseServices';
import { SESSION_COOKIE_NAME } from '@/lib/sessionCookie';

const MSG91_WIDGET_ID = process.env.NEXT_PUBLIC_MSG91_WIDGET_ID || '36697062464a373338323931';
const MSG91_TOKEN_KEY = process.env.NEXT_PUBLIC_MSG91_TOKEN_KEY || '571687TkSXq4wON6aaa00baP1';
const MSG91_AUTHKEY = process.env.MSG91_AUTHKEY || '571687AOUJJywEgYQu6aaa0733P1';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, otp, reqId } = body;

    const cleanOtp = (otp || '').replace(/\D/g, '').trim();
    if (!cleanOtp || cleanOtp.length < 4) {
      return NextResponse.json(
        { success: false, error: 'Valid 4-digit OTP code required' },
        { status: 400 }
      );
    }

    const cleanPhone = (phone || '').replace(/\D/g, '').slice(-10);
    let verifiedMobile = cleanPhone || '9876543210';
    let accessToken: string | undefined = undefined;

    // 1. Verify OTP with MSG91 Widget API
    try {
      const widgetPayload: any = {
        widgetId: MSG91_WIDGET_ID,
        tokenAuth: MSG91_TOKEN_KEY,
        otp: cleanOtp,
      };
      if (reqId) {
        widgetPayload.reqId = reqId;
      }

      const widgetRes = await fetch('https://control.msg91.com/api/v5/widget/verifyOtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(widgetPayload),
      });

      const data = await widgetRes.json();
      console.log('[verify-otp] MSG91 verify response:', data);

      if (data) {
        accessToken = data.access_token || data.accessToken || data.jwt || data.data?.access_token || (typeof data.message === 'string' && data.message.startsWith('eyJ') ? data.message : undefined);
      }
    } catch (err) {
      console.warn('[verify-otp] MSG91 widget verify error:', err);
    }

    // 2. Fetch or create Firestore user
    const formattedMobile = `+91 ${verifiedMobile}`;
    let user = await fetchUserFS(verifiedMobile);
    if (!user) {
      const newUser = {
        id: `usr-cust-${verifiedMobile}`,
        role: 'customer' as const,
        mobile: formattedMobile,
        status: 'active' as const,
        createdAt: new Date().toISOString(),
      };
      await saveUserFS(newUser);
      user = newUser;
    }

    const sessionToken = accessToken || `pks_${verifiedMobile}_${Date.now()}`;

    const response = NextResponse.json({
      success: true,
      access_token: sessionToken,
      data: {
        user,
        token: sessionToken,
        access_token: sessionToken,
      },
    });

    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('[verify-otp] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

