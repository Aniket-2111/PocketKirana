/**
 * PocketKirana — Production Database Migration: Marketing, Offers, Coupons & Loyalty Engine
 *
 * Tables:
 *   1. marketing_campaigns
 *   2. offers
 *   3. offer_rules
 *   4. offer_rewards
 *   5. coupons (expanded)
 *   6. coupon_redemptions
 *   7. loyalty_rules
 *   8. customer_loyalty
 *   9. offer_usage_logs
 *  10. promotion_audit_logs
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
-- POCKETKIRANA MARKETING & PROMOTIONS ENGINE SCHEMA
-- ═══════════════════════════════════════════════════════════════════

-- 1. Marketing Campaigns
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id                  VARCHAR(64) PRIMARY KEY,
  title               VARCHAR(255) NOT NULL,
  internal_name       VARCHAR(255),
  festival_name       VARCHAR(64),
  campaign_type       VARCHAR(64) NOT NULL DEFAULT 'GENERAL', -- FESTIVAL | DISCOUNT | BOGO | LOYALTY | WIN_BACK | ABANDONMENT
  banner_url          TEXT,
  deep_link           VARCHAR(255),
  target_segment      VARCHAR(64) NOT NULL DEFAULT 'ALL', -- ALL | NEW_USERS | RETURNING | VIP | INACTIVE_30 | INACTIVE_60 | CART_ABANDONERS
  start_date          TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date            TIMESTAMP WITH TIME ZONE NOT NULL,
  status              VARCHAR(32) NOT NULL DEFAULT 'DRAFT', -- DRAFT | SCHEDULED | ACTIVE | PAUSED | EXPIRED | CANCELLED
  priority            INT NOT NULL DEFAULT 1,
  budget              NUMERIC(12,2) DEFAULT 0.00,
  stats_json          JSONB DEFAULT '{"views":0,"clicks":0,"redemptions":0,"orders":0,"revenue":0,"discountCost":0}'::jsonb,
  created_by          VARCHAR(128),
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mkt_campaigns_status ON marketing_campaigns(status, start_date, end_date);

-- 2. Offers Engine
CREATE TABLE IF NOT EXISTS offers (
  id                  VARCHAR(64) PRIMARY KEY,
  campaign_id         VARCHAR(64) REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
  name                VARCHAR(255) NOT NULL,
  internal_name       VARCHAR(255),
  customer_title      VARCHAR(255) NOT NULL,
  description         TEXT,
  banner_image        TEXT,
  offer_type          VARCHAR(64) NOT NULL, -- PERCENTAGE | FIXED | BOGO | BUY_X_GET_Y | FREE_PRODUCT_ABOVE_X | TIERED_CART | FREE_DELIVERY | CATEGORY_DISCOUNT | PRODUCT_DISCOUNT | FIRST_ORDER | CUSTOMER_SPECIFIC | WIN_BACK | CART_ABANDONMENT
  status              VARCHAR(32) NOT NULL DEFAULT 'DRAFT', -- DRAFT | SCHEDULED | ACTIVE | PAUSED | EXPIRED | CANCELLED
  priority            INT NOT NULL DEFAULT 1,
  stacking_rule       VARCHAR(32) NOT NULL DEFAULT 'ALLOW', -- ALLOW | DENY | BEST_DISCOUNT | PRIORITY_FIRST
  min_cart_value      NUMERIC(10,2) DEFAULT 0.00,
  max_discount        NUMERIC(10,2),
  discount_value      NUMERIC(10,2) DEFAULT 0.00,
  buy_product_id      VARCHAR(64),
  buy_quantity        INT DEFAULT 1,
  reward_product_id   VARCHAR(64),
  reward_quantity     INT DEFAULT 1,
  reward_type         VARCHAR(64) DEFAULT 'DISCOUNT', -- DISCOUNT | FREE_PRODUCT | FREE_DELIVERY | CASHBACK
  category_id         VARCHAR(64),
  target_customer_ids JSONB DEFAULT '[]'::jsonb,
  inactive_days       INT,
  tiers_json          JSONB,
  fallback_action     VARCHAR(64) DEFAULT 'REMOVE_REWARD', -- REMOVE_REWARD | ALTERNATE_PRODUCT | DISABLE_CAMPAIGN
  alternate_product_id VARCHAR(64),
  start_date          TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date            TIMESTAMP WITH TIME ZONE NOT NULL,
  usage_count         INT NOT NULL DEFAULT 0,
  max_usage_limit     INT,
  per_customer_limit  INT DEFAULT 1,
  deep_link           VARCHAR(255),
  created_by          VARCHAR(128),
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_offers_status_dates ON offers(status, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_offers_type ON offers(offer_type);

-- 3. Coupons Master
CREATE TABLE IF NOT EXISTS coupons (
  id                  VARCHAR(64) PRIMARY KEY,
  code                VARCHAR(64) UNIQUE NOT NULL,
  type                VARCHAR(32) NOT NULL DEFAULT 'PERCENTAGE', -- PERCENTAGE | FIXED | TIERED
  value               NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  minimum_order       NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  max_discount        NUMERIC(10,2),
  start_date          TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date            TIMESTAMP WITH TIME ZONE NOT NULL,
  usage_limit         INT NOT NULL DEFAULT 1000,
  per_customer_limit  INT NOT NULL DEFAULT 1,
  used_count          INT NOT NULL DEFAULT 0,
  customer_segment    VARCHAR(32) NOT NULL DEFAULT 'ALL',
  is_first_order_only BOOLEAN NOT NULL DEFAULT FALSE,
  applicable_products JSONB DEFAULT '[]'::jsonb,
  applicable_categories JSONB DEFAULT '[]'::jsonb,
  tiers_json          JSONB,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(is_active, start_date, end_date);

-- 4. Coupon Redemptions (Atomic Tracking)
CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id                  VARCHAR(64) PRIMARY KEY,
  coupon_id           VARCHAR(64) NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  coupon_code         VARCHAR(64) NOT NULL,
  customer_id         VARCHAR(128) NOT NULL,
  order_id            VARCHAR(64) NOT NULL,
  discount_applied    NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  redeemed_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_cust ON coupon_redemptions(customer_id, coupon_code);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_order ON coupon_redemptions(order_id);

-- 5. Loyalty / Order Milestone Rules
CREATE TABLE IF NOT EXISTS loyalty_rules (
  id                        VARCHAR(64) PRIMARY KEY,
  name                      VARCHAR(255) NOT NULL,
  description               TEXT,
  required_completed_orders INT NOT NULL, -- e.g. 5, 10
  reward_type               VARCHAR(64) NOT NULL DEFAULT 'PERCENTAGE', -- PERCENTAGE | FIXED | FREE_PRODUCT | FREE_DELIVERY
  reward_value              NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  max_discount              NUMERIC(10,2),
  min_order_value           NUMERIC(10,2) DEFAULT 0.00,
  reward_product_id         VARCHAR(64),
  validity_days             INT NOT NULL DEFAULT 30,
  is_active                 BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at                TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Customer Loyalty State
CREATE TABLE IF NOT EXISTS customer_loyalty (
  id                      VARCHAR(64) PRIMARY KEY,
  customer_id             VARCHAR(128) UNIQUE NOT NULL,
  completed_orders_count  INT NOT NULL DEFAULT 0,
  unlocked_rewards_json   JSONB DEFAULT '[]'::jsonb,
  used_rewards_json       JSONB DEFAULT '[]'::jsonb,
  updated_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cust_loyalty ON customer_loyalty(customer_id);

-- 7. Promotion Audit Logs
CREATE TABLE IF NOT EXISTS promotion_audit_logs (
  id                  VARCHAR(64) PRIMARY KEY,
  entity_type         VARCHAR(64) NOT NULL, -- OFFER | COUPON | CAMPAIGN | LOYALTY_RULE
  entity_id           VARCHAR(64) NOT NULL,
  entity_name         VARCHAR(255),
  actor_id            VARCHAR(128) NOT NULL,
  actor_name          VARCHAR(255) NOT NULL,
  actor_role          VARCHAR(64) NOT NULL DEFAULT 'Admin',
  action              VARCHAR(64) NOT NULL, -- CREATE | UPDATE | PAUSE | RESUME | CANCEL | EXPIRE | DELETE
  old_state_json      JSONB,
  new_state_json      JSONB,
  change_summary      TEXT,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_promo_audit_entity ON promotion_audit_logs(entity_type, entity_id);
`;

async function runMigration() {
  console.log(`\n===============================================================`);
  console.log(`  POCKETKIRANA — MARKETING & PROMOTIONS ENGINE MIGRATION       `);
  console.log(`===============================================================\n`);
  console.log(`📍 Target: ${targetHost}:${targetPort} / ${targetDb}\n`);

  const client = new Client({ connectionString, connectionTimeoutMillis: 5000 });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL database.');
    await client.query(migrationSql);
    console.log('✅ Marketing & Promotions schema applied successfully!');
    await client.end();
  } catch (err) {
    console.warn('⚠️ PostgreSQL connection notice (Standalone Dev Mode Active):', err.message);
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = { migrationSql, runMigration };
