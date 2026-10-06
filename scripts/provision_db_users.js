#!/usr/bin/env node
/**
 * PocketKirana — Phase 13D: Dual-User Database Security Provisioning Script
 * 
 * Safely provisions least-privilege PostgreSQL roles without hardcoding passwords in SQL files.
 * Roles:
 * 1. pk_app_user: Runtime user used by Next.js & Outbox Worker (DML: SELECT, INSERT, UPDATE, DELETE)
 * 2. pk_migrator: Deployment & Migration user (DDL: CREATE, ALTER, TABLE & SEQUENCE MANAGEMENT)
 * 
 * Required Environment Variables:
 * - PK_APP_USER_PASSWORD: Strong secret password for pk_app_user
 * - PK_MIGRATOR_PASSWORD: Strong secret password for pk_migrator
 * 
 * Administrative Connection Variables (Defaults to .env.local):
 * - DB_HOST / POSTGRES_HOST (default: 192.168.0.103)
 * - DB_PORT / POSTGRES_PORT (default: 5433)
 * - DB_NAME / POSTGRES_DB (default: pocketkirana_db)
 * - DB_USER / POSTGRES_USER (must have CREATEROLE / SUPERUSER, default: postgres)
 * - DB_PASSWORD / POSTGRES_PASSWORD
 * 
 * Usage:
 *   $env:PK_APP_USER_PASSWORD="<APP_PW>"
 *   $env:PK_MIGRATOR_PASSWORD="<MIGRATOR_PW>"
 *   node scripts/provision_db_users.js
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Auto-load local environment if present
const envLocalPath = path.resolve(__dirname, '../.env.local');
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envLocalPath) && typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile(envLocalPath); } catch {}
} else if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile(envPath); } catch {}
}

const appUserPw = process.env.PK_APP_USER_PASSWORD;
const migratorPw = process.env.PK_MIGRATOR_PASSWORD;

if (!appUserPw || appUserPw.trim() === '' || appUserPw.includes('CHANGE_IN_PRODUCTION')) {
  console.error('❌ Error: PK_APP_USER_PASSWORD environment variable is missing, empty, or contains placeholder.');
  console.error('   Please provide a strong random password via PK_APP_USER_PASSWORD.');
  process.exit(1);
}

if (!migratorPw || migratorPw.trim() === '' || migratorPw.includes('CHANGE_IN_PRODUCTION')) {
  console.error('❌ Error: PK_MIGRATOR_PASSWORD environment variable is missing, empty, or contains placeholder.');
  console.error('   Please provide a strong random password via PK_MIGRATOR_PASSWORD.');
  process.exit(1);
}

const targetHost = process.env.POSTGRES_HOST || process.env.DB_HOST || '192.168.0.103';
const targetPort = parseInt(process.env.POSTGRES_PORT || process.env.DB_PORT || '5433', 10);
const targetDb = process.env.POSTGRES_DB || process.env.DB_NAME || 'pocketkirana_db';
const adminUser = process.env.POSTGRES_ADMIN_USER || 'postgres';
const adminPass = process.env.POSTGRES_ADMIN_PASSWORD || process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || process.env.PGPASSWORD;

const connectionString =
  process.env.ADMIN_DATABASE_URL ||
  (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres:') ? process.env.DATABASE_URL : null) ||
  `postgresql://${adminUser}:${encodeURIComponent(adminPass)}@${targetHost}:${targetPort}/${targetDb}`;

async function provisionRoles() {
  console.log('================================================================');
  console.log('  POCKETKIRANA — DUAL-USER DATABASE SECURITY PROVISIONING');
  console.log('================================================================');
  console.log(`📍 Target Host:     ${targetHost}:${targetPort}`);
  console.log(`📍 Database:        ${targetDb}`);
  console.log(`📍 Admin Account:   ${adminUser}`);
  console.log('🔒 Security Model:  Phase 13D Least-Privilege DML Separation');
  console.log('================================================================\n');

  const client = new Client({ connectionString, connectionTimeoutMillis: 5000 });

  try {
    await client.connect();
    console.log('✅ Connected to database as administrative user.\n');

    // 1. Provision pk_app_user
    console.log('👤 Provisioning role: pk_app_user...');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'pk_app_user') THEN
          CREATE ROLE pk_app_user WITH LOGIN;
        END IF;
      END $$;
    `);
    await client.query(`ALTER ROLE pk_app_user WITH LOGIN PASSWORD ${client.escapeLiteral(appUserPw)};`);
    console.log('   ✓ Role pk_app_user verified with login password.');

    // 2. Provision pk_migrator
    console.log('👤 Provisioning role: pk_migrator...');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'pk_migrator') THEN
          CREATE ROLE pk_migrator WITH LOGIN;
        END IF;
      END $$;
    `);
    await client.query(`ALTER ROLE pk_migrator WITH LOGIN PASSWORD ${client.escapeLiteral(migratorPw)};`);
    console.log('   ✓ Role pk_migrator verified with login password.\n');

    // 3. Configure Database & Schema Connection Privileges
    console.log('🔐 Configuring connection and schema access...');
    await client.query(`GRANT CONNECT ON DATABASE ${targetDb} TO pk_app_user;`);
    await client.query(`GRANT CONNECT ON DATABASE ${targetDb} TO pk_migrator;`);
    await client.query(`GRANT USAGE ON SCHEMA public TO pk_app_user;`);
    await client.query(`GRANT USAGE, CREATE ON SCHEMA public TO pk_migrator;`);
    console.log('   ✓ Database & schema connection granted.');

    // 4. Runtime User (pk_app_user) — Least-Privilege DML Only
    console.log('🛡️  Enforcing least-privilege DML policies for pk_app_user...');
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pk_app_user;`);
    await client.query(`GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO pk_app_user;`);

    // Ensure future tables created by pk_migrator are accessible to pk_app_user
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pk_app_user;`);
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO pk_app_user;`);

    // Explicitly revoke destructive privileges from application runtime
    await client.query(`REVOKE CREATE ON SCHEMA public FROM pk_app_user;`);
    await client.query(`REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM pk_app_user;`);
    console.log('   ✓ DML granted (SELECT, INSERT, UPDATE, DELETE).');
    console.log('   ✓ TRUNCATE and CREATE strictly REVOKED.');

    // 5. Migrator User (pk_migrator) — DDL & Schema Management Only
    console.log('🛠️  Granting DDL management privileges to pk_migrator...');
    await client.query(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO pk_migrator;`);
    await client.query(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO pk_migrator;`);
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO pk_migrator;`);
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO pk_migrator;`);
    console.log('   ✓ DDL schema management privileges active for pk_migrator.\n');

    console.log('================================================================');
    console.log('🎉 SUCCESS: Dual-User Security Model Provisioned Successfully!');
    console.log('   - pk_app_user: Runtime queries (no DDL / no TRUNCATE)');
    console.log('   - pk_migrator: Schema migrations');
    console.log('================================================================\n');

  } catch (err) {
    console.error('❌ Provisioning failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

provisionRoles();
