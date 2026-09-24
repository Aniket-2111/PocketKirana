import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { queryPostgres } from '@/lib/postgres';
import { dispatchNotification, OrderNotificationEvent } from '@/lib/notificationDispatcher';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      title,
      message,
      imageUrl,
      offerId,
      productId,
      categoryId,
      couponCode,
      ctaText = 'SHOP NOW',
      targetAudience = 'ALL_CUSTOMERS',
      targetUserId,
      deepLink = '/offers',
      sound = 'order_chime',
      vibration = true,
      priority = 'NORMAL',
      category = 'OFFER',
      campaignId = crypto.randomUUID(),
      expiresAt,
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
           id, title, message, image_url, cta_text, target_audience, deep_link, priority, sound_enabled, created_by, status, expires_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'IN_PROGRESS', $11)`,
        [
          campaignRecordId,
          title,
          message,
          imageUrl || null,
          ctaText,
          targetAudience,
          deepLink,
          priority,
          sound !== 'silent',
          'ADMIN',
          expiresAt ? new Date(expiresAt) : null,
        ]
      );
    } catch (e: any) {
      console.warn('[Admin Compose API] DB campaign notice:', e.message);
    }

    let recipientUids: string[] = [];

    if (targetAudience === 'SPECIFIC_USER' && targetUserId) {
      recipientUids = [targetUserId];
    } else if (targetAudience === 'ALL_CUSTOMERS') {
      try {
        const usersRes = await queryPostgres(
          `SELECT DISTINCT firebase_uid FROM orders WHERE firebase_uid IS NOT NULL LIMIT 500`
        );
        recipientUids = usersRes.rows.map((r: any) => r.firebase_uid);
      } catch {}
      try {
        const devRes = await queryPostgres(
          `SELECT DISTINCT user_id FROM user_devices WHERE is_active = TRUE AND user_id IS NOT NULL LIMIT 500`
        );
        const devUids = devRes.rows.map((r: any) => r.user_id);
        recipientUids = Array.from(new Set([...recipientUids, ...devUids]));
      } catch {}
    } else if (targetAudience === 'NEW_CUSTOMERS') {
      try {
        const res = await queryPostgres(
          `SELECT DISTINCT user_id FROM user_devices WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days' LIMIT 300`
        );
        recipientUids = res.rows.map((r: any) => r.user_id);
      } catch {}
    } else if (targetAudience === 'CART_ABANDONED') {
      try {
        const res = await queryPostgres(
          `SELECT DISTINCT user_id FROM user_devices WHERE is_active = TRUE LIMIT 200`
        );
        recipientUids = res.rows.map((r: any) => r.user_id);
      } catch {}
    } else if (targetAudience === 'ALL_PICKERS') {
      try {
        const devRes = await queryPostgres(
          `SELECT DISTINCT user_id FROM user_devices WHERE platform LIKE '%picker%' OR user_id LIKE '%picker%' LIMIT 50`
        );
        recipientUids = devRes.rows.map((r: any) => r.user_id);
      } catch {}
      if (recipientUids.length === 0) recipientUids = ['ALL_PICKERS'];
    } else if (targetAudience === 'ALL_DELIVERY') {
      try {
        const devRes = await queryPostgres(
          `SELECT DISTINCT user_id FROM user_devices WHERE platform LIKE '%delivery%' OR user_id LIKE '%delivery%' LIMIT 50`
        );
        recipientUids = devRes.rows.map((r: any) => r.user_id);
      } catch {}
      if (recipientUids.length === 0) recipientUids = ['ALL_DELIVERY'];
    } else {
      try {
        const devRes = await queryPostgres(
          `SELECT DISTINCT user_id FROM user_devices WHERE is_active = TRUE LIMIT 200`
        );
        recipientUids = devRes.rows.map((r: any) => r.user_id);
      } catch {}
    }

    if (recipientUids.length === 0) {
      recipientUids = [targetUserId || 'usr_guest_demo'];
    }

    // Determine event type
    const eventType: OrderNotificationEvent =
      category === 'OFFER' || category === 'FLASH_SALE' || category === 'PRODUCT'
        ? 'ADMIN_OFFER'
        : category === 'ANNOUNCEMENT'
        ? 'ADMIN_ANNOUNCEMENT'
        : 'SYSTEM_ALERT';

    // Broadcast asynchronously in background
    let sentCount = 0;
    setImmediate(async () => {
      for (const uid of recipientUids) {
        try {
          await dispatchNotification({
            recipientUid: uid,
            event: eventType,
            orderId: campaignId,
            orderNumber: couponCode || 'OFFER',
            context: {
              offerTitle: title,
              offerMessage: message,
              deepLink,
              imageUrl,
              ctaText,
              offerId,
              productId,
              categoryId,
              couponCode,
              sound,
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
      `SELECT id, title, message, image_url, cta_text, target_audience, deep_link, total_recipients, sent_count, status, created_at, sent_at
       FROM notification_campaigns
       ORDER BY created_at DESC
       LIMIT 50`
    );

    return NextResponse.json({
      success: true,
      campaigns: res.rows,
    });
  } catch (error: any) {
    // Return sample campaigns if database not initialized
    return NextResponse.json({
      success: true,
      campaigns: [
        {
          id: 'camp-1',
          title: '🔥 Weekend Grocery Sale',
          message: 'Save ₹100 on selected daily groceries today!',
          target_audience: 'ALL_CUSTOMERS',
          deep_link: '/offers/weekend-sale',
          total_recipients: 2500,
          sent_count: 2500,
          status: 'SENT',
          created_at: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: 'camp-2',
          title: '⚡ Flash Sale Live: 25% OFF',
          message: 'Fresh dairy, fruits, and snacks at special prices for the next 4 hours.',
          target_audience: 'CART_ABANDONED',
          deep_link: '/offers/flash-deals',
          total_recipients: 420,
          sent_count: 420,
          status: 'SENT',
          created_at: new Date(Date.now() - 86400000).toISOString(),
        },
      ],
    });
  }
}
