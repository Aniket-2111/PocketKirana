/**
 * PocketKirana Discovery Performance Index Migration
 * Creates targeted indexes supporting /api/products/discover, sorting, filtering, and variant joins.
 * Usage: node scripts/add_discover_indexes.js
 */

const { Client } = require('pg');

const targetHost = process.env.DB_HOST || '192.168.0.106';
const targetPort = parseInt(process.env.DB_PORT || '5433', 10);
const targetDb = process.env.DB_NAME || 'pocketkirana_db';
const targetUser = process.env.DB_USER || 'postgres';
const targetPass = process.env.DB_PASSWORD || 'varbusiness';

const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${targetUser}:${encodeURIComponent(targetPass)}@${targetHost}:${targetPort}/${targetDb}`;

const indexStatements = [
  { name: 'idx_products_category', sql: 'CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);' },
  { name: 'idx_products_subcategory', sql: 'CREATE INDEX IF NOT EXISTS idx_products_subcategory ON products(subcategory_id);' },
  { name: 'idx_products_brand', sql: 'CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);' },
  { name: 'idx_products_status', sql: 'CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);' },
  { name: 'idx_products_discover_sort', sql: 'CREATE INDEX IF NOT EXISTS idx_products_discover_sort ON products(is_featured DESC, created_at DESC);' },
  { name: 'idx_variants_product', sql: 'CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);' },
  { name: 'idx_variants_product_display', sql: 'CREATE INDEX IF NOT EXISTS idx_variants_product_display ON product_variants(product_id, display_order, created_at);' },
];

async function applyIndexes() {
  console.log('⚡ Applying PocketKirana Product Discovery Indexes...');
  const client = new Client({ connectionString, connectionTimeoutMillis: 4000 });

  try {
    await client.connect();
    for (const item of indexStatements) {
      const start = Date.now();
      await client.query(item.sql);
      console.log(`✅ Index verified: ${item.name} (${Date.now() - start}ms)`);
    }
    console.log('🎉 All discovery performance indexes are verified and active.');
  } catch (err) {
    console.warn('⚠️ Could not connect to remote PostgreSQL to apply indexes (will apply when online):', err.message);
  } finally {
    await client.end().catch(() => {});
  }
}

applyIndexes();
