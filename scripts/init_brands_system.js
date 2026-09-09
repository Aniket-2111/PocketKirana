/**
 * Database Migration and Seed Script for Dynamic Brand Management System
 * 
 * 1. Enhances 'brands' table in PostgreSQL.
 * 2. Creates 'brand_categories' and 'brand_subcategories' junction tables.
 * 3. Seeds realistic grocery brands with logos, banners, and category mappings.
 * 4. Updates all catalog products with their matching brand_id.
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || '192.168.0.102',
  port: parseInt(process.env.DB_PORT || '5433', 10),
  database: process.env.DB_NAME || 'pocketkirana_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'varbusiness',
});

const INITIAL_BRANDS = [
  {
    id: 'brand-fortune',
    name: 'Fortune',
    slug: 'fortune',
    description: 'Fortune provides high quality cooking oils, basmati rice, chakki fresh atta, and kitchen essentials for healthy Indian homes.',
    logoUrl: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=200&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80',
    displayOrder: 1,
    categories: ['cat-oil-ghee', 'cat-staples'],
    subcategories: ['sub-cooking-oil', 'sub-sunflower-oil', 'sub-mustard-oil', 'sub-rice-poha', 'sub-atta-flours'],
  },
  {
    id: 'brand-amul',
    name: 'Amul',
    slug: 'amul',
    description: 'Amul - The Taste of India. Fresh pasteurized milk, butter, cheese, ghee, paneer, and delightful dairy essentials.',
    logoUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=200&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1527153857715-3908f2ae5e81?auto=format&fit=crop&w=1200&q=80',
    displayOrder: 2,
    categories: ['cat-dairy', 'cat-bakery', 'cat-oil-ghee'],
    subcategories: ['sub-milk-cream', 'sub-butter-spreads', 'sub-paneer-curd', 'sub-ghee'],
  },
  {
    id: 'brand-aashirvaad',
    name: 'Aashirvaad',
    slug: 'aashirvaad',
    description: 'Aashirvaad by ITC delivers 100% pure whole wheat chakki atta, organic grains, and authentic Indian spices with love.',
    logoUrl: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=200&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1200&q=80',
    displayOrder: 3,
    categories: ['cat-staples'],
    subcategories: ['sub-atta-flours', 'sub-dals-pulses', 'sub-spices-salt'],
  },
  {
    id: 'brand-lays',
    name: "Lay's",
    slug: 'lays',
    description: "Crispy, flavorful, farm-grown potato chips made with authentic spices. Lay's brings smiles to every celebration.",
    logoUrl: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=200&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=1200&q=80',
    displayOrder: 4,
    categories: ['cat-snacks'],
    subcategories: ['sub-chips-namkeen'],
  },
  {
    id: 'brand-britannia',
    name: 'Britannia',
    slug: 'britannia',
    description: 'Britannia brings you delicious biscuits, fresh bread, butter, cheese slices, and cakes baked to golden perfection.',
    logoUrl: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=200&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1200&q=80',
    displayOrder: 5,
    categories: ['cat-bakery', 'cat-dairy', 'cat-snacks'],
    subcategories: ['sub-breads-pav', 'sub-bread-eggs', 'sub-biscuits-cookies', 'sub-cakes-muffins'],
  },
  {
    id: 'brand-mother-dairy',
    name: 'Mother Dairy',
    slug: 'mother-dairy',
    description: 'Pure, fresh cow & toned milk, curd, fruit drinks, and ice creams loved by millions of households daily.',
    logoUrl: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=200&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1527153857715-3908f2ae5e81?auto=format&fit=crop&w=1200&q=80',
    displayOrder: 6,
    categories: ['cat-dairy', 'cat-drinks'],
    subcategories: ['sub-milk-cream', 'sub-paneer-curd', 'sub-soft-drinks'],
  },
  {
    id: 'brand-tata',
    name: 'Tata',
    slug: 'tata',
    description: 'Tata Sampann & Tata Salt - unpolished pulses, vacuum evaporated iodized salt, premium tea and spices for healthy living.',
    logoUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=200&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=1200&q=80',
    displayOrder: 7,
    categories: ['cat-staples', 'cat-drinks'],
    subcategories: ['sub-spices-salt', 'sub-dals-pulses', 'sub-tea-coffee'],
  },
  {
    id: 'brand-saffola',
    name: 'Saffola',
    slug: 'saffola',
    description: 'Saffola Gold blended edible oils and 100% natural rolled oats specially formulated for active hearts and fitness.',
    logoUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=200&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1490818387583-1baba5e638af?auto=format&fit=crop&w=1200&q=80',
    displayOrder: 8,
    categories: ['cat-oil-ghee', 'cat-staples'],
    subcategories: ['sub-cooking-oil', 'sub-cereal-oats'],
  },
  {
    id: 'brand-dettol',
    name: 'Dettol',
    slug: 'dettol',
    description: 'Dettol antiseptic liquid, germ protection bathing soaps, handwashes, and multi-surface hygiene essentials.',
    logoUrl: 'https://images.unsplash.com/photo-1608248597359-593b4a2c534c?auto=format&fit=crop&w=200&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=1200&q=80',
    displayOrder: 9,
    categories: ['cat-personal', 'cat-household'],
    subcategories: ['sub-bath-soaps', 'sub-cleaners'],
  },
  {
    id: 'brand-surf-excel',
    name: 'Surf Excel',
    slug: 'surf-excel',
    description: 'Surf Excel Matic top load, front load liquids and detergent powders offering tough stain removal with gentle fabric care.',
    logoUrl: 'https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=200&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?auto=format&fit=crop&w=1200&q=80',
    displayOrder: 10,
    categories: ['cat-household'],
    subcategories: ['sub-detergents'],
  },
  {
    id: 'brand-patanjali',
    name: 'Patanjali',
    slug: 'patanjali',
    description: 'Patanjali Ayurved pure cow ghee, organic honey, herbal dental care, whole spices, and Ayurvedic wellness essentials.',
    logoUrl: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=200&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1200&q=80',
    displayOrder: 11,
    categories: ['cat-oil-ghee', 'cat-staples', 'cat-personal'],
    subcategories: ['sub-ghee', 'sub-spices-salt', 'sub-oral-care'],
  },
  {
    id: 'brand-real',
    name: 'Real',
    slug: 'real',
    description: 'Real Fruit Power 100% pure juices, mixed fruit nectars, and refreshing summer beverages packed with natural vitamins.',
    logoUrl: 'https://images.unsplash.com/photo-1622597467836-f3285f2131b7?auto=format&fit=crop&w=200&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?auto=format&fit=crop&w=1200&q=80',
    displayOrder: 12,
    categories: ['cat-drinks'],
    subcategories: ['sub-soft-drinks'],
  },
  {
    id: 'brand-farm-fresh',
    name: 'Farm Fresh Organic',
    slug: 'farm-fresh-organic',
    description: 'Directly sourced organic fresh fruits, leafy vegetables, handpicked farm produce delivered crisp within 24 hours.',
    logoUrl: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=200&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1200&q=80',
    displayOrder: 13,
    categories: ['cat-veg'],
    subcategories: ['sub-fresh-veg', 'sub-fresh-fruits', 'sub-organic'],
  },
];

async function initBrandsSystem() {
  console.log('--- Step 1: Upgrading brands table in PostgreSQL ---');
  
  await pool.query(`
    CREATE TABLE IF NOT EXISTS brands (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL UNIQUE,
      description TEXT,
      logo_url TEXT,
      banner_url TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      display_order INTEGER DEFAULT 0,
      seo_title VARCHAR(255),
      seo_description TEXT,
      seo_keywords VARCHAR(255),
      meta_image TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Alter table columns if they don't exist
  const columnChecks = [
    { col: 'logo_url', type: 'TEXT' },
    { col: 'banner_url', type: 'TEXT' },
    { col: 'display_order', type: 'INTEGER DEFAULT 0' },
    { col: 'seo_title', type: 'VARCHAR(255)' },
    { col: 'seo_description', type: 'TEXT' },
    { col: 'seo_keywords', type: 'VARCHAR(255)' },
    { col: 'meta_image', type: 'TEXT' },
  ];

  for (const { col, type } of columnChecks) {
    try {
      await pool.query(`ALTER TABLE brands ADD COLUMN IF NOT EXISTS ${col} ${type};`);
    } catch (_) {}
  }

  console.log('--- Step 2: Creating brand_categories and brand_subcategories junction tables ---');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS brand_categories (
      id VARCHAR(255) PRIMARY KEY,
      brand_id VARCHAR(255) NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
      category_id VARCHAR(255) NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(brand_id, category_id)
    );

    CREATE TABLE IF NOT EXISTS brand_subcategories (
      id VARCHAR(255) PRIMARY KEY,
      brand_id VARCHAR(255) NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
      subcategory_id VARCHAR(255) NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(brand_id, subcategory_id)
    );

    CREATE INDEX IF NOT EXISTS idx_brand_categories_brand ON brand_categories(brand_id);
    CREATE INDEX IF NOT EXISTS idx_brand_categories_cat ON brand_categories(category_id);
    CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products(brand_id);
  `);

  console.log('--- Step 3: Seeding Brands & Junction Mappings ---');
  // Query valid categories
  const catRes = await pool.query('SELECT id FROM categories');
  const validCatIds = new Set(catRes.rows.map((r) => r.id));

  for (const brand of INITIAL_BRANDS) {
    // 1. Upsert brand
    const upsertBrandQuery = `
      INSERT INTO brands (
        id, name, slug, description, logo_url, banner_url, is_active,
        display_order, seo_title, seo_description, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, $9, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        slug = EXCLUDED.slug,
        description = EXCLUDED.description,
        logo_url = EXCLUDED.logo_url,
        banner_url = EXCLUDED.banner_url,
        display_order = EXCLUDED.display_order,
        updated_at = NOW();
    `;

    await pool.query(upsertBrandQuery, [
      brand.id,
      brand.name,
      brand.slug,
      brand.description,
      brand.logoUrl,
      brand.bannerUrl,
      brand.displayOrder,
      `${brand.name} Products Online | PocketKirana`,
      `Buy authentic ${brand.name} products with fastest 15-minute delivery at best prices on PocketKirana.`,
    ]);

    // 2. Insert brand category mappings
    for (const catId of brand.categories || []) {
      if (validCatIds.has(catId)) {
        const jId = `bc_${brand.id}_${catId}`;
        await pool.query(
          `INSERT INTO brand_categories (id, brand_id, category_id, created_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (brand_id, category_id) DO NOTHING;`,
          [jId, brand.id, catId]
        );
      }
    }

    // 3. Insert brand subcategory mappings
    for (const subId of brand.subcategories || []) {
      if (validCatIds.has(subId)) {
        const jId = `bsc_${brand.id}_${subId}`;
        await pool.query(
          `INSERT INTO brand_subcategories (id, brand_id, subcategory_id, created_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (brand_id, subcategory_id) DO NOTHING;`,
          [jId, brand.id, subId]
        );
      }
    }
  }

  console.log(`✅ Seeded ${INITIAL_BRANDS.length} brands in PostgreSQL with category mappings.`);

  console.log('--- Step 4: Linking Catalog Products to Brands ---');
  // Match products to brands based on product name/slug
  const brandMappings = [
    { brandId: 'brand-fortune', match: ['fortune', 'oil'] },
    { brandId: 'brand-amul', match: ['amul', 'butter', 'taaza', 'gold'] },
    { brandId: 'brand-aashirvaad', match: ['aashirvaad', 'atta'] },
    { brandId: 'brand-lays', match: ['lay', 'chips'] },
    { brandId: 'brand-britannia', match: ['britannia', 'bread', 'rusk'] },
    { brandId: 'brand-mother-dairy', match: ['mother dairy'] },
    { brandId: 'brand-tata', match: ['tata', 'salt'] },
    { brandId: 'brand-saffola', match: ['saffola', 'oats'] },
    { brandId: 'brand-dettol', match: ['dettol', 'soap'] },
    { brandId: 'brand-surf-excel', match: ['surf excel', 'surf'] },
    { brandId: 'brand-patanjali', match: ['patanjali', 'honey'] },
    { brandId: 'brand-real', match: ['real', 'juice'] },
    { brandId: 'brand-farm-fresh', match: ['apple', 'banana', 'beans', 'brinjal', 'capsicum', 'carrot', 'cauliflower', 'cucumber', 'onion', 'potato', 'spinach', 'tomato', 'mushroom', 'chiaseeds', 'greentea', 'peanutbutter'] },
  ];

  const prodRes = await pool.query('SELECT id, name, slug FROM products');
  let mappedCount = 0;

  for (const prod of prodRes.rows) {
    const text = `${prod.name} ${prod.slug}`.toLowerCase();
    let matchedBrandId = null;

    for (const mapping of brandMappings) {
      if (mapping.match.some((keyword) => text.includes(keyword))) {
        matchedBrandId = mapping.brandId;
        break;
      }
    }

    if (!matchedBrandId) {
      matchedBrandId = 'brand-farm-fresh';
    }

    await pool.query('UPDATE products SET brand_id = $1 WHERE id = $2', [matchedBrandId, prod.id]);
    mappedCount++;
  }

  console.log(`✅ Linked ${mappedCount} products to brands in PostgreSQL.`);

  await pool.end();
  process.exit(0);
}

initBrandsSystem().catch((err) => {
  console.error('Migration failed:', err);
  pool.end();
  process.exit(1);
});
