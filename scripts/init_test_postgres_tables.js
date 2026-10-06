/**
 * PocketKirana — Dedicated Fail-Closed Test PostgreSQL Database Migration Runner
 * 
 * Target Database: pocketkirana_test ONLY
 * 
 * ABSOLUTE SAFETY RULES:
 * 1. Strictly FAIL-CLOSED. Requires explicit DATABASE_URL_TEST.
 * 2. Absolutely NEVER falls back to DATABASE_URL or .env.local production values.
 * 3. Explicitly rejects and aborts if target database is 'pocketkirana_db'.
 * 4. Strictly validates that target database is exactly 'pocketkirana_test'.
 * 5. Performs runtime post-connection verification: SELECT current_database() === 'pocketkirana_test'.
 * 6. Executes Direct Authoritative DDL Composition in ACID transaction:
 *      BEGIN;
 *      -> Baseline Schema (from init_client_postgres_tables.js)
 *      -> Migration 001 DDL (from migrations/001_add_store_operational_settings.js)
 *      -> Migration 002 DDL (from migrations/002_add_phase2_store_operational_settings.js)
 *      COMMIT;
 * 7. Supports --dry-run mode for preflight verification without executing DDL.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

/**
 * Validates and extracts the test database connection parameters.
 * Throws an explicit error if missing, malformed, or targeting any database other than pocketkirana_test.
 *
 * @param {string | undefined} databaseUrl - The test database connection URL
 * @returns {object} Validated database parameters
 */
function validateTestDatabaseUrl(databaseUrl) {
  if (!databaseUrl || typeof databaseUrl !== 'string' || databaseUrl.trim() === '') {
    throw new Error('FATAL SAFETY ERROR: DATABASE_URL_TEST is required for test migrations.');
  }

  let parsed;
  try {
    parsed = new URL(databaseUrl.trim());
  } catch (err) {
    throw new Error(`FATAL SAFETY ERROR: Malformed test database URL: ${err.message}`);
  }

  if (!parsed.protocol.startsWith('postgres')) {
    throw new Error(`FATAL SAFETY ERROR: Invalid protocol '${parsed.protocol}', expected postgres: or postgresql:`);
  }

  const targetDatabase = parsed.pathname.replace(/^\//, '');

  if (targetDatabase === 'pocketkirana_db') {
    throw new Error(
      'FATAL SAFETY VIOLATION: Test migration attempted to target production database (pocketkirana_db)! Execution aborted.'
    );
  }

  if (targetDatabase !== 'pocketkirana_test') {
    throw new Error(
      `FATAL SAFETY VIOLATION: Test migration target must be exactly 'pocketkirana_test', got: '${targetDatabase}'`
    );
  }

  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '5432', 10),
    database: targetDatabase,
    user: decodeURIComponent(parsed.username || ''),
    password: decodeURIComponent(parsed.password || ''),
    connectionString: databaseUrl.trim()
  };
}

/**
 * Safely extracts baseline DDL from scripts/init_client_postgres_tables.js without modifying that file.
 * Preserves 100% schema fidelity with the production baseline.
 */
