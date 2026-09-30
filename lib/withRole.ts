import { NextRequest, NextResponse } from 'next/server';
import { requireRole, requireAuth, RouteAuthContext } from './routeAuth';

export type RouteHandlerWithAuth = (
  req: NextRequest,
  context: any,
  auth: RouteAuthContext
) => Promise<NextResponse> | NextResponse;

/**
 * Higher-order function to enforce role-based access control on Next.js API route handlers.
 * Rejects with 403 Forbidden if the caller lacks one of the required roles.
 */
export const withRole = (
  roles: string[],
  handler: RouteHandlerWithAuth
) => {
  return async (req: NextRequest, context: any = {}) => {
    const auth = requireRole(req, roles);
    if (!auth) {
      return NextResponse.json(
        { success: false, code: 'FORBIDDEN', error: 'Forbidden: Insufficient role privileges' },
        { status: 403 }
      );
    }
    return handler(req, context, auth);
  };
};

/**
 * Higher-order function to enforce authentication on Next.js API route handlers.
 * Rejects with 401 Unauthorized if the caller is not authenticated.
 */
export const withAuth = (
  handler: RouteHandlerWithAuth
) => {
  return async (req: NextRequest, context: any = {}) => {
    const auth = requireAuth(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, code: 'UNAUTHORIZED', error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }
    return handler(req, context, auth);
  };
};
