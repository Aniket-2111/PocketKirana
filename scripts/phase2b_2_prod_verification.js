import { Pool } from 'pg';
import fs from 'fs';

async function main() {
  let rawUrl = process.env.DATABASE_URL;
  if (!rawUrl && fs.existsSync('.env.local')) {
    const env = fs.readFileSync('.env.local', 'utf8');
    const match = env.match(/DATABASE_URL=([^\r\n]+)/);
    if (match) {
      rawUrl = match[1].trim().replace(/^["']|["']$/g, '');
    }
  }

  if (!rawUrl) {
    console.error('No DATABASE_URL found');
    process.exit(1);
  }

  const prodUrl = rawUrl.replace('/pocketkirana_test', '/pocketkirana_db');
  const pool = new Pool({ connectionString: prodUrl });

  try {
    const dbRes = await pool.query('SELECT current_database();');
    console.log('Connected DB:', dbRes.rows[0].current_database);

    if (dbRes.rows[0].current_database !== 'pocketkirana_db') {
      console.error('ABORTING: Not connected to pocketkirana_db');
      process.exit(1);
    }

    const storesRes = await pool.query('SELECT COUNT(*) FROM stores;');
    const ordersRes = await pool.query('SELECT COUNT(*) FROM orders;');
    const whRes = await pool.query('SELECT COUNT(*) FROM warehouses;');
    const adminUsersRes = await pool.query('SELECT COUNT(*) FROM admin_users;');
    const asaRes = await pool.query('SELECT COUNT(*) FROM admin_store_assignments;');
    const auditRes = await pool.query('SELECT COUNT(*) FROM audit_logs;');

    const rolesRes = await pool.query("SELECT id, name, description FROM roles WHERE name = 'store_admin';");

    console.log('\n--- PRODUCTION BASELINE COUNTS ---');
    console.log('stores:', storesRes.rows[0].count);
    console.log('orders:', ordersRes.rows[0].count);
    console.log('warehouses:', whRes.rows[0].count);
    console.log('admin_users:', adminUsersRes.rows[0].count);
    console.log('admin_store_assignments:', asaRes.rows[0].count);
    console.log('audit_logs:', auditRes.rows[0].count);
    console.log('store_admin role exists in DB:', rolesRes.rows.length > 0 ? 'YES' : 'NO');
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
