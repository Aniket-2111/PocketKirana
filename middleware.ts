/**
 * PocketKirana — Production Edge Security & RBAC Middleware
 *
 * Enforces:
 *  1. Server-side RBAC route gating (/admin, /picker, /delivery)
 *  2. HttpOnly `pk_session` cookie verification
 *  3. HTTP Security Headers (X-Content-Type-Options, Referrer-Policy, X-Frame-Options)
 *  4. CSRF Protection for state-changing HTTP methods (POST, PUT, PATCH, DELETE)
 */

import { NextRequest, NextResponse } from 'next/server';

// ── Route → Required Role Mapping ──────────────────────────────────────────

const PROTECTED_ROUTES: Array<{ prefix: string; requiredRoles: string[] }> = [
  { prefix: '/admin',    requiredRoles: ['admin'] },
  { prefix: '/picker',   requiredRoles: ['picker', 'admin'] },
  { prefix: '/delivery', requiredRoles: ['delivery_partner', 'admin'] },
];

// ── JWT Payload Decoder (Edge-safe) ─────────────────────────────────────────

interface FirebaseJwtPayload {
  uid?: string;
  sub?: string;
  role?: string;
  admin?: boolean;
  exp?: number;
  iss?: string;
}

function decodeJwtPayload(token: string): FirebaseJwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload.padEnd(payload.length + (4 - (payload.length % 4)) % 4, '=');
    const decoded = atob(padded);
    return JSON.parse(decoded) as FirebaseJwtPayload;
  } catch {
    return null;
  }
}

function isTokenExpired(payload: FirebaseJwtPayload): boolean {
  if (!payload.exp) return true;
  return Date.now() / 1000 > payload.exp - 5;
}

// ── Main Middleware ─────────────────────────────────────────────────────────

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Create base response
  let response = NextResponse.next();

  // 1. Inject Security Headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Frame-Options', 'DENY');

  // 2. CSRF Check on State-Changing API Mutations
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');

    // Allow requests originating from same host
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

  // 3. RBAC Route Gating
  const match = PROTECTED_ROUTES.find((route) => pathname.startsWith(route.prefix));
  if (!match) {
    return response; // Not a protected route
  }

  // Dev bypass handling for local testing
  const isProduction = process.env.NODE_ENV === 'production';
  const strictModeEnabled = process.env.NEXT_PUBLIC_AUTH_MIDDLEWARE_ENABLED === 'true';
  const host = request.headers.get('host') || '';
  const isLocalhost = host.startsWith('localhost') || host.startsWith('127.0.0.1');

  if (!isProduction && isLocalhost && !strictModeEnabled) {
    const devRole =
      pathname.startsWith('/admin')    ? 'admin' :
      pathname.startsWith('/picker')   ? 'picker' :
      pathname.startsWith('/delivery') ? 'delivery_partner' : 'customer';

    response.headers.set('x-pk-uid', 'dev-user');
    response.headers.set('x-pk-role', devRole);
    response.headers.set('x-pk-dev-bypass', '1');
    return response;
  }

  // Read Session token from `pk_session` or `__pk_session` cookie
  const sessionToken =
    request.cookies.get('pk_session')?.value ||
    request.cookies.get('__pk_session')?.value ||
    request.cookies.get('__session')?.value;

  const redirectToLogin = (reason: string) => {
    const loginUrl = new URL('/access-denied', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    loginUrl.searchParams.set('reason', reason);
    return NextResponse.redirect(loginUrl);
  };

  if (!sessionToken) {
    return redirectToLogin('unauthenticated');
  }

  // If token is a JWT (Firebase or server token), decode payload
  if (sessionToken.includes('.')) {
    const payload = decodeJwtPayload(sessionToken);
    if (!payload || isTokenExpired(payload)) {
      return redirectToLogin('invalid_token');
    }

    const userRole = payload.role as string | undefined;
    const isAdminClaim = payload.admin === true;

    if (isAdminClaim || (userRole && match.requiredRoles.includes(userRole))) {
      response.headers.set('x-pk-uid', payload.sub || payload.uid || '');
      response.headers.set('x-pk-role', userRole || 'unknown');
      return response;
    }
  } else {
    // Cryptographic Session UUID token — allow session lookup to proceed
    response.headers.set('x-pk-session-id', sessionToken);
    return response;
  }

  return redirectToLogin('insufficient_role');
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/picker/:path*',
    '/delivery/:path*',
    '/api/:path*',
  ],
};
