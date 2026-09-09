import { NextResponse } from 'next/server';
import { resolveLocationFromCoords } from '@/lib/locationServices';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { latitude, longitude } = body;

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { success: false, error: 'Latitude and Longitude are required' },
        { status: 400 }
      );
    }

    const locationData = await resolveLocationFromCoords(latitude, longitude);

    return NextResponse.json({
      success: true,
      data: locationData,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Reverse geocoding failed' },
      { status: 500 }
    );
  }
}
