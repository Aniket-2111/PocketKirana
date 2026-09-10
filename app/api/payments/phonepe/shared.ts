/**
 * Shared helpers for the PhonePe payment routes (create / verify / webhook).
 * Extracted verbatim from the routes so the auth and CORS behavior has a
 * single source of truth.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export function corsResponse(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-VERIFY');
  return response;
}

export async function OPTIONS() {
  return corsResponse({ status: 'ok' });
}

/** Read the session cookie (same names the middleware accepts). */
export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return (
    cookieStore.get('pk_session')?.value || // written by login (lib/sessionCookie.ts)
    cookieStore.get('__pk_session')?.value ||
    cookieStore.get('__session')?.value ||
    null
  );
}

// Edge/Node-safe JWT payload decoder (same logic as middleware.ts)
export function decodeJwtPayload(token: string): { uid: string; role: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=');
    const parsed = JSON.parse(atob(padded));
    return { uid: parsed.sub || parsed.uid || '', role: parsed.role || 'customer' };
  } catch {
    return null;
  }
}

export function isAuthMiddlewareEnabled(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_MIDDLEWARE_ENABLED === 'true';
}

/** Demo customer used when the auth middleware is disabled (local dev/UAT). */
export const DEV_USER_ID = 'usr-cust-1';

/**
 * Resolve the paying user. Fails closed with 401 when the auth middleware is
 * enabled and no valid session cookie is present; falls back to the shared
 * demo user in local dev.
 */
export async function authenticateRequest(): Promise<
  { uid: string } | { error: string; status: 401 }
> {
  const sessionToken = await getSessionToken();

  if (sessionToken) {
    const user = decodeJwtPayload(sessionToken);
    if (user?.uid) return { uid: user.uid };
    if (isAuthMiddlewareEnabled()) return { error: 'Unauthorized session', status: 401 };
  } else if (isAuthMiddlewareEnabled()) {
    return { error: 'Authentication required', status: 401 };
  }

  return { uid: DEV_USER_ID };
}
