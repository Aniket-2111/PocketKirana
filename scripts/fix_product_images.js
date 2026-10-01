const { Pool } = require('pg');

const targetHost = process.env.DB_HOST || '192.168.0.101';
const targetPort = parseInt(process.env.DB_PORT || '5433', 10);
const targetDb = process.env.DB_NAME || 'pocketkirana_db';
const targetUser = process.env.DB_USER || 'postgres';
const targetPass = process.env.DB_PASSWORD || process.env.PGPASSWORD || 'varbusiness';

const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${targetUser}:${encodeURIComponent(targetPass)}@${targetHost}:${targetPort}/${targetDb}?schema=public`;

const pool = new Pool({ connectionString, connectionTimeoutMillis: 5000 });

async function fixProductImages() {
  console.log('\n=============================================');
  console.log('🖼️ FIXING PRODUCT IMAGES IN POSTGRESQL');
  console.log('=============================================\n');

  const client = await pool.connect();
  try {
    // 1. Give dry-run duplicate test products appropriate category images rather than null
    const dryRunUpdate = await client.query(`
      UPDATE products 
      SET thumbnail_url = 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=400&q=80'
      WHERE id LIKE 'prod_dry_%' AND thumbnail_url IS NULL AND name ILIKE '%atta%'
    `);
    console.log(`✅ Updated ${dryRunUpdate.rowCount} dry-run products with atta thumbnail_url`);

    // 2. Ensure canonical image URLs for key products
    const updates = [
      {
        id: 'p-apple-1kg',
        name: 'Apple Red (1kg)',
        url: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=400&q=80',
      },
      {
        id: 'p-banana-1kg',
        name: 'Banana (1kg)',
        url: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=400&q=80',
      },
      {
        id: 'p-atta-5kg',
        name: 'Aashirvaad Atta 5kg',
        url: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=400&q=80',
      },
      {
        id: 'p_atta_5kg',
        name: 'Aashirvaad Superior MP Atta 5kg',
        url: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=400&q=80',
      },
    ];

    for (const item of updates) {
      const res = await client.query(
        `UPDATE products SET thumbnail_url = $1 WHERE id = $2 OR name ILIKE $3`,
        [item.url, item.id, `%${item.name}%`]
      );
      console.log(`✅ Updated ${item.name}: ${res.rowCount} row(s)`);
    }

    // 3. Verify products with images
    const verifyRes = await client.query(`
      SELECT id, name, thumbnail_url 
      FROM products 
      WHERE name ILIKE '%apple%' OR name ILIKE '%banana%' OR name ILIKE '%atta%'
    `);
    console.log('\n--- VERIFIED PRODUCTS ---');
    console.table(verifyRes.rows);

  } catch (err) {
    console.error('❌ Error fixing product images:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fixProductImages();
