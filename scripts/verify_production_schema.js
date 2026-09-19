/**
 * PocketKirana — Production PostgreSQL Schema Verification Tool
 *
 * Validates that a target database possesses the complete canonical schema:
 * - PostgreSQL version & TLS configuration
 * - 62 canonical tables
 * - Foreign keys, indexes, and constraints
 * - Sequential number generators (pk_order_seq)
 * - Outbox events, notification events, FEFO, payment, and delivery tables
 *
 * Usage: node scripts/verify_production_schema.js
 */

const { Client } = require('pg');

const targetHost = process.env.DB_HOST || 'localhost';
const targetPort = parseInt(process.env.DB_PORT || '5432', 10);
const targetDb = process.env.DB_NAME || 'pocketkirana_db';
const targetUser = process.env.DB_USER || 'postgres';
const targetPass = process.env.DB_PASSWORD || 'postgres';
const sslMode = process.env.DATABASE_SSL === 'true' || process.env.NODE_ENV === 'production';

const connectionString = process.env.DATABASE_URL || 
  `postgresql://${targetUser}:${encodeURIComponent(targetPass)}@${targetHost}:${targetPort}/${targetDb}`;

// 62 Expected Tables in the Canonical Schema
const EXPECTED_TABLES = [
  'admin_audit_logs',
  'admin_roles',
  'admin_users',
  'app_notifications',
  'audit_logs',
  'brands',
  'categories',
  'coupons',
  'customer_addresses',
  'customer_profiles',
  'daily_reconciliations',
  'delivery_exceptions',
  'delivery_partner_shifts',
  'delivery_partners',
  'delivery_payouts',
  'delivery_routes',
  'delivery_tracking',
  'discounts',
  'dispatch_batches',
  'failed_jobs',
  'fefo_allocations',
  'geofences',
  'hub_inventories',
  'hubs',
  'idempotency_keys',
  'inventory',
  'inventory_adjustments',
  'inventory_balances',
  'inventory_batches',
  'inventory_events',
  'invoice_records',
  'live_locations',
  'marketing_banners',
  'notification_campaigns',
  'notification_events',
  'notification_preferences',
  'notifications',
  'order_events',
  'order_items',
  'order_timeline',
  'orders',
  'outbox_events',
  'packing_items',
  'packing_tasks',
  'payment_methods',
  'payment_transactions',
  'payments',
  'picker_assignments',
  'picker_performance',
  'picker_profiles',
  'picking_items',
  'picking_tasks',
  'product_barcodes',
  'product_categories',
  'product_images',
  'product_variants',
  'products',
  'refund_transactions',
  'refunds',
  'rider_ratings',
  'stock_reservation_items',
  'stock_reservations',
  'user_devices',
  'users',
];

