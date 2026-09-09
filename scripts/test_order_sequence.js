/**
 * PocketKirana — Sequential Order Number Verification Test Suite
 *
 * Verifies:
 *   1. Formatting (1→PK-01, 9→PK-09, 10→PK-10, 99→PK-99, 100→PK-100)
 *   2. Existing test orders are unchanged
 *   3. Uniqueness of generated numbers
 *   4. Concurrency — 20 simultaneous NEXTVAL calls, 0 duplicates
 *
 * Usage: node scripts/test_order_sequence.js
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

try {
  const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8');
  envContent.split('\n').forEach((line) => {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
} catch (_) {}

const pool = new Pool({
  host: process.env.DB_HOST || '192.168.0.102',
  port: parseInt(process.env.DB_PORT || '5433'),
  database: process.env.DB_NAME || 'pocketkirana_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max: 30,
  connectionTimeoutMillis: 8000,
});

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`  ✔ ${msg}`);
    passed++;
  } else {
    console.error(`  ✖ FAIL: ${msg}`);
    failed++;
  }
}

function formatOrderNum(n) {
  return n < 10 ? `PK-0${n}` : `PK-${n}`;
}

async function run() {
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  POCKETKIRANA — Sequential Order Number Test Suite');
  console.log('══════════════════════════════════════════════════════════════\n');

  // ── TEST 1: Formatting logic ──────────────────────────────────────
  console.log('TEST 1: Formatting Verification');
  const cases = [
    [1, 'PK-01'], [2, 'PK-02'], [9, 'PK-09'],
    [10, 'PK-10'], [99, 'PK-99'], [100, 'PK-100'], [101, 'PK-101'],
  ];
  cases.forEach(([n, expected]) => {
    const result = formatOrderNum(n);
    assert(result === expected, `${n} → ${result} (expected ${expected})`);
  });

  // ── TEST 2: Existing test orders unchanged ────────────────────────
  console.log('\nTEST 2: Existing Automated Test Orders Preserved');
  const existingRes = await pool.query(`
    SELECT order_number FROM orders
    WHERE order_number IN ('PK-E2E-850695','PK-DRY-804384','PK-CANCEL-804384','PK-DISP-780557')
    ORDER BY placed_at DESC
  `);
  assert(existingRes.rows.length === 4, `All 4 known test orders still present in DB`);
  existingRes.rows.forEach(r => {
    assert(!r.order_number.match(/^PK-\d+$/), `${r.order_number} has non-sequential format (correct)`);
  });

  // ── TEST 3: Total order count unchanged ───────────────────────────
  console.log('\nTEST 3: Order Count Integrity');
  const countRes = await pool.query('SELECT COUNT(*) as total FROM orders');
  const total = parseInt(countRes.rows[0].total, 10);
  assert(total >= 44, `Total orders still ≥ 44 (actual: ${total}) — no data deleted`);

  // ── TEST 4: Sequence uniqueness — 10 serial calls ─────────────────
  console.log('\nTEST 4: Serial Uniqueness (10 sequential NEXTVAL calls)');
  // Save current seq state
  const currentSeq = await pool.query("SELECT last_value FROM pk_order_seq");
  const startVal = parseInt(currentSeq.rows[0].last_value, 10);

  const serialNums = [];
  for (let i = 0; i < 10; i++) {
    const r = await pool.query("SELECT NEXTVAL('pk_order_seq') AS n");
    serialNums.push(Number(r.rows[0].n));
  }
  const serialUniq = new Set(serialNums);
  assert(serialUniq.size === 10, `All 10 serial numbers unique (${serialNums.map(n => formatOrderNum(n)).join(', ')})`);

  // ── TEST 5: Concurrency — 20 parallel NEXTVAL calls ───────────────
  console.log('\nTEST 5: Concurrency Safety (20 parallel NEXTVAL calls)');
  const concurrentResults = await Promise.all(
    Array.from({ length: 20 }, () =>
      pool.query("SELECT NEXTVAL('pk_order_seq') AS n").then(r => Number(r.rows[0].n))
    )
  );
  const concurrentSet = new Set(concurrentResults);
  assert(concurrentSet.size === 20, `All 20 concurrent calls returned unique numbers (0 duplicates)`);
  const concurrentFormatted = [...concurrentSet].sort((a,b) => a-b).map(n => formatOrderNum(n));
  console.log(`     Generated: ${concurrentFormatted.join(', ')}`);

  // ── TEST 6: Reset sequence to 1 for next real order ───────────────
  console.log('\nTEST 6: Reset Sequence for First Real Customer Order');
  await pool.query("SELECT setval('pk_order_seq', 1, false)"); // next call → 1
  const peekRes = await pool.query("SELECT NEXTVAL('pk_order_seq') AS n");
  const nextNum = Number(peekRes.rows[0].n);
  assert(nextNum === 1, `After reset, NEXTVAL returns 1`);
  assert(formatOrderNum(nextNum) === 'PK-01', `PK-01 will be assigned to the next order`);
  // Reset again so first real order gets PK-01
  await pool.query("SELECT setval('pk_order_seq', 1, false)");
  console.log('  ✔ Sequence reset to 1 — first real customer order will receive PK-01');

  // ── SUMMARY ───────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════');
  if (failed === 0) {
    console.log(`  🎉 ALL CHECKS PASSED: ${passed} passed, ${failed} failed`);
  } else {
    console.log(`  ❌ ${failed} CHECK(S) FAILED: ${passed} passed, ${failed} failed`);
  }
  console.log('══════════════════════════════════════════════════════════════\n');

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => {
  console.error('\n❌ Test error:', e.message);
  process.exit(1);
});
