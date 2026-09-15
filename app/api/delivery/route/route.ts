import { NextResponse } from 'next/server';
import { getRoadRoute } from '@/lib/locationServices';

/**
 * GET /api/delivery/route?fromLat=...&fromLng=...&toLat=...&toLng=...
 *
 * Server-side routing endpoint for Web and Android APK clients.
 * Returns real turn-by-turn road geometry, distance, and duration.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fromLatStr = searchParams.get('fromLat');
    const fromLngStr = searchParams.get('fromLng');
    const toLatStr = searchParams.get('toLat');
    const toLngStr = searchParams.get('toLng');

    if (!fromLatStr || !fromLngStr || !toLatStr || !toLngStr) {
      return NextResponse.json(
        { success: false, error: 'fromLat, fromLng, toLat, and toLng are required parameters' },
        { status: 400 }
      );
    }

    const fromLat = parseFloat(fromLatStr);
    const fromLng = parseFloat(fromLngStr);
    const toLat = parseFloat(toLatStr);
    const toLng = parseFloat(toLngStr);

    if (
      isNaN(fromLat) || isNaN(fromLng) || isNaN(toLat) || isNaN(toLng) ||
      fromLat < -90 || fromLat > 90 || toLat < -90 || toLat > 90 ||
      fromLng < -180 || fromLng > 180 || toLng < -180 || toLng > 180
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid coordinate bounds' },
        { status: 400 }
      );
    }

    const routeResult = await getRoadRoute(fromLat, fromLng, toLat, toLng);

    return NextResponse.json({
      success: true,
      ...routeResult,
    });
  } catch (error: any) {
    console.error('API /api/delivery/route error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Routing service error' },
      { status: 500 }
    );
  }
}
