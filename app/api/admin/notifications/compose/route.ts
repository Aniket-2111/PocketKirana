import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { queryPostgres } from '@/lib/postgres';
import { dispatchNotification, OrderNotificationEvent } from '@/lib/notificationDispatcher';

let _adminApp: any = null;
function getAdminApp(): any {
  if (_adminApp) return _adminApp;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const admin = require('firebase-admin');
    if (admin.apps?.length > 0) {
      _adminApp = admin.apps[0];
      return _adminApp;
    }
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      _adminApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId,
      });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      _adminApp = admin.initializeApp({ projectId });
    }
    return _adminApp;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      title,
      message,
      targetAudience = 'ALL_CUSTOMERS', // 'ALL_CUSTOMERS' | 'ACTIVE_CUSTOMERS' | 'ALL_PICKERS' | 'ALL_DELIVERY' | 'SPECIFIC_USER'
      targetUserId,
      deepLink = '/home',
      sound = 'default',
      category = 'PROMOTION', // 'PROMOTION' | 'ANNOUNCEMENT' | 'OPERATIONAL' | 'OFFER'
      campaignId = crypto.randomUUID(),
    } = body;

    if (!title || !message) {
      return NextResponse.json(
        { error: 'title and message are required' },
        { status: 400 }
      );
    }

    const campaignRecordId = crypto.randomUUID();

    // 1. Record Campaign in notification_campaigns table
    try {
      await queryPostgres(
        `INSERT INTO notification_campaigns (
           id, title, message, target_audience, deep_link, sound, created_by, status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'IN_PROGRESS')`,
        [campaignRecordId, title, message, targetAudience, deepLink, sound, 'ADMIN']
      );
    } catch (e: any) {
      console.warn('[Admin Compose API] DB campaign notice:', e.message);
    }

    let recipientUids: string[] = [];

    if (targetAudience === 'SPECIFIC_USER' && targetUserId) {
      recipientUids = [targetUserId];
    } else if (targetAudience === 'ALL_CUSTOMERS') {
      try {
        const usersRes = await queryPostgres(`SELECT DISTINCT firebase_uid FROM orders WHERE firebase_uid IS NOT NULL LIMIT 200`);
        recipientUids = usersRes.rows.map((r: any) => r.firebase_uid);
      } catch {}
      // Also get from user_devices
      try {
        const devRes = await queryPostgres(`SELECT DISTINCT user_id FROM user_devices WHERE is_active = TRUE AND user_id IS NOT NULL LIMIT 200`);
        const devUids = devRes.rows.map((r: any) => r.user_id);
        recipientUids = Array.from(new Set([...recipientUids, ...devUids]));
      } catch {}
    } else if (targetAudience === 'ALL_PICKERS') {
      try {
        const devRes = await queryPostgres(`SELECT DISTINCT user_id FROM user_devices WHERE platform LIKE '%picker%' OR user_id LIKE '%picker%' LIMIT 50`);
        recipientUids = devRes.rows.map((r: any) => r.user_id);
      } catch {}
      if (recipientUids.length === 0) recipientUids = ['ALL_PICKERS'];
    } else if (targetAudience === 'ALL_DELIVERY') {
      try {
        const devRes = await queryPostgres(`SELECT DISTINCT user_id FROM user_devices WHERE platform LIKE '%delivery%' OR user_id LIKE '%delivery%' LIMIT 50`);
        recipientUids = devRes.rows.map((r: any) => r.user_id);
      } catch {}
      if (recipientUids.length === 0) recipientUids = ['ALL_DELIVERY'];
    }

    // Default sample if empty in dev
    if (recipientUids.length === 0 && targetUserId) {
      recipientUids = [targetUserId];
    }

    // Determine event type
    const eventType: OrderNotificationEvent =
      category === 'OFFER' ? 'ADMIN_OFFER' :
      category === 'ANNOUNCEMENT' ? 'ADMIN_ANNOUNCEMENT' :
      'SYSTEM_ALERT';

    // Broadcast in background
    let sentCount = 0;
    setImmediate(async () => {
      for (const uid of recipientUids) {
        try {
          await dispatchNotification({
            recipientUid: uid,
            event: eventType,
            orderId: campaignId,
            orderNumber: 'OFFER',
            context: {
              offerTitle: title,
              offerMessage: message,
              deepLink,
            },
          });
          sentCount++;
        } catch {}
      }

      // Update campaign status
      try {
        await queryPostgres(
          `UPDATE notification_campaigns
           SET status = 'SENT',
               total_recipients = $1,
               sent_count = $2,
               sent_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [recipientUids.length, sentCount, campaignRecordId]
        );
      } catch {}
    });

    return NextResponse.json({
      success: true,
      campaignId: campaignRecordId,
      targetAudience,
      recipientCount: recipientUids.length,
      message: `Broadcast notification initiated for ${recipientUids.length} recipient(s)`,
    });
  } catch (error: any) {
    console.error('[Admin Compose API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const res = await queryPostgres(
      `SELECT id, title, message, target_audience, deep_link, total_recipients, sent_count, status, created_at, sent_at
       FROM notification_campaigns
       ORDER BY created_at DESC
       LIMIT 50`
    );

    return NextResponse.json({
      success: true,
      campaigns: res.rows,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: true,
      campaigns: [],
      error: error.message,
    });
  }
}
