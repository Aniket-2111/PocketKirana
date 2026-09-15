import { NextResponse } from 'next/server';
import { updateDeliveryTrackingFS, fetchLatestTrackingFS } from '@/lib/firebaseServices';
import { validateGpsUpdate, GpsFix } from '@/lib/locationServices';

// ── In-memory rate limiter (per partner, max 1 accepted write per 4 seconds) ──
const RATE_LIMIT_WINDOW_MS = 4_000;
const partnerLastWrite: Record<string, number> = {};

// ── Last accepted GPS fix per partner (for impossible-speed detection) ──
const lastGpsFix: Record<string, GpsFix> = {};

// ── Hard limits ──
const MAX_ACCURACY_M = 200; // absolute reject threshold

function rateExceeded(partnerId: string): boolean {
  const now = Date.now();
  const last = partnerLastWrite[partnerId] ?? 0;
  if (now - last < RATE_LIMIT_WINDOW_MS) return true;
  partnerLastWrite[partnerId] = now;
  return false;
}

// ══════════════════════════════════════════
// POST /api/delivery/location
// Called by delivery app to push a GPS fix
// ══════════════════════════════════════════
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      partnerId,
      orderId,
      latitude,
      longitude,
      accuracy,
      speed,
      heading,
      altitude,
      deviceTimestamp,
    } = body;

    // ── 1. Required field validation ──
    if (!partnerId || !orderId || latitude == null || longitude == null) {
      return NextResponse.json(
        { success: false, error: 'partnerId, orderId, latitude and longitude are required' },
        { status: 400 }
      );
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const acc = accuracy != null ? parseFloat(accuracy) : 999;
    const spd = speed != null ? parseFloat(speed) : 0;
    const hdg = heading != null ? parseFloat(heading) : 0;
    const alt = altitude != null ? parseFloat(altitude) : undefined;

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json(
        { success: false, error: 'Invalid coordinates' },
        { status: 400 }
      );
    }

    // ── 2. Hard accuracy reject ──
    if (acc > MAX_ACCURACY_M) {
      return NextResponse.json(
        { success: false, error: `GPS accuracy ${Math.round(acc)}m is too poor (max ${MAX_ACCURACY_M}m)`, skipped: true },
        { status: 422 }
      );
    }

    // ── 3. GPS validation (accuracy threshold + impossible-speed guard) ──
    const incoming: GpsFix = { latitude: lat, longitude: lng, accuracy: acc, timestamp: Date.now() };
    const prev = lastGpsFix[partnerId] ?? null;
    const validation = validateGpsUpdate(incoming, prev);

    if (!validation.valid) {
      console.warn(`[location] Rejected GPS fix for partner ${partnerId}: ${validation.reason}`);
      return NextResponse.json(
        { success: false, error: validation.reason, skipped: true },
        { status: 422 }
      );
    }

    // ── 4. Per-partner rate limiting ──
    if (rateExceeded(partnerId)) {
      return NextResponse.json(
        { success: false, error: 'Rate limit: too many updates', skipped: true },
        { status: 429 }
      );
    }

    // ── 5. Write to Firestore via the tracking service ──
    const assignmentId = `assign-${orderId}`;
    await updateDeliveryTrackingFS(
      assignmentId,
      partnerId,
      orderId,
      lat,
      lng,
      true,
      {
        accuracy: acc,
        speed: spd,
        heading: hdg,
        altitude: alt,
        deviceTimestamp: deviceTimestamp ?? new Date().toISOString(),
        partnerId,
        orderId,
        latitude: lat,
        longitude: lng,
      }
    );

    // ── 6. Update last accepted fix (for next validation round) ──
    lastGpsFix[partnerId] = incoming;

    return NextResponse.json({
      success: true,
      message: 'Location telemetry accepted',
      data: {
        partnerId,
        orderId,
        latitude: lat,
        longitude: lng,
        accuracy: acc,
        speed: spd,
        heading: hdg,
        receivedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[location POST] error:', error);
    return NextResponse.json(
      { success: false, error: error?.message ?? 'Failed to process location update' },
      { status: 500 }
    );
  }
}

// ══════════════════════════════════════════
// GET /api/delivery/location?orderId=...
// Called by customer app to get latest fix
// ══════════════════════════════════════════
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'orderId is required' },
        { status: 400 }
      );
    }

    const tracking = await fetchLatestTrackingFS(orderId);

    if (!tracking) {
      return NextResponse.json({ success: true, data: null });
    }

    // ── Privacy: if tracking session has ended, do not return partner location ──
    if (tracking.isActive === false) {
      return NextResponse.json({
        success: true,
        data: {
          orderId,
          isActive: false,
          status: tracking.status ?? 'ended',
          endedAt: tracking.endedAt ?? null,
        },
      });
    }

    // Return safe tracking snapshot (no other customers' data)
    return NextResponse.json({
      success: true,
      data: {
        orderId: tracking.orderId,
        partnerId: tracking.partnerId,
        latitude: tracking.currentLat,
        longitude: tracking.currentLng,
        accuracy: tracking.accuracy,
        speed: tracking.speed,
        heading: tracking.heading,
        isActive: tracking.isActive,
        updatedAt: tracking.updatedAt,
        receivedAt: tracking.receivedAt,
      },
    });
  } catch (error: any) {
    console.error('[location GET] error:', error);
    return NextResponse.json(
      { success: false, error: error?.message ?? 'Failed to fetch tracking data' },
      { status: 500 }
    );
  }
}
