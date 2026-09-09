/**
 * GET & PUT /api/admin/store/operations
 *
 * Darkstore Operational Optimization & Capacity Control API
 *
 * GET: Returns live darkstore operational metrics (status, operating hours, active queues, capacity %).
 * PUT: Updates store status (OPEN, HIGH_DEMAND, PAUSED, CLOSED), hours, and delivery radius.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/routeAuth';
import {
  getDarkstoreOperationalStatus,
  updateDarkstoreOperations,
  StoreOperatingStatus,
} from '@/lib/storeOperationsService';

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'store_manager']);
  if (!auth) {
    return NextResponse.json(
      { error: 'Unauthorized: Admin or Store Manager role required.' },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get('storeId') || 'store_primary';

    const status = await getDarkstoreOperationalStatus(storeId);

    return NextResponse.json({ success: true, data: status }, { status: 200 });
  } catch (err: any) {
    console.error('[StoreOperations API GET Error]', err.message);
    return NextResponse.json(
      { error: 'Failed to fetch darkstore operational status.', details: err.message },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const auth = requireRole(req, ['admin', 'store_manager']);
  if (!auth) {
    return NextResponse.json(
      { error: 'Unauthorized: Admin or Store Manager role required.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const {
      storeId = 'store_primary',
      status,
      openingTime,
      closingTime,
      deliveryRadiusKm,
    } = body;

    await updateDarkstoreOperations({
      storeId,
      status: status as StoreOperatingStatus,
      openingTime,
      closingTime,
      deliveryRadiusKm: deliveryRadiusKm ? parseFloat(deliveryRadiusKm) : undefined,
    });

    const updated = await getDarkstoreOperationalStatus(storeId);

    return NextResponse.json({
      success: true,
      message: 'Darkstore operational settings updated successfully.',
      data: updated,
    });
  } catch (err: any) {
    console.error('[StoreOperations API PUT Error]', err.message);
    return NextResponse.json(
      { error: 'Failed to update darkstore operations.', details: err.message },
      { status: 500 }
    );
  }
}