function extractBaselineSchemaSql() {
  const filePath = path.resolve(__dirname, 'init_client_postgres_tables.js');
  if (!fs.existsSync(filePath)) {
    throw new Error(`Baseline migration file not found at: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const startMarker = 'const schemaSql = `';
  const endMarker = '`;\n\nasync function initRemoteTables()';

  const startIndex = content.indexOf(startMarker);
  if (startIndex === -1) {
    throw new Error('Could not find start marker for schemaSql in init_client_postgres_tables.js');
  }

  const endIndex = content.indexOf(endMarker, startIndex);
  if (endIndex === -1) {
    throw new Error('Could not find end marker for schemaSql in init_client_postgres_tables.js');
  }

  let sql = content.substring(startIndex + startMarker.length, endIndex);

  // In production pocketkirana_db, these columns exist from earlier table setup scripts
  // and are indexed by performance indexes (idx_products_subcategory, idx_products_status, idx_variants_product_display).
  // Ensure they are present on clean initialization before the performance indexes run.
  const prerequisiteColumns = `
ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory_id VARCHAR(64) REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'active';
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 1;
`;

  sql = sql.replace('-- PERFORMANCE INDEXES', prerequisiteColumns + '\n-- PERFORMANCE INDEXES');
  return sql;
}

/**
 * Loads Migration 001 authoritative DDL string from source file.
 */
function getMigration001Sql() {
  const m001 = require('./migrations/001_add_store_operational_settings.js');
  if (!m001 || typeof m001.migrationSql !== 'string') {
    throw new Error('Failed to load authoritative migrationSql from Migration 001');
  }
  return m001.migrationSql;
}

/**
 * Loads Migration 002 authoritative DDL string from source file.
 */
function getMigration002Sql() {
  const m002 = require('./migrations/002_add_phase2_store_operational_settings.js');
  if (!m002 || typeof m002.migrationSql !== 'string') {
    throw new Error('Failed to load authoritative migrationSql from Migration 002');
  }
  return m002.migrationSql;
}

/**
 * Loads Migration 003 authoritative DDL string from source file.
 */
function getMigration003Sql() {
  const m003 = require('./migrations/003_add_store_admin_role.js');
  if (!m003 || typeof m003.migrationSql !== 'string') {
    throw new Error('Failed to load authoritative migrationSql from Migration 003');
  }
  return m003.migrationSql;
}

/**
 * Runs preflight / dry-run check against pocketkirana_test.
 * Does not execute any DDL.
 */
async function runPreflight(client, config) {
  console.log('\n======================================================');
  console.log('🔍 PREFLIGHT / DRY-RUN: TEST DATABASE MIGRATION');
  console.log('======================================================');
  console.log(`📍 Target Host:     ${config.host}:${config.port}`);
  console.log(`📍 Target Database: ${config.database}`);
  console.log(`📍 Target User:     ${config.user}`);

  // Post-connect check
  const dbCheck = await client.query('SELECT current_database(), current_user, version();');
  const currentDb = dbCheck.rows[0].current_database;
  const currentUser = dbCheck.rows[0].current_user;
  const pgVersion = dbCheck.rows[0].version;

  if (currentDb !== 'pocketkirana_test') {
    throw new Error(`SAFETY HALT: Connected database '${currentDb}' does not match 'pocketkirana_test'!`);
  }
  if (currentDb === 'pocketkirana_db') {
    throw new Error('FATAL SAFETY VIOLATION: Connected to production database pocketkirana_db!');
  }

  console.log(`✅ Connected Database Confirmed: ${currentDb}`);
  console.log(`👤 Connected User:               ${currentUser}`);
  console.log(`🐘 Engine Version:              ${pgVersion.split(',')[0]}`);

  // Check extensions
  const extRes = await client.query("SELECT extname, extversion FROM pg_extension WHERE extname = 'uuid-ossp';");
  if (extRes.rows.length > 0) {
    console.log(`✅ Extension uuid-ossp:         INSTALLED (v${extRes.rows[0].extversion})`);
  } else {
    console.log('⚠️  Extension uuid-ossp:         NOT INSTALLED (must be installed by postgres superuser)');
  }

  // Check existing application tables
  const tablesRes = await client.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
    ORDER BY tablename;
  `);
  console.log(`📊 Existing Tables:             ${tablesRes.rows.length}`);
  if (tablesRes.rows.length > 0) {
    console.log('   Tables:', tablesRes.rows.map(r => r.tablename).join(', '));
  }

  console.log('\n📋 MIGRATION PLAN TO APPLY:');
  console.log('   1. Baseline Schema: 38 core tables + 3 legacy support tables (via init_client_postgres_tables.js)');
  console.log('   2. Migration 001:   001_add_store_operational_settings.js (Authoritative migrationSql)');
  console.log('   3. Migration 002:   002_add_phase2_store_operational_settings.js (Authoritative migrationSql)');

  console.log('\n✅ Preflight check complete. No DDL was executed in --dry-run mode.\n');
}

/**
 * Validates that all expected tables, columns, constraints, and indexes exist in pocketkirana_test.
 */
async function verifyTestSchema(client) {
  console.log('\n🔍 Verifying final schema integrity in pocketkirana_test...');

  // 1. Verify current database
  const dbRes = await client.query('SELECT current_database();');
  if (dbRes.rows[0].current_database !== 'pocketkirana_test') {
    throw new Error(`Verification Failure: Expected database 'pocketkirana_test', got '${dbRes.rows[0].current_database}'`);
  }

  // 2. Verify Table Count and Required Tables
  const tablesRes = await client.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename;
  `);
  const foundTables = tablesRes.rows.map(r => r.tablename);
  console.log(`📊 Total Tables in public schema: ${foundTables.length}`);

  const requiredTables = [
    'stores',
    'orders',
    'order_items',
    'order_status_history',
    'payments',
    'payment_transactions',
    'outbox_events',
    'audit_logs',
    'admin_store_assignments'
  ];

  for (const tbl of requiredTables) {
    if (!foundTables.includes(tbl)) {
      throw new Error(`Verification Failure: Required table '${tbl}' was not found in pocketkirana_test!`);
    }
  }
  console.log('✅ Required core tables confirmed present.');

  // 3. Verify stores columns added by Migration 001 & 002
  const colsRes = await client.query(`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'stores'
    ORDER BY column_name;
  `);
  const storeCols = colsRes.rows.map(r => r.column_name);
  const requiredStoreCols = [
    'delivery_radius_km',
    'max_road_distance_km',
    'road_distance_multiplier',
    'opening_time',
    'closing_time',
    'delivery_fee',
    'free_delivery_threshold',
    'minimum_order_value',
    'free_delivery_enabled',
    'delivery_fee_tiers'
  ];

  for (const col of requiredStoreCols) {
    if (!storeCols.includes(col)) {
      throw new Error(`Verification Failure: Required column '${col}' on table 'stores' was not found!`);
    }
  }
  console.log('✅ All Phase 1B and Phase 2 operational columns on stores confirmed present.');

  // 4. Verify Constraints on stores
  const constrRes = await client.query(`
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_name = 'stores'
      AND constraint_name IN ('check_store_delivery_radius', 'check_store_free_delivery_threshold');
  `);
  const foundConstraints = constrRes.rows.map(r => r.constraint_name);
  if (!foundConstraints.includes('check_store_delivery_radius')) {
    throw new Error("Verification Failure: CHECK constraint 'check_store_delivery_radius' missing on stores!");
  }
  if (!foundConstraints.includes('check_store_free_delivery_threshold')) {
    throw new Error("Verification Failure: CHECK constraint 'check_store_free_delivery_threshold' missing on stores!");
  }
  console.log('✅ CHECK constraints (radius and free delivery threshold) confirmed present.');

  // 5. Verify Indexes
  const idxRes = await client.query(`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname IN (
        'idx_orders_store_id',
        'idx_admin_store_assignments_user',
        'idx_admin_store_assignments_store'
      );
  `);
  const foundIndexes = idxRes.rows.map(r => r.indexname);
  for (const idx of ['idx_orders_store_id', 'idx_admin_store_assignments_user', 'idx_admin_store_assignments_store']) {
    if (!foundIndexes.includes(idx)) {
      throw new Error(`Verification Failure: Expected index '${idx}' was not found!`);
    }
  }
  console.log('✅ Operational indexes (idx_orders_store_id, admin store assignment indexes) confirmed present.');

  // 6. Verify Column Defaults on stores
  const defaults = colsRes.rows.reduce((acc, r) => {
    acc[r.column_name] = r.column_default;
    return acc;
  }, {});

  if (!defaults.minimum_order_value || !defaults.minimum_order_value.startsWith('0')) {
    throw new Error(`Verification Failure: stores.minimum_order_value default is '${defaults.minimum_order_value}', expected 0.00!`);
  }
  if (!defaults.free_delivery_enabled || !defaults.free_delivery_enabled.includes('true')) {
    throw new Error(`Verification Failure: stores.free_delivery_enabled default is '${defaults.free_delivery_enabled}', expected true!`);
  }
  if (!defaults.delivery_fee_tiers || !defaults.delivery_fee_tiers.includes('[]')) {
    throw new Error(`Verification Failure: stores.delivery_fee_tiers default is '${defaults.delivery_fee_tiers}', expected '[]'::jsonb!`);
  }
  console.log('✅ Column defaults on stores verified (min order = 0, free delivery = true, fee tiers = []).');

  return {
    totalTables: foundTables.length,
    foundTables
  };
}

/**
 * Main migration execution function.
 */
async function runTestMigrations() {
  const isDryRun = process.argv.includes('--dry-run');

  // 1. Resolve & Validate Configuration
  const config = validateTestDatabaseUrl(process.env.DATABASE_URL_TEST);

  const client = new Client({
    connectionString: config.connectionString,
    connectionTimeoutMillis: 5000
  });

  try {
    await client.connect();

    // 2. Post-connect safety verification
    const verifyRes = await client.query('SELECT current_database(), current_user;');
    const verifiedDb = verifyRes.rows[0].current_database;
    const verifiedUser = verifyRes.rows[0].current_user;

    if (verifiedDb !== 'pocketkirana_test' || verifiedDb === 'pocketkirana_db') {
      throw new Error(`CRITICAL ABORT: Connected database '${verifiedDb}' is illegal for test migrations!`);
    }

    if (isDryRun) {
      await runPreflight(client, config);
      return;
    }

    // 3. Normal Migration Execution
    console.log('\n======================================================');
    console.log('🚀 EXECUTING DIRECT AUTHORITATIVE TEST SCHEMA MIGRATION');
    console.log('======================================================');
    console.log(`📍 Target Database: ${verifiedDb}`);
    console.log(`👤 Connected User:   ${verifiedUser}`);

    // Verify uuid-ossp extension is present
    const extCheck = await client.query("SELECT extname FROM pg_extension WHERE extname = 'uuid-ossp';");
    if (extCheck.rows.length === 0) {
      throw new Error('FATAL: Extension uuid-ossp is not installed in pocketkirana_test. Admin execution required.');
    }

    // Load Authoritative DDL strings
    const baselineSql = extractBaselineSchemaSql();
    const m001Sql = getMigration001Sql();
    const m002Sql = getMigration002Sql();
    const m003Sql = getMigration003Sql();

    console.log('\n⚡ Beginning ACID Transaction Block...');
    await client.query('BEGIN;');

    console.log('⚡ Step 1/4: Applying Baseline Schema DDL (47 tables + indexes)...');
    await client.query(baselineSql);

    console.log('⚡ Step 2/4: Applying Migration 001 DDL (Store operational settings)...');
    await client.query(m001Sql);

    console.log('⚡ Step 3/4: Applying Migration 002 DDL (Phase 2 serviceability, constraints, admin store assignments)...');
    await client.query(m002Sql);

    console.log('⚡ Step 4/4: Applying Migration 003 DDL (store_admin role)...');
    await client.query(m003Sql);

    console.log('⚡ Committing ACID Transaction Block...');
    await client.query('COMMIT;');
    console.log('✅ Transaction committed successfully.');

    // Comprehensive Post-Migration Verification
    const verification = await verifyTestSchema(client);
    console.log(`\n🎉 SUCCESS: pocketkirana_test is fully initialized with ${verification.totalTables} tables!`);

  } catch (err) {
    await client.query('ROLLBACK;').catch(() => {});
    console.error('\n❌ Test Migration Failed:', err.message);
    throw err;
  } finally {
    await client.end().catch(() => {});
  }
}

// Auto-run if executed directly from CLI
if (require.main === module) {
  runTestMigrations().catch(() => {
    process.exit(1);
  });
}

module.exports = {
  validateTestDatabaseUrl,
  extractBaselineSchemaSql,
  getMigration001Sql,
  getMigration002Sql,
  verifyTestSchema,
  runTestMigrations
};
