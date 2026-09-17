import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { queryPostgres } from '@/lib/postgres';

let _adminDb: any = null;
function getFirestoreDb(): any {
  if (_adminDb) return _adminDb;
  try {
    const admin = require('firebase-admin');
    if (admin.apps?.length > 0) {
      _adminDb = admin.firestore();
      return _adminDb;
    }
  } catch {}
  return null;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const {
      latitude,
      longitude,
      bearing = 0,
      speed = 0,
      accuracy = 5,
      batteryLevel = 100,
      partnerId = 'rider_default',
      assignmentId,
    } = body;

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { success: false, error: 'latitude and longitude are required' },
        { status: 400 }
      );
    }

    const recordedAt = new Date().toISOString();

    try {
      await queryPostgres(
        `INSERT INTO delivery_locations (
           id, order_id, assignment_id, partner_id, latitude, longitude,
           bearing, speed, accuracy, battery_level, recorded_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)`,
        [
          crypto.randomUUID(),
          id,
          assignmentId || null,
          partnerId,
          latitude,
          longitude,
          bearing,
          speed,
          accuracy,
          batteryLevel,
        ]
      );
    } catch {}

    try {
      const db = getFirestoreDb();
      if (db) {
        await db.collection('delivery_tracking').doc(id).set(
          {
            orderId: id,
            partnerId,
            latitude,
            longitude,
            bearing,
            speed,
            accuracy,
            updatedAt: recordedAt,
          },
          { merge: true }
        );
      }
    } catch {}

    return NextResponse.json({
      success: true,
      data: {
        orderId: id,
        latitude,
        longitude,
        recordedAt,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to update delivery location' },
      { status: 500 }
    );
  }
}
