/**
 * Read-only live PostgreSQL cutover verification.
 *
 * Scope is intentionally limited to the tables named in CUTOVER_GAP_VERIFICATION.md.
 * It runs inside `BEGIN READ ONLY` and must never be used for migrations or repairs.
 *
 * Usage: node scripts/verify_live_cutover_postgres.js
 * Optional: DB_HOST=192.168.0.103 DB_PORT=5433 node scripts/verify_live_cutover_postgres.js
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

try {
  const envFile = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8');
  for (const line of envFile.split(/\r?\n/)) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
  }
} catch (_) {
  // Environment variables or defaults are sufficient for a read-only audit.
}

const tables = [
  'orders',
  'order_items',
  'stock_reservations',
  'payments',
  'payment_transactions',
  'refunds',
  'idempotency_keys',
  'inventory_batches',
  'inventory_balances',
  'inventory_events',
];

const client = new Client({
  host: process.env.DB_HOST || '192.168.0.103',
  port: Number(process.env.DB_PORT || 5433),
  database: process.env.DB_NAME || 'pocketkirana_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'varbusiness',
  connectionTimeoutMillis: 10000,
});

function identifier(name) {
  return `"${name.replace(/"/g, '""')}"`;
}

async function main() {
  await client.connect();
  await client.query('BEGIN TRANSACTION READ ONLY');

  try {
    const tableRows = await client.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = ANY($1::text[])
       ORDER BY table_name`,
      [tables]
    );
    const present = new Set(tableRows.rows.map((row) => row.table_name));

    const columns = await client.query(
      `SELECT table_name, column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = ANY($1::text[])
       ORDER BY table_name, ordinal_position`,
      [tables]
    );
    const columnsByTable = new Map();
    for (const row of columns.rows) {
      const names = columnsByTable.get(row.table_name) || [];
      names.push(row.column_name);
      columnsByTable.set(row.table_name, names);
    }

    const foreignKeys = await client.query(
      `SELECT tc.table_name AS source_table,
              tc.constraint_name,
              kcu.column_name AS source_column,
              ccu.table_name AS target_table,
              ccu.column_name AS target_column
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
       JOIN information_schema.constraint_column_usage ccu
         ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
       WHERE tc.table_schema = 'public'
         AND tc.constraint_type = 'FOREIGN KEY'
         AND (tc.table_name = ANY($1::text[]) OR ccu.table_name = ANY($1::text[]))
       ORDER BY source_table, tc.constraint_name, source_column`,
      [tables]
    );

    const results = {
      target: `${client.host}:${client.port}/${client.database}`,
      readOnly: true,
      requestedTables: tables,
      presentTables: [...present],
      missingTables: tables.filter((table) => !present.has(table)),
      rowCounts: {},
      statusDistributions: {},
      foreignKeys: foreignKeys.rows,
      recoveryColumns: {},
      idempotency: null,
    };

    for (const table of tables) {
      if (!present.has(table)) continue;
      const names = columnsByTable.get(table) || [];
      const count = await client.query(`SELECT COUNT(*)::bigint AS count FROM ${identifier(table)}`);
      results.rowCounts[table] = count.rows[0].count;

      const statusColumn = names.find((name) => ['status', 'order_status', 'payment_status'].includes(name));
      if (statusColumn) {
        const statuses = await client.query(
          `SELECT ${identifier(statusColumn)}::text AS status, COUNT(*)::bigint AS count
           FROM ${identifier(table)}
           GROUP BY ${identifier(statusColumn)}
           ORDER BY count DESC, status NULLS FIRST`
        );
        results.statusDistributions[table] = { column: statusColumn, values: statuses.rows };
      }

      results.recoveryColumns[table] = names.filter((name) =>
        /(id$|status|reason|error|failure|gateway|transaction|attempt|reference|payload|response|created_at|updated_at|expires_at|resolved)/i.test(name)
      );
    }

    if (present.has('idempotency_keys')) {
      const idempotencyColumns = columnsByTable.get('idempotency_keys') || [];
      const expiryColumn = idempotencyColumns.includes('expires_at') ? ', COUNT(*) FILTER (WHERE expires_at > NOW())::bigint AS unexpired' : '';
      const idempotency = await client.query(
        `SELECT COUNT(*)::bigint AS total${expiryColumn} FROM idempotency_keys`
      );
      results.idempotency = { columns: idempotencyColumns, counts: idempotency.rows[0] };
    }

    console.log(JSON.stringify(results, null, 2));
  } finally {
    await client.query('ROLLBACK');
  }
}

main()
  .catch((error) => {
    console.error(`Cutover verification failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end().catch(() => {});
  });
