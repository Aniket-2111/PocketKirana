/**
 * Syncs all catalog products from Firestore & MockData into PostgreSQL 'products'
 * and populates realistic product_variants for every catalog product.
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const { Pool } = require('pg');

const firebaseConfig = {
  apiKey: 'AIzaSyBMMfUjpISU3zOEGt0mvekBb9PL9znOSGc',
  authDomain: 'pocketkirana.firebaseapp.com',
  projectId: 'pocketkirana',
  storageBucket: 'pocketkirana.firebasestorage.app',
  messagingSenderId: '370391453253',
  appId: '1:370391453253:web:271f7b7724f545dc1edd2c',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const pool = new Pool({
  host: process.env.DB_HOST || '192.168.0.102',
  port: parseInt(process.env.DB_PORT || '5433', 10),
  database: process.env.DB_NAME || 'pocketkirana_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'varbusiness',
});

function generateVariantsForProduct(product) {
  const name = (product.name || '').toLowerCase();
  const basePrice = Number(product.sellingPrice) || 50;
  const baseMrp = Number(product.mrp) || Math.round(basePrice * 1.15);

  if (
    name.includes('apple') ||
    name.includes('banana') ||
    name.includes('potato') ||
    name.includes('onion') ||
    name.includes('tomato') ||
    name.includes('brinjal') ||
    name.includes('carrot') ||
    name.includes('capsicum') ||
    name.includes('cucumber')
  ) {
    return [
      { name: '500 g', value: 500, unit: 'g', priceRatio: 0.55, mrpRatio: 0.55, stock: 25, isDefault: false },
      { name: '1 kg', value: 1, unit: 'kg', priceRatio: 1.0, mrpRatio: 1.0, stock: 40, isDefault: true },
      { name: '2 kg', value: 2, unit: 'kg', priceRatio: 1.9, mrpRatio: 1.9, stock: 15, isDefault: false },
    ];
  } else if (name.includes('milk') || name.includes('oil') || name.includes('juice')) {
    return [
      { name: '250 ml', value: 250, unit: 'ml', priceRatio: 0.35, mrpRatio: 0.35, stock: 20, isDefault: false },
      { name: '500 ml', value: 500, unit: 'ml', priceRatio: 0.55, mrpRatio: 0.55, stock: 35, isDefault: false },
      { name: '1 L', value: 1, unit: 'L', priceRatio: 1.0, mrpRatio: 1.0, stock: 50, isDefault: true },
    ];
  } else if (
    name.includes('atta') ||
    name.includes('rice') ||
    name.includes('flour') ||
    name.includes('sugar') ||
    name.includes('salt')
  ) {
    return [
      { name: '1 kg', value: 1, unit: 'kg', priceRatio: 0.25, mrpRatio: 0.25, stock: 30, isDefault: false },
      { name: '5 kg', value: 5, unit: 'kg', priceRatio: 1.0, mrpRatio: 1.0, stock: 45, isDefault: true },
      { name: '10 kg', value: 10, unit: 'kg', priceRatio: 1.9, mrpRatio: 1.9, stock: 10, isDefault: false },
    ];
  } else if (
    name.includes('lay') ||
    name.includes('chip') ||
    name.includes('biscuit') ||
    name.includes('bread') ||
    name.includes('snack')
  ) {
    return [
      { name: '50 g', value: 50, unit: 'g', priceRatio: 0.5, mrpRatio: 0.5, stock: 50, isDefault: false },
      { name: '100 g', value: 100, unit: 'g', priceRatio: 1.0, mrpRatio: 1.0, stock: 40, isDefault: true },
      { name: '200 g', value: 200, unit: 'g', priceRatio: 1.85, mrpRatio: 1.85, stock: 20, isDefault: false },
    ];
  } else {
    return [
      { name: '1 pc', value: 1, unit: 'piece', priceRatio: 1.0, mrpRatio: 1.0, stock: 30, isDefault: true },
      { name: 'Pack of 2', value: 2, unit: 'pack', priceRatio: 1.9, mrpRatio: 1.9, stock: 15, isDefault: false },
    ];
  }
}

async function syncProductsAndVariants() {
  console.log('Fetching valid categories from PostgreSQL...');
  const catRes = await pool.query('SELECT id FROM categories');
  const validCatIds = new Set(catRes.rows.map((r) => r.id));

  console.log('Fetching all products from Firestore...');
  const snap = await getDocs(collection(db, 'products'));
  console.log(`Found ${snap.size} products in Firestore.`);

  let insertedProds = 0;
  let insertedVariants = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const id = doc.id;
    const name = data.name || 'Unnamed Product';
    const slug = data.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const sku = data.sku || `PK-${id.toUpperCase().slice(-6)}`;
    const barcode = data.barcode || null;
    const unit = data.unit || '1 unit';
    const mrp = Number(data.mrp) || Number(data.sellingPrice) || 50;
    const sellingPrice = Number(data.sellingPrice) || mrp;
    
    // Validate categoryId against foreign key
    let categoryId = data.categoryId;
    if (!validCatIds.has(categoryId)) {
      if (categoryId === 'cat-oil') categoryId = 'cat-oil-ghee';
      else if (categoryId === 'cat-dairy-breakfast') categoryId = 'cat-dairy';
      else if (categoryId === 'cat-fruits-vegetables') categoryId = 'cat-veg';
      else categoryId = validCatIds.has('cat-veg') ? 'cat-veg' : Array.from(validCatIds)[0];
    }

    let subcategoryId = data.subcategoryId;
    if (subcategoryId && !validCatIds.has(subcategoryId)) {
      subcategoryId = null;
    }

    const thumbnail = data.thumbnail || data.thumbnail_url || null;
    const description = data.description || '';

    // 1. Upsert product into PostgreSQL
    const upsertProductQuery = `
      INSERT INTO products (
        id, category_id, subcategory_id, name, slug, sku, barcode, description,
        unit, mrp, selling_price, stock, status, lifecycle_status, thumbnail_url,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 100, 'active', 'ACTIVE', $12, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        slug = EXCLUDED.slug,
        mrp = EXCLUDED.mrp,
        selling_price = EXCLUDED.selling_price,
        thumbnail_url = COALESCE(EXCLUDED.thumbnail_url, products.thumbnail_url),
        updated_at = NOW();
    `;

    await pool.query(upsertProductQuery, [
      id,
      categoryId,
      subcategoryId,
      name,
      slug,
      sku,
      barcode,
      description,
      unit,
      mrp,
      sellingPrice,
      thumbnail,
    ]);
    insertedProds++;

    // 2. Check if product already has variants in PostgreSQL
    const existingVariantsRes = await pool.query(
      'SELECT id FROM product_variants WHERE product_id = $1',
      [id]
    );

    if (existingVariantsRes.rows.length === 0) {
      // Seed default variants for this product
      const variantSpecs = generateVariantsForProduct({ ...data, name, mrp, sellingPrice });
      let order = 1;

      for (const spec of variantSpecs) {
        const vPrice = Math.max(1, Math.round(sellingPrice * spec.priceRatio));
        const vMrp = Math.max(vPrice, Math.round(mrp * spec.mrpRatio));
        const vDiscount = vMrp > vPrice ? Math.round(((vMrp - vPrice) / vMrp) * 100) : 0;
        const vId = `var_${id}_${spec.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        const vSku = `SKU-${id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}-${spec.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}-${order}`;

        const insertVariantQuery = `
          INSERT INTO product_variants (
            id, product_id, variant_name, quantity_value, quantity_unit,
            selling_price, mrp, discount_percentage, stock_quantity,
            low_stock_threshold, sku, is_active, is_default, display_order,
            pk_display_code, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, $12, $13, $14, NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET
            selling_price = EXCLUDED.selling_price,
            mrp = EXCLUDED.mrp,
            is_default = EXCLUDED.is_default,
            updated_at = NOW();
        `;

        await pool.query(insertVariantQuery, [
          vId,
          id,
          spec.name,
          spec.value,
          spec.unit,
          vPrice,
          vMrp,
          vDiscount,
          spec.stock,
          5,
          vSku,
          spec.isDefault,
          order,
          `PK-V${order}`,
        ]);
        insertedVariants++;
        order++;
      }
    }
  }

  console.log(`\n✅ Successfully synchronized ${insertedProds} products and seeded ${insertedVariants} variants in PostgreSQL!`);
  await pool.end();
  process.exit(0);
}

syncProductsAndVariants().catch((err) => {
  console.error('Sync failed:', err);
  pool.end();
  process.exit(1);
});
