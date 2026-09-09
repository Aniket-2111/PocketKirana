import { NextResponse } from 'next/server';

let DRIVER_TELEMETRY_STORE: Record<string, {
  partnerId: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  status: 'ONLINE' | 'ON_DELIVERY' | 'OFFLINE';
  lastUpdated: string;
}> = {
  'partner-1': {
    partnerId: 'partner-1',
    latitude: 19.0315,
    longitude: 73.3155,
    heading: 45,
    speed: 24,
    status: 'ON_DELIVERY',
    lastUpdated: new Date().toISOString(),
  },
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const partnerId = searchParams.get('partnerId');

    if (partnerId && DRIVER_TELEMETRY_STORE[partnerId]) {
      return NextResponse.json({
        success: true,
        data: DRIVER_TELEMETRY_STORE[partnerId],
      });
    }

    return NextResponse.json({
      success: true,
      data: Object.values(DRIVER_TELEMETRY_STORE),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch driver location telemetry' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { partnerId, latitude, longitude, heading = 0, speed = 0, status = 'ONLINE' } = body;

    if (!partnerId || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { success: false, error: 'partnerId, latitude, and longitude are required' },
        { status: 400 }
      );
    }

    const telemetry = {
      partnerId,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      heading: parseFloat(heading),
      speed: parseFloat(speed),
      status,
      lastUpdated: new Date().toISOString(),
    };

    DRIVER_TELEMETRY_STORE[partnerId] = telemetry;

    return NextResponse.json({
      success: true,
      message: 'Driver location telemetry updated',
      data: telemetry,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update driver telemetry' },
      { status: 500 }
    );
  }
}
