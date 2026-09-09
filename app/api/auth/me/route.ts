import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/serverSession';
import { SESSION_COOKIE_NAME } from '@/lib/sessionCookie';

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value || '';

    if (!sessionId) {
      return NextResponse.json({
        authenticated: false,
        user: null,
      });
    }

    const session = getServerSession(sessionId);

    if (!session) {
      const response = NextResponse.json({
        authenticated: false,
        user: null,
      });
      response.cookies.set(SESSION_COOKIE_NAME, '', { maxAge: 0, path: '/' });
      return response;
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.userId,
        role: session.role,
        name: session.name || 'User',
        mobile: session.mobile,
        email: session.email,
        lastActivityAt: session.lastActivityAt,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { authenticated: false, error: error?.message || 'Session lookup error' },
      { status: 500 }
    );
  }
}
