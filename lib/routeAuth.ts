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

  // Session-based auth: look up the session store from header or cookie
  const effectiveSessionId = sessionId || req.cookies?.get('pk_session')?.value || req.cookies?.get('__pk_session')?.value;
  if (effectiveSessionId) {
    const session: UserSessionData | null = getServerSession(effectiveSessionId);
    if (!session) return null;

    return {
      uid:       session.userId,
      role:      session.role,
      name:      session.name,
      sessionId: effectiveSessionId,
    };
  }

  // No auth context — fail safe
  return null;
}

import { getPostgresPool } from './postgres';

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

export interface StoreAccessResult {
  authorized: boolean;
  error?: string;
  statusCode?: number;
}

/**
 * Server-side RBAC validation verifying whether an administrator has permission
 * to view or modify operational settings for the target store:
 *  - Main Admin ('admin'): Global administrative authority across all darkstores.
 *  - Store Admin ('store_admin' / 'store_manager'): Restricted strictly to stores assigned in admin_store_assignments.
 *  - Other / Unauthorized: Rejected with 401 or 403.
 */
export async function verifyStoreAccess(
  auth: RouteAuthContext | null,
  storeId: string
): Promise<StoreAccessResult> {
  if (!auth) {
    return {
      authorized: false,
      error: 'Unauthorized: Authentication required.',
      statusCode: 401,
    };
  }

  // 1. Main Admin has global authority over all darkstores
  if (auth.role === 'admin') {
    return { authorized: true };
  }

  // 2. Store Admin / Store Manager: scope-restricted to assigned stores
  if (auth.role === 'store_admin' || auth.role === 'store_manager') {
    try {
      const pool = getPostgresPool();
      const res = await pool.query(
        `SELECT 1 FROM admin_store_assignments asa
         LEFT JOIN admin_users au ON asa.admin_user_id = au.id
         WHERE (asa.admin_user_id = $1 OR au.firebase_uid = $1)
           AND (
             asa.store_id = $2 OR 
             asa.store_id = (SELECT id FROM stores WHERE id = $2 OR UPPER(code) = UPPER($2) LIMIT 1)
           )
         LIMIT 1`,
        [auth.uid, storeId]
      );

      if (res.rows && res.rows.length > 0) {
        return { authorized: true };
      }

      return {
        authorized: false,
        error: `Forbidden: Store Administrator '${auth.uid}' is not assigned to manage store '${storeId}'.`,
        statusCode: 403,
      };
    } catch (err: any) {
      console.error('[verifyStoreAccess Error]', err.message);
      return {
        authorized: false,
        error: 'Database authorization verification failed.',
        statusCode: 500,
      };
    }
  }

  // 3. Any other role (customer, delivery_partner, picker)
  return {
    authorized: false,
    error: 'Forbidden: Insufficient privileges for store operations.',
    statusCode: 403,
  };
}
