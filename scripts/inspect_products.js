const { Pool } = require('pg');

const targetUser = process.env.POSTGRES_USER || process.env.DB_USER || 'postgres';
const targetPass = process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || '';
const targetHost = process.env.POSTGRES_HOST || process.env.DB_HOST || '127.0.0.1';
const targetPort = process.env.POSTGRES_PORT || process.env.DB_PORT || 5432;
const targetDb = process.env.POSTGRES_DB || process.env.DB_NAME || 'pocketkirana_db';

const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${targetUser}:${encodeURIComponent(targetPass)}@${targetHost}:${targetPort}/${targetDb}?schema=public`;

const pool = new Pool({ connectionString });

async function main() {
  try {
    const colRes = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'products'");
    console.log('Columns:', colRes.rows.map(r => r.column_name));

    const prodRes = await pool.query("SELECT id, name, thumbnail_url FROM products WHERE name ILIKE '%apple%' OR name ILIKE '%banana%' OR name ILIKE '%atta%'");
    console.log('Products:', prodRes.rows);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

main();
