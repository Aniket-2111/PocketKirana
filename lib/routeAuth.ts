/**
 * PocketKirana — API Route Auth Helper
 *
 * Extracts the authenticated user context from a Next.js API route request.
 * The middleware (middleware.ts) sets x-pk-uid and x-pk-role headers after
 * verifying the session token.
 *
 * Usage in any API route:
 *   const auth = getRouteAuth(req);
 *   if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 *   const { uid, role, name, sessionId } = auth;
 */

import { NextRequest } from 'next/server';
import { getServerSession, UserSessionData } from './serverSession';

export interface RouteAuthContext {
  /** Firebase UID or dev-user in development */
  uid: string;
  /** Role from middleware RBAC check */
  role: string;
  /** Display name if available from session */
  name?: string;
  /** Session ID (UUID) if cookie-based session */
  sessionId?: string;
}

/**
 * Get authenticated user context from an API route request.
 * Returns null if not authenticated.
 *
 * In development (localhost, no NEXT_PUBLIC_AUTH_MIDDLEWARE_ENABLED),
 * the middleware sets x-pk-dev-bypass=1 and infers role from path prefix.
 * In production, it decodes the JWT and sets x-pk-uid + x-pk-role.
 */
export function getRouteAuth(req: NextRequest): RouteAuthContext | null {
  const uid        = req.headers.get('x-pk-uid');
  const role       = req.headers.get('x-pk-role');
  const sessionId  = req.headers.get('x-pk-session-id');

  // If middleware set uid + role headers, trust them
  if (uid && role) {
    return { uid, role, sessionId: sessionId ?? undefined };
  }

  // Session-based auth: look up the session store
  if (sessionId) {
    const session: UserSessionData | null = getServerSession(sessionId);
    if (!session) return null;

    return {
      uid:       session.userId,
      role:      session.role,
      name:      session.name,
      sessionId,
    };
  }

  // No auth context — middleware should have caught this, but fail safe
  return null;
}

/**
 * Require any authenticated user regardless of role.
 */
export function requireAuth(req: NextRequest): RouteAuthContext | null {
  return getRouteAuth(req);
}

/**
 * Require one of the given roles; returns null if unauthorized.
 */
export function requireRole(
  req: NextRequest,
  allowedRoles: string[]
): RouteAuthContext | null {
  const auth = getRouteAuth(req);
  if (!auth) return null;
  if (!allowedRoles.includes(auth.role)) return null;
  return auth;
}
