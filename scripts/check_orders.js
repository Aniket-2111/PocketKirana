/**
 * Quick query: last 10 orders + total order count in DB
 * Usage: node scripts/check_orders.js
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

try {
  const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8');
  envContent.split('\n').forEach(line => {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
} catch (_) {}

const client = new Client({
  host: process.env.DB_HOST || '192.168.0.102',
  port: parseInt(process.env.DB_PORT || '5433'),
  database: process.env.DB_NAME || 'pocketkirana_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  connectionTimeoutMillis: 5000
});

(async () => {
  await client.connect();
  console.log('\n📊 TOTAL ORDERS IN DATABASE:');
  const count = await client.query('SELECT COUNT(*) as total FROM orders');
  console.log(`   ${count.rows[0].total} orders total\n`);

  console.log('📋 LAST 10 ORDERS (newest first):');
  const orders = await client.query(`
    SELECT order_number, order_status, payment_method, payment_status,
           total_amount, placed_at
    FROM orders
    ORDER BY placed_at DESC
    LIMIT 10
  `);
  console.table(orders.rows);

  await client.end();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
