import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { queryPostgres } from '@/lib/postgres';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    try {
      const res = await queryPostgres(
        `SELECT order_updates, promotional_offers, delivery_alerts, sound_enabled, vibration_enabled
         FROM notification_preferences
         WHERE user_id = $1`,
        [userId]
      );

      if (res.rowCount && res.rowCount > 0) {
        return NextResponse.json({
          success: true,
          preferences: {
            orderUpdates: res.rows[0].order_updates,
            promotionalOffers: res.rows[0].promotional_offers,
            deliveryAlerts: res.rows[0].delivery_alerts,
            soundEnabled: res.rows[0].sound_enabled,
            vibrationEnabled: res.rows[0].vibration_enabled,
          },
        });
      }
    } catch (e: any) {
      console.warn('[Preferences API] DB query notice:', e.message);
    }

    // Default preferences
    return NextResponse.json({
      success: true,
      preferences: {
        orderUpdates: true,
        promotionalOffers: true,
        deliveryAlerts: true,
        soundEnabled: true,
        vibrationEnabled: true,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId,
      orderUpdates = true,
      promotionalOffers = true,
      deliveryAlerts = true,
      soundEnabled = true,
      vibrationEnabled = true,
    } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    try {
      await queryPostgres(
        `INSERT INTO notification_preferences (
           id, user_id, order_updates, promotional_offers, delivery_alerts, sound_enabled, vibration_enabled, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id) DO UPDATE
         SET order_updates = EXCLUDED.order_updates,
             promotional_offers = EXCLUDED.promotional_offers,
             delivery_alerts = EXCLUDED.delivery_alerts,
             sound_enabled = EXCLUDED.sound_enabled,
             vibration_enabled = EXCLUDED.vibration_enabled,
             updated_at = CURRENT_TIMESTAMP`,
        [crypto.randomUUID(), userId, orderUpdates, promotionalOffers, deliveryAlerts, soundEnabled, vibrationEnabled]
      );
    } catch (e: any) {
      console.warn('[Preferences API] DB update notice:', e.message);
    }

    return NextResponse.json({
      success: true,
      preferences: {
        orderUpdates,
        promotionalOffers,
        deliveryAlerts,
        soundEnabled,
        vibrationEnabled,
      },
      message: 'Notification preferences updated',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
