/**
 * POST /api/admin/store/register
 *
 * PocketKirana — Canonical Main Admin Store Registration Endpoint
 *
 * Implements server-side guarded store registration:
 *  1. RBAC Gate: Only Main Admin ('admin') can register a new store.
 *     Store Admins, Store Managers, Pickers, Drivers, and Customers receive 401/403.
 *  2. Parameter Validation: Enforces strict data types, coordinates range, radius (3, 4, 5 km),
 *     free delivery non-negative threshold, and business operating hours (HH:mm).
 *  3. ACID Transaction: Atomically creates the canonical store, primary fulfillment warehouse,
 *     and STORE_REGISTERED audit log in PostgreSQL.
 *  4. Initial State: Sets is_active = false and minimum_order_value = 0.
 *  5. Post-Commit Mirror: Triggers secondary non-fatal Firestore mirror.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuth, requireRole } from '@/lib/routeAuth';
import { registerCanonicalStore } from '@/lib/storeOperationsService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // 1. RBAC Authentication Gate: Main Admin strictly required
  const authContext = getRouteAuth(req);
  if (!authContext) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Authentication required.' },
      { status: 401 }
    );
  }

  const auth = requireRole(req, ['admin']);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: 'Forbidden: Main Admin role required for store registration.' },
      { status: 403 }
    );
  }

  // 2. Parse and Validate Request Payload
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON payload.', code: 'INVALID_PAYLOAD' },
      { status: 400 }
    );
  }

  const ipAddress =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || 'admin-client';

  try {
    const result = await registerCanonicalStore({
      name: body.name,
      code: body.code,
      phone: body.phone,
      address: body.address,
      city: body.city,
      state: body.state,
      pincode: body.pincode,
      latitude: body.latitude,
      longitude: body.longitude,
      deliveryRadiusKm: body.deliveryRadiusKm !== undefined ? body.deliveryRadiusKm : body.delivery_radius_km,
      deliveryFee: body.deliveryFee !== undefined ? body.deliveryFee : body.delivery_fee,
      freeDeliveryEnabled: body.freeDeliveryEnabled !== undefined ? body.freeDeliveryEnabled : body.free_delivery_enabled,
      freeDeliveryThreshold: body.freeDeliveryThreshold !== undefined ? body.freeDeliveryThreshold : body.free_delivery_threshold,
      deliveryFeeTiers: body.deliveryFeeTiers !== undefined ? body.deliveryFeeTiers : body.delivery_fee_tiers,
      openingTime: body.openingTime || body.opening_time,
      closingTime: body.closingTime || body.closing_time,
      adminUid: auth.uid,
      adminRole: auth.role,
      ipAddress,
      userAgent,
    });

    return NextResponse.json(
      {
        success: true,
        store: result.store,
        warehouse: result.warehouse,
        registration_status: result.registrationStatus,
      },
      { status: 201 }
    );
  } catch (err: any) {
    const statusCode = typeof err.statusCode === 'number' ? err.statusCode : 500;
    const errorCode =
      statusCode === 409
        ? 'STORE_ALREADY_EXISTS'
        : statusCode === 400
        ? 'VALIDATION_ERROR'
        : 'INTERNAL_SERVER_ERROR';

    if (statusCode >= 500) {
      console.error('[StoreRegistration API Error]', err);
    }

    return NextResponse.json(
      {
        success: false,
        error: err.message || 'An unexpected error occurred during store registration.',
        code: errorCode,
      },
      { status: statusCode }
    );
  }
}
