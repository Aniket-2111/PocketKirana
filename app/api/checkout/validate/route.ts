import { NextResponse } from 'next/server';
import { calculateDistanceKm, getStores, setStoresState } from '@/lib/locationServices';
import { fetchShopsFS } from '@/lib/firebaseServices';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { address, latitude, longitude, storeId, cartTotal = 0 } = body;

    const lat = latitude !== undefined ? Number(latitude) : address?.latitude;
    const lng = longitude !== undefined ? Number(longitude) : address?.longitude;

    if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { success: false, isServiceable: false, error: 'Customer delivery coordinates (latitude & longitude) are required for verification.' },
        { status: 400 }
      );
    }

    let activeStores = await fetchShopsFS();
    if (!activeStores || activeStores.length === 0) {
      activeStores = getStores();
    } else {
      setStoresState(activeStores);
    }

    const activeList = activeStores.filter((s) => s.status !== 'inactive');
    const targetStore = storeId ? activeList.find((s) => s.id === storeId) || activeList[0] : activeList[0] || {
      id: 'store-1',
      name: 'PocketKirana Express DarkStore (Neral Hub)',
      latitude: 19.033,
      longitude: 73.317,
      deliveryRadiusKm: 5.0,
      status: 'active',
    };

    const storeLat = targetStore.latitude || 19.033;
    const storeLng = targetStore.longitude || 73.317;
    const radiusKm = targetStore.deliveryRadiusKm || 5.0;

    const distKm = Math.round(calculateDistanceKm(storeLat, storeLng, lat, lng) * 10) / 10;
    const isServiceable = distKm <= radiusKm && targetStore.status === 'active';
    const isTenMinuteEligible = isServiceable && distKm <= 3.0;
    const estimatedDeliveryMins = isServiceable ? (isTenMinuteEligible ? 10 : Math.min(25, Math.ceil(10 + (distKm - 3.0) * 3))) : 0;
    const deliveryFee = !isServiceable ? 0 : cartTotal >= 499 || distKm <= 1.0 ? 0 : 29;

    if (!isServiceable) {
      return NextResponse.json(
        {
          success: false,
          isServiceable: false,
          error: `Delivery Unserviceable: Your address is ${distKm} KM away, which exceeds the ${radiusKm} KM delivery radius for ${targetStore.name}.`,
          distanceKm: distKm,
          radiusKm,
          storeName: targetStore.name,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      isServiceable: true,
      isTenMinuteEligible,
      distanceKm: distKm,
      radiusKm,
      storeId: targetStore.id,
      storeName: targetStore.name,
      estimatedDeliveryMins,
      deliveryFee,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Checkout validation failed' },
      { status: 500 }
    );
  }
}
