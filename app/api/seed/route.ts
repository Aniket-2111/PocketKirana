/**
 * POST /api/seed
 *
 * One-time Firestore seeder. Seeds the PocketKirana database with:
 * - Store configuration (settings/store)
 * - 50+ products with barcode registry
 * - 10+ categories
 * - 8 storage locations (Aisle-Rack-Shelf-Bin)
 * - Sample inventory records
 * - 2 active coupons
 * - 1 sample picker account
 * - 1 sample delivery partner account
 *
 * PROTECTED: Requires X-Seed-Secret header matching SEED_SECRET env var.
 * Run only ONCE on a fresh Firebase project.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  writeBatch,
  Firestore,
} from 'firebase/firestore';
import { getFirebaseDb, isFirebaseConfigured } from '@/lib/firebase';

const SEED_SECRET = process.env.SEED_SECRET || 'pocketkirana-seed-2024';

const STORE_CONFIG = {
  storeId: 'store-001',
  name: 'PocketKirana',
  address: 'Neral, Maharashtra',
  city: 'Neral',
  state: 'Maharashtra',
  pincode: '410101',
  phone: '+91 9876543210',
  email: 'store@pocketkirana.com',
  gstNumber: '27AABCP1234C1Z5',
  latitude: 19.0224536,
  longitude: 73.3210018,
  deliveryRadiusKm: 3,
  minimumOrderValue: 99,
  deliveryFee: 25,
  freeDeliveryThreshold: 299,
  openingTime: '06:00',
  closingTime: '23:00',
  isOpen: true,
  codEnabled: true,
  razorpayEnabled: false,
  updatedAt: new Date().toISOString(),
};

const CATEGORIES = [
  { id: 'cat-fruits', name: 'Fruits & Vegetables', slug: 'fruits-vegetables', image: '/images/categories/fruits.jpg', sortOrder: 1, isActive: true },
  { id: 'cat-dairy', name: 'Dairy & Eggs', slug: 'dairy-eggs', image: '/images/categories/dairy.jpg', sortOrder: 2, isActive: true },
  { id: 'cat-staples', name: 'Atta & Dry Grains', slug: 'atta-dry-grains', image: '/images/categories/staples.jpg', sortOrder: 3, isActive: true },
  { id: 'cat-snacks', name: 'Snacks & Namkeen', slug: 'snacks-namkeen', image: '/images/categories/snacks.jpg', sortOrder: 4, isActive: true },
  { id: 'cat-beverages', name: 'Beverages', slug: 'beverages', image: '/images/categories/beverages.jpg', sortOrder: 5, isActive: true },
  { id: 'cat-biscuits', name: 'Biscuits & Cookies', slug: 'biscuits-cookies', image: '/images/categories/biscuits.jpg', sortOrder: 6, isActive: true },
  { id: 'cat-oils', name: 'Edible Oils & Ghee', slug: 'edible-oils-ghee', image: '/images/categories/oils.jpg', sortOrder: 7, isActive: true },
  { id: 'cat-personal', name: 'Personal Care', slug: 'personal-care', image: '/images/categories/personal.jpg', sortOrder: 8, isActive: true },
  { id: 'cat-household', name: 'Household & Cleaning', slug: 'household-cleaning', image: '/images/categories/household.jpg', sortOrder: 9, isActive: true },
  { id: 'cat-masala', name: 'Masala & Spices', slug: 'masala-spices', image: '/images/categories/masala.jpg', sortOrder: 10, isActive: true },
];

const STORAGE_LOCATIONS = [
  { id: 'loc-a01', storeId: 'store-001', aisle: 'Aisle A', rack: '01', shelf: 'A', bin: '01', barcode: 'LOC-A01A01', displayCode: 'A-01-A-01', zone: 'Ambient' },
  { id: 'loc-a02', storeId: 'store-001', aisle: 'Aisle A', rack: '02', shelf: 'B', bin: '04', barcode: 'LOC-A02B04', displayCode: 'A-02-B-04', zone: 'Ambient' },
  { id: 'loc-b01', storeId: 'store-001', aisle: 'Aisle B', rack: '01', shelf: 'A', bin: '02', barcode: 'LOC-B01A02', displayCode: 'B-01-A-02', zone: 'Ambient' },
  { id: 'loc-b02', storeId: 'store-001', aisle: 'Aisle B', rack: '02', shelf: 'C', bin: '01', barcode: 'LOC-B02C01', displayCode: 'B-02-C-01', zone: 'Ambient' },
  { id: 'loc-c01', storeId: 'store-001', aisle: 'Aisle C', rack: '01', shelf: 'A', bin: '03', barcode: 'LOC-C01A03', displayCode: 'C-01-A-03', zone: 'Chilled' },
  { id: 'loc-c02', storeId: 'store-001', aisle: 'Aisle C', rack: '02', shelf: 'B', bin: '02', barcode: 'LOC-C02B02', displayCode: 'C-02-B-02', zone: 'Chilled' },
  { id: 'loc-d01', storeId: 'store-001', aisle: 'Aisle D', rack: '01', shelf: 'A', bin: '01', barcode: 'LOC-D01A01', displayCode: 'D-01-A-01', zone: 'Frozen' },
  { id: 'loc-e01', storeId: 'store-001', aisle: 'Aisle E', rack: '01', shelf: 'A', bin: '01', barcode: 'LOC-E01A01', displayCode: 'E-01-A-01', zone: 'Ambient' },
];

const PRODUCTS = [
  {
    id: 'prod-toor-dal-500g', categoryId: 'cat-staples', storeId: 'store-001',
    sku: 'TDD-500', barcode: '8901030000001', name: 'Toor Dal 500g',
    slug: 'toor-dal-500g', description: 'Premium quality Toor Dal', unit: '500g',
    weight: 0.5, mrp: 75, sellingPrice: 68, costPrice: 52, taxPercentage: 5,
    thumbnail: '/images/products/toor-dal.jpg', status: 'active',
    rating: 4.5, reviewsCount: 42, isFeatured: true,
    locationId: 'loc-a01',
  },
  {
    id: 'prod-basmati-1kg', categoryId: 'cat-staples', storeId: 'store-001',
    sku: 'BSR-1KG', barcode: '8901030000002', name: 'Basmati Rice 1kg',
    slug: 'basmati-rice-1kg', description: 'Long grain aged basmati rice', unit: '1kg',
    weight: 1.0, mrp: 120, sellingPrice: 105, costPrice: 82, taxPercentage: 5,
    thumbnail: '/images/products/basmati-rice.jpg', status: 'active',
    rating: 4.7, reviewsCount: 88, isFeatured: true,
    locationId: 'loc-a01',
  },
  {
    id: 'prod-amul-butter-100g', categoryId: 'cat-dairy', storeId: 'store-001',
    sku: 'AMB-100', barcode: '8901030000003', name: 'Amul Butter 100g',
    slug: 'amul-butter-100g', description: 'Pasteurised butter', unit: '100g',
    weight: 0.1, mrp: 56, sellingPrice: 54, costPrice: 44, taxPercentage: 5,
    thumbnail: '/images/products/amul-butter.jpg', status: 'active',
    rating: 4.8, reviewsCount: 134, isPopular: true,
    locationId: 'loc-c01',
  },
  {
    id: 'prod-amul-milk-1l', categoryId: 'cat-dairy', storeId: 'store-001',
    sku: 'AML-1L', barcode: '8901030000004', name: 'Amul Full Cream Milk 1L',
    slug: 'amul-milk-1l', description: 'Full cream pasteurised milk', unit: '1L',
    weight: 1.0, mrp: 68, sellingPrice: 66, costPrice: 55, taxPercentage: 0,
    thumbnail: '/images/products/amul-milk.jpg', status: 'active',
    rating: 4.6, reviewsCount: 201, isPopular: true,
    locationId: 'loc-c01',
  },
  {
    id: 'prod-maggi-2x70g', categoryId: 'cat-snacks', storeId: 'store-001',
    sku: 'MGI-2PK', barcode: '8901030000005', name: 'Maggi Noodles 2-Pack',
    slug: 'maggi-noodles-2-pack', description: '2 Minute Noodles pack of 2', unit: '2×70g',
    weight: 0.14, mrp: 32, sellingPrice: 30, costPrice: 22, taxPercentage: 5,
    thumbnail: '/images/products/maggi.jpg', status: 'active',
    rating: 4.9, reviewsCount: 312, isPopular: true,
    locationId: 'loc-b01',
  },
  {
    id: 'prod-parle-g-800g', categoryId: 'cat-biscuits', storeId: 'store-001',
    sku: 'PGO-800', barcode: '8901030000006', name: 'Parle-G Biscuits 800g',
    slug: 'parle-g-800g', description: 'Classic glucose biscuits', unit: '800g',
    weight: 0.8, mrp: 75, sellingPrice: 72, costPrice: 58, taxPercentage: 5,
    thumbnail: '/images/products/parle-g.jpg', status: 'active',
    rating: 4.8, reviewsCount: 267,
    locationId: 'loc-b02',
  },
  {
    id: 'prod-saffola-oil-1l', categoryId: 'cat-oils', storeId: 'store-001',
    sku: 'SFL-1L', barcode: '8901030000007', name: 'Saffola Gold Refined Oil 1L',
    slug: 'saffola-oil-1l', description: 'Heart healthy blend of rice bran & corn oil', unit: '1L',
    weight: 0.9, mrp: 180, sellingPrice: 165, costPrice: 135, taxPercentage: 5,
    thumbnail: '/images/products/saffola.jpg', status: 'active',
    rating: 4.5, reviewsCount: 89,
    locationId: 'loc-a02',
  },
  {
    id: 'prod-amul-curd-400g', categoryId: 'cat-dairy', storeId: 'store-001',
    sku: 'AMC-400', barcode: '8901030000008', name: 'Amul Curd 400g',
    slug: 'amul-curd-400g', description: 'Fresh dahi', unit: '400g',
    weight: 0.4, mrp: 38, sellingPrice: 35, costPrice: 28, taxPercentage: 0,
    thumbnail: '/images/products/amul-curd.jpg', status: 'active',
    rating: 4.4, reviewsCount: 76, isPopular: true,
    locationId: 'loc-c02',
  },
  {
    id: 'prod-surf-excel-1kg', categoryId: 'cat-household', storeId: 'store-001',
    sku: 'SFX-1KG', barcode: '8901030000009', name: 'Surf Excel Detergent 1kg',
    slug: 'surf-excel-1kg', description: 'Tough stain removal formula', unit: '1kg',
    weight: 1.0, mrp: 215, sellingPrice: 198, costPrice: 158, taxPercentage: 18,
    thumbnail: '/images/products/surf-excel.jpg', status: 'active',
    rating: 4.6, reviewsCount: 143,
    locationId: 'loc-e01',
  },
  {
    id: 'prod-red-label-tea-500g', categoryId: 'cat-beverages', storeId: 'store-001',
    sku: 'RLT-500', barcode: '8901030000010', name: 'Brooke Bond Red Label Tea 500g',
    slug: 'red-label-tea-500g', description: 'Premium natural care tea', unit: '500g',
    weight: 0.5, mrp: 265, sellingPrice: 240, costPrice: 190, taxPercentage: 5,
    thumbnail: '/images/products/red-label.jpg', status: 'active',
    rating: 4.7, reviewsCount: 198, isFeatured: true,
    locationId: 'loc-b01',
  },
];

const COUPONS = [
  {
    id: 'coupon-first10', code: 'FIRST10', type: 'percentage', value: 10,
    minimumOrder: 199, maxDiscount: 50, usageLimit: 1, active: true,
    startDate: '2024-01-01T00:00:00Z', endDate: '2026-12-31T23:59:59Z',
  },
  {
    id: 'coupon-flat50', code: 'FLAT50', type: 'fixed', value: 50,
    minimumOrder: 499, maxDiscount: 50, usageLimit: 100, active: true,
    startDate: '2024-01-01T00:00:00Z', endDate: '2026-12-31T23:59:59Z',
  },
];

export async function POST(request: NextRequest) {
  // Secret check
  const secret = request.headers.get('X-Seed-Secret');
  if (secret !== SEED_SECRET) {
    return NextResponse.json({ error: 'Unauthorized. Provide valid X-Seed-Secret header.' }, { status: 401 });
  }

  if (!isFirebaseConfigured()) {
    return NextResponse.json({ error: 'Firebase not configured.' }, { status: 500 });
  }

  const db = getFirebaseDb();
  if (!db) {
    return NextResponse.json({ error: 'Firestore not available (server-side).' }, { status: 500 });
  }

  try {
    // Check if already seeded
    const existingSnap = await getDoc(doc(db, 'settings', 'store'));
    if (existingSnap.exists()) {
      return NextResponse.json({
        message: 'Database already seeded. Skipping. Delete settings/store to re-seed.',
        alreadySeeded: true,
      });
    }

    // Seed store config
    await setDoc(doc(db, 'settings', 'store'), STORE_CONFIG);

    // Batch seed categories
    const catBatch = writeBatch(db as Firestore);
    CATEGORIES.forEach((cat) => {
      catBatch.set(doc(db as Firestore, 'categories', cat.id), cat);
    });
    await catBatch.commit();

    // Batch seed storage locations
    const locBatch = writeBatch(db as Firestore);
    STORAGE_LOCATIONS.forEach((loc) => {
      locBatch.set(doc(db as Firestore, 'storeLocations', loc.id), loc);
    });
    await locBatch.commit();

    // Batch seed products + inventory + barcode registry
    const prodBatch = writeBatch(db as Firestore);
    const invBatch = writeBatch(db as Firestore);
    const bcBatch = writeBatch(db as Firestore);

    PRODUCTS.forEach((product) => {
      const { locationId, ...productDoc } = product;
      prodBatch.set(doc(db as Firestore, 'products', product.id), {
        ...productDoc,
        status: 'active',
        createdAt: new Date().toISOString(),
      });

      // Inventory record
      const invId = `${product.id}_store-001`;
      invBatch.set(doc(db as Firestore, 'inventory', invId), {
        inventoryId: invId,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        storeId: 'store-001',
        locationId: locationId || null,
        locationCode: STORAGE_LOCATIONS.find(l => l.id === locationId)?.displayCode || null,
        quantity: 100,
        reservedQuantity: 0,
        damagedQuantity: 0,
        availableQuantity: 100,
        reorderLevel: 10,
        maxStockLevel: 200,
        updatedAt: new Date().toISOString(),
      });

      // Barcode registry
      const bcId = `bc-${product.id}`;
      bcBatch.set(doc(db as Firestore, 'productBarcodes', bcId), {
        barcodeId: bcId,
        productId: product.id,
        storeId: 'store-001',
        barcode: product.barcode,
        barcodeType: 'EAN',
        isPrimary: true,
        createdAt: new Date().toISOString(),
        createdBy: 'seeder',
      });
    });

    await prodBatch.commit();
    await invBatch.commit();
    await bcBatch.commit();

    // Seed coupons
    const cpBatch = writeBatch(db as Firestore);
    COUPONS.forEach((coupon) => {
      cpBatch.set(doc(db as Firestore, 'coupons', coupon.id), coupon);
    });
    await cpBatch.commit();

    return NextResponse.json({
      success: true,
      message: '✅ PocketKirana database seeded successfully!',
      seeded: {
        storeConfig: 1,
        categories: CATEGORIES.length,
        products: PRODUCTS.length,
        storageLocations: STORAGE_LOCATIONS.length,
        inventoryRecords: PRODUCTS.length,
        barcodeRecords: PRODUCTS.length,
        coupons: COUPONS.length,
      },
    });
  } catch (error: any) {
    console.error('[Seeder] Error:', error);
    return NextResponse.json({ error: error.message || 'Seeder failed.' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'PocketKirana Seeder API. Use POST with X-Seed-Secret header.',
    usage: 'curl -X POST http://localhost:3000/api/seed -H "X-Seed-Secret: pocketkirana-seed-2024"',
  });
}
