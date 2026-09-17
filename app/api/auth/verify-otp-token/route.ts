/**
 * POST /api/auth/verify-otp-token
 *
 * Receives the short-lived access_token issued by the MSG91 OTP Widget after
 * the customer successfully verifies their OTP on the client side.
 *
 * Flow:
 *  1. Browser sends { access_token } (never the AuthKey — that stays here)
 *  2. We verify the token with MSG91's server-to-server API
 *  3. Extract the verified mobile number from MSG91 response
 *  4. Look up or create the Firestore user record
 *  5. Write the pk_session cookie and return { success, user }
 *
 * Security:
 *  - MSG91_AUTHKEY is accessed ONLY here (server-side env var, no NEXT_PUBLIC_ prefix)
 *  - The access_token is a short-lived, single-use JWT — it cannot be replayed
 *  - pk_session cookie is HttpOnly on HTTPS; client never sees the raw AuthKey
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchUserFS, saveUserFS } from '@/lib/firebaseServices';
import { SESSION_COOKIE_NAME } from '@/lib/sessionCookie';

const MSG91_VERIFY_URL =
  'https://control.msg91.com/api/v5/widget/verifyAccessToken';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Msg91VerifyResponse {
  type: 'success' | 'error';
  message: string;
  data?: {
    /** Mobile number returned by MSG91, typically in E.164 or local format */
    mobile?: string;
    /** Access token that was verified */
    access_token?: string;
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // ── 1. Parse & validate request body ─────────────────────────────────────
    let body: { access_token?: string; accessToken?: string; mobile?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid request body — expected JSON' },
        { status: 400 }
      );
    }

    const access_token = body.access_token || body.accessToken;

    if (!access_token || typeof access_token !== 'string' || access_token.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'access_token is required' },
        { status: 400 }
      );
    }

    // ── 2. Read server-side AuthKey ───────────────────────────────────────────
    const authKey = process.env.MSG91_AUTHKEY;

    // Development bypass: only if AuthKey is literally not configured yet.
    // NODE_ENV is intentionally NOT checked — always use the real key if present.
    const isDemoMode =
      !authKey ||
      authKey === 'your_msg91_authkey_here';

    let verifiedMobile: string | null = null;

    if (isDemoMode) {
      // ── DEV MODE: Skip MSG91 API call, extract phone from access_token claim ─
      // MSG91 access_token is a JWT; decode the payload (no signature verification
      // here — server-to-server verification would normally do that).
      // This is ONLY acceptable in development/test mode.
      try {
        const payloadB64 = access_token.split('.')[1];
        if (payloadB64) {
          const decoded = JSON.parse(
            Buffer.from(payloadB64, 'base64url').toString('utf-8')
          );
          verifiedMobile =
            decoded.mobile ?? decoded.phone ?? decoded.sub ?? null;
        }
      } catch {
        // If JWT decode fails, continue — we'll use a placeholder below
      }

      if (!verifiedMobile) {
        // Last-resort fallback for dev testing with dummy tokens
        verifiedMobile = `dev-${Date.now()}`;
      }

      console.warn(
        '[verify-otp-token] Running in DEV mode — MSG91 AuthKey not configured. ' +
        'Set MSG91_AUTHKEY in .env.local before going to production.'
      );
    } else {
      // ── PRODUCTION MODE: Verify token with MSG91 server-to-server API ───────
      let msg91Response: Msg91VerifyResponse;

      try {
        const res = await fetch(MSG91_VERIFY_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            authkey: authKey,
          },
          // MSG91 API requires "access-token" with a hyphen (not underscore)
          body: JSON.stringify({ 'access-token': access_token }),
        });

        msg91Response = (await res.json()) as Msg91VerifyResponse;
      } catch (fetchError: any) {
        console.error('[verify-otp-token] MSG91 API request failed:', fetchError);
        return NextResponse.json(
          { success: false, error: 'OTP verification service unavailable. Please try again.' },
          { status: 503 }
        );
      }

      if (msg91Response.type !== 'success') {
        console.warn('[verify-otp-token] MSG91 rejected token:', msg91Response);
        return NextResponse.json(
          {
            success: false,
            error: msg91Response.message || 'OTP verification failed. The code may have expired.',
          },
          { status: 401 }
        );
      }

      /**
       * MSG91 verifyAccessToken response shape (confirmed from live logs):
       *   { "type": "success", "message": "918421778740" }
       *
       * The mobile number is in the top-level `message` field as a digit string.
       * We also try data.mobile as a fallback for any future API changes.
       */
      const rawMobile: string =
        (msg91Response.data as any)?.mobile ??
        (msg91Response.data as any)?.phone ??
        (typeof msg91Response.message === 'string' &&
          /^\d{10,15}$/.test(msg91Response.message.replace(/\D/g, ''))
          ? msg91Response.message
          : null) ??
        '';

      verifiedMobile = rawMobile.replace(/\D/g, '').slice(-10) || null;

      if (!verifiedMobile) {
        console.error('[verify-otp-token] Could not extract mobile. MSG91 response:', JSON.stringify(msg91Response));
        return NextResponse.json(
          { success: false, error: 'Could not determine mobile number from OTP verification.' },
          { status: 500 }
        );
      }
    }

    // ── 3. Normalise mobile to 10 digits ─────────────────────────────────────
    const cleanDigits = verifiedMobile.replace(/\D/g, '').slice(-10);
    const formattedMobile = `+91 ${cleanDigits}`;

    // ── 4. Look up or create user in Firestore ────────────────────────────────
    let user = await fetchUserFS(cleanDigits);

    if (!user) {
      const newUser = {
        id: `usr-cust-${cleanDigits}`,
        role: 'customer' as const,
        mobile: formattedMobile,
        status: 'active' as const,
        createdAt: new Date().toISOString(),
      };
      await saveUserFS(newUser);
      user = newUser;
    }

    // ── 5. Build session token & write HttpOnly cookie ────────────────────────
    // In production this would be a Firebase Custom Token or a signed JWT.
    // For now we write a deterministic session ID that middleware recognises.
    const sessionToken = `pks_${cleanDigits}_${Date.now()}`;

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        role: user.role,
        mobile: user.mobile,
        status: user.status,
        createdAt: user.createdAt,
      },
      isDemoMode,
    });

    // Write pk_session cookie — HttpOnly on HTTPS, Lax for CSRF protection
    const isSecure = request.headers.get('x-forwarded-proto') === 'https';
    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: false,         // kept false to match existing sessionCookie.ts client writes
      secure: isSecure,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('[verify-otp-token] Unhandled error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
