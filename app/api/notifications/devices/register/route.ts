import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { queryPostgres } from '@/lib/postgres';
import { COLLECTIONS } from '@/lib/firestoreSchema';

let _adminDb: any = null;
function getFirestoreDb(): any {
  if (_adminDb) return _adminDb;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const admin = require('firebase-admin');
    if (admin.apps?.length > 0) {
      _adminDb = admin.firestore();
      return _adminDb;
    }
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      const app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId,
      });
      _adminDb = app.firestore();
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const app = admin.initializeApp({ projectId });
      _adminDb = app.firestore();
    }
    return _adminDb;
  } catch (err: any) {
    console.warn('[DeviceRegister API] Firestore admin init warning:', err.message);
    return null;
  }
}

// In-memory fallback token store
const memoryDeviceTokens = new Map<string, { userId: string; token: string; platform: string; updatedAt: string }>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId,
      deviceId = crypto.randomUUID(),
      platform = 'web', // 'web' | 'android' | 'ios'
      pushToken,
      appVersion = '1.0.0',
      appType = 'customer', // 'customer' | 'picker' | 'delivery' | 'admin'
    } = body;

    if (!userId || !pushToken) {
      return NextResponse.json(
        { error: 'userId and pushToken are required' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // 1. Try PostgreSQL insertion / update
    let pgSuccess = false;
    try {
      await queryPostgres(
        `INSERT INTO user_devices (
           id, user_id, device_id, platform, push_token, app_version, is_active, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, TRUE, CURRENT_TIMESTAMP)
         ON CONFLICT (device_id) DO UPDATE
         SET user_id = EXCLUDED.user_id,
             push_token = EXCLUDED.push_token,
             platform = EXCLUDED.platform,
             app_version = EXCLUDED.app_version,
             is_active = TRUE,
             updated_at = CURRENT_TIMESTAMP`,
        [crypto.randomUUID(), userId, deviceId, platform, pushToken, appVersion]
      );
      pgSuccess = true;
    } catch (dbErr: any) {
      console.warn('[DeviceRegister API] Postgres write notice:', dbErr.message);
    }

    // 2. Always sync with Firestore notificationTokens collection
    try {
      const db = getFirestoreDb();
      if (db) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const admin = require('firebase-admin');
        const tokenDocRef = db.collection(COLLECTIONS.NOTIFICATION_TOKENS).doc(userId);
        await tokenDocRef.set(
          {
            userId,
            appType,
            platform,
            tokens: admin.firestore.FieldValue.arrayUnion(pushToken),
            lastActive: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
    } catch (fsErr: any) {
      console.warn('[DeviceRegister API] Firestore write notice:', fsErr.message);
    }

    // 3. Keep in-memory cache
    memoryDeviceTokens.set(deviceId, {
      userId,
      token: pushToken,
      platform,
      updatedAt: now,
    });

    return NextResponse.json({
      success: true,
      deviceId,
      userId,
      platform,
      syncedPg: pgSuccess,
      message: 'Push notification device registered successfully',
    });
  } catch (error: any) {
    console.error('[DeviceRegister API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to register device token', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const deviceId = searchParams.get('deviceId');
    const userId = searchParams.get('userId');
    const pushToken = searchParams.get('pushToken');

    if (!deviceId && !pushToken) {
      return NextResponse.json({ error: 'deviceId or pushToken required' }, { status: 400 });
    }

    try {
      if (deviceId) {
        await queryPostgres(
          `UPDATE user_devices SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE device_id = $1`,
          [deviceId]
        );
      } else if (pushToken) {
        await queryPostgres(
          `UPDATE user_devices SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE push_token = $1`,
          [pushToken]
        );
      }
    } catch (e: any) {
      console.warn('[DeviceUnregister API] DB notice:', e.message);
    }

    if (userId && pushToken) {
      try {
        const db = getFirestoreDb();
        if (db) {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const admin = require('firebase-admin');
          await db.collection(COLLECTIONS.NOTIFICATION_TOKENS).doc(userId).update({
            tokens: admin.firestore.FieldValue.arrayRemove(pushToken),
          });
        }
      } catch {}
    }

    if (deviceId) memoryDeviceTokens.delete(deviceId);

    return NextResponse.json({ success: true, message: 'Device token unregistered' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
