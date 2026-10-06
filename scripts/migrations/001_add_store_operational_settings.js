/**
 * PocketKirana — Migration 001: Add Store Operational Settings
 *
 * PROVISIONAL ARCHITECTURAL CONFIGURATION NOTICE:
 * Phase 1B operational values (delivery_radius_km: 3.0, max_road_distance_km: 4.5,
 * road_distance_multiplier: 1.35, opening_time: '06:00', closing_time: '23:00',
 * delivery_fee: 29, free_delivery_threshold: 499, minimum_order_value: 199)
 * are provisional architectural defaults for server-side enforcement.
 *
 * Phase 2 (Serviceability Unification) is responsible for reviewing and finalizing
 * production business rules across the platform.
 *
 * SECURITY & CONNECTION ARCHITECTURE:
 * - Administrative migration credentials are required (ADMIN_DATABASE_URL or POSTGRES_ADMIN_USER + POSTGRES_ADMIN_PASSWORD).
 * - Fails closed: refuses to fall back to runtime DATABASE_URL or pk_app_user credentials.
 * - Supports dry-run connection check: node scripts/migrations/001_add_store_operational_settings.js --check-connection
 *
 * Idempotency: Safe to execute repeatedly.
 * Usage: node scripts/migrations/001_add_store_operational_settings.js
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

const migrationSql = `
-- 1. Idempotently add operational columns to stores table
ALTER TABLE stores 
  ADD COLUMN IF NOT EXISTS delivery_radius_km NUMERIC(4, 2) DEFAULT 3.0,
  ADD COLUMN IF NOT EXISTS max_road_distance_km NUMERIC(4, 2) DEFAULT 4.5,
  ADD COLUMN IF NOT EXISTS road_distance_multiplier NUMERIC(3, 2) DEFAULT 1.35,
  ADD COLUMN IF NOT EXISTS opening_time VARCHAR(8) DEFAULT '06:00',
  ADD COLUMN IF NOT EXISTS closing_time VARCHAR(8) DEFAULT '23:00',
  ADD COLUMN IF NOT EXISTS delivery_fee INT DEFAULT 29,
  ADD COLUMN IF NOT EXISTS free_delivery_threshold INT DEFAULT 499,
  ADD COLUMN IF NOT EXISTS minimum_order_value INT DEFAULT 199;

-- 2. Populate provisional defaults for primary store ONLY if columns are currently NULL
-- (Preserves any existing non-null production configuration)
UPDATE stores 
SET 
  latitude = COALESCE(latitude, 19.0224536),
  longitude = COALESCE(longitude, 73.3210018),
  delivery_radius_km = COALESCE(delivery_radius_km, 3.0),
  max_road_distance_km = COALESCE(max_road_distance_km, 4.5),
  road_distance_multiplier = COALESCE(road_distance_multiplier, 1.35),
  opening_time = COALESCE(opening_time, '06:00'),
  closing_time = COALESCE(closing_time, '23:00'),
  delivery_fee = COALESCE(delivery_fee, 29),
  free_delivery_threshold = COALESCE(free_delivery_threshold, 499),
  minimum_order_value = COALESCE(minimum_order_value, 199),
  is_active = COALESCE(is_active, TRUE),
  updated_at = NOW()
WHERE id IN ('store-001', 'store-1', 'store_primary') OR code IN ('STORE-001', 'STORE001', 'PK-STORE-01');
`;

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
 * Executes Migration 001 inside an ACID transaction.
 */
async function runMigration() {
  console.log('🚀 Running Migration 001: Add Store Operational Settings...');
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

    await client.query('BEGIN');
    await client.query(migrationSql);
    await client.query('COMMIT');

    console.log('✅ Migration 001 completed successfully.');

    // Verification check
    const verifyRes = await client.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'stores' 
        AND column_name IN (
          'delivery_radius_km', 'max_road_distance_km', 'road_distance_multiplier',
          'opening_time', 'closing_time', 'delivery_fee', 'free_delivery_threshold', 'minimum_order_value'
        )
      ORDER BY ordinal_position;
    `);

    console.log('\nVerified columns in stores table:');
    console.table(verifyRes.rows);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Migration 001 failed:', err.message);
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

module.exports = { runMigration, checkAdminConnection, resolveAdminConnectionConfig, migrationSql };
