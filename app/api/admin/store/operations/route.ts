/**
 * GET & PUT /api/admin/store/operations
 *
 * PocketKirana — Canonical Admin Darkstore Operations & Capacity Control API
 *
 * GET: Returns live darkstore operational parameters (PostgreSQL stores authority + queue metrics).
 * PUT: Updates store status, operating hours, delivery radius, fees, and free delivery thresholds in PostgreSQL.
 *
 * Security & RBAC:
 *  - Main Admin ('admin'): Full access to all darkstores.
 *  - Store Admin ('store_admin', 'store_manager'): Access scope-restricted by `admin_store_assignments`.
 *  - Coordinates: Protected against casual admin modifications; requires valid developer token.
 *  - Audit: Every successful mutation logs to PostgreSQL `audit_logs`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, verifyStoreAccess } from '@/lib/routeAuth';
import {
  getDarkstoreOperationalStatus,
  updateDarkstoreOperations,
  getAuthorizedStoresList,
} from '@/lib/storeOperationsService';

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'store_admin', 'store_manager']);
  if (!auth) {
    return NextResponse.json(
      { error: 'Unauthorized: Admin or Store Manager role required.' },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const authorizedStores = await getAuthorizedStoresList(auth);

    if (authorizedStores.length === 0 && auth.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: No store assignments found for this user.' },
        { status: 403 }
      );
    }

    const requestedStoreId = searchParams.get('storeId');
    const storeId = requestedStoreId || authorizedStores[0]?.id || 'store_primary';

    // Verify store-level authorization
    const access = await verifyStoreAccess(auth, storeId);
    if (!access.authorized) {
      return NextResponse.json(
        { error: access.error || 'Forbidden: User is not authorized to manage this store.' },
        { status: access.statusCode || 403 }
      );
    }

    const status = await getDarkstoreOperationalStatus(storeId);

    return NextResponse.json(
      {
        success: true,
        data: {
          ...status,
          authorizedStores,
        },
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('[StoreOperations API GET Error]', err.message);
    return NextResponse.json(
      { error: 'Failed to fetch darkstore operational status.', details: err.message },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'store_admin', 'store_manager']);
  if (!auth) {
    return NextResponse.json(
      { error: 'Unauthorized: Admin or Store Manager role required.' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const storeId = body.storeId || 'store_primary';

    // Verify store-level authorization
    const access = await verifyStoreAccess(auth, storeId);
    if (!access.authorized) {
      return NextResponse.json(
        { error: access.error || 'Forbidden: User is not authorized to manage this store.' },
        { status: access.statusCode || 403 }
      );
    }

    const ipAddress =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      undefined;
    const userAgent = req.headers.get('user-agent') || undefined;

    await updateDarkstoreOperations({
      ...body,
      storeId,
      adminUid: auth.uid,
      adminRole: auth.role,
      ipAddress,
      userAgent,
    });

    const updated = await getDarkstoreOperationalStatus(storeId);

    return NextResponse.json(
      {
        success: true,
        message: 'Darkstore operational settings updated successfully in canonical PostgreSQL.',
        data: updated,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('[StoreOperations API PUT Error]', err.message);

    // Differentiate client validation / authorization errors from 500 server errors
    const isCoordinateError = err.message?.includes('STORE_COORDINATES_PROTECTED');
    const isValidationError =
      err.message?.includes('Invalid delivery radius') ||
      err.message?.includes('Invalid operating hours') ||
      err.message?.includes('must be strictly before') ||
      err.message?.includes('must be a non-negative number') ||
      err.message?.includes('Store not found');

    const statusCode = isCoordinateError ? 403 : isValidationError ? 400 : 500;

    return NextResponse.json(
      { error: err.message || 'Failed to update darkstore operations.' },
      { status: statusCode }
    );
  }
}
