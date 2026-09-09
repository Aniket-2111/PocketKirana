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
  connectionTimeoutMillis: 8000,
});

async function inspect() {
  await client.connect();
  try {
    const countRes = await client.query("SELECT COUNT(*) FROM product_variants");
    console.log('Total rows in product_variants:', countRes.rows[0].count);

    const rowsRes = await client.query("SELECT * FROM product_variants LIMIT 5");
    console.log('Sample rows:', rowsRes.rows);

    const productsCount = await client.query("SELECT COUNT(*) FROM products");
    console.log('Total products:', productsCount.rows[0].count);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
    process.exit(0);
  }
}

inspect();
