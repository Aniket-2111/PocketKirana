/**
 * Diagnostic CLI Tool: Test Developer -> Client Laptop PostgreSQL Connection & Schema Audit
 * Usage: node scripts/test_client_postgres.js [CLIENT_IP]
 */

const net = require('net');
const { Client } = require('pg');

const targetHost = process.argv[2] || process.env.DB_HOST || '192.168.0.101';
const targetPort = parseInt(process.env.DB_PORT || '5433', 10);
const targetDb = process.env.DB_NAME || 'pocketkirana_db';
const targetUser = process.env.DB_USER || 'postgres';
const targetPass = process.env.DB_PASSWORD || 'varbusiness';

console.log('\n======================================================');
console.log('🐘 POCKETKIRANA — CLIENT LAPTOP POSTGRESQL DIAGNOSTIC');
console.log('======================================================\n');
console.log(`📍 Client Laptop IP : ${targetHost}`);
console.log(`🔌 Target Port      : ${targetPort}`);
console.log(`📦 Database Name    : ${targetDb}`);
console.log(`👤 Database User    : ${targetUser}`);
console.log('------------------------------------------------------');

// Step 1: Test TCP Network Socket
console.log(`\n[1/3] Testing TCP Port ${targetPort} Reachability...`);
const socket = new net.Socket();
socket.setTimeout(10000);

socket.on('connect', () => {
  console.log(`✅ SUCCESS: TCP Port ${targetPort} is OPEN on Client Laptop (${targetHost}). Firewall is allowing connection!`);
  socket.destroy();
  runDatabaseAuthTest();
});

socket.on('timeout', () => {
  console.error(`❌ TIMEOUT: Could not reach ${targetHost}:${targetPort} within 10 seconds.`);
  console.error('\n🛠️ Troubleshooting Tips:');
  console.error(` 1. Ensure Client Laptop Firewall allows TCP Port ${targetPort} inbound.`);
  console.error(' 2. Check if postgresql.conf has `listen_addresses = "*"` on Client Laptop.');
  console.error(' 3. Ensure both laptops are connected to the same Wi-Fi/subnet.');
  socket.destroy();
});

socket.on('error', (err) => {
  console.error(`❌ ERROR: TCP Connection failed to ${targetHost}:${targetPort} (${err.message}).`);
  socket.destroy();
});

socket.connect(targetPort, targetHost);

// Step 2 & 3: Test SQL Authentication & Run Schema Diagnostics
async function runDatabaseAuthTest() {
  console.log('\n[2/3] Authenticating with PostgreSQL (`pocketkirana_db` database)...');

  const connectionString = `postgresql://${targetUser}:${encodeURIComponent(targetPass)}@${targetHost}:${targetPort}/${targetDb}`;
  const client = new Client({ connectionString, connectionTimeoutMillis: 10000 });

  const start = Date.now();
  try {
    await client.connect();
    const duration = Date.now() - start;
    console.log(`✅ SUCCESS: Authenticated successfully in ${duration}ms!`);

    console.log('\n[3/3] Running System Diagnostics & Schema Audit Query...');
    const versionRes = await client.query('SELECT VERSION(), NOW() as server_time, current_database() as db_name, current_user as db_user');
    const row = versionRes.rows[0];

    console.log('------------------------------------------------------');
    console.log(`🐘 PostgreSQL Version : ${row.version.split(',')[0]}`);
    console.log(`🕒 Server Time (Client): ${row.server_time}`);
    console.log(`📁 Active Database    : ${row.db_name}`);
    console.log(`🔑 Connected User     : ${row.db_user}`);

    // Check Tables
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    const tableNames = tablesRes.rows.map(r => r.table_name);
    console.log(`\n📊 Existing Database Tables Count: ${tableNames.length}`);

    // Categorized Modules mapping
    const modules = {
      '01. CATALOG': ['categories', 'brands', 'products', 'product_variants', 'product_images', 'product_attributes', 'product_attribute_values'],
      '02. STORE & INVENTORY': ['stores', 'inventory', 'inventory_transactions', 'stock_reservations'],
      '03. SHOPPING': ['carts', 'cart_items', 'wishlists', 'wishlist_items'],
      '04. ORDERS': ['orders', 'order_items', 'order_addresses', 'order_status_history', 'order_notes'],
      '05. PAYMENTS': ['payments', 'payment_transactions', 'refunds'],
      '06. DELIVERY': ['delivery_zones', 'delivery_partners', 'delivery_assignments', 'delivery_status_history', 'delivery_tracking', 'partner_auth_tokens', 'picking_tasks'],
      '07. OFFERS & COUPONS': ['coupons', 'coupon_usage', 'offers', 'offer_products', 'offer_categories'],
      '08. CUSTOMER ACTIVITY': ['reviews', 'notifications', 'support_tickets'],
      '09. ADMIN': ['roles', 'permissions', 'role_permissions', 'admin_users', 'audit_logs'],
      '10. REPORTING': ['daily_statistics', 'sales_summaries']
    };

    console.log('\n🗂️ Module Schema Audit:');
    for (const [modName, modTables] of Object.entries(modules)) {
      const present = modTables.filter(t => tableNames.includes(t));
      const statusIcon = present.length === modTables.length ? '✅' : (present.length > 0 ? '⚠️' : '❌');
      console.log(` ${statusIcon} ${modName} (${present.length}/${modTables.length} tables present)`);
      present.forEach(t => console.log(`      • ${t}`));
    }

    console.log('------------------------------------------------------');
    console.log('🎉 RESULT: DEVELOPER LAPTOP IS CONNECTED TO CLIENT LAPTOP POSTGRESQL DATABASE!\n');

    await client.end();
  } catch (error) {
    console.error('❌ SQL AUTHENTICATION / QUERY FAILED:', error.message);
    try { await client.end(); } catch (e) { }
  }
}
