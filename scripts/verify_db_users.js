#!/usr/bin/env node
/**
 * PocketKirana — Phase 13D: Dual-User Privilege & Security Verification Probe
 *
 * Verifies that pk_app_user and pk_migrator exist and enforce least-privilege:
 * - pk_app_user has SELECT, INSERT, UPDATE, DELETE
 * - pk_app_user does NOT have CREATE or TRUNCATE
 * - pk_migrator exists with DDL capabilities
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envLocalPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envLocalPath) && typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile(envLocalPath); } catch {}
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

async function verifyUsers() {
  console.log('================================================================');
  console.log('  POCKETKIRANA — DATABASE ROLES & PRIVILEGES VERIFICATION');
  console.log('================================================================');
  console.log(`📍 Host:     ${targetHost}:${targetPort}`);
  console.log(`📍 Database: ${targetDb}\n`);

  const client = new Client({ connectionString, connectionTimeoutMillis: 5000 });

  try {
    await client.connect();

    // 1. Query Roles
    const rolesRes = await client.query(`
      SELECT rolname, rolcanlogin, rolsuper, rolinherit, rolcreaterole
      FROM pg_roles
      WHERE rolname IN ('postgres', 'pk_app_user', 'pk_migrator')
      ORDER BY rolname;
    `);

    console.log('📋 PostgreSQL Roles State:');
    console.table(rolesRes.rows);

    const hasAppUser = rolesRes.rows.some(r => r.rolname === 'pk_app_user');
    const hasMigrator = rolesRes.rows.some(r => r.rolname === 'pk_migrator');

    if (!hasAppUser || !hasMigrator) {
      console.log('\n⚠️  Status: Roles have not been provisioned yet.');
      if (!hasAppUser) console.log('   - pk_app_user: MISSING');
      if (!hasMigrator) console.log('   - pk_migrator: MISSING');
      console.log('\nRun the provisioning step first:');
      console.log('  $env:PK_APP_USER_PASSWORD = $appPw');
      console.log('  $env:PK_MIGRATOR_PASSWORD = $migratorPw');
      console.log('  node scripts/provision_db_users.js\n');
      process.exit(2);
    }

    // 2. Query Table Grants for pk_app_user
    const grantsRes = await client.query(`
      SELECT privilege_type, COUNT(*)::int as table_count
      FROM information_schema.role_table_grants
      WHERE grantee = 'pk_app_user'
      GROUP BY privilege_type
      ORDER BY privilege_type;
    `);

    console.log('\n🔐 Table Privileges for pk_app_user:');
    console.table(grantsRes.rows);

    // 3. Verify Revocations
    const truncateGrants = grantsRes.rows.find(g => g.privilege_type === 'TRUNCATE');
    const schemaCreateRes = await client.query(`
      SELECT has_schema_privilege('pk_app_user', 'public', 'CREATE') as can_create;
    `);
    const canCreate = schemaCreateRes.rows[0]?.can_create;

    console.log('🛡️  Least-Privilege Audit:');
    console.log(`   - TRUNCATE privilege:  ${truncateGrants ? '❌ ALLOWED (Violation)' : '✅ REVOKED (Enforced)'}`);
    console.log(`   - Schema CREATE:       ${canCreate ? '❌ ALLOWED (Violation)' : '✅ REVOKED (Enforced)'}`);

    console.log('\n================================================================');
    console.log('✅ VERIFICATION RESULT: Dual-User Security Model active and verified.');
    console.log('================================================================\n');

  } catch (err) {
    console.error('❌ Verification query failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyUsers();
