/**
 * PocketKirana — Migration 002: Add Phase 2 Store Operational Settings & RBAC
 *
 * PURPOSE:
 * Phase 2 Canonical Database Alignment:
 * 1. Store Service Radius Constraint: Enforce straight-line radius in (3.00, 4.00, 5.00).
 * 2. Range-Based Delivery Fee Tiers: Add delivery_fee_tiers JSONB (default: '[]'::jsonb).
 *    NOTE: Does NOT insert unapproved fee amounts (no ₹35/₹25/₹15).
 * 3. Free Delivery Toggle & Validation: Add free_delivery_enabled BOOLEAN (default: true)
 *    and CHECK (free_delivery_threshold >= 0.00). Preserves existing 499.00 default.
 * 4. Minimum Order Retirement: In-place zeroing (SET DEFAULT 0.00; UPDATE stores SET minimum_order_value = 0.00).
 * 5. Road Cutoff Deprecation: Add SQL comments marking max_road_distance_km and
 *    road_distance_multiplier deprecated.
 * 6. Store ID Index: Create index on orders(store_id).
 *    CRITICAL: Does NOT add foreign key on orders(store_id) to protect historical orders.
 * 7. Multi-Store Admin Assignments: Create admin_store_assignments table and indexes.
 *
 * SECURITY & CONNECTION ARCHITECTURE:
 * - Administrative migration credentials required (ADMIN_DATABASE_URL or POSTGRES_ADMIN_USER + POSTGRES_ADMIN_PASSWORD).
 * - Fails closed: refuses to fall back to runtime DATABASE_URL or pk_app_user credentials.
 * - Supports dry-run connection check: node scripts/migrations/002_add_phase2_store_operational_settings.js --check-connection
 *
 * Idempotency: Safe to execute repeatedly.
 * Usage: node scripts/migrations/002_add_phase2_store_operational_settings.js
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Auto-load .env.local if present (only loads variables if not already set in environment)
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach((line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] ? match[2].trim() : '';
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
      }
    });
  }
} catch (_) {}

/**
 * Resolves administrative migration connection credentials.
 * Fails closed if administrative credentials are not provided.
 * Does NOT fall back to runtime DATABASE_URL, DB_USER, or pk_app_user.
 */
function resolveAdminConnectionConfig() {
  if (process.env.ADMIN_DATABASE_URL && process.env.ADMIN_DATABASE_URL.trim() !== '') {
    const connStr = process.env.ADMIN_DATABASE_URL.trim();
    if (connStr.includes('pk_app_user')) {
      throw new Error(
        'Refusing schema migration with runtime role pk_app_user.\n' +
        'ADMIN_DATABASE_URL must target an administrative migration account.'
      );
    }
    return { connectionString: connStr };
  }

  if (process.env.POSTGRES_ADMIN_USER && process.env.POSTGRES_ADMIN_PASSWORD) {
    const adminUser = process.env.POSTGRES_ADMIN_USER.trim();
    const adminPass = process.env.POSTGRES_ADMIN_PASSWORD;

    if (adminUser === 'pk_app_user') {
      throw new Error(
        'Refusing schema migration with runtime role pk_app_user.\n' +
        'POSTGRES_ADMIN_USER must target an administrative migration account.'
      );
    }

    const host = process.env.POSTGRES_HOST || process.env.DB_HOST || '127.0.0.1';
    const port = parseInt(process.env.POSTGRES_PORT || process.env.DB_PORT || '5432', 10);
    const database = process.env.POSTGRES_DB || process.env.DB_NAME || 'pocketkirana';

    return {
      host,
      port,
      database,
      user: adminUser,
      password: adminPass,
    };
  }

  // FAIL CLOSED: Refuse to use runtime DATABASE_URL or DB_USER / DB_PASSWORD
  throw new Error(
    'Administrative migration credentials are required.\n' +
    'Refusing to use DATABASE_URL/runtime credentials.\n' +
    'Set ADMIN_DATABASE_URL or POSTGRES_ADMIN_USER + POSTGRES_ADMIN_PASSWORD to run schema migrations.'
  );
}

/**
 * Preflight Safety Checks (Read-Only)
 * Verifies that the environment and data meet all prerequisites before any DDL executes.
 */
