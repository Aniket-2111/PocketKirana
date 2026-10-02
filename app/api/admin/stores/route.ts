import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/routeAuth';
import { getStores } from '@/lib/locationServices';

export async function GET(req: NextRequest) {
  // PK-SEC-09: Dark store configs live under /api/admin/ — require admin role
  const auth = requireRole(req, ['admin']);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stores = getStores();
  return NextResponse.json({
    success: true,
    data: stores,
  });
}
