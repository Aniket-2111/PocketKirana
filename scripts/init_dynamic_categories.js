/**
 * PocketKirana — Dynamic Categories & Subcategories Database Setup & Seed
 * 
 * Ensures PostgreSQL table `categories` supports hierarchy (parent_id),
 * metadata, display order, and image URLs.
 * Seeds full realistic Indian grocery categories and subcategories.
 * 
 * Usage: node scripts/init_dynamic_categories.js
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

const SEED_CATEGORIES = [
  // 1. Fruits & Vegetables
  {
    id: 'cat-veg',
    parentId: null,
    name: 'Fruits & Vegetables',
    slug: 'fruits-vegetables',
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=200&q=80',
    description: 'Farm-fresh daily vegetables, organic produce and seasonal fruits',
    displayOrder: 1,
    isActive: true,
  },
  {
    id: 'sub-fresh-veg',
    parentId: 'cat-veg',
    name: 'Fresh Vegetables',
    slug: 'fresh-vegetables',
    image: 'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?auto=format&fit=crop&w=200&q=80',
    description: 'Potatoes, tomatoes, onions, leafy greens & daily kitchen staples',
    displayOrder: 1,
    isActive: true,
  },
  {
    id: 'sub-fresh-fruits',
    parentId: 'cat-veg',
    name: 'Fresh Fruits',
    slug: 'fresh-fruits',
    image: 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=200&q=80',
    description: 'Fresh apples, bananas, citrus, papayas and seasonal fruits',
    displayOrder: 2,
    isActive: true,
  },
  {
    id: 'sub-exotic-fruits',
    parentId: 'cat-veg',
    name: 'Exotic Fruits',
    slug: 'exotic-fruits',
    image: 'https://images.unsplash.com/photo-1528825871115-3581a5387919?auto=format&fit=crop&w=200&q=80',
    description: 'Kiwi, avocado, dragon fruit, blueberries and imported fresh fruits',
    displayOrder: 3,
    isActive: true,
  },
  {
    id: 'sub-exotic-veg',
    parentId: 'cat-veg',
    name: 'Exotic Vegetables',
    slug: 'exotic-vegetables',
    image: 'https://images.unsplash.com/photo-1584270354949-c26b0d5b4a0c?auto=format&fit=crop&w=200&q=80',
    description: 'Broccoli, lettuce, colored capsicum, zucchini and mushrooms',
    displayOrder: 4,
    isActive: true,
  },
  {
    id: 'sub-organic',
    parentId: 'cat-veg',
    name: 'Organic Produce',
    slug: 'organic-produce',
    image: 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?auto=format&fit=crop&w=200&q=80',
    description: 'Certified pesticide-free organic fresh vegetables & fruits',
    displayOrder: 5,
    isActive: true,
  },
  {
    id: 'sub-seasons-best',
    parentId: 'cat-veg',
    name: "Season's Best",
    slug: 'seasons-best',
    image: 'https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?auto=format&fit=crop&w=200&q=80',
    description: 'Peak season fresh arrivals handpicked for best sweetness & flavor',
    displayOrder: 6,
    isActive: true,
  },

  // 2. Oil & Ghee
  {
    id: 'cat-oil-ghee',
    parentId: null,
    name: 'Oil & Ghee',
    slug: 'oil-ghee',
    image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=200&q=80',
    description: 'Pure desi ghee, mustard oil, refined cooking oils & cold pressed oils',
    displayOrder: 2,
    isActive: true,
  },
  {
    id: 'sub-cooking-oil',
    parentId: 'cat-oil-ghee',
    name: 'Cooking Oil',
    slug: 'cooking-oil',
    image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=200&q=80',
    description: 'Refined sunflower, soybean, rice bran and blended cooking oils',
    displayOrder: 1,
    isActive: true,
  },
  {
    id: 'sub-ghee',
    parentId: 'cat-oil-ghee',
    name: 'Desi Ghee',
    slug: 'desi-ghee',
    image: 'https://images.unsplash.com/photo-1631451095765-2c91616fc9e6?auto=format&fit=crop&w=200&q=80',
    description: 'Pure cow ghee, buffalo ghee and A2 bilona desi ghee',
    displayOrder: 2,
    isActive: true,
  },
  {
    id: 'sub-mustard-oil',
    parentId: 'cat-oil-ghee',
    name: 'Mustard Oil',
    slug: 'mustard-oil',
    image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=200&q=80',
    description: 'Kachi ghani cold pressed pure mustard oil',
    displayOrder: 3,
    isActive: true,
  },
  {
    id: 'sub-sunflower-oil',
    parentId: 'cat-oil-ghee',
    name: 'Sunflower Oil',
    slug: 'sunflower-oil',
    image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=200&q=80',
    description: 'Light and healthy refined sunflower cooking oil',
    displayOrder: 4,
    isActive: true,
  },
  {
    id: 'sub-groundnut-oil',
    parentId: 'cat-oil-ghee',
    name: 'Groundnut Oil',
    slug: 'groundnut-oil',
    image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=200&q=80',
    description: 'Cold pressed & filtered pure groundnut peanut cooking oil',
    displayOrder: 5,
    isActive: true,
  },

  // 3. Dairy & Breakfast
  {
    id: 'cat-dairy',
    parentId: null,
    name: 'Dairy & Breakfast',
    slug: 'dairy-breakfast',
    image: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=200&q=80',
    description: 'Fresh milk, butter, paneer, curd, cheese, bread and eggs',
    displayOrder: 3,
    isActive: true,
  },
  {
    id: 'sub-milk-cream',
    parentId: 'cat-dairy',
    name: 'Milk & Cream',
    slug: 'milk-cream',
    image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=200&q=80',
    description: 'Cow milk, toned milk, full cream pouch milk & fresh dairy cream',
    displayOrder: 1,
    isActive: true,
  },
  {
    id: 'sub-butter-spreads',
    parentId: 'cat-dairy',
    name: 'Butter & Spreads',
    slug: 'butter-spreads',
    image: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=200&q=80',
    description: 'Salted butter, unsalted white butter, peanut butter and cheese spreads',
    displayOrder: 2,
    isActive: true,
  },
  {
    id: 'sub-paneer-curd',
    parentId: 'cat-dairy',
    name: 'Paneer & Curd',
    slug: 'paneer-curd',
    image: 'https://images.unsplash.com/photo-1631451095765-2c91616fc9e6?auto=format&fit=crop&w=200&q=80',
    description: 'Fresh malai paneer, thick dahi curd, lassi and Greek yogurt',
    displayOrder: 3,
    isActive: true,
  },
  {
    id: 'sub-bread-eggs',
    parentId: 'cat-dairy',
    name: 'Bread & Eggs',
    slug: 'bread-eggs',
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=200&q=80',
    description: 'Brown bread, white sandwich bread, pav, fresh farm eggs and brown eggs',
    displayOrder: 4,
    isActive: true,
  },
  {
    id: 'sub-cereal-oats',
    parentId: 'cat-dairy',
    name: 'Cereal & Oats',
    slug: 'cereal-oats',
    image: 'https://images.unsplash.com/photo-1521483451569-e33803c0330c?auto=format&fit=crop&w=200&q=80',
    description: 'Rolled oats, muesli, cornflakes and crunchy granola',
    displayOrder: 5,
    isActive: true,
  },

  // 4. Staples & Grains
  {
    id: 'cat-staples',
    parentId: null,
    name: 'Staples & Grains',
    slug: 'staples',
    image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=200&q=80',
    description: 'Atta, flours, rice, dals, pulses, spices and cooking essentials',
    displayOrder: 4,
    isActive: true,
  },
  {
    id: 'sub-atta-flours',
    parentId: 'cat-staples',
    name: 'Atta & Flours',
    slug: 'atta-flours',
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=200&q=80',
    description: 'Chakki fresh whole wheat atta, maida, besan, sooji and multigrain flours',
    displayOrder: 1,
    isActive: true,
  },
  {
    id: 'sub-rice-poha',
    parentId: 'cat-staples',
    name: 'Rice & Poha',
    slug: 'rice-poha',
    image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=200&q=80',
    description: 'Basmati rice, kolam rice, sona masoori, thick poha and murmura',
    displayOrder: 2,
    isActive: true,
  },
  {
    id: 'sub-dals-pulses',
    parentId: 'cat-staples',
    name: 'Dals & Pulses',
    slug: 'dals-pulses',
    image: 'https://images.unsplash.com/photo-1515942400420-2b98fed1f515?auto=format&fit=crop&w=200&q=80',
    description: 'Toor dal, moong dal, chana dal, urad dal, rajma and kabuli chana',
    displayOrder: 3,
    isActive: true,
  },
  {
    id: 'sub-spices-salt',
    parentId: 'cat-staples',
    name: 'Spices, Salt & Sugar',
    slug: 'spices-salt-sugar',
    image: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=200&q=80',
    description: 'Turmeric, red chilli powder, coriander powder, whole garam masala, salt & sugar',
    displayOrder: 4,
    isActive: true,
  },

  // 5. Snacks & Munchies
  {
    id: 'cat-snacks',
    parentId: null,
    name: 'Snacks & Munchies',
    slug: 'snacks-munchies',
    image: 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?auto=format&fit=crop&w=200&q=80',
    description: 'Chips, namkeen, instant noodles, chocolates, sweets and cookies',
    displayOrder: 5,
    isActive: true,
  },
  {
    id: 'sub-chips-namkeen',
    parentId: 'cat-snacks',
    name: 'Chips & Namkeen',
    slug: 'chips-namkeen',
    image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=200&q=80',
    description: 'Potato chips, bhujia, sev, mixture, roasted peanuts and kurkure',
    displayOrder: 1,
    isActive: true,
  },
  {
    id: 'sub-noodles-pasta',
    parentId: 'cat-snacks',
    name: 'Instant Noodles & Pasta',
    slug: 'instant-noodles-pasta',
    image: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=200&q=80',
    description: 'Maggi, ramen noodles, macaroni, penne pasta and pasta sauces',
    displayOrder: 2,
    isActive: true,
  },
  {
    id: 'sub-biscuits-cookies',
    parentId: 'cat-snacks',
    name: 'Biscuits & Cookies',
    slug: 'biscuits-cookies',
    image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=200&q=80',
    description: 'Glucose biscuits, cream cookies, digestive crackers and cookies',
    displayOrder: 3,
    isActive: true,
  },
  {
    id: 'sub-chocolates-sweets',
    parentId: 'cat-snacks',
    name: 'Chocolates & Sweets',
    slug: 'chocolates-sweets',
    image: 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?auto=format&fit=crop&w=200&q=80',
    description: 'Dairy Milk, KitKat, 5Star, gulab jamun, rasgulla and traditional Indian sweets',
    displayOrder: 4,
    isActive: true,
  },

  // 6. Beverages
  {
    id: 'cat-drinks',
    parentId: null,
    name: 'Beverages',
    slug: 'beverages',
    image: 'https://images.unsplash.com/photo-1527960471264-932f39eb5846?auto=format&fit=crop&w=200&q=80',
    description: 'Tea, coffee, soft drinks, juices, energy drinks and water',
    displayOrder: 6,
    isActive: true,
  },
  {
    id: 'sub-tea-coffee',
    parentId: 'cat-drinks',
    name: 'Tea & Coffee',
    slug: 'tea-coffee',
    image: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=200&q=80',
    description: 'Chai patti, green tea, instant coffee powder and filter coffee',
    displayOrder: 1,
    isActive: true,
  },
  {
    id: 'sub-soft-drinks',
    parentId: 'cat-drinks',
    name: 'Soft Drinks & Juices',
    slug: 'soft-drinks-juices',
    image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=200&q=80',
    description: 'Cola, lemon soda, mango juice, real fruit juices and coconut water',
    displayOrder: 2,
    isActive: true,
  },
  {
    id: 'sub-health-drinks',
    parentId: 'cat-drinks',
    name: 'Health & Energy Drinks',
    slug: 'health-energy-drinks',
    image: 'https://images.unsplash.com/photo-1527960471264-932f39eb5846?auto=format&fit=crop&w=200&q=80',
    description: 'Horlicks, Bournvita, Red Bull and protein health supplements',
    displayOrder: 3,
    isActive: true,
  },

  // 7. Personal Care
  {
    id: 'cat-personal',
    parentId: null,
    name: 'Personal Care',
    slug: 'personal-care',
    image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=200&q=80',
    description: 'Soaps, shampoos, hair oils, toothpastes, skincare and grooming',
    displayOrder: 7,
    isActive: true,
  },
  {
    id: 'sub-bath-soaps',
    parentId: 'cat-personal',
    name: 'Bath & Soaps',
    slug: 'bath-soaps',
    image: 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?auto=format&fit=crop&w=200&q=80',
    description: 'Bathing soaps, body wash, shower gels and hand washes',
    displayOrder: 1,
    isActive: true,
  },
  {
    id: 'sub-hair-care',
    parentId: 'cat-personal',
    name: 'Hair Care',
    slug: 'hair-care',
    image: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=200&q=80',
    description: 'Shampoos, conditioners, hair oils and styling gels',
    displayOrder: 2,
    isActive: true,
  },
  {
    id: 'sub-oral-care',
    parentId: 'cat-personal',
    name: 'Oral Care',
    slug: 'oral-care',
    image: 'https://images.unsplash.com/photo-1559599101-f09722fb4948?auto=format&fit=crop&w=200&q=80',
    description: 'Toothpaste, toothbrushes, tongue cleaners and mouthwashes',
    displayOrder: 3,
    isActive: true,
  },
  {
    id: 'sub-skincare',
    parentId: 'cat-personal',
    name: 'Skincare & Creams',
    slug: 'skincare-creams',
    image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=200&q=80',
    description: 'Face wash, body lotions, moisturizers, cold creams and sunscreens',
    displayOrder: 4,
    isActive: true,
  },

  // 8. Household
  {
    id: 'cat-household',
    parentId: null,
    name: 'Household Care',
    slug: 'household',
    image: 'https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?auto=format&fit=crop&w=200&q=80',
    description: 'Detergents, floor cleaners, dishwashing bars, insect repellents and pooja essentials',
    displayOrder: 8,
    isActive: true,
  },
  {
    id: 'sub-detergents',
    parentId: 'cat-household',
    name: 'Detergents & Fabric Care',
    slug: 'detergents-fabric-care',
    image: 'https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?auto=format&fit=crop&w=200&q=80',
    description: 'Washing powder, liquid detergents, fabric conditioners and bar soaps',
    displayOrder: 1,
    isActive: true,
  },
  {
    id: 'sub-cleaners',
    parentId: 'cat-household',
    name: 'Cleaners & Disinfectants',
    slug: 'cleaners-disinfectants',
    image: 'https://images.unsplash.com/photo-1584813470613-5b1c1cad3d69?auto=format&fit=crop&w=200&q=80',
    description: 'Floor cleaners, toilet cleaners, glass cleaners and surface sprays',
    displayOrder: 2,
    isActive: true,
  },
  {
    id: 'sub-dishwash',
    parentId: 'cat-household',
    name: 'Dishwash & Tools',
    slug: 'dishwash-tools',
    image: 'https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?auto=format&fit=crop&w=200&q=80',
    description: 'Dishwash bars, gels, scrubs, sponges and steel wool',
    displayOrder: 3,
    isActive: true,
  },

  // 9. Baby Care
  {
    id: 'cat-baby',
    parentId: null,
    name: 'Baby Care',
    slug: 'baby-care',
    image: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=200&q=80',
    description: 'Baby diapers, wipes, baby food, cereals, baby soaps and lotions',
    displayOrder: 9,
    isActive: true,
  },
  {
    id: 'sub-diapers-wipes',
    parentId: 'cat-baby',
    name: 'Diapers & Wipes',
    slug: 'diapers-wipes',
    image: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=200&q=80',
    description: 'Baby pant diapers, taped diapers, wet wipes and diaper rash cream',
    displayOrder: 1,
    isActive: true,
  },
  {
    id: 'sub-baby-food',
    parentId: 'cat-baby',
    name: 'Baby Food & Formula',
    slug: 'baby-food-formula',
    image: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=200&q=80',
    description: 'Cerelac, infant milk formula, purees and organic baby cereal',
    displayOrder: 2,
    isActive: true,
  },
  {
    id: 'sub-baby-bath',
    parentId: 'cat-baby',
    name: 'Baby Bath & Skincare',
    slug: 'baby-bath-skincare',
    image: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=200&q=80',
    description: 'Baby shampoo, body wash, massage oil and gentle baby powder',
    displayOrder: 3,
    isActive: true,
  },

  // 10. Bakery & Biscuits
  {
    id: 'cat-bakery',
    parentId: null,
    name: 'Bakery & Biscuits',
    slug: 'bakery-biscuits',
    image: 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?auto=format&fit=crop&w=200&q=80',
    description: 'Artisan breads, pav, cakes, muffins, rusk and gourmet cookies',
    displayOrder: 10,
    isActive: true,
  },
  {
    id: 'sub-breads-pav',
    parentId: 'cat-bakery',
    name: 'Breads & Pav',
    slug: 'breads-pav',
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=200&q=80',
    description: 'Sandwich white bread, brown bread, pav, burger buns and garlic bread',
    displayOrder: 1,
    isActive: true,
  },
  {
    id: 'sub-cakes-muffins',
    parentId: 'cat-bakery',
    name: 'Cakes & Muffins',
    slug: 'cakes-muffins',
    image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=200&q=80',
    description: 'Tea cakes, chocolate muffins, brownies, swiss rolls and celebration cakes',
    displayOrder: 2,
    isActive: true,
  },
  {
    id: 'sub-rusk-toast',
    parentId: 'cat-bakery',
    name: 'Rusk, Khari & Toast',
    slug: 'rusk-khari-toast',
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=200&q=80',
    description: 'Crispy suji rusk, butter khari, jeera toast and tea snacks',
    displayOrder: 3,
    isActive: true,
  },
];

async function run() {
  await client.connect();
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  POCKETKIRANA — Dynamic Category & Subcategory DB Setup');
  console.log('══════════════════════════════════════════════════════════════\n');

  // 1. Ensure Table Schema in PostgreSQL
  console.log('[1/4] Ensuring PostgreSQL categories table structure...');
  
  const alterColumns = [
    { name: 'parent_id', type: 'VARCHAR(64) REFERENCES categories(id) ON DELETE SET NULL' },
    { name: 'description', type: 'TEXT' },
    { name: 'image', type: 'TEXT' },
    { name: 'image_url', type: 'TEXT' },
    { name: 'banner_image', type: 'TEXT' },
    { name: 'display_order', type: 'INT DEFAULT 0' },
    { name: 'is_active', type: 'BOOLEAN DEFAULT TRUE' },
    { name: 'meta_title', type: 'VARCHAR(255)' },
    { name: 'meta_description', type: 'TEXT' },
    { name: 'updated_at', type: 'TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP' },
  ];

  for (const col of alterColumns) {
    try {
      await client.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
    } catch (err) {
      console.warn(`  Notice on column ${col.name}:`, err.message);
    }
  }

  try {
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory_id VARCHAR(64) REFERENCES categories(id) ON DELETE SET NULL`);
  } catch (_) {}

  console.log('  ✔ PostgreSQL categories & products tables up to date.');

  // 2. Seed / Upsert Top-Level Categories first
  console.log('\n[2/4] Upserting top-level categories...');
  const topCategories = SEED_CATEGORIES.filter(c => !c.parentId);
  for (const cat of topCategories) {
    await client.query(`
      INSERT INTO categories (id, parent_id, name, slug, description, image, image_url, display_order, is_active, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        slug = EXCLUDED.slug,
        description = EXCLUDED.description,
        image = EXCLUDED.image,
        image_url = EXCLUDED.image_url,
        display_order = EXCLUDED.display_order,
        is_active = EXCLUDED.is_active,
        updated_at = CURRENT_TIMESTAMP
    `, [
      cat.id,
      null,
      cat.name,
      cat.slug,
      cat.description,
      cat.image,
      cat.image,
      cat.displayOrder,
      cat.isActive
    ]);
  }
  console.log(`  ✔ ${topCategories.length} top-level categories upserted.`);

  // 3. Seed / Upsert Subcategories
  console.log('\n[3/4] Upserting subcategories...');
  const subCategories = SEED_CATEGORIES.filter(c => c.parentId);
  for (const sub of subCategories) {
    await client.query(`
      INSERT INTO categories (id, parent_id, name, slug, description, image, image_url, display_order, is_active, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        parent_id = EXCLUDED.parent_id,
        name = EXCLUDED.name,
        slug = EXCLUDED.slug,
        description = EXCLUDED.description,
        image = EXCLUDED.image,
        image_url = EXCLUDED.image_url,
        display_order = EXCLUDED.display_order,
        is_active = EXCLUDED.is_active,
        updated_at = CURRENT_TIMESTAMP
    `, [
      sub.id,
      sub.parentId,
      sub.name,
      sub.slug,
      sub.description,
      sub.image,
      sub.image,
      sub.displayOrder,
      sub.isActive
    ]);
  }
  console.log(`  ✔ ${subCategories.length} subcategories upserted.`);

  // 4. Verify Total Categories & Subcategories
  console.log('\n[4/4] Verifying database counts...');
  const totalRes = await client.query('SELECT COUNT(*) as count FROM categories');
  const topRes = await client.query('SELECT COUNT(*) as count FROM categories WHERE parent_id IS NULL');
  const subRes = await client.query('SELECT COUNT(*) as count FROM categories WHERE parent_id IS NOT NULL');

  console.log(`  📊 Total categories in DB : ${totalRes.rows[0].count}`);
  console.log(`  📂 Top-level categories   : ${topRes.rows[0].count}`);
  console.log(`  📑 Subcategories          : ${subRes.rows[0].count}`);

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  ✅ DYNAMIC CATEGORY & SUBCATEGORY SETUP COMPLETE');
  console.log('══════════════════════════════════════════════════════════════\n');

  await client.end();
}

run().catch((e) => {
  console.error('\n❌ Setup error:', e.message);
  process.exit(1);
});
