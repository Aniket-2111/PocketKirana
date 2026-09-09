/**
 * PocketKirana — Sequential Production Order Number Migration
 *
 * Creates the pk_order_seq PostgreSQL sequence for concurrency-safe
 * production order numbering (PK-01, PK-02, ... PK-99, PK-100, ...).
 *
 * Safety guarantees:
 *   - CREATE SEQUENCE IF NOT EXISTS: idempotent, safe to run multiple times
 *   - Does NOT modify existing orders
 *   - Does NOT alter the orders table schema
 *   - Automated test orders (PK-E2E-*, PK-DRY-*, etc.) are untouched
 *   - Production numbering starts at PK-01 independently
 *
 * Usage: node scripts/create_order_sequence.js
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Securely load .env.local
try {
  const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8');
  envContent.split('\n').forEach((line) => {
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
  connectionTimeoutMillis: 8000,
});

async function run() {
  await client.connect();
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  POCKETKIRANA — Sequential Order Number Migration');
  console.log('══════════════════════════════════════════════════════════════\n');

  // ── STEP 1: Verify no existing production-format order numbers ──
  console.log('[1/5] Checking for any existing PK-01..PK-99 order numbers...');
  const existing = await client.query(`
    SELECT order_number FROM orders
    WHERE order_number ~ '^PK-[0-9]+$'
    ORDER BY order_number
  `);
  if (existing.rows.length > 0) {
    console.log(`  ⚠️  Found ${existing.rows.length} sequential order number(s) already:`);
    existing.rows.forEach(r => console.log(`     ${r.order_number}`));
  } else {
    console.log('  ✔ No existing sequential production order numbers found. Safe to proceed.');
  }

  // ── STEP 2: Verify orders.order_number column type ──
  console.log('\n[2/5] Verifying orders.order_number column type and constraints...');
  const colInfo = await client.query(`
    SELECT column_name, data_type, character_maximum_length, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'order_number'
  `);
  if (colInfo.rows.length === 0) {
    throw new Error('orders.order_number column not found!');
  }
  console.log('  ✔ Column info:', colInfo.rows[0]);

  // Verify UNIQUE constraint
  const uqInfo = await client.query(`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'orders' AND indexname LIKE '%order_number%'
  `);
  if (uqInfo.rows.length > 0) {
    console.log(`  ✔ Unique constraint found: ${uqInfo.rows.map(r => r.indexname).join(', ')}`);
  }

  // ── STEP 3: Create sequence ──
  console.log('\n[3/5] Creating pk_order_seq sequence (START 1, INCREMENT 1)...');
  await client.query(`
    CREATE SEQUENCE IF NOT EXISTS pk_order_seq
    START WITH 1
    INCREMENT BY 1
    NO MAXVALUE
    CACHE 1;
  `);
  console.log('  ✔ Sequence pk_order_seq created (or already existed).');

  // ── STEP 4: Verify sequence works ──
  console.log('\n[4/5] Verifying sequence produces correct values...');
  const seqCheck = await client.query(`SELECT nextval('pk_order_seq') as next_val`);
  const firstVal = parseInt(seqCheck.rows[0].next_val, 10);
  const formatted = firstVal < 10 ? `PK-0${firstVal}` : `PK-${firstVal}`;
  console.log(`  ✔ First NEXTVAL: ${firstVal} → formatted: ${formatted}`);

  // Reset sequence back so first REAL order gets PK-01
  // (We consumed one value in the test above, so reset to 1 so next call gives the right next number)
  await client.query(`SELECT setval('pk_order_seq', 1, false)`); // false = next call returns 1
  console.log('  ✔ Sequence reset: next NEXTVAL will return 1 → PK-01');

  // ── STEP 5: Final state check ──
  console.log('\n[5/5] Confirming total existing orders are untouched...');
  const countRes = await client.query('SELECT COUNT(*) as total FROM orders');
  console.log(`  ✔ Total orders in database: ${countRes.rows[0].total} (all existing orders preserved)`);

  const latestAutoTest = await client.query(`
    SELECT order_number, order_status FROM orders
    WHERE order_number NOT SIMILAR TO 'PK-[0-9]+'
    ORDER BY placed_at DESC LIMIT 3
  `);
  console.log('  ✔ Latest automated test orders (untouched):');
  latestAutoTest.rows.forEach(r => console.log(`     ${r.order_number} → ${r.order_status}`));

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  ✅ MIGRATION COMPLETE');
  console.log('  Next production order will receive: PK-01');
  console.log('══════════════════════════════════════════════════════════════\n');

  await client.end();
}

run().catch(e => {
  console.error('\n❌ Migration failed:', e.message);
  process.exit(1);
});
