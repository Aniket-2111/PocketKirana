/**
 * PocketKirana — Dynamic Product Variants Database Setup & Seed
 */

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

async function initVariants() {
  console.log('\n[Init] Connecting to PostgreSQL at', process.env.DB_HOST || '192.168.0.102', '...');
  await client.connect();

  try {
    // 1. Create table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_variants (
        id VARCHAR(100) PRIMARY KEY,
        product_id VARCHAR(100) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        variant_name VARCHAR(150) NOT NULL,
        quantity_value NUMERIC(10, 3),
        quantity_unit VARCHAR(50) NOT NULL DEFAULT 'kg',
        selling_price NUMERIC(10, 2) NOT NULL,
        mrp NUMERIC(10, 2) NOT NULL,
        cost_price NUMERIC(10, 2),
        discount_percentage NUMERIC(5, 2) DEFAULT 0,
        tax_percentage NUMERIC(5, 2) DEFAULT 0,
        stock_quantity INTEGER NOT NULL DEFAULT 20,
        low_stock_threshold INTEGER NOT NULL DEFAULT 5,
        sku VARCHAR(100),
        barcode VARCHAR(100),
        is_active BOOLEAN NOT NULL DEFAULT true,
        is_default BOOLEAN NOT NULL DEFAULT false,
        display_order INTEGER NOT NULL DEFAULT 1,
        pk_display_code VARCHAR(50),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Add columns if missing
    const columnsToAdd = [
      { name: 'quantity_value', type: 'NUMERIC(10, 3)' },
      { name: 'quantity_unit', type: "VARCHAR(50) NOT NULL DEFAULT 'kg'" },
      { name: 'stock_quantity', type: 'INTEGER NOT NULL DEFAULT 20' },
      { name: 'low_stock_threshold', type: 'INTEGER NOT NULL DEFAULT 5' },
      { name: 'is_default', type: 'BOOLEAN NOT NULL DEFAULT false' },
      { name: 'display_order', type: 'INTEGER NOT NULL DEFAULT 1' },
      { name: 'pk_display_code', type: 'VARCHAR(50)' },
    ];

    for (const col of columnsToAdd) {
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'product_variants' AND column_name = '${col.name}'
          ) THEN
            ALTER TABLE product_variants ADD COLUMN ${col.name} ${col.type};
          END IF;
        END $$;
      `);
    }

    // 3. Create indices
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
      CREATE INDEX IF NOT EXISTS idx_product_variants_display_order ON product_variants(product_id, display_order);
      CREATE INDEX IF NOT EXISTS idx_product_variants_is_active ON product_variants(is_active);
    `);

    console.log('✔ PostgreSQL product_variants table structure verified.');

    // 4. Fetch all existing products from database
    const prodRes = await client.query('SELECT id, name, slug, selling_price, mrp, unit FROM products');
    console.log(`Found ${prodRes.rows.length} products in database.`);

    // 5. Populate realistic variants
    for (const prod of prodRes.rows) {
      const basePrice = Number(prod.selling_price) || 50;
      const baseMrp = Number(prod.mrp) || Math.round(basePrice * 1.15);
      const pName = (prod.name || '').toLowerCase();

      let variantsToCreate = [];

      if (pName.includes('banana') || pName.includes('apple') || pName.includes('lemon') || pName.includes('egg')) {
        variantsToCreate = [
          { name: '1 piece', value: 1, unit: 'piece', price: Math.round(basePrice * 0.18), mrp: Math.round(baseMrp * 0.18), stock: 30, isDefault: false, order: 1 },
          { name: '6 pieces', value: 6, unit: 'piece', price: Math.round(basePrice * 0.95), mrp: Math.round(baseMrp * 0.95), stock: 25, isDefault: true, order: 2 },
          { name: '12 pieces (1 Dozen)', value: 12, unit: 'piece', price: Math.round(basePrice * 1.8), mrp: Math.round(baseMrp * 1.8), stock: 15, isDefault: false, order: 3 },
        ];
      } else if (pName.includes('milk') || pName.includes('oil') || pName.includes('ghee') || pName.includes('juice') || pName.includes('coke') || pName.includes('drink')) {
        variantsToCreate = [
          { name: '250 ml', value: 250, unit: 'ml', price: Math.round(basePrice * 0.55), mrp: Math.round(baseMrp * 0.55), stock: 20, isDefault: false, order: 1 },
          { name: '500 ml', value: 500, unit: 'ml', price: basePrice, mrp: baseMrp, stock: 35, isDefault: true, order: 2 },
          { name: '1 L', value: 1, unit: 'L', price: Math.round(basePrice * 1.9), mrp: Math.round(baseMrp * 1.9), stock: 18, isDefault: false, order: 3 },
        ];
      } else if (pName.includes('atta') || pName.includes('rice') || pName.includes('dal') || pName.includes('flour')) {
        variantsToCreate = [
          { name: '1 kg', value: 1, unit: 'kg', price: basePrice, mrp: baseMrp, stock: 25, isDefault: true, order: 1 },
          { name: '2 kg', value: 2, unit: 'kg', price: Math.round(basePrice * 1.95), mrp: Math.round(baseMrp * 1.95), stock: 15, isDefault: false, order: 2 },
          { name: '5 kg', value: 5, unit: 'kg', price: Math.round(basePrice * 4.7), mrp: Math.round(baseMrp * 4.7), stock: 8, isDefault: false, order: 3 },
        ];
      } else if (pName.includes('chip') || pName.includes('lay') || pName.includes('kurkure') || pName.includes('biscuit') || pName.includes('namkeen')) {
        variantsToCreate = [
          { name: '50 g', value: 50, unit: 'g', price: 10, mrp: 10, stock: 40, isDefault: false, order: 1 },
          { name: '100 g', value: 100, unit: 'g', price: 20, mrp: 20, stock: 30, isDefault: true, order: 2 },
          { name: '200 g', value: 200, unit: 'g', price: 38, mrp: 40, stock: 15, isDefault: false, order: 3 },
        ];
      } else {
        variantsToCreate = [
          { name: '250 g', value: 250, unit: 'g', price: Math.round(basePrice * 0.55), mrp: Math.round(baseMrp * 0.55), stock: 25, isDefault: false, order: 1 },
          { name: '500 g', value: 500, unit: 'g', price: basePrice, mrp: baseMrp, stock: 20, isDefault: true, order: 2 },
          { name: '1 kg', value: 1, unit: 'kg', price: Math.round(basePrice * 1.9), mrp: Math.round(baseMrp * 1.9), stock: 12, isDefault: false, order: 3 },
        ];
      }

      for (const v of variantsToCreate) {
        const varId = `var_${prod.id}_${v.value}${v.unit}`;
        const cleanProdId = prod.id.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase();
        const sku = `SKU-${cleanProdId}-${v.value}${v.unit}`.toUpperCase();
        const discount = v.mrp > v.price ? Math.round(((v.mrp - v.price) / v.mrp) * 100) : 0;

        await client.query(`
          INSERT INTO product_variants (
            id, product_id, variant_name, quantity_value, quantity_unit,
            selling_price, mrp, discount_percentage, stock_quantity, low_stock_threshold,
            sku, is_active, is_default, display_order, pk_display_code, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET
            variant_name = EXCLUDED.variant_name,
            quantity_value = EXCLUDED.quantity_value,
            quantity_unit = EXCLUDED.quantity_unit,
            selling_price = EXCLUDED.selling_price,
            mrp = EXCLUDED.mrp,
            discount_percentage = EXCLUDED.discount_percentage,
            stock_quantity = EXCLUDED.stock_quantity,
            is_default = EXCLUDED.is_default,
            display_order = EXCLUDED.display_order,
            updated_at = NOW()
        `, [
          varId,
          prod.id,
          v.name,
          v.value,
          v.unit,
          v.price,
          v.mrp,
          discount,
          v.stock,
          5,
          sku,
          true,
          v.isDefault,
          v.order,
          `PK-V${v.order}`
        ]);
      }
    }

    const totalVariants = await client.query('SELECT COUNT(*) as count FROM product_variants');
    console.log(`\n🎉 Success! Total product variants in database: ${totalVariants.rows[0].count}`);

  } catch (err) {
    console.error('Error setting up product variants:', err);
    throw err;
  } finally {
    await client.end();
  }
}

initVariants().catch((e) => {
  console.error(e);
  process.exit(1);
});
