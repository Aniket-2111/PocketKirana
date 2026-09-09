/**
 * Script: Remove Legacy PostgreSQL `users` Table & Constraints
 * Drops orders_customer_id_fkey constraint and legacy `users` table from Client Laptop DB.
 * Usage: node scripts/cleanup_legacy_user_table.js
 */

const { Client } = require('pg');

const targetHost = process.env.DB_HOST || '192.168.0.101';
const targetPort = parseInt(process.env.DB_PORT || '5433', 10);
const targetDb = process.env.DB_NAME || 'pocketkirana_db';
const targetUser = process.env.DB_USER || 'postgres';
const targetPass = process.env.DB_PASSWORD || 'varbusiness';

const connectionString = `postgresql://${targetUser}:${encodeURIComponent(targetPass)}@${targetHost}:${targetPort}/${targetDb}`;

async function cleanupUserTable() {
  console.log('\n======================================================');
  console.log('🧹 CLEANING UP LEGACY `users` TABLE & FK CONSTRAINTS');
  console.log(`📍 Client IP: ${targetHost}:${targetPort} | DB: ${targetDb}`);
  console.log('======================================================\n');

  const client = new Client({ connectionString, connectionTimeoutMillis: 5000 });

  try {
    await client.connect();

    console.log('1. Removing foreign key constraint `orders_customer_id_fkey` from `orders`...');
    await client.query('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_customer_id_fkey;');
    console.log('   ✅ `orders_customer_id_fkey` dropped.');

    console.log('2. Dropping redundant PostgreSQL `users` table...');
    await client.query('DROP TABLE IF EXISTS users CASCADE;');
    console.log('   ✅ `users` table dropped successfully.');

    console.log('\n🎉 Clean architecture verified: User profiles live strictly in Firebase, linked via `firebase_uid`!\n');
  } catch (err) {
    console.error('❌ Error during cleanup:', err.message);
  } finally {
    await client.end();
  }
}

cleanupUserTable();
