/**
 * PocketKirana — Architecture Consolidation Migration Script
 * 
 * Adds missing tables and columns to complete the clean architecture:
 *   PostgreSQL = business source of truth
 *   Firebase   = identity + customer realtime + notifications
 * 
 * SAFE: Uses CREATE TABLE IF NOT EXISTS and ADD COLUMN IF NOT EXISTS.
 *       Never drops tables or existing data.
 * 
 * Usage: node scripts/migrate_to_clean_architecture.js
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Auto-load .env.local if present
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
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
} catch (e) {
  // ignore
}

const targetHost = process.env.DB_HOST || '192.168.0.101';
const targetPort = parseInt(process.env.DB_PORT || '5433', 10);
const targetDb   = process.env.DB_NAME || 'pocketkirana_db';
const targetUser = process.env.DB_USER || 'postgres';
const targetPass = process.env.DB_PASSWORD || 'varbusiness';

const connectionString = `postgresql://${targetUser}:${encodeURIComponent(targetPass)}@${targetHost}:${targetPort}/${targetDb}`;

// ─────────────────────────────────────────────────────────────────────────────
// MIGRATION SQL
// ─────────────────────────────────────────────────────────────────────────────

const migrationSql = `

-- ═══════════════════════════════════════════════════════════════════
-- SECTION A: MISSING TABLES
-- ═══════════════════════════════════════════════════════════════════

--------------------------------------------------------------------------------
-- A1. picking_task_items
--     Tracks each product line inside a picking task.
--     Picker scans barcode → updates picked_quantity → marks status.
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS picking_task_items (
  id                 VARCHAR(64)  PRIMARY KEY,
  picking_task_id    VARCHAR(64)  NOT NULL REFERENCES picking_tasks(id)    ON DELETE CASCADE,
  order_item_id      VARCHAR(64)  NOT NULL REFERENCES order_items(id)      ON DELETE CASCADE,
  product_id         VARCHAR(64)  NOT NULL REFERENCES products(id)         ON DELETE RESTRICT,
  variant_id         VARCHAR(64)  REFERENCES product_variants(id)          ON DELETE RESTRICT,
  barcode            VARCHAR(64),
  required_quantity  INT          NOT NULL DEFAULT 1,
  picked_quantity    INT          NOT NULL DEFAULT 0,
  -- status: pending | scanning | picked | partially_picked | skipped | out_of_stock
  status             VARCHAR(32)  NOT NULL DEFAULT 'pending',
  notes              TEXT,
  created_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_picking_task_items_task    ON picking_task_items(picking_task_id);
CREATE INDEX IF NOT EXISTS idx_picking_task_items_barcode ON picking_task_items(barcode);

--------------------------------------------------------------------------------
-- A2. packing_tasks
--     Created automatically when a picking_task reaches status = 'completed'.
--     Packer confirms each item is properly packed before marking READY.
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS packing_tasks (
  id               VARCHAR(64)  PRIMARY KEY,
  picking_task_id  VARCHAR(64)  NOT NULL REFERENCES picking_tasks(id) ON DELETE CASCADE,
  order_id         VARCHAR(64)  NOT NULL REFERENCES orders(id)         ON DELETE CASCADE,
  packer_id        VARCHAR(128),          -- firebase_uid of the packer
  packer_name      VARCHAR(128),
  -- status: pending | in_progress | packed | ready_for_pickup
  status           VARCHAR(32)  NOT NULL DEFAULT 'pending',
  started_at       TIMESTAMP WITH TIME ZONE,
  completed_at     TIMESTAMP WITH TIME ZONE,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_packing_tasks_order   ON packing_tasks(order_id);
CREATE INDEX IF NOT EXISTS idx_packing_tasks_packer  ON packing_tasks(packer_id);
CREATE INDEX IF NOT EXISTS idx_packing_tasks_status  ON packing_tasks(status);

--------------------------------------------------------------------------------
-- A3. packing_items
--     Each product line inside a packing task, confirmed by the packer.
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS packing_items (
  id               VARCHAR(64)  PRIMARY KEY,
  packing_task_id  VARCHAR(64)  NOT NULL REFERENCES packing_tasks(id)   ON DELETE CASCADE,
  order_item_id    VARCHAR(64)  NOT NULL REFERENCES order_items(id)      ON DELETE CASCADE,
  packed_quantity  INT          NOT NULL DEFAULT 0,
  is_confirmed     BOOLEAN      NOT NULL DEFAULT FALSE,
  notes            TEXT,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_packing_items_task ON packing_items(packing_task_id);

--------------------------------------------------------------------------------
-- A4. delivery_earnings
--     Immutable financial record per completed delivery trip.
--     Source of truth for partner payouts — never store in Firestore.
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS delivery_earnings (
  id                   VARCHAR(64)  PRIMARY KEY,
  delivery_partner_id  VARCHAR(64)  NOT NULL REFERENCES delivery_partners(id) ON DELETE RESTRICT,
  assignment_id        VARCHAR(64)  NOT NULL REFERENCES delivery_assignments(id) ON DELETE RESTRICT,
  order_id             VARCHAR(64)  NOT NULL REFERENCES orders(id)              ON DELETE RESTRICT,
  base_fee             NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  distance_fee         NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  peak_bonus           NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  total_earnings       NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  distance_km          NUMERIC(6, 2),
  -- status: pending | approved | paid | disputed
  status               VARCHAR(32)  NOT NULL DEFAULT 'pending',
  paid_at              TIMESTAMP WITH TIME ZONE,
  created_at           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_delivery_earnings_partner    ON delivery_earnings(delivery_partner_id);
CREATE INDEX IF NOT EXISTS idx_delivery_earnings_assignment ON delivery_earnings(assignment_id);
CREATE INDEX IF NOT EXISTS idx_delivery_earnings_status     ON delivery_earnings(status);

-- ═══════════════════════════════════════════════════════════════════
-- SECTION B: MISSING COLUMNS ON EXISTING TABLES
-- ═══════════════════════════════════════════════════════════════════

--------------------------------------------------------------------------------
-- B1. order_status_history — add changed_by_role
--     Required to know which role (admin / picker / delivery_partner / customer)
--     made each status transition.
--------------------------------------------------------------------------------
ALTER TABLE order_status_history ADD COLUMN IF NOT EXISTS changed_by_role VARCHAR(64);

--------------------------------------------------------------------------------
-- B2. picking_tasks — add timing columns + started_by
--------------------------------------------------------------------------------
ALTER TABLE picking_tasks ADD COLUMN IF NOT EXISTS started_at    TIMESTAMP WITH TIME ZONE;
ALTER TABLE picking_tasks ADD COLUMN IF NOT EXISTS completed_at  TIMESTAMP WITH TIME ZONE;
ALTER TABLE picking_tasks ADD COLUMN IF NOT EXISTS notes         TEXT;

--------------------------------------------------------------------------------
-- B3. delivery_assignments — add OTP + arrival columns
--     otp_code: 6-digit code used to verify store handover
--     delivery_otp: 4-digit code used to verify customer delivery
--     otp_verified: set TRUE when customer OTP matched
--     arrived_at_store_at: timestamp when partner marks arrived
--------------------------------------------------------------------------------
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS otp_code            VARCHAR(8);
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS delivery_otp        VARCHAR(8);
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS otp_verified        BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS arrived_at_store_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS failure_reason      TEXT;
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS cod_amount          NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS cod_collected       BOOLEAN DEFAULT FALSE;

--------------------------------------------------------------------------------
-- B4. delivery_partners — add identity + verification columns
--     These make delivery_partners a first-class PostgreSQL record, linked
--     to Firebase Auth via firebase_uid (already exists), enriched here.
--------------------------------------------------------------------------------
ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS name             VARCHAR(128);
ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS phone            VARCHAR(32);
ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS license_number   VARCHAR(64);
ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS is_verified      BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS verified_at      TIMESTAMP WITH TIME ZONE;
ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS rejected_reason  TEXT;

--------------------------------------------------------------------------------
-- B5. orders — add shipping_address_id reference + refactored status naming
--     shipping_address_id references order_addresses for cleaner FK access
--------------------------------------------------------------------------------
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address_id VARCHAR(64);

-- Note: We do NOT add an FK constraint on shipping_address_id here because
-- order_addresses has order_id as FK (not orders having address_id).
-- The existing order_addresses table is the canonical address record.
-- shipping_address_id is a convenience denormalized reference.

--------------------------------------------------------------------------------
-- B6. order_items — add quantity tracking columns for picking/packing
--     picked_quantity: how many units the picker actually found
--     packed_quantity: how many units the packer confirmed into the box
--------------------------------------------------------------------------------
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS picked_quantity INT DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS packed_quantity INT DEFAULT 0;

-- ═══════════════════════════════════════════════════════════════════
-- SECTION C: ADDITIONAL PERFORMANCE INDEXES
-- ═══════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_orders_status         ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_placed_at      ON orders(placed_at DESC);

CREATE INDEX IF NOT EXISTS idx_picking_tasks_status      ON picking_tasks(status);
CREATE INDEX IF NOT EXISTS idx_picking_tasks_picker      ON picking_tasks(picker_id);
CREATE INDEX IF NOT EXISTS idx_picking_tasks_order       ON picking_tasks(order_id);

CREATE INDEX IF NOT EXISTS idx_delivery_assignments_partner ON delivery_assignments(delivery_partner_id);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_status  ON delivery_assignments(status);

CREATE INDEX IF NOT EXISTS idx_delivery_partners_firebase ON delivery_partners(firebase_uid);

-- ═══════════════════════════════════════════════════════════════════
-- SECTION D: SEED CORE ROLES (IDEMPOTENT)
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO roles (id, name, description) VALUES
  ('role_admin',            'admin',            'Full system administrator')
ON CONFLICT (name) DO NOTHING;

INSERT INTO roles (id, name, description) VALUES
  ('role_store_manager',    'store_manager',    'Manages store catalog and inventory')
ON CONFLICT (name) DO NOTHING;

INSERT INTO roles (id, name, description) VALUES
  ('role_picker',           'picker',           'Picks and packs orders in the warehouse')
ON CONFLICT (name) DO NOTHING;

INSERT INTO roles (id, name, description) VALUES
  ('role_delivery_partner', 'delivery_partner', 'Delivers orders to customers')
ON CONFLICT (name) DO NOTHING;

INSERT INTO roles (id, name, description) VALUES
  ('role_customer',         'customer',         'End customer (identity from Firebase Auth)')
ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════
-- SECTION E: COMPETITIVE PRODUCT & INVENTORY ARCHITECTURE
-- ═══════════════════════════════════════════════════════════════════

--------------------------------------------------------------------------------
-- E1. product_identifiers
--     Unified external and internal barcodes (EAN-13, UPC, INTERNAL, etc.)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_identifiers (
  id               VARCHAR(64)  PRIMARY KEY,
  product_id       VARCHAR(64)  NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id       VARCHAR(64)  REFERENCES product_variants(id) ON DELETE SET NULL,
  identifier_type  VARCHAR(32)  NOT NULL DEFAULT 'EAN13', -- EAN13 | UPC | ISBN | INTERNAL | CUSTOM
  identifier_value VARCHAR(128) NOT NULL,
  is_primary       BOOLEAN      NOT NULL DEFAULT FALSE,
  verified_at      TIMESTAMP WITH TIME ZONE,
  created_by       VARCHAR(128),
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (identifier_type, identifier_value)
);

CREATE INDEX IF NOT EXISTS idx_product_identifiers_product  ON product_identifiers(product_id);
CREATE INDEX IF NOT EXISTS idx_product_identifiers_variant  ON product_identifiers(variant_id);
CREATE INDEX IF NOT EXISTS idx_product_identifiers_value    ON product_identifiers(identifier_value);

--------------------------------------------------------------------------------
-- E2. Sequence and Lifecycle Status for Products
--------------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS pk_product_seq START 1 INCREMENT 1;

ALTER TABLE products ADD COLUMN IF NOT EXISTS lifecycle_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE products ADD COLUMN IF NOT EXISTS pk_sequence_id BIGINT;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS pk_display_code VARCHAR(32);

--------------------------------------------------------------------------------
-- E3. warehouses
--     Physical fulfillment locations
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS warehouses (
  id             VARCHAR(64) PRIMARY KEY,
  store_id       VARCHAR(64) REFERENCES stores(id) ON DELETE SET NULL,
  name           VARCHAR(128) NOT NULL,
  code           VARCHAR(32)  UNIQUE NOT NULL,
  warehouse_type VARCHAR(32)  NOT NULL DEFAULT 'MAIN_STORE', -- MAIN_STORE | COLD_STORAGE | BACKROOM | TRANSIT
  address        TEXT,
  is_active      BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_warehouses_store ON warehouses(store_id);

--------------------------------------------------------------------------------
-- E4. inventory_batches
--     Batch-level inventory with expiry dates (powers FEFO picking)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_batches (
  id               VARCHAR(64)    PRIMARY KEY,
  warehouse_id     VARCHAR(64)    NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  variant_id       VARCHAR(64)    NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  batch_number     VARCHAR(128),
  manufacture_date DATE,
  expiry_date      DATE,           -- NULL = no expiry (e.g., salt)
  mrp_at_receipt   NUMERIC(10, 2),
  received_qty     INT            NOT NULL DEFAULT 0,
  status           VARCHAR(32)    NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | EXPIRED | DISPOSED | CONSUMED
  received_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by       VARCHAR(128),
  notes            TEXT
);

CREATE INDEX IF NOT EXISTS idx_batches_variant_expiry ON inventory_batches(variant_id, expiry_date ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_batches_warehouse       ON inventory_batches(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_batches_status          ON inventory_batches(status);

--------------------------------------------------------------------------------
-- E5. inventory_balances
--     Live stock balance per warehouse + variant + batch
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_balances (
  id            VARCHAR(64) PRIMARY KEY,
  warehouse_id  VARCHAR(64) NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  variant_id    VARCHAR(64) NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  batch_id      VARCHAR(64) NOT NULL REFERENCES inventory_batches(id) ON DELETE RESTRICT,
  available_qty INT         NOT NULL DEFAULT 0,
  reserved_qty  INT         NOT NULL DEFAULT 0,
  damaged_qty   INT         NOT NULL DEFAULT 0,
  expired_qty   INT         NOT NULL DEFAULT 0,
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (warehouse_id, variant_id, batch_id)
);

CREATE INDEX IF NOT EXISTS idx_balances_variant   ON inventory_balances(variant_id);
CREATE INDEX IF NOT EXISTS idx_balances_warehouse ON inventory_balances(warehouse_id);

--------------------------------------------------------------------------------
-- E6. inventory_events
--     Append-only audit ledger of every inventory mutation
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_events (
  id                BIGSERIAL    PRIMARY KEY,
  warehouse_id      VARCHAR(64),
  variant_id        VARCHAR(64),
  batch_id          VARCHAR(64),
  event_type        VARCHAR(32)  NOT NULL, -- RECEIVED | RESERVED | RELEASED | PICKED | PACKED | SOLD | DAMAGED | EXPIRED | DISPOSED | ADJUSTED | RETURNED | TRANSFERRED
  quantity          INT          NOT NULL,
  balance_after     INT,
  reference_type    VARCHAR(64),           -- ORDER | PICKING_TASK | ADJUSTMENT | RECEIPT
  reference_id      VARCHAR(64),
  performed_by      VARCHAR(128),
  performed_by_role VARCHAR(32),
  notes             TEXT,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inv_events_variant   ON inventory_events(variant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_events_ref       ON inventory_events(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_inv_events_warehouse ON inventory_events(warehouse_id, created_at DESC);

--------------------------------------------------------------------------------
-- E7. expiry_records
--     Detailed tracking for Expiry Center
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expiry_records (
  id                  VARCHAR(64) PRIMARY KEY,
  batch_id            VARCHAR(64) NOT NULL REFERENCES inventory_batches(id) ON DELETE CASCADE,
  warehouse_id        VARCHAR(64),
  variant_id          VARCHAR(64),
  expiry_date         DATE        NOT NULL,
  quantity_at_receipt INT         NOT NULL,
  current_quantity    INT         NOT NULL DEFAULT 0,
  status              VARCHAR(32) NOT NULL DEFAULT 'FRESH', -- FRESH | EXPIRING_SOON | EXPIRED | DISPOSED
  alerted_at          TIMESTAMP WITH TIME ZONE,
  disposed_at         TIMESTAMP WITH TIME ZONE,
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_expiry_records_date   ON expiry_records(expiry_date);
CREATE INDEX IF NOT EXISTS idx_expiry_records_status ON expiry_records(status);
CREATE INDEX IF NOT EXISTS idx_expiry_records_batch  ON expiry_records(batch_id);

--------------------------------------------------------------------------------
-- E8. expiry_alerts
--     Proactive alerting queue (30d, 7d, 3d, Expired)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expiry_alerts (
  id                VARCHAR(64) PRIMARY KEY,
  expiry_record_id  VARCHAR(64) REFERENCES expiry_records(id) ON DELETE CASCADE,
  batch_id          VARCHAR(64),
  variant_id        VARCHAR(64),
  warehouse_id      VARCHAR(64),
  expiry_date       DATE        NOT NULL,
  alert_type        VARCHAR(32) NOT NULL, -- EXPIRING_30D | EXPIRING_7D | EXPIRING_3D | EXPIRED
  quantity          INT         NOT NULL,
  is_acknowledged   BOOLEAN     NOT NULL DEFAULT FALSE,
  acknowledged_by   VARCHAR(128),
  acknowledged_at   TIMESTAMP WITH TIME ZONE,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_expiry_alerts_unack ON expiry_alerts(is_acknowledged, expiry_date);

--------------------------------------------------------------------------------
-- E9. stock_disposals
--     Formal write-off tracking
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_disposals (
  id            VARCHAR(64)    PRIMARY KEY,
  batch_id      VARCHAR(64)    REFERENCES inventory_batches(id) ON DELETE RESTRICT,
  variant_id    VARCHAR(64),
  warehouse_id  VARCHAR(64),
  quantity      INT            NOT NULL,
  reason        VARCHAR(32)    NOT NULL DEFAULT 'EXPIRED', -- EXPIRED | DAMAGED | QUALITY_FAIL | SHRINKAGE | OTHER
  disposal_cost NUMERIC(10, 2) DEFAULT 0.00,
  notes         TEXT,
  disposed_by   VARCHAR(128),
  disposed_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stock_disposals_batch ON stock_disposals(batch_id);

--------------------------------------------------------------------------------
-- E10. Auto-provision default warehouse per store (Idempotent)
--------------------------------------------------------------------------------
INSERT INTO warehouses (id, store_id, name, code, warehouse_type, is_active, created_at, updated_at)
SELECT 'wh_' || id, id, name || ' Warehouse', 'WH_' || code, 'MAIN_STORE', true, NOW(), NOW()
FROM stores
ON CONFLICT (code) DO NOTHING;

`;

// ─────────────────────────────────────────────────────────────────────────────
// RUNNER
// ─────────────────────────────────────────────────────────────────────────────

async function runMigration() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║   POCKETKIRANA — ARCHITECTURE CONSOLIDATION MIGRATION        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log(`📍 Target: ${targetHost}:${targetPort} / ${targetDb}`);
  console.log('⚠️  SAFE MODE: No tables or data will be dropped.\n');

  const client = new Client({ connectionString, connectionTimeoutMillis: 10000 });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL\n');

    // ── Run migration ──────────────────────────────────────────────
    console.log('⚡ Running migration SQL...\n');
    await client.query(migrationSql);
    console.log('✅ Migration SQL executed successfully\n');

    // ── Verify new tables ──────────────────────────────────────────
    const newTables = [
      'picking_task_items',
      'packing_tasks',
      'packing_items',
      'delivery_earnings',
      'product_identifiers',
      'warehouses',
      'inventory_batches',
      'inventory_balances',
      'inventory_events',
      'expiry_records',
      'expiry_alerts',
      'stock_disposals'
    ];
    console.log('🔍 Verifying new tables:');
    for (const tbl of newTables) {
      const res = await client.query(
        `SELECT COUNT(*) AS col_count FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1`,
        [tbl]
      );
      const cols = parseInt(res.rows[0].col_count, 10);
      if (cols > 0) {
        console.log(`   ✅ ${tbl.padEnd(24)} — ${cols} columns`);
      } else {
        console.log(`   ❌ ${tbl.padEnd(24)} — NOT FOUND`);
      }
    }

    // ── Verify added columns ───────────────────────────────────────
    console.log('\n🔍 Verifying added columns:');
    const colChecks = [
      ['order_status_history', 'changed_by_role'],
      ['picking_tasks',        'started_at'],
      ['picking_tasks',        'completed_at'],
      ['delivery_assignments', 'otp_code'],
      ['delivery_assignments', 'delivery_otp'],
      ['delivery_assignments', 'otp_verified'],
      ['delivery_assignments', 'arrived_at_store_at'],
      ['delivery_partners',    'name'],
      ['delivery_partners',    'phone'],
      ['delivery_partners',    'is_verified'],
      ['delivery_partners',    'license_number'],
      ['orders',               'shipping_address_id'],
      ['order_items',          'picked_quantity'],
      ['order_items',          'packed_quantity'],
      ['products',             'lifecycle_status'],
      ['products',             'pk_sequence_id'],
      ['product_variants',     'pk_display_code'],
    ];

    for (const [table, col] of colChecks) {
      const res = await client.query(
        `SELECT column_name, data_type FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
        [table, col]
      );
      if (res.rows.length > 0) {
        console.log(`   ✅ ${table}.${col} (${res.rows[0].data_type})`);
      } else {
        console.log(`   ❌ ${table}.${col} — NOT FOUND`);
      }
    }

    // ── Full table count ───────────────────────────────────────────
    const tableRes = await client.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' ORDER BY table_name`
    );
    console.log(`\n📊 Total tables in database: ${tableRes.rows.length}`);
    tableRes.rows.forEach((r, i) => {
      console.log(`   ${String(i + 1).padStart(2, ' ')}. ${r.table_name}`);
    });

    // ── Roles ──────────────────────────────────────────────────────
    const rolesRes = await client.query(`SELECT name, description FROM roles ORDER BY name`);
    console.log(`\n👥 Seeded Roles (${rolesRes.rows.length}):`);
    rolesRes.rows.forEach(r => console.log(`   • ${r.name.padEnd(20)} — ${r.description}`));

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║   ✅ MIGRATION COMPLETE                                       ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

  } catch (err) {
    console.error('\n❌ Migration failed:', err?.message || err);
    console.error(err?.stack || '');
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
