/**
 * GET /api/admin/analytics
 *
 * Operational & Financial Management Intelligence Endpoint
 *
 * Query Params:
 *   - range: 'today' | '7d' | '30d' | 'all' (default: '7d')
 *   - warehouseId?: string (optional darkstore filter)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/routeAuth';
import { getAnalyticsReport, AnalyticsTimeRange } from '@/lib/analyticsService';

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
    const range = (searchParams.get('range') || '7d') as AnalyticsTimeRange;
    const warehouseId = searchParams.get('warehouseId') || undefined;

    const report = await getAnalyticsReport(range, warehouseId);

    return NextResponse.json(
      {
        success: true,
        data: report,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('[Analytics API Error]', err.message);
    return NextResponse.json(
      { error: 'Failed to generate analytics report.', details: err.message },
      { status: 500 }
    );
  }
}
