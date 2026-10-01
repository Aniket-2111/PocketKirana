import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/routeAuth';
import { updateStoreConfig, getStoreById } from '@/lib/locationServices';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(request, ['admin', 'store_manager']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized: Admin role required.' }, { status: 403 });

  try {
    const { id } = await params;
    const store = getStoreById(id);
    if (!store) {
      return NextResponse.json({ success: false, error: 'Store not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: store });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Failed to fetch store' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(request, ['admin']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized: Admin role required.' }, { status: 403 });

  try {
    const { id } = await params;
    const body = await request.json();

    const updated = updateStoreConfig(id, body);
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Store not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Store ${updated.name} configuration updated successfully`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Failed to update store settings' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(request, ['admin']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized: Admin role required.' }, { status: 403 });

  try {
    const { id } = await params;
    const body = await request.json();

    const updated = updateStoreConfig(id, body);
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Store not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Store ${updated.name} configuration updated successfully`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Failed to update store settings' }, { status: 500 });
  }
}
