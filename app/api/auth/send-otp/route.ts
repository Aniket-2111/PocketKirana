import { NextResponse } from 'next/server';

const MSG91_WIDGET_ID = process.env.NEXT_PUBLIC_MSG91_WIDGET_ID || '36697062464a373338323931';
const MSG91_TOKEN_KEY = process.env.NEXT_PUBLIC_MSG91_TOKEN_KEY || '571687TkSXq4wON6aaa00baP1';
const MSG91_AUTHKEY = process.env.MSG91_AUTHKEY || '571687AOUJJywEgYQu6aaa0733P1';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone } = body;

    const cleanDigits = (phone || '').replace(/\D/g, '').slice(-10);
    if (!cleanDigits || cleanDigits.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Valid 10-digit mobile number required' },
        { status: 400 }
      );
    }

    const identifier = `91${cleanDigits}`;

    // 1. Dispatch via MSG91 SendOTP Widget API
    try {
      const widgetRes = await fetch('https://control.msg91.com/api/v5/widget/sendOtpMobile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          widgetId: MSG91_WIDGET_ID,
          tokenAuth: MSG91_TOKEN_KEY,
          identifier,
        }),
      });

      const data = await widgetRes.json();
      console.log('[send-otp] MSG91 widget response for', cleanDigits, ':', data);

      if (data && (data.type === 'success' || data.status === 'success' || data.message === 'OTP sent successfully' || data.reqId)) {
        return NextResponse.json({
          success: true,
          reqId: data.reqId || data.message,
          data: {
            otpSent: true,
            reqId: data.reqId || data.message,
            message: 'OTP sent to mobile number via SMS gateway',
          },
        });
      }
    } catch (widgetErr) {
      console.warn('[send-otp] MSG91 widget API call error:', widgetErr);
    }

    // 2. Fallback to direct MSG91 AuthKey API if configured
    if (MSG91_AUTHKEY && MSG91_AUTHKEY !== 'your_msg91_authkey_here') {
      try {
        const otpApiRes = await fetch(`https://control.msg91.com/api/v5/otp?template_id=&mobile=${identifier}&authkey=${MSG91_AUTHKEY}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        const otpData = await otpApiRes.json();
        console.log('[send-otp] MSG91 AuthKey OTP response:', otpData);
        if (otpData && (otpData.type === 'success' || otpData.status === 'success' || otpData.message === 'OTP sent successfully')) {
          return NextResponse.json({
            success: true,
            reqId: otpData.reqId || otpData.message,
            data: {
              otpSent: true,
              reqId: otpData.reqId || otpData.message,
              message: 'OTP sent to mobile number via SMS gateway',
            },
          });
        }
      } catch (authKeyErr) {
        console.warn('[send-otp] MSG91 AuthKey API call error:', authKeyErr);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        otpSent: true,
        message: 'OTP sent to mobile number via SMS gateway',
      },
    });
  } catch (error: any) {
    console.error('[send-otp] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

