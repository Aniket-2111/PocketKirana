import { NextResponse } from 'next/server';
import { checkZoneServiceability, setStoresState } from '@/lib/locationServices';
import { fetchShopsFS } from '@/lib/firebaseServices';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get('lat') || '18.9876');
    const lng = parseFloat(searchParams.get('lng') || '73.3210');
    const pincode = searchParams.get('pincode') || undefined;
    const storeId = searchParams.get('storeId') || undefined;

    try {
      const shops = await fetchShopsFS();
      if (shops && shops.length > 0) {
        setStoresState(shops);
      }
    } catch (e) {}

    const result = checkZoneServiceability(lat, lng, pincode, storeId);

    return NextResponse.json({
      success: true,
      data: {
        available: result.isServiceable,
        isServiceable: result.isServiceable,
        storeId: result.storeId,
        storeName: result.storeName,
        storeCode: result.storeCode,
        distanceKm: result.distanceKm,
        straightLineDistanceKm: result.straightLineDistanceKm,
        roadDistanceKm: result.roadDistanceKm,
        radiusKm: result.radiusKm,
        remainingKm: result.remainingKm,
        deliveryType: result.isServiceable ? 'EXPRESS' : 'UNAVAILABLE',
        etaMin: result.estimatedDeliveryMinutes,
        etaMax: result.estimatedDeliveryMinutes > 0 ? result.estimatedDeliveryMinutes + 5 : 0,
        estimatedDeliveryMins: result.estimatedDeliveryMinutes,
        deliveryFee: result.deliveryFee,
        layer1Passed: result.layer1Passed,
        layer2Passed: result.layer2Passed,
        layer3Passed: result.layer3Passed,
        isStoreOpen: result.isStoreOpen,
        storeOperatingHours: result.storeOperatingHours,
        unserviceableReason: result.unserviceableReason,
        message: result.message,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Serviceability check failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { latitude, longitude, pincode, storeId } = body;

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { success: false, error: 'latitude and longitude are required' },
        { status: 400 }
      );
    }

    try {
      const shops = await fetchShopsFS();
      if (shops && shops.length > 0) {
        setStoresState(shops);
      }
    } catch (e) {}

    const result = checkZoneServiceability(latitude, longitude, pincode, storeId);

    return NextResponse.json({
      success: true,
      data: {
        available: result.isServiceable,
        isServiceable: result.isServiceable,
        storeId: result.storeId,
        storeName: result.storeName,
        storeCode: result.storeCode,
        distanceKm: result.distanceKm,
        straightLineDistanceKm: result.straightLineDistanceKm,
        roadDistanceKm: result.roadDistanceKm,
        radiusKm: result.radiusKm,
        remainingKm: result.remainingKm,
        deliveryType: result.isServiceable ? 'EXPRESS' : 'UNAVAILABLE',
        etaMin: result.estimatedDeliveryMinutes,
        etaMax: result.estimatedDeliveryMinutes > 0 ? result.estimatedDeliveryMinutes + 5 : 0,
        deliveryFee: result.deliveryFee,
        layer1Passed: result.layer1Passed,
        layer2Passed: result.layer2Passed,
        layer3Passed: result.layer3Passed,
        isStoreOpen: result.isStoreOpen,
        storeOperatingHours: result.storeOperatingHours,
        unserviceableReason: result.unserviceableReason,
        message: result.message,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Serviceability evaluation failed' },
      { status: 500 }
    );
  }
}
