import { NextRequest, NextResponse } from 'next/server';
import { destroyServerSession } from '@/lib/serverSession';
import { SESSION_COOKIE_NAME } from '@/lib/sessionCookie';

export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (sessionId) {
      destroyServerSession(sessionId);
    }

    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });

    // Clear HttpOnly session cookie
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
      { success: false, error: error?.message || 'Logout error' },
      { status: 500 }
    );
  }
}
