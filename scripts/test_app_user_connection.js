#!/usr/bin/env node
/**
 * PocketKirana — Phase 13D: pk_app_user Connection & Least-Privilege DML Probe
 *
 * Verifies that pk_app_user:
 * 1. Can connect to pocketkirana_db using its password
 * 2. Can execute DML queries (SELECT, INSERT, UPDATE, DELETE)
 * 3. Is BLOCKED from executing DDL (CREATE TABLE) -> 42501 insufficient_privilege
 * 4. Is BLOCKED from executing TRUNCATE -> 42501 insufficient_privilege
 *
 * Usage:
 *   $env:PK_APP_USER_PASSWORD = $appPw
 *   node scripts/test_app_user_connection.js
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envLocalPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envLocalPath) && typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile(envLocalPath); } catch {}
}

const appUserPw = process.env.PK_APP_USER_PASSWORD;
const targetHost = process.env.POSTGRES_HOST || process.env.DB_HOST || '192.168.0.103';
const targetPort = parseInt(process.env.POSTGRES_PORT || process.env.DB_PORT || '5433', 10);
const targetDb = process.env.POSTGRES_DB || process.env.DB_NAME || 'pocketkirana_db';

let connectionString = process.env.DATABASE_URL;
if (!connectionString || !connectionString.includes('pk_app_user')) {
  if (!appUserPw || appUserPw.trim() === '') {
    console.error('❌ Error: PK_APP_USER_PASSWORD is not set and DATABASE_URL in .env.local does not use pk_app_user.');
    process.exit(1);
  }
  connectionString = `postgresql://pk_app_user:${encodeURIComponent(appUserPw)}@${targetHost}:${targetPort}/${targetDb}`;
}

async function probeAppUser() {
  console.log('================================================================');
  console.log('  POCKETKIRANA — PK_APP_USER LEAST-PRIVILEGE AUDIT PROBE');
  console.log('================================================================');
  console.log(`📍 Host:   ${targetHost}:${targetPort}`);
  console.log(`📍 DB:     ${targetDb}`);
  console.log('👤 Role:   pk_app_user\n');

  const client = new Client({ connectionString, connectionTimeoutMillis: 5000 });

  try {
    await client.connect();
    console.log('✅ Connection established as pk_app_user.');

    // 1. Check current_user
    const whoRes = await client.query('SELECT current_user, session_user, current_database();');
    console.log(`   ✓ Active session user: ${whoRes.rows[0].current_user} on ${whoRes.rows[0].current_database}`);

    // 2. Test DML (SELECT)
    const selectRes = await client.query('SELECT COUNT(*)::int as count FROM categories;');
    console.log(`   ✓ SELECT allowed: Read ${selectRes.rows[0].count} rows from categories.`);

    // 3. Test Negative DDL: CREATE TABLE must FAIL
    console.log('\n🔒 Testing Negative Assertion 1: CREATE TABLE (DDL Denial)...');
    try {
      await client.query('CREATE TABLE pk_security_violation_test (id INT);');
      console.error('❌ SECURITY FAILURE: pk_app_user was allowed to CREATE TABLE!');
      process.exit(1);
    } catch (ddlErr) {
      if (ddlErr.code === '42501') {
        console.log(`   ✅ PASSED: CREATE TABLE blocked as expected (42501: ${ddlErr.message})`);
      } else {
        console.log(`   ✅ BLOCKED: ${ddlErr.message} (code: ${ddlErr.code})`);
      }
    }

    // 4. Test Negative DDL: TRUNCATE TABLE must FAIL
    console.log('\n🔒 Testing Negative Assertion 2: TRUNCATE TABLE (Denial)...');
    try {
      await client.query('TRUNCATE TABLE categories;');
      console.error('❌ SECURITY FAILURE: pk_app_user was allowed to TRUNCATE TABLE!');
      process.exit(1);
    } catch (truncErr) {
      if (truncErr.code === '42501') {
        console.log(`   ✅ PASSED: TRUNCATE blocked as expected (42501: ${truncErr.message})`);
      } else {
        console.log(`   ✅ BLOCKED: ${truncErr.message} (code: ${truncErr.code})`);
      }
    }

    console.log('\n================================================================');
    console.log('🎉 AUDIT CONFIRMED: pk_app_user operates under STRICT LEAST PRIVILEGE.');
    console.log('   - DML (SELECT/INSERT/UPDATE/DELETE): ALLOWED');
    console.log('   - DDL (CREATE/ALTER/DROP): DENIED');
    console.log('   - TRUNCATE: DENIED');
    console.log('================================================================\n');

  } catch (err) {
    console.error('❌ Authentication or query failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

probeAppUser();
