/**
 * PocketKirana — Controlled Schema Migration v1.1.0 (Promotions & Coupons Engine)
 *
 * Target: PostgreSQL Database (pocketkirana_db)
 *
 * Adds:
 *   1. promotions (id, name, type, value, applies_to, target_id, min_cart_value, max_discount, start_date, end_date, is_active, customer_segment, stacking_rule)
 *   2. coupons (id, code, type, value, min_cart_value, max_discount, usage_limit, used_count, tiers_json, start_date, end_date, is_active, customer_segment)
 *   3. promotion_usage_logs (id, promotion_id, coupon_id, order_id, customer_uid, discount_amount, created_at)
 *
 * Usage:
 *   node scripts/migrate_v1_1_promotions.js
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Auto-load .env.local
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach((line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] ? match[2].trim() : '';
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        if (!process.env[key]) process.env[key] = val;
      }
    });
  }
} catch (_) {}

const targetHost = process.env.DB_HOST || '192.168.0.101';
const targetPort = parseInt(process.env.DB_PORT || '5433', 10);
const targetDb   = process.env.DB_NAME || 'pocketkirana_db';
const targetUser = process.env.DB_USER || 'postgres';
const targetPass = process.env.DB_PASSWORD || 'varbusiness';

const connectionString = `postgresql://${targetUser}:${encodeURIComponent(targetPass)}@${targetHost}:${targetPort}/${targetDb}`;

const migrationSql = `
-- ═══════════════════════════════════════════════════════════════════
-- SCHEMA v1.1.0: DYNAMIC PRICING, PROMOTIONS & COUPONS ENGINE
-- ═══════════════════════════════════════════════════════════════════

-- 1. Create promotions table
CREATE TABLE IF NOT EXISTS promotions (
  id                  VARCHAR(64)   PRIMARY KEY,
  name                VARCHAR(128)  NOT NULL,
  type                VARCHAR(32)   NOT NULL, -- PERCENTAGE | FLAT | BOGO | CATEGORY_DISCOUNT
  value               NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  applies_to          VARCHAR(32)   NOT NULL DEFAULT 'ENTIRE_STORE', -- ENTIRE_STORE | CATEGORY | PRODUCT | COLLECTION
  target_id           VARCHAR(64),
  min_cart_value      NUMERIC(10,2) DEFAULT 0.00,
  max_discount_amount NUMERIC(10,2),
  start_date          TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date            TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active           BOOLEAN       NOT NULL DEFAULT TRUE,
  customer_segment    VARCHAR(32)   NOT NULL DEFAULT 'ALL', -- ALL | NEW_CUSTOMER | RETURNING | VIP
  stacking_rule       VARCHAR(32)   NOT NULL DEFAULT 'BEST_DISCOUNT',
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_promotions_target ON promotions(applies_to, target_id);

-- 2. Expand coupons table for tiered structures & segmentation
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS tiers_json JSONB;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS customer_segment VARCHAR(32) NOT NULL DEFAULT 'ALL';
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS used_count INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_validity ON coupons(is_active, valid_from, valid_until);

-- 3. Create promotion_usage_logs table
CREATE TABLE IF NOT EXISTS promotion_usage_logs (
  id                  VARCHAR(64)   PRIMARY KEY,
  promotion_id        VARCHAR(64)   REFERENCES promotions(id) ON DELETE SET NULL,
  coupon_id           VARCHAR(64)   REFERENCES coupons(id) ON DELETE SET NULL,
  order_id            VARCHAR(64)   NOT NULL,
  customer_uid        VARCHAR(128),
  discount_amount     NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_promo_usage_order ON promotion_usage_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_promo_usage_customer ON promotion_usage_logs(customer_uid);
`;

async function runMigration() {
  console.log(`\n===============================================================`);
  console.log(`  POCKETKIRANA — CONTROLLED SCHEMA MIGRATION v1.1.0           `);
  console.log(`===============================================================\n`);
  console.log(`📍 Target: ${targetHost}:${targetPort} / ${targetDb}\n`);

  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log(`✔ Connected to database.`);

    await client.query('BEGIN');
    await client.query(migrationSql);
    await client.query('COMMIT');

    console.log(`✔ Migration v1.1.0 executed successfully.`);

    // Verify created tables
    const tableRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('promotions', 'coupons', 'promotion_usage_logs')
    `);

    console.log(`\n📊 Verified Tables (${tableRes.rowCount}/3):`);
    tableRes.rows.forEach(r => console.log(`  - public.${r.table_name}`));

    const totalRes = await client.query(`SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'`);
    console.log(`\n🎉 Database Schema Total Tables: ${totalRes.rows[0].count} Tables\n`);

  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error(`❌ Migration v1.1.0 failed:`, err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

runMigration();
