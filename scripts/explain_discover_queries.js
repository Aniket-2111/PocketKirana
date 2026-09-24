/**
 * PocketKirana PostgreSQL Query Plan & Index Verification Script
 * Runs EXPLAIN (ANALYZE, BUFFERS) against live discovery queries on PostgreSQL.
 * Usage: node scripts/explain_discover_queries.js
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

async function runExplainTests() {
  console.log('================================================================');
  console.log('🔍 RUNNING EXPLAIN (ANALYZE, BUFFERS) ON REAL POSTGRESQL INSTANCE');
  console.log(`📍 Host: ${targetHost}:${targetPort} | Database: ${targetDb}`);
  console.log('================================================================\n');

  const client = new Client({ connectionString, connectionTimeoutMillis: 5000 });
  await client.connect();

  // Test 1: Baseline Page 1 Discovery (Limit 13)
  console.log('📋 [TEST 1] Page 1 Discovery Query (Limit 13, no exclusions):');
  const query1 = `
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT 
      p.id, p.category_id, p.subcategory_id, p.brand_id, p.name, p.slug, 
      p.selling_price, p.stock, p.status, p.is_featured, p.created_at
    FROM products p
    WHERE (p.status IS NULL OR LOWER(p.status) NOT IN ('inactive', 'discontinued'))
    ORDER BY 
      CASE WHEN COALESCE(p.stock, 0) > 0 THEN 0 ELSE 1 END,
      p.is_featured DESC,
      p.created_at DESC
    LIMIT 13 OFFSET 0;
  `;
  const res1 = await client.query(query1);
  res1.rows.forEach((r) => console.log('   ' + r['QUERY PLAN']));

  // Test 2: Page 2 Discovery with 50 Exclusions
  console.log('\n📋 [TEST 2] Page 2 Discovery Query with 50 Exclusions ($1 array):');
  const sampleExclusions = [
    'p-milk-fresh-1l', 'amul-fresh-milk-1l', 'p-butter-500g', 'amul-butter-500g',
    'p-paneer-200g', 'amul-paneer-200g', 'p-cauliflower-1pc', 'cauliflower-1pc',
    'p-tomato-hybrid-1kg', 'tomato-hybrid-1kg', 'p-onion-1kg', 'onion-1kg',
    'p-potato-1kg', 'potato-1kg', 'p-atta-10kg', 'aashirvaad-atta-10kg',
    'p-fortune-oil-1l', 'fortune-sunflower-oil-1l', 'p-sugar-1kg', 'madhur-sugar-1kg',
    'p-toordal-1kg', 'tata-sampann-toor-dal-1kg', 'p-maggi-70g', 'maggi-noodles-70g',
    'p-chiaseeds-200g', 'chia-seeds-200g', 'p-almonds-500g', 'california-almonds-500g'
  ];
  const query2 = `
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT 
      p.id, p.category_id, p.subcategory_id, p.brand_id, p.name, p.slug, 
      p.selling_price, p.stock, p.status, p.is_featured, p.created_at
    FROM products p
    WHERE (p.status IS NULL OR LOWER(p.status) NOT IN ('inactive', 'discontinued'))
      AND NOT (p.id = ANY($1::varchar[]) OR (p.slug IS NOT NULL AND p.slug = ANY($1::varchar[])))
    ORDER BY 
      CASE WHEN COALESCE(p.stock, 0) > 0 THEN 0 ELSE 1 END,
      p.is_featured DESC,
      p.created_at DESC
    LIMIT 13 OFFSET 12;
  `;
  const res2 = await client.query(query2, [sampleExclusions]);
  res2.rows.forEach((r) => console.log('   ' + r['QUERY PLAN']));

  // Test 3: Category Filter Query
  console.log('\n📋 [TEST 3] Category Filter Query (fruits-vegetables):');
  const query3 = `
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT 
      p.id, p.category_id, p.subcategory_id, p.brand_id, p.name, p.slug, 
      p.selling_price, p.stock, p.status, p.is_featured, p.created_at
    FROM products p
    WHERE (p.status IS NULL OR LOWER(p.status) NOT IN ('inactive', 'discontinued'))
      AND (p.category_id = $1 OR p.subcategory_id = $1)
    ORDER BY 
      CASE WHEN COALESCE(p.stock, 0) > 0 THEN 0 ELSE 1 END,
      p.is_featured DESC,
      p.created_at DESC
    LIMIT 13 OFFSET 0;
  `;
  const res3 = await client.query(query3, ['fruits-vegetables']);
  res3.rows.forEach((r) => console.log('   ' + r['QUERY PLAN']));

  // Test 4: Product Variants Lookup Query
  console.log('\n📋 [TEST 4] Product Variants Lookup for 12 Products:');
  const sampleProductIds = ['p-milk-fresh-1l', 'p-butter-500g', 'p-cauliflower-1pc', 'p-atta-10kg'];
  const query4 = `
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT 
      id, product_id, variant_name, quantity_value, quantity_unit,
      selling_price, mrp, stock_quantity, is_active, is_default, display_order
    FROM product_variants
    WHERE product_id = ANY($1::varchar[])
    ORDER BY display_order ASC, created_at ASC;
  `;
  const res4 = await client.query(query4, [sampleProductIds]);
  res4.rows.forEach((r) => console.log('   ' + r['QUERY PLAN']));

  console.log('\n================================================================');
  console.log('✅ ALL EXPLAIN ANALYZE TESTS COMPLETED SUCCESSFULLY');
  console.log('================================================================\n');

  await client.end();
}

runExplainTests().catch(console.error);
