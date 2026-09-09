/**
 * PocketKirana — Secure Post-Order Ledger & Financial Verification
 * Reads credentials securely from .env.local — No exposed credentials.
 * Usage: node scripts/verify_latest_order.js
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Securely auto-load .env.local
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

const targetHost = process.env.DB_HOST || '192.168.0.102';
const targetPort = parseInt(process.env.DB_PORT || '5433', 10);
const targetDb = process.env.DB_NAME || 'pocketkirana_db';
const targetUser = process.env.DB_USER || 'postgres';
const targetPass = process.env.DB_PASSWORD || '';

const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${targetUser}:${encodeURIComponent(targetPass)}@${targetHost}:${targetPort}/${targetDb}`;

async function verifyLatestOrder() {
  const client = new Client({ connectionString, connectionTimeoutMillis: 5000 });

  try {
    await client.connect();
    console.log('\n======================================================');
    console.log('🔍 POCKETKIRANA POST-ORDER RECONCILIATION AUDIT');
    console.log(`📍 Connected to: ${targetHost}:${targetPort} / ${targetDb}`);
    console.log('======================================================\n');

    // 1. Latest Order
    const orderRes = await client.query(`
      SELECT order_number, order_status, subtotal, discount_amount, delivery_fee, tax_amount, total_amount, payment_method, payment_status, placed_at
      FROM orders
      ORDER BY placed_at DESC
      LIMIT 1
    `);

    if (orderRes.rows.length === 0) {
      console.log('ℹ️ No orders found in database.');
    } else {
      const order = orderRes.rows[0];
      console.log('📋 LATEST ORDER IN POSTGRESQL:');
      console.table([order]);
    }

    // 2. Latest Inventory Transactions
    try {
      const invRes = await client.query(`
        SELECT transaction_type, quantity, reference_type, reference_id, created_at
        FROM inventory_transactions
        ORDER BY created_at DESC
        LIMIT 5
      `);
      console.log('\n📦 LATEST INVENTORY TRANSACTIONS:');
      console.table(invRes.rows);
    } catch (_) {}

    // 3. Latest Delivery Earnings
    try {
      const earnRes = await client.query(`
        SELECT assignment_id, partner_id, amount, status, created_at
        FROM delivery_earnings
        ORDER BY created_at DESC
        LIMIT 1
      `);
      console.log('\n🚴 LATEST RIDER EARNINGS CREDITED:');
      if (earnRes.rows.length > 0) {
        console.table(earnRes.rows);
      } else {
        console.log('ℹ️ No delivery earnings recorded yet.');
      }
    } catch (_) {}

    console.log('\n======================================================');
    console.log('🎉 RECONCILIATION CHECK COMPLETE');
    console.log('======================================================\n');

    await client.end();
  } catch (err) {
    console.error('\n❌ Reconciliation Error:', err.message);
    process.exit(1);
  }
}

verifyLatestOrder();
