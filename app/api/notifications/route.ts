import { NextRequest, NextResponse } from 'next/server';
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
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const role = searchParams.get('role') || 'customer';
    const limit = parseInt(searchParams.get('limit') || '30', 10);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // 1. Try PostgreSQL notifications table
    try {
      let query = `
        SELECT id, event_id, order_id, firebase_uid, recipient_type, notification_type,
               title, message, channel, status, is_read, read_at, created_at
        FROM notifications
        WHERE firebase_uid = $1
      `;
      const params: any[] = [userId];

      if (unreadOnly) {
        query += ` AND is_read = FALSE`;
      }

      query += ` ORDER BY created_at DESC LIMIT $2`;
      params.push(limit);

      const res = await queryPostgres(query, params);

      // Unread count
      const countRes = await queryPostgres(
        `SELECT COUNT(*) as unread_count FROM notifications WHERE firebase_uid = $1 AND is_read = FALSE`,
        [userId]
      );
      const unreadCount = parseInt(countRes.rows[0]?.unread_count || '0', 10);

      return NextResponse.json({
        success: true,
        source: 'postgres',
        unreadCount,
        notifications: res.rows.map((r: any) => ({
          id: r.id,
          eventId: r.event_id,
          orderId: r.order_id,
          recipientType: r.recipient_type,
          notificationType: r.notification_type,
          title: r.title,
          message: r.message,
          isRead: r.is_read || false,
          readAt: r.read_at,
          createdAt: r.created_at,
        })),
      });
    } catch (pgErr: any) {
      console.warn('[Notifications API] Postgres notice:', pgErr.message);
    }

    // 2. Fallback: Query Firestore notifications
    try {
      const db = getFirestoreDb();
      if (db) {
        let queryRef = db.collection(COLLECTIONS.NOTIFICATIONS).where('uid', '==', userId);
        const snapshot = await queryRef.orderBy('createdAt', 'desc').limit(limit).get();

        const notifications = snapshot.docs.map((doc: any) => {
          const d = doc.data();
          return {
            id: doc.id,
            orderId: d.orderId,
            title: d.title,
            message: d.body || d.message,
            notificationType: d.event || 'GENERAL',
            isRead: d.isRead || false,
            createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : new Date().toISOString(),
          };
        });

        const unreadCount = notifications.filter((n: any) => !n.isRead).length;

        return NextResponse.json({
          success: true,
          source: 'firestore',
          unreadCount,
          notifications,
        });
      }
    } catch (fsErr: any) {
      console.warn('[Notifications API] Firestore fallback notice:', fsErr.message);
    }

    return NextResponse.json({
      success: true,
      unreadCount: 0,
      notifications: [],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { notificationId, userId, markAll = false } = body;

    if (!userId && !notificationId) {
      return NextResponse.json({ error: 'notificationId or userId is required' }, { status: 400 });
    }

    try {
      if (markAll && userId) {
        await queryPostgres(
          `UPDATE notifications SET is_read = TRUE, read_at = CURRENT_TIMESTAMP WHERE firebase_uid = $1 AND is_read = FALSE`,
          [userId]
        );
      } else if (notificationId) {
        await queryPostgres(
          `UPDATE notifications SET is_read = TRUE, read_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [notificationId]
        );
      }
    } catch (pgErr: any) {
      console.warn('[Notifications API PATCH] Postgres notice:', pgErr.message);
    }

    // Also update Firestore if available
    try {
      const db = getFirestoreDb();
      if (db) {
        if (notificationId) {
          await db.collection(COLLECTIONS.NOTIFICATIONS).doc(notificationId).update({
            isRead: true,
          });
        }
      }
    } catch {}

    return NextResponse.json({
      success: true,
      message: markAll ? 'All notifications marked as read' : 'Notification marked as read',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