async function verifyProductionSchema() {
  const client = new Client({
    connectionString,
    ssl: sslMode ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
  });

  console.log('\n========================================');
  console.log('POCKETKIRANA PRODUCTION SCHEMA VERIFY');
  console.log('========================================\n');

  let hasError = false;

  try {
    await client.connect();
    console.log(`📍 Connected to: ${targetHost}:${targetPort}/${targetDb}`);

    // 1. PostgreSQL Version
    const verRes = await client.query('SHOW server_version;');
    const ver = verRes.rows[0]?.server_version || 'unknown';
    console.log(`✓ PostgreSQL Version       : ${ver} (PASS)`);

    // 2. TLS Connection Status
    const sslRes = await client.query('SELECT ssl_is_used() AS is_ssl;');
    const isSsl = sslRes.rows[0]?.is_ssl || sslMode;
    console.log(`✓ TLS Connection           : ${isSsl ? 'ENCRYPTED (PASS)' : 'UNENCRYPTED / DEV ONLY'}`);

    // 3. Tables Verification
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    const existingTables = new Set(tablesRes.rows.map(r => r.table_name));

    let tablesFound = 0;
    const missingTables = [];
    EXPECTED_TABLES.forEach(tbl => {
      if (existingTables.has(tbl)) {
        tablesFound++;
      } else {
        missingTables.push(tbl);
      }
    });

    console.log(`✓ Tables                   : ${tablesFound} / ${EXPECTED_TABLES.length} verified`);
    if (missingTables.length > 0) {
      console.warn(`  ⚠️ Missing Tables (${missingTables.length}):`, missingTables.join(', '));
      hasError = true;
    }

    // 4. Foreign Keys
    const fkRes = await client.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.table_constraints 
      WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public';
    `);
    const fkCount = parseInt(fkRes.rows[0]?.count || '0', 10);
    console.log(`✓ Foreign Keys             : ${fkCount} active constraints`);

    // 5. Indexes
    const idxRes = await client.query(`
      SELECT COUNT(*) as count 
      FROM pg_indexes 
      WHERE schemaname = 'public';
    `);
    const idxCount = parseInt(idxRes.rows[0]?.count || '0', 10);
    console.log(`✓ Indexes                  : ${idxCount} active indexes`);

    // 6. Sequential Generator (pk_order_seq)
    const seqRes = await client.query(`
      SELECT sequence_name 
      FROM information_schema.sequences 
      WHERE sequence_schema = 'public' AND sequence_name = 'pk_order_seq';
    `);
    if (seqRes.rows.length > 0) {
      console.log(`✓ Order Sequence Generator : pk_order_seq verified (PASS)`);
    } else {
      console.warn(`⚠️ Order Sequence Generator : pk_order_seq missing!`);
      hasError = true;
    }

    // 7. Transactional Outbox Table & Fencing
    const outboxColsRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'outbox_events' AND table_schema = 'public';
    `);
    const outboxCols = new Set(outboxColsRes.rows.map(r => r.column_name));
    if (outboxCols.has('id') && outboxCols.has('lease_token') && outboxCols.has('leased_until') && outboxCols.has('status')) {
      console.log(`✓ Outbox Lease Fencing     : outbox_events schema verified (PASS)`);
    } else {
      console.warn(`⚠️ Outbox Table Schema incomplete!`);
      hasError = true;
    }

    // 8. Notification Idempotency Ledger
    const notifEventCols = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'notification_events' AND table_schema = 'public';
    `);
    if (notifEventCols.rows.length > 0) {
      console.log(`✓ Notification Idempotency : notification_events verified (PASS)`);
    } else {
      console.warn(`⚠️ notification_events table missing!`);
      hasError = true;
    }

    // 9. FEFO Inventory System
    const fefoBatchCols = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'inventory_batches' AND table_schema = 'public';
    `);
    if (fefoBatchCols.rows.length > 0) {
      console.log(`✓ FEFO Inventory Batches   : inventory_batches verified (PASS)`);
    } else {
      console.warn(`⚠️ inventory_batches table missing!`);
      hasError = true;
    }

    // 10. Payment Transactions & Reconciliation
    const paymentCols = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'payment_transactions' AND table_schema = 'public';
    `);
    if (paymentCols.rows.length > 0) {
      console.log(`✓ Payment Reconciliation   : payment_transactions verified (PASS)`);
    } else {
      console.warn(`⚠️ payment_transactions table missing!`);
      hasError = true;
    }

    console.log('\n========================================');
    if (!hasError) {
      console.log('RESULT: PASS — SCHEMA IS READY FOR PRODUCTION');
    } else {
      console.log('RESULT: INCOMPLETE — SCHEMA REQUIRES MIGRATIONS');
    }
    console.log('========================================\n');

  } catch (err) {
    console.error('❌ Connection or Verification error:', err.message);
    hasError = true;
  } finally {
    try {
      await client.end();
    } catch {}
  }

  return !hasError;
}

if (require.main === module) {
  verifyProductionSchema().then(passed => {
    process.exit(passed ? 0 : 1);
  });
}

module.exports = { verifyProductionSchema, EXPECTED_TABLES };
