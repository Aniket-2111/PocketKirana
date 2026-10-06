/**
 * PocketKirana — Migration 003: Add Store Admin Role
 *
 * PURPOSE:
 * Phase 2B.1 Canonical Database Alignment:
 * 1. Establishes canonical store_admin role in roles table if missing.
 * 2. Idempotent: safe to execute repeatedly.
 * 3. Does NOT alter any existing roles, role IDs, or permissions.
 *
 * Usage: node scripts/migrations/003_add_store_admin_role.js
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Auto-load .env.local if present
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

  const host = process.env.POSTGRES_HOST || 'localhost';
  const port = process.env.POSTGRES_PORT || '5432';
  const database = process.env.POSTGRES_DB || 'pocketkirana_db';
  const user = process.env.POSTGRES_ADMIN_USER || process.env.POSTGRES_USER || 'postgres';
  const password = process.env.POSTGRES_ADMIN_PASSWORD || process.env.POSTGRES_PASSWORD || '';

  if (user === 'pk_app_user') {
    throw new Error('Refusing schema migration with runtime role pk_app_user.');
  }

  return {
    host,
    port: parseInt(port, 10),
    database,
    user,
    password,
  };
}

const migrationSql = `
-- 1. Canonical Roles Setup
INSERT INTO roles (id, name, description) VALUES
  ('role_admin',            'admin',            'Full system administrator'),
  ('role_store_manager',    'store_manager',    'Manages store catalog and inventory'),
  ('role_store_admin',      'store_admin',      'Store Administrator with access to assigned darkstore operations'),
  ('role_picker',           'picker',           'Picks and packs orders in the warehouse'),
  ('role_delivery_partner', 'delivery_partner', 'Delivers orders to customers'),
  ('role_customer',         'customer',         'End customer (identity from Firebase Auth)')
ON CONFLICT (name) DO NOTHING;
`;

async function checkAdminConnection() {
  const config = resolveAdminConnectionConfig();
  const client = new Client(config);
  try {
    await client.connect();
    const res = await client.query('SELECT current_database(), current_user;');
    console.log(`✅ Migration 003 Connection OK: DB=${res.rows[0].current_database}, User=${res.rows[0].current_user}`);
  } finally {
    await client.end().catch(() => {});
  }
}

async function runMigration(overrideConfig) {
  const config = overrideConfig || resolveAdminConnectionConfig();
  const client = new Client(config);

  try {
    await client.connect();
    await client.query('BEGIN');
    await client.query(migrationSql);

    const checkRes = await client.query(`SELECT id, name FROM roles WHERE name = 'store_admin'`);
    if (checkRes.rows.length !== 1) {
      throw new Error('Post-migration verification failed: store_admin role missing after insert');
    }

    await client.query('COMMIT');
    console.log('✅ Migration 003 completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Migration 003 failed:', err.message);
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
  migrationSql,
};
