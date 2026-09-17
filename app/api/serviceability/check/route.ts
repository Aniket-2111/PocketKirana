import { NextRequest, NextResponse } from 'next/server';
import { calculateDistanceKm, getStores } from '@/lib/locationServices';
import { INITIAL_STORES } from '@/lib/mockData';

export const dynamic = 'force-dynamic';

/**
 * Single Authoritative Serviceability Check API
 * POST /api/serviceability/check
 *
 * Business Rules:
 * - Service Area: Neral only
 * - Store: Maule Kirana Shop
 * - Maximum Delivery Radius: 3.0 KM
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { latitude, longitude } = body;

    if (
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      isNaN(latitude) ||
      isNaN(longitude)
    ) {
      return NextResponse.json(
        {
          error: 'Invalid coordinates. Both latitude and longitude numbers are required.',
          serviceable: false,
          status: 'INVALID_COORDINATES',
        },
        { status: 400 }
      );
    }

    // Active store: Maule Kirana (Neral)
    const stores = getStores();
    const activeStore =
      stores.find((s) => s.status === 'active') || INITIAL_STORES[0];

    const storeLat = activeStore.latitude || 19.0224536;
    const storeLon = activeStore.longitude || 73.3210018;
    const storeName = 'Maule Kirana';
    const serviceArea = 'Neral';
    const maximumDistanceKm = activeStore.deliveryRadiusKm || 4.5;

    // Haversine distance in KM
    const rawDistanceKm = calculateDistanceKm(storeLat, storeLon, latitude, longitude);
    const distanceKm = Number(rawDistanceKm.toFixed(1));

    const isStoreOperational =
      activeStore.status === 'active' && activeStore.deliveryStatus !== 'INACTIVE';

    const isWithinRadius = distanceKm <= maximumDistanceKm;
    const serviceable = isWithinRadius && isStoreOperational;

    if (serviceable) {
      return NextResponse.json({
        serviceable: true,
        status: 'SERVICEABLE',
        serviceArea,
        storeName,
        distanceKm,
        maximumDistanceKm,
        storeLatitude: storeLat,
        storeLongitude: storeLon,
        message: '✓ PocketKirana delivers to your location',
      });
    }

    const status = !isStoreOperational
      ? 'STORE_OFFLINE'
      : 'OUT_OF_RANGE';

    return NextResponse.json({
      serviceable: false,
      status,
      serviceArea,
      storeName,
      distanceKm,
      maximumDistanceKm,
      storeLatitude: storeLat,
      storeLongitude: storeLon,
      message: !isStoreOperational
        ? 'Delivery service currently paused.'
        : 'PocketKirana currently delivers within 3 KM of our Neral store.',
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || 'Failed to check serviceability',
        serviceable: false,
        status: 'SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const latStr = searchParams.get('lat') || searchParams.get('latitude');
  const lonStr = searchParams.get('lon') || searchParams.get('lng') || searchParams.get('longitude');

  if (!latStr || !lonStr) {
    const stores = getStores();
    const activeStore = stores.find((s) => s.status === 'active') || INITIAL_STORES[0];
    return NextResponse.json({
      serviceArea: 'Neral',
      storeName: 'Maule Kirana',
      maximumDistanceKm: activeStore.deliveryRadiusKm || 4.5,
      storeLatitude: activeStore.latitude || 19.0224536,
      storeLongitude: activeStore.longitude || 73.3210018,
      status: 'ACTIVE',
    });
  }

  const latitude = parseFloat(latStr);
  const longitude = parseFloat(lonStr);

  const stores = getStores();
  const activeStore = stores.find((s) => s.status === 'active') || INITIAL_STORES[0];
  const storeLat = activeStore.latitude || 19.0224536;
  const storeLon = activeStore.longitude || 73.3210018;
  const maximumDistanceKm = activeStore.deliveryRadiusKm || 4.5;

  const rawDistanceKm = calculateDistanceKm(storeLat, storeLon, latitude, longitude);
  const distanceKm = Number(rawDistanceKm.toFixed(1));
  const serviceable = distanceKm <= maximumDistanceKm && activeStore.status === 'active';

  return NextResponse.json({
    serviceable,
    status: serviceable ? 'SERVICEABLE' : 'OUT_OF_RANGE',
    serviceArea: 'Neral',
    storeName: 'Maule Kirana',
    distanceKm,
    maximumDistanceKm,
    storeLatitude: storeLat,
    storeLongitude: storeLon,
  });
}
