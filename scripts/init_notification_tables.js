/**
 * PocketKirana — Production Notification Database Migration
 * Creates/updates PostgreSQL tables for:
 *   1. user_devices
 *   2. notifications
 *   3. notification_campaigns
 *   4. notification_preferences
 *   5. notification_events (idempotency ledger)
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pocketkirana',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function migrateNotificationTables() {
  const client = await pool.connect();
  try {
    console.log('🚀 Starting notification system database migration...');
    await client.query('BEGIN');

    // 1. user_devices
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_devices (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(128) NOT NULL,
        device_id VARCHAR(128) NOT NULL,
        platform VARCHAR(32) NOT NULL DEFAULT 'web',
        push_token TEXT NOT NULL,
        app_version VARCHAR(32) DEFAULT '1.0.0',
        is_active BOOLEAN DEFAULT TRUE,
        last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_user_device UNIQUE (user_id, device_id)
      );
    `);
    console.log('✓ user_devices table ready');

    // 2. notifications
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(64) PRIMARY KEY,
        event_id VARCHAR(64),
        order_id VARCHAR(64),
        user_id VARCHAR(128) NOT NULL,
        firebase_uid VARCHAR(128),
        recipient_type VARCHAR(32) NOT NULL DEFAULT 'customer',
        role VARCHAR(32) DEFAULT 'customer',
        notification_type VARCHAR(64) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        channel VARCHAR(32) DEFAULT 'PUSH_AND_INAPP',
        data JSONB DEFAULT '{}'::jsonb,
        priority VARCHAR(16) DEFAULT 'NORMAL',
        sound VARCHAR(64) DEFAULT 'default',
        is_read BOOLEAN DEFAULT FALSE,
        read_at TIMESTAMP WITH TIME ZONE,
        delivered_at TIMESTAMP WITH TIME ZONE,
        clicked_at TIMESTAMP WITH TIME ZONE,
        status VARCHAR(32) DEFAULT 'SENT',
        expires_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure helpful indexes exist
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_firebase_uid ON notifications (firebase_uid);
      CREATE INDEX IF NOT EXISTS idx_notifications_order_id ON notifications (order_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications (user_id, is_read);
    `);
    console.log('✓ notifications table ready');

    // 3. notification_campaigns
    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_campaigns (
        id VARCHAR(64) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        image_url TEXT,
        cta_text VARCHAR(64),
        deep_link TEXT,
        target_audience VARCHAR(64) DEFAULT 'all_customers',
        customer_segment VARCHAR(64) DEFAULT 'all',
        priority VARCHAR(16) DEFAULT 'NORMAL',
        sound_enabled BOOLEAN DEFAULT TRUE,
        sent_count INTEGER DEFAULT 0,
        delivered_count INTEGER DEFAULT 0,
        opened_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        status VARCHAR(32) DEFAULT 'DRAFT',
        scheduled_at TIMESTAMP WITH TIME ZONE,
        expires_at TIMESTAMP WITH TIME ZONE,
        created_by VARCHAR(128) NOT NULL DEFAULT 'admin',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ notification_campaigns table ready');

    // 4. notification_preferences
    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        user_id VARCHAR(128) PRIMARY KEY,
        role VARCHAR(32) DEFAULT 'customer',
        order_updates BOOLEAN DEFAULT TRUE,
        delivery_updates BOOLEAN DEFAULT TRUE,
        payment_updates BOOLEAN DEFAULT TRUE,
        offers_promotions BOOLEAN DEFAULT TRUE,
        system_alerts BOOLEAN DEFAULT TRUE,
        sound_enabled BOOLEAN DEFAULT TRUE,
        vibration_enabled BOOLEAN DEFAULT TRUE,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ notification_preferences table ready');

    // 5. notification_events (Idempotency Ledger)
    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_events (
        id VARCHAR(64) PRIMARY KEY,
        event_id VARCHAR(64) NOT NULL,
        recipient_id VARCHAR(128) NOT NULL,
        notification_type VARCHAR(64) NOT NULL,
        order_id VARCHAR(64),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_event_recipient_type UNIQUE (event_id, recipient_id, notification_type)
      );
    `);
    console.log('✓ notification_events table ready');

    await client.query('COMMIT');
    console.log('🎉 Notification database schema migration completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  migrateNotificationTables();
}

module.exports = { migrateNotificationTables };