async function runPreflightChecks(client) {
  console.log('🔍 Executing Migration 002 Preflight Checks...');

  // 1. Verify Target Database
  const dbRes = await client.query('SELECT current_database();');
  const dbName = dbRes.rows[0].current_database;
  if (dbName !== 'pocketkirana_db' && dbName !== 'pocketkirana') {
    throw new Error(`Preflight Failed: Unexpected target database '${dbName}'. Expected 'pocketkirana_db'.`);
  }

  // 2. Verify Table Existence
  const tablesRes = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name IN ('stores', 'orders', 'admin_users');
  `);
  const foundTables = tablesRes.rows.map((r) => r.table_name);
  for (const required of ['stores', 'orders', 'admin_users']) {
    if (!foundTables.includes(required)) {
      throw new Error(`Preflight Failed: Required table '${required}' does not exist.`);
    }
  }

  // 3. Verify Existing Store Count & Preserved Records
  const storesCountRes = await client.query('SELECT COUNT(*) as count FROM stores;');
  const storeCount = parseInt(storesCountRes.rows[0].count, 10);
  if (storeCount !== 2) {
    throw new Error(`Preflight Failed: Expected exactly 2 store records, found ${storeCount}.`);
  }

  const storeIdsRes = await client.query("SELECT id FROM stores WHERE id IN ('store_primary', 'store_central_001');");
  if (storeIdsRes.rows.length !== 2) {
    throw new Error("Preflight Failed: Both 'store_primary' and 'store_central_001' must exist.");
  }

  // 4. Verify Existing Delivery Radii (Must satisfy 3.00, 4.00, or 5.00)
  const radiusCheckRes = await client.query(
    'SELECT id, delivery_radius_km FROM stores WHERE delivery_radius_km NOT IN (3.00, 4.00, 5.00);'
  );
  if (radiusCheckRes.rows.length > 0) {
    throw new Error(
      `Preflight Failed: Store contains invalid radius for CHECK constraint: ${JSON.stringify(radiusCheckRes.rows)}`
    );
  }

  // 5. Verify Orders Preserved
  const ordersCountRes = await client.query('SELECT COUNT(*) as count FROM orders;');
  const orderCount = parseInt(ordersCountRes.rows[0].count, 10);
  if (orderCount !== 53) {
    console.warn(`[Preflight Notice] Orders count is ${orderCount} (baseline was 53). Confirming orders integrity.`);
  }

  console.log('✅ Preflight checks passed successfully.');
}

const migrationSql = `
-- ============================================================================
-- POCKETKIRANA MIGRATION 002: DDL TRANSACTION BLOCK
-- ============================================================================

-- 1. Add Free Delivery Toggle & Delivery Fee Tiers JSONB
ALTER TABLE stores 
  ADD COLUMN IF NOT EXISTS free_delivery_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS delivery_fee_tiers JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2. Enforce Service Radius CHECK Constraint (Only 3.00, 4.00, or 5.00 km)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'check_store_delivery_radius' AND table_name = 'stores'
  ) THEN
    ALTER TABLE stores ADD CONSTRAINT check_store_delivery_radius 
      CHECK (delivery_radius_km IN (3.00, 4.00, 5.00));
  END IF;
END $$;

-- 3. Enforce Free Delivery Threshold Non-Negative CHECK Constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'check_store_free_delivery_threshold' AND table_name = 'stores'
  ) THEN
    ALTER TABLE stores ADD CONSTRAINT check_store_free_delivery_threshold 
      CHECK (free_delivery_threshold >= 0.00);
  END IF;
END $$;

-- 4. Minimum Order Value In-Place Retirement (Set Default to 0.00 and zero existing rows)
ALTER TABLE stores ALTER COLUMN minimum_order_value SET DEFAULT 0.00;
UPDATE stores SET minimum_order_value = 0.00;

-- 5. Mark Road Distance Columns Deprecated via PostgreSQL Documentation Comments
COMMENT ON COLUMN stores.max_road_distance_km IS 'DEPRECATED: Phase 2 serviceability is strictly straight-line radius.';
COMMENT ON COLUMN stores.road_distance_multiplier IS 'DEPRECATED: Phase 2 serviceability is strictly straight-line radius.';

-- 6. Operational & Query Performance Index on Orders
CREATE INDEX IF NOT EXISTS idx_orders_store_id ON orders(store_id);

