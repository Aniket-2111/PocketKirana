import { NextRequest, NextResponse } from 'next/server';
import { evaluateServerServiceability } from '@/lib/serverServiceability';

export const dynamic = 'force-dynamic';

function parseCoordinate(val: unknown): number | null {
  if (val === undefined || val === null || val === '') return null;
  const num = typeof val === 'number' ? val : parseFloat(String(val).trim());
  if (isNaN(num) || !isFinite(num)) return null;
  return num;
}

function parseSubtotal(val: unknown): number {
  if (typeof val === 'number') return Math.max(0, isNaN(val) || !isFinite(val) ? 0 : val);
  if (typeof val === 'string' && val.trim() !== '') {
    const num = parseFloat(val.trim());
    return Math.max(0, isNaN(num) || !isFinite(num) ? 0 : num);
  }
  return 0;
}

interface ServiceabilityCheckParams {
  latInput: unknown;
  lngInput: unknown;
  storeIdInput?: unknown;
  subtotalInput?: unknown;
}

async function handleServiceabilityCheck(params: ServiceabilityCheckParams) {
  try {
    const lat = parseCoordinate(params.latInput);
    const lng = parseCoordinate(params.lngInput);

    if (lat === null || lat < -90 || lat > 90 || lng === null || lng < -180 || lng > 180) {
      return NextResponse.json(
        {
          serviceable: false,
          code: 'INVALID_COORDINATES',
          status: 'INVALID_COORDINATES',
          error: 'Invalid coordinates provided. Latitude must be between -90 and 90, longitude between -180 and 180.',
        },
        { status: 400 }
      );
    }

    const storeId =
      typeof params.storeIdInput === 'string' && params.storeIdInput.trim() !== ''
        ? params.storeIdInput.trim()
        : 'store-001';

    const subtotal = parseSubtotal(params.subtotalInput);

    const decision = await evaluateServerServiceability(
      storeId,
      lat,
      lng,
      subtotal
    );

    if (!decision.serviceable) {
      if (decision.code === 'INVALID_COORDINATES') {
        return NextResponse.json(
          {
            serviceable: false,
            code: 'INVALID_COORDINATES',
            status: 'INVALID_COORDINATES',
            error: decision.error || 'Invalid coordinates provided.',
          },
          { status: 400 }
        );
      }

      if (decision.code === 'STORE_NOT_FOUND') {
        return NextResponse.json(
          {
            serviceable: false,
            code: 'STORE_NOT_FOUND',
            status: 'STORE_NOT_FOUND',
            error: decision.error || `Store '${storeId}' was not found.`,
          },
          { status: 404 }
        );
      }

      const statusAlias = decision.code === 'OUT_OF_SERVICE_AREA' ? 'OUT_OF_RANGE' : decision.code;
      return NextResponse.json({
        serviceable: false,
        code: decision.code,
        status: statusAlias,
        error: decision.error,
        message: decision.error,
        straightLineDistanceKm: decision.straightLineDistanceKm,
        distanceKm: decision.straightLineDistanceKm,
        store: decision.store,
        storeName: decision.store?.name,
        storeId: decision.store?.id,
        storeLatitude: decision.store?.latitude,
        storeLongitude: decision.store?.longitude,
        maximumDistanceKm: decision.store?.deliveryRadiusKm,
        serviceArea: decision.store?.name || 'Neral',
      });
    }

    return NextResponse.json({
      serviceable: true,
      code: 'SERVICEABLE',
      status: 'SERVICEABLE',
      message: '✓ PocketKirana delivers to your location',
      straightLineDistanceKm: decision.straightLineDistanceKm,
      distanceKm: decision.straightLineDistanceKm,
      deliveryFee: decision.deliveryFee,
      freeDeliveryThreshold: decision.freeDeliveryThreshold,
      freeDeliveryEnabled: decision.store?.freeDeliveryEnabled,
      store: decision.store,
      storeName: decision.store?.name,
      storeId: decision.store?.id,
      storeLatitude: decision.store?.latitude,
      storeLongitude: decision.store?.longitude,
      maximumDistanceKm: decision.store?.deliveryRadiusKm,
      serviceArea: decision.store?.name || 'Neral',
    });
  } catch (error: any) {
    console.error('[Serviceability Check API Error]', error?.message || error);
    return NextResponse.json(
      {
        serviceable: false,
        code: 'SERVICEABILITY_ERROR',
        status: 'SERVICEABILITY_ERROR',
        error: 'Serviceability evaluation temporarily unavailable. Please try again.',
      },
      { status: 500 }
    );
  }
}

/**
 * Public Serviceability Check API
 * GET /api/serviceability/check?lat=19.0224&lng=73.3210&storeId=store-001&subtotal=300
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const latInput = searchParams.get('lat') ?? searchParams.get('latitude');
  const lngInput = searchParams.get('lng') ?? searchParams.get('lon') ?? searchParams.get('longitude');
  const storeIdInput = searchParams.get('storeId') ?? searchParams.get('store_id');
  const subtotalInput = searchParams.get('subtotal');

  return handleServiceabilityCheck({
    latInput,
    lngInput,
    storeIdInput,
    subtotalInput,
  });
}

/**
 * Public Serviceability Check API
 * POST /api/serviceability/check
 * Body: { latitude: 19.0224, longitude: 73.3210, storeId: 'store-001', subtotal: 300 }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const latInput = body.latitude ?? body.lat;
  const lngInput = body.longitude ?? body.lng ?? body.lon;
  const storeIdInput = body.storeId ?? body.store_id;
  const subtotalInput = body.subtotal;

  return handleServiceabilityCheck({
    latInput,
    lngInput,
    storeIdInput,
    subtotalInput,
  });
}

