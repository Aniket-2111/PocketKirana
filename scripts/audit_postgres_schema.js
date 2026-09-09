/**
 * Diagnostic CLI Tool: Comprehensive PocketKirana PostgreSQL Schema Audit
 * Checks actual columns, data types (BYTEA), PKs, FKs (including `users` dependencies), and indexes.
 * Usage: node scripts/audit_postgres_schema.js
 */

const { Client } = require('pg');

const targetHost = process.env.DB_HOST || '192.168.0.101';
const targetPort = parseInt(process.env.DB_PORT || '5433', 10);
const targetDb = process.env.DB_NAME || 'pocketkirana_db';
const targetUser = process.env.DB_USER || 'postgres';
const targetPass = process.env.DB_PASSWORD || 'varbusiness';

const connectionString = `postgresql://${targetUser}:${encodeURIComponent(targetPass)}@${targetHost}:${targetPort}/${targetDb}`;

async function runAudit() {
  const client = new Client({ connectionString, connectionTimeoutMillis: 10000 });

  try {
    await client.connect();
    console.log('\n======================================================');
    console.log('🔍 POCKETKIRANA POSTGRESQL DETAILED SCHEMA AUDIT');
    console.log(`📍 Host: ${targetHost}:${targetPort} | DB: ${targetDb}`);
    console.log('======================================================\n');

    // 1. Column Metadata Audit
    const colsRes = await client.query(`
      SELECT 
        table_name, 
        column_name, 
        data_type, 
        udt_name, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      ORDER BY table_name, ordinal_position;
    `);

    console.log(`📋 Total Columns Across All Tables: ${colsRes.rows.length}\n`);

    // Group columns by table
    const tableColumns = {};
    colsRes.rows.forEach(r => {
      if (!tableColumns[r.table_name]) tableColumns[r.table_name] = [];
      tableColumns[r.table_name].push(r);
    });

    console.log('--- TABLE COLUMN METADATA SUMMARY ---');
    for (const [tbl, cols] of Object.entries(tableColumns)) {
      console.log(`\n📌 Table: ${tbl} (${cols.length} columns)`);
      cols.forEach(c => {
        const typeStr = c.data_type === 'USER-DEFINED' ? c.udt_name : (c.data_type === 'ARRAY' ? `${c.udt_name}[]` : c.udt_name);
        const nullStr = c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const defStr = c.column_default ? ` DEFAULT ${c.column_default}` : '';
        console.log(`    • ${c.column_name.padEnd(24)} : ${typeStr.padEnd(16)} | ${nullStr}${defStr}`);
      });
    }

    // 2. Foreign Key Dependency Audit on `users`
    console.log('\n======================================================');
    console.log('🔗 FOREIGN KEY DEPENDENCY AUDIT ON `users` TABLE');
    console.log('======================================================\n');

    const fkRes = await client.query(`
      SELECT
          tc.constraint_name,
          tc.table_name AS source_table,
          kcu.column_name AS source_column,
          ccu.table_name AS target_table,
          ccu.column_name AS target_column
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
          ON tc.constraint_name = ccu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND (ccu.table_name = 'users' OR tc.table_name = 'users' OR kcu.column_name = 'user_id' OR kcu.column_name = 'customer_id');
    `);

    if (fkRes.rows.length === 0) {
      console.log('✅ No active Foreign Keys referencing `users` or `customer_id`/`user_id` found!');
    } else {
      console.log(`⚠️ Found ${fkRes.rows.length} Foreign Key constraints involving \`users\` / user columns:`);
      fkRes.rows.forEach(r => {
        console.log(`    • Constraint [${r.constraint_name}]: ${r.source_table}.${r.source_column} -> ${r.target_table}.${r.target_column}`);
      });
    }

    // 3. Image Binary (BYTEA) Column Audit
    console.log('\n======================================================');
    console.log('🖼️ BINARY IMAGE (BYTEA) COLUMN AUDIT');
    console.log('======================================================\n');

    const byteaRes = await client.query(`
      SELECT table_name, column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND udt_name = 'bytea';
    `);

    if (byteaRes.rows.length > 0) {
      console.log(`✅ Verified ${byteaRes.rows.length} BYTEA binary columns for storing images directly in PostgreSQL:`);
      byteaRes.rows.forEach(r => console.log(`    • ${r.table_name}.${r.column_name} (${r.udt_name})`));
    } else {
      console.log('❌ WARNING: No BYTEA columns found in public schema!');
    }

    // 4. Index Audit
    console.log('\n======================================================');
    console.log('⚡ INDEXES AUDIT');
    console.log('======================================================\n');

    const idxRes = await client.query(`
      SELECT tablename, indexname, indexdef 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      ORDER BY tablename, indexname;
    `);

    console.log(`📊 Total Indexes Created: ${idxRes.rows.length}`);
    idxRes.rows.forEach(r => console.log(`    • ${r.tablename} -> ${r.indexname}`));

    console.log('\n======================================================');
    console.log('🎉 AUDIT COMPLETE');
    console.log('======================================================\n');

  } catch (err) {
    console.error('❌ Audit Failed:', err.message);
  } finally {
    await client.end();
  }
}

runAudit();
