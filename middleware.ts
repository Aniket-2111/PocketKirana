/**
 * PocketKirana — Production Edge Security & RBAC Middleware
 *
 * Enforces:
 *  1. Server-side RBAC route gating (/admin, /picker, /delivery) with REAL
 *     Firebase ID-token signature verification (RS256 + JWKS) — a forged or
 *     unsigned token can no longer pass (cso Finding #1).
 *  2. Inbound x-pk-* header sanitization: clients can no longer forge the
 *     identity headers that lib/routeAuth.ts reads (cso Finding #2). The
 *     middleware strips them, then re-injects its own ONLY after signature
 *     verification — for /admin, /picker, /delivery AND /api routes.
 *  3. HttpOnly session cookie verification.
 *  4. HTTP Security Headers (X-Content-Type-Options, Referrer-Policy, X-Frame-Options).
 *  5. CSRF Protection for state-changing HTTP methods (POST, PUT, PATCH, DELETE).
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseIdToken, decodeJwtPayload } from './lib/sessionVerify';

// ── Route → Required Role Mapping ──────────────────────────────────────────

const PROTECTED_ROUTES: Array<{ prefix: string; requiredRoles: string[] }> = [
  { prefix: '/admin', requiredRoles: ['admin'] },
  { prefix: '/picker', requiredRoles: ['picker', 'admin'] },
  { prefix: '/delivery', requiredRoles: ['delivery_partner', 'admin'] },
];

// ── Header Sanitization (cso Finding #2) ───────────────────────────────────
// The very first thing the middleware does is drop any x-pk-* headers that
// arrived from the client. lib/routeAuth.ts trusts these headers, so they
// must never survive from an untrusted origin.

function sanitizeRequestHeaders(request: NextRequest): NextRequest {
  const headers = new Headers(request.headers);
  let mutated = false;
  for (const name of [...headers.keys()]) {
    if (name.toLowerCase().startsWith('x-pk-')) {
      headers.delete(name);
      mutated = true;
    }
  }
  if (!mutated) return request;
  return new NextRequest(request.url, {
    method: request.method,
    headers,
    body: request.body,
    redirect: 'manual',
  });
}

// ── Main Middleware ─────────────────────────────────────────────────────────

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const sanitized = sanitizeRequestHeaders(request);
  const { pathname } = sanitized.nextUrl;
  const method = sanitized.method;

  // Create base response with security headers
  const requestHeaders = new Headers(sanitized.headers);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Frame-Options', 'DENY');

  // CSRF Check on State-Changing API Mutations
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && pathname.startsWith('/api/')) {
    const origin = sanitized.headers.get('origin');
    const host = sanitized.headers.get('host');

    if (origin && host) {
      const originHost = origin.replace(/^https?:\/\//, '');
      if (originHost !== host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
        return new NextResponse(
          JSON.stringify({ success: false, code: 'CSRF_BLOCKED', error: 'Cross-site request blocked' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
  }

  const sessionToken =
    sanitized.cookies.get('pk_session')?.value ||
    sanitized.cookies.get('__pk_session')?.value ||
    sanitized.cookies.get('__session')?.value;

  const strictModeEnabled = process.env.NEXT_PUBLIC_AUTH_MIDDLEWARE_ENABLED === 'true';
  const isProduction = process.env.NODE_ENV === 'production';
  const host = sanitized.headers.get('host') || '';
  const isLocalhost = host.startsWith('localhost') || host.startsWith('127.0.0.1');

  // Dev bypass: local, non-strict, non-production ONLY. Never injects x-pk-*
  // for /api/* (route-level auth handles API identity), only for protected pages.
  const match = PROTECTED_ROUTES.find((route) => pathname.startsWith(route.prefix));
  if (match && !isProduction && isLocalhost && !strictModeEnabled) {
    const devRole =
      pathname.startsWith('/admin') ? 'admin' :
      pathname.startsWith('/picker') ? 'picker' :
      pathname.startsWith('/delivery') ? 'delivery_partner' : 'customer';

    response.headers.set('x-pk-uid', 'dev-user');
    response.headers.set('x-pk-role', devRole);
    response.headers.set('x-pk-dev-bypass', '1');
    return response;
  }

  // ── Verified-token identity for protected pages AND /api routes ──────────
  // On success, x-pk-uid/x-pk-role are injected from a SIGNATURE-VERIFIED
  // Firebase token — these are the only x-pk-* headers routeAuth ever sees.
  // On failure with a malformed/invalid token present: 401 for API, redirect
  // for pages. No token: pass through (route-level auth decides for /api;
  // protected pages redirect below).

  if (sessionToken) {
    const verified = await verifyFirebaseIdToken(sessionToken);

    if (verified) {
      const role = verified.admin ? 'admin' : verified.role || 'customer';
      response.headers.set('x-pk-uid', verified.uid);
      response.headers.set('x-pk-role', role);

      if (match) {
        const isAdmin = verified.admin === true || role === 'admin';
        const userRole = verified.role || 'customer';
        const allowed = isAdmin || match.requiredRoles.includes(userRole);
        if (!allowed) return redirectToLogin(sanitized.url, pathname, 'insufficient_role');
      }
      return response;
    }

    // Token present but NOT verified: is it a legacy/demo token?
    // Demo 'pks_' tokens and opaque UUID session ids are only honored when
    // auth middleware is NOT enabled (dev/demo installs).
    const looksJwt = sessionToken.includes('.');
    const payload = looksJwt ? decodeJwtPayload(sessionToken) : null;
    const isDemoToken = sessionToken.startsWith('pks_');

    if (!strictModeEnabled && !isProduction) {
      // Dev/demo mode: keep legacy behavior for non-JWT tokens.
      if (!looksJwt) {
        response.headers.set('x-pk-session-id', sessionToken);
        return response;
      }
      // Dev JWT with valid shape: decode-only, flag as unverified (dev only).
      if (payload && (payload.uid || payload.sub)) {
        response.headers.set('x-pk-uid', String(payload.sub || payload.uid));
        response.headers.set('x-pk-role', String(payload.role || 'customer'));
        response.headers.set('x-pk-unverified', '1');
        return response;
      }
    }

    // Strict mode or production: invalid token = fail closed.
    if (pathname.startsWith('/api/')) {
      return new NextResponse(
        JSON.stringify({ success: false, error: 'Invalid session token' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return redirectToLogin(sanitized.url, pathname, 'invalid_token');
  }

  // ── No token ─────────────────────────────────────────────────────────────
  if (match) return redirectToLogin(sanitized.url, pathname, 'unauthenticated');
  return response; // /api with no token: route-level auth decides (fail closed there)
}

function redirectToLogin(baseUrl: string, pathname: string, reason: string): NextResponse {
  const loginUrl = new URL('/access-denied', baseUrl);
  loginUrl.searchParams.set('redirect', pathname);
  loginUrl.searchParams.set('reason', reason);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/picker/:path*',
    '/delivery/:path*',
    '/api/:path*',
  ],
};
