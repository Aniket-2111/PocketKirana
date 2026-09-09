import { NextResponse } from 'next/server';
import { checkZoneServiceability, calculateDistanceKm, getStores, setStoresState } from '@/lib/locationServices';
import { fetchShopsFS } from '@/lib/firebaseServices';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { address, latitude, longitude, storeId } = body;

    const lat = latitude !== undefined ? Number(latitude) : address?.latitude;
    const lng = longitude !== undefined ? Number(longitude) : address?.longitude;

    if (lat === undefined || lng === undefined) {
      return NextResponse.json(
        { success: false, error: 'Customer delivery coordinates (latitude & longitude) are required for verification.' },
        { status: 400 }
      );
    }

    // Try fetching freshest shops config from Firestore
    let activeStores = await fetchShopsFS();
    if (!activeStores || activeStores.length === 0) {
      activeStores = getStores();
    } else {
      setStoresState(activeStores);
    }

    const targetStore = storeId ? activeStores.find((s) => s.id === storeId) || activeStores[0] : activeStores[0];
    const storeLat = targetStore?.latitude || 19.033;
    const storeLng = targetStore?.longitude || 73.317;
    const radiusKm = targetStore?.deliveryRadiusKm || 3.0;

    // Strict Haversine distance
    const distKm = calculateDistanceKm(storeLat, storeLng, lat, lng);
    const isServiceable = distKm <= radiusKm && targetStore?.status === 'active';

    if (!isServiceable) {
      return NextResponse.json(
        {
          success: false,
          isServiceable: false,
          error: `Delivery Unserviceable: Your address is ${distKm} KM away, which exceeds the current ${radiusKm} KM delivery radius for ${targetStore?.name || 'PocketKirana'}.`,
          distanceKm: distKm,
          radiusKm,
          storeName: targetStore?.name,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      isServiceable: true,
      distanceKm: distKm,
      radiusKm,
      storeId: targetStore?.id,
      storeName: targetStore?.name,
      estimatedDeliveryMins: Math.max(10, Math.round(10 + distKm * 3)),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Checkout validation failed' },
      { status: 500 }
    );
  }
}
