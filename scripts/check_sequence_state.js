/**
 * Quick check: what will the next NEXTVAL return?
 * Does NOT consume a sequence number.
 * Usage: node scripts/check_sequence_state.js
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

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
});

(async () => {
  await client.connect();

  // Read sequence metadata WITHOUT consuming a value
  const r = await client.query('SELECT last_value, is_called FROM pk_order_seq');
  const lastValue = Number(r.rows[0].last_value);
  const isCalled  = r.rows[0].is_called === true || r.rows[0].is_called === 'true';

  // When is_called=false: next NEXTVAL returns last_value (not last_value+1)
  const nextVal = isCalled ? lastValue + 1 : lastValue;
  const formatted = nextVal < 10 ? `PK-0${nextVal}` : `PK-${nextVal}`;

  console.log('\n══════════════════════════════════════════');
  console.log('  pk_order_seq — Current State');
  console.log('══════════════════════════════════════════');
  console.log(`  last_value : ${lastValue}`);
  console.log(`  is_called  : ${isCalled}`);
  console.log(`  ─────────────────────────────────────`);
  console.log(`  ➜ Next NEXTVAL will return : ${nextVal}`);
  console.log(`  ➜ Next order_number will be: ${formatted}`);
  console.log('══════════════════════════════════════════\n');

  await client.end();
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
