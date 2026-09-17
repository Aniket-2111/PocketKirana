import { NextResponse } from 'next/server';
import { calculateDistanceKm, getStores, setStoresState } from '@/lib/locationServices';
import { fetchShopsFS } from '@/lib/firebaseServices';

export interface ServiceabilityResponse {
  success: boolean;
  isServiceable: boolean;
  isTenMinuteEligible: boolean;
  zoneId: string;
  zoneName: string;
  storeId: string;
  storeName: string;
  distanceKm: number;
  roadDistanceKm: number;
  estimatedDeliveryMinutes: number;
  deliveryFee: number;
  radiusKm: number;
  message: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { latitude, longitude, address, cartTotal = 0 } = body;

    const lat = latitude !== undefined ? Number(latitude) : address?.latitude;
    const lng = longitude !== undefined ? Number(longitude) : address?.longitude;

    // Security & Range validation
    if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json(
        {
          success: false,
          isServiceable: false,
          error: 'Valid GPS coordinates (latitude between -90 and 90, longitude between -180 and 180) are required.',
        },
        { status: 400 }
      );
    }

    // Retrieve active DarkStore hubs from Firestore / Memory
    let activeStores = await fetchShopsFS();
    if (!activeStores || activeStores.length === 0) {
      activeStores = getStores();
    } else {
      setStoresState(activeStores);
    }

    // Default primary store (Neral DarkStore Hub)
    const activeStoreList = activeStores.filter((s) => s.status !== 'inactive');
    
    // Find closest store
    let closestStore = activeStoreList[0];
    let minDistance = 999999;

    for (const store of activeStoreList) {
      const sLat = store.latitude || 19.033;
      const sLng = store.longitude || 73.317;
      const dist = calculateDistanceKm(sLat, sLng, lat, lng);
      if (dist < minDistance) {
        minDistance = dist;
        closestStore = store;
      }
    }

    const targetStore = closestStore || {
      id: 'store-1',
      name: 'Maule Kirana',
      latitude: 19.0224536,
      longitude: 73.3210018,
      deliveryRadiusKm: 4.5,
      status: 'active',
    };

    const radiusKm = targetStore.deliveryRadiusKm || 3.0;
    const distanceKm = Math.round(minDistance * 10) / 10;
    const roadDistanceKm = Math.round(distanceKm * 1.35 * 10) / 10;

    const isServiceable = distanceKm <= radiusKm && targetStore.status === 'active';
    const isTenMinuteEligible = isServiceable;

    const estimatedDeliveryMinutes = isServiceable
      ? Math.max(10, Math.round(10 + distanceKm * 4))
      : 0;

    const deliveryFee = !isServiceable
      ? 0
      : 15;

    const message = isServiceable
      ? `✓ PocketKirana delivers to your location (${distanceKm} km from ${targetStore.name})`
      : `PocketKirana currently delivers within 3 KM of our Neral store. You are ${distanceKm} km away.`;

    const responseData: ServiceabilityResponse = {
      success: true,
      isServiceable,
      isTenMinuteEligible,
      zoneId: isServiceable ? 'zone-neral-01' : 'unserviceable',
      zoneName: isServiceable ? 'Neral DarkStore Delivery Zone' : 'Out of Delivery Range',
      storeId: targetStore.id,
      storeName: targetStore.name,
      distanceKm,
      roadDistanceKm,
      estimatedDeliveryMinutes,
      deliveryFee,
      radiusKm,
      message,
    };

    return NextResponse.json(responseData);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, isServiceable: false, error: error.message || 'Serviceability verification failed' },
      { status: 500 }
    );
  }
}