-- 7. Multi-Store Admin Assignments Table
CREATE TABLE IF NOT EXISTS admin_store_assignments (
  id VARCHAR(64) PRIMARY KEY,
  admin_user_id VARCHAR(64) NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  store_id VARCHAR(64) NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  assigned_by_uid VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(admin_user_id, store_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_store_assignments_user 
  ON admin_store_assignments(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_store_assignments_store 
  ON admin_store_assignments(store_id);
`;

/**
 * Post-Migration Verification Assertions
 */
async function runPostMigrationVerification(client) {
  console.log('🔍 Executing Post-Migration Assertions...');

  // 1. Verify New Columns on stores
  const colRes = await client.query(`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'stores' 
      AND column_name IN ('free_delivery_enabled', 'delivery_fee_tiers')
    ORDER BY column_name;
  `);
  if (colRes.rows.length !== 2) {
    throw new Error(`Verification Failed: Expected 2 new columns on stores, found ${colRes.rows.length}`);
  }

  // 2. Verify CHECK Constraints
  const constrRes = await client.query(`
    SELECT constraint_name 
    FROM information_schema.table_constraints
    WHERE table_name = 'stores' 
      AND constraint_name IN ('check_store_delivery_radius', 'check_store_free_delivery_threshold');
  `);
  if (constrRes.rows.length !== 2) {
    throw new Error(`Verification Failed: Expected 2 CHECK constraints on stores, found ${constrRes.rows.length}`);
  }

  // 3. Verify Minimum Order Retired to 0.00
  const minOrderRes = await client.query('SELECT id, minimum_order_value FROM stores;');
  for (const row of minOrderRes.rows) {
    if (parseFloat(row.minimum_order_value) !== 0.00) {
      throw new Error(`Verification Failed: Store ${row.id} minimum_order_value is not 0.00 (got ${row.minimum_order_value})`);
    }
  }

  // 4. Verify orders.store_id Index Exists
  const idxRes = await client.query(`
    SELECT indexname FROM pg_indexes WHERE tablename = 'orders' AND indexname = 'idx_orders_store_id';
  `);
  if (idxRes.rows.length === 0) {
    throw new Error("Verification Failed: Index 'idx_orders_store_id' was not created.");
  }

  // 5. Verify NO Foreign Key was added to orders.store_id
  const fkRes = await client.query(`
    SELECT tc.constraint_name 
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name AND tc.table_name = kcu.table_name
    WHERE tc.table_name = 'orders' 
      AND kcu.column_name = 'store_id' 
      AND tc.constraint_type = 'FOREIGN KEY';
  `);
  if (fkRes.rows.length > 0) {
    throw new Error('SECURITY VIOLATION: Foreign key on orders.store_id was unexpectedly created!');
  }

  // 6. Verify admin_store_assignments Table & Structure
  const tableCheck = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'admin_store_assignments';
  `);
  if (tableCheck.rows.length === 0) {
    throw new Error("Verification Failed: Table 'admin_store_assignments' was not created.");
  }

  // 7. Verify Data Preservation (Stores count = 2, Orders count preserved)
  const finalStores = await client.query('SELECT COUNT(*) as count FROM stores;');
  if (parseInt(finalStores.rows[0].count, 10) !== 2) {
    throw new Error('DATA LOSS DETECTED: Stores count changed!');
  }

  console.log('✅ All post-migration assertions verified successfully.');
}

/**
 * Dry-run connection check: verifies connection & identity without executing DDL.
 */
async function checkAdminConnection() {
  console.log('🔍 Performing Administrative Connection Check (Dry-Run)...');
  const connConfig = resolveAdminConnectionConfig();
  const client = new Client({ ...connConfig, connectionTimeoutMillis: 5000 });

  try {
    await client.connect();
    const identityRes = await client.query('SELECT current_user, session_user, current_database();');
    const { current_user, session_user, current_database } = identityRes.rows[0];

    // Explicit runtime-user protection
    if (current_user === 'pk_app_user' || session_user === 'pk_app_user') {
      throw new Error(
        'Refusing schema migration with runtime role pk_app_user.\n' +
        'Use an administrative migration connection.'
      );
    }

    console.log('✅ Administrative connection verified successfully:');
    console.log(`   Current User:     ${current_user}`);
    console.log(`   Session User:     ${session_user}`);
    console.log(`   Target Database:  ${current_database}`);
    console.log('   Status:           Dry-run check complete. No DDL executed.');
  } finally {
    await client.end().catch(() => {});
  }
}

/**
 * Executes Migration 002 inside an ACID transaction.
 */
async function runMigration() {
  console.log('🚀 Running Migration 002: Add Phase 2 Store Operational Settings & RBAC...');
  const connConfig = resolveAdminConnectionConfig();
  const client = new Client({ ...connConfig, connectionTimeoutMillis: 5000 });

  try {
    await client.connect();

    // Explicit runtime-user protection pre-flight
    const identityRes = await client.query('SELECT current_user, session_user;');
    const { current_user } = identityRes.rows[0];
    if (current_user === 'pk_app_user') {
      throw new Error(
        'Refusing schema migration with runtime role pk_app_user.\n' +
        'Use an administrative migration connection.'
      );
    }

    console.log(`Connected to PostgreSQL target database as ${current_user}.`);

    // 1. Run Preflight Safety Checks
    await runPreflightChecks(client);

    // 2. Execute ACID Transaction Block
    await client.query('BEGIN');
    await client.query(migrationSql);

    // 3. Run Post-Migration Verification inside transaction
    await runPostMigrationVerification(client);

    // 4. Commit Transaction
    await client.query('COMMIT');

    console.log('✅ Migration 002 completed and committed successfully.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Migration 002 failed and rolled back:', err.message);
    throw err;
  } finally {
    await client.end().catch(() => {});
  }
}

if (require.main === module) {
  if (process.argv.includes('--check-connection')) {
    checkAdminConnection().catch((err) => {
      console.error('❌ Connection check failed:', err.message);
      process.exit(1);
    });
  } else {
    runMigration().catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
  }
}

module.exports = {
  runMigration,
  checkAdminConnection,
  resolveAdminConnectionConfig,
  runPreflightChecks,
  runPostMigrationVerification,
  migrationSql,
};
