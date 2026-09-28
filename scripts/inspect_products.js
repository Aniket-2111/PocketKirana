const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres:varbusiness@192.168.0.101:5433/pocketkirana_db?schema=public'
});

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
