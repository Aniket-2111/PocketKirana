import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, revokeAllUserSessions } from '@/lib/serverSession';
import { SESSION_COOKIE_NAME } from '@/lib/sessionCookie';

export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = sessionId ? getServerSession(sessionId) : null;

    let revokedCount = 0;
    if (session?.userId) {
      revokedCount = revokeAllUserSessions(session.userId);
    }

    const response = NextResponse.json({
      success: true,
      revokedCount,
      message: `Revoked ${revokedCount} session(s) across all devices`,
    });

    // Clear current cookie
    response.cookies.set(SESSION_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Logout all error' },
      { status: 500 }
    );
  }
}
