import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/serverSession';
import { SESSION_COOKIE_NAME } from '@/lib/sessionCookie';

export async function GET(request: NextRequest) {
  try {
    console.log('[AUTH] ME_REQUEST_START');
    const authHeader = request.headers.get('authorization') || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
    const headerSessionId = request.headers.get('x-pk-session-id') || request.headers.get('x-session-id') || '';
    const cookieSessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value || '';

    const effectiveSessionId = cookieSessionId || bearerToken || headerSessionId;

    if (!effectiveSessionId) {
      return NextResponse.json({
        authenticated: false,
        user: null,
        customer: null,
      });
    }

    const session = getServerSession(effectiveSessionId);

    if (!session) {
      const response = NextResponse.json({
        authenticated: false,
        user: null,
        customer: null,
      });
      response.cookies.set(SESSION_COOKIE_NAME, '', { maxAge: 0, path: '/' });
      return response;
    }

    console.log('[AUTH] ME_REQUEST_SUCCESS', { userId: session.userId, phone: `+91 XXXXXX${(session.mobile || '').slice(-4)}` });

    const customerObj = {
      id: session.userId,
      role: session.role,
      name: session.name || 'Customer',
      firstName: (session.name || '').split(' ')[0] || 'Customer',
      mobile: session.mobile,
      phone: session.mobile,
      email: session.email,
      lastActivityAt: session.lastActivityAt,
    };

    return NextResponse.json({
      authenticated: true,
      user: customerObj,
      customer: customerObj,
    });
  } catch (error: any) {
    return NextResponse.json(
      { authenticated: false, error: error?.message || 'Session lookup error' },
      { status: 500 }
    );
  }
}
