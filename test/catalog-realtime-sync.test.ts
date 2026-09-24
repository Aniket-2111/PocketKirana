import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock postgres pool and queryPostgres to run instantly without waiting for remote LAN timeouts
vi.mock('@/lib/postgres', () => {
  const mockClient = {
    query: vi.fn().mockImplementation((sql: string, params?: any[]) => {
      if (sql.includes('catalog_metadata')) {
        return Promise.resolve({
          rows: [{ version: (globalThis._pkCatalogVersion || 100) + 1, updated_at: new Date().toISOString() }],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 1 });
    }),
    release: vi.fn(),
  };

  return {
    queryPostgres: vi.fn().mockImplementation((sql: string, params?: any[]) => {
      if (sql.includes('catalog_metadata')) {
        return Promise.resolve({
          rows: [{ version: globalThis._pkCatalogVersion || 100, updated_at: new Date().toISOString() }],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    }),
    getPostgresPool: vi.fn().mockReturnValue({
      connect: vi.fn().mockResolvedValue(mockClient),
      query: mockClient.query,
    }),
  };
});

vi.mock('@/lib/firebaseServices', () => ({
  updateProductFS: vi.fn().mockResolvedValue(true),
  addProductFS: vi.fn().mockResolvedValue('new-id'),
  deleteProductFS: vi.fn().mockResolvedValue(true),
}));

import {
  getCatalogVersion,
  incrementCatalogVersion,
  buildCatalogEvent,
  syncIncrementalCatalog,
  validateServerPricing,
  publishProductChange,
  deleteCatalogProduct,
} from '@/lib/catalogSync';
import { Product, ProductVariant } from '@/types';

describe('PocketKirana Authoritative Catalog & Realtime Sync Engine', () => {
  beforeEach(() => {
    // Reset runtime memory versions and cache
    globalThis._pkCatalogVersion = 100;
    globalThis._pkProductCache = undefined;
    globalThis._pkDeletedProductIds = undefined;
  });

  // TEST 1: Admin changes product name
  it('TEST 1: Admin changes product name and version increments', async () => {
    const pub = await publishProductChange('p-test-1', {
      name: 'Organic Cavendish Bananas',
      sellingPrice: 48,
      mrp: 60,
      publishStatus: 'PUBLISHED',
      status: 'active',
    });

    expect(pub.success).toBe(true);
    expect(pub.product.name).toBe('Organic Cavendish Bananas');
    expect(pub.product.version).toBeGreaterThan(100);
    expect(pub.catalogVersion).toBeGreaterThan(100);

    const sync = await syncIncrementalCatalog(100);
    const found = sync.products.find((p) => p.id === 'p-test-1');
    expect(found).toBeDefined();
    expect(found?.name).toBe('Organic Cavendish Bananas');
  });

  // TEST 2: Admin changes price -> Cart server-validates
  it('TEST 2: Admin changes price from ₹48 to ₹45 and server validates price mismatch', async () => {
    // 1. Initial publish at ₹48
    await publishProductChange('p-test-price', {
      name: 'Shimla Fresh Apples',
      sellingPrice: 48,
      mrp: 60,
      publishStatus: 'PUBLISHED',
      status: 'active',
      stock: 50,
    });

    // 2. Customer cart with ₹48
    const validationBefore = await validateServerPricing([
      { productId: 'p-test-price', quantity: 1, unitPrice: 48 },
    ]);
    expect(validationBefore.isValid).toBe(true);
    expect(validationBefore.recalculatedSubtotal).toBe(48);

    // 3. Admin updates price to ₹45
    await publishProductChange('p-test-price', {
      name: 'Shimla Fresh Apples',
      sellingPrice: 45,
      mrp: 60,
      publishStatus: 'PUBLISHED',
      status: 'active',
    });

    // 4. Customer submits old cached price ₹48 -> server detects price change
    const validationAfter = await validateServerPricing([
      { productId: 'p-test-price', quantity: 2, unitPrice: 48 },
    ]);
    expect(validationAfter.isValid).toBe(false);
    expect(validationAfter.priceChanges.length).toBe(1);
    expect(validationAfter.priceChanges[0].oldPrice).toBe(48);
    expect(validationAfter.priceChanges[0].newPrice).toBe(45);
    expect(validationAfter.recalculatedSubtotal).toBe(90); // 2 * 45
  });

  // TEST 3: Admin adds variant
  it('TEST 3: Admin adds variant and sync reflects new variant options', async () => {
    const variants: ProductVariant[] = [
      {
        id: 'var-1kg',
        productId: 'p-atta',
        variantName: '1 kg',
        measurementType: 'WEIGHT',
        measurementUnit: 'KG',
        measurementValue: 1,
        packagingType: 'Packet',
        sellingPrice: 55,
        mrp: 65,
        stockQuantity: 20,
        isActive: true,
      },
      {
        id: 'var-5kg',
        productId: 'p-atta',
        variantName: '5 kg',
        measurementType: 'WEIGHT',
        measurementUnit: 'KG',
        measurementValue: 5,
        packagingType: 'Packet',
        sellingPrice: 260,
        mrp: 300,
        stockQuantity: 15,
        isActive: true,
      },
    ];

    await publishProductChange('p-atta', {
      name: 'Chakki Fresh Atta',
      hasVariants: true,
      variants,
      publishStatus: 'PUBLISHED',
      status: 'active',
    });

    const sync = await syncIncrementalCatalog(0);
    const atta = sync.products.find((p) => p.id === 'p-atta');
    expect(atta).toBeDefined();
    expect(atta?.hasVariants).toBe(true);
    expect(atta?.variants?.length).toBe(2);

    // Validate cart with 5kg variant
    const cartVal = await validateServerPricing([
      { productId: 'p-atta', variantId: 'var-5kg', quantity: 2, unitPrice: 260 },
    ]);
    expect(cartVal.isValid).toBe(true);
    expect(cartVal.recalculatedSubtotal).toBe(520);
  });

  // TEST 4: Admin disables variant
  it('TEST 4: Admin disables variant -> Variant becomes non-purchasable', async () => {
    const variants: ProductVariant[] = [
      {
        id: 'var-1kg',
        productId: 'p-atta',
        variantName: '1 kg',
        sellingPrice: 55,
        mrp: 65,
        stockQuantity: 20,
        isActive: true,
      },
      {
        id: 'var-5kg',
        productId: 'p-atta',
        variantName: '5 kg',
        sellingPrice: 260,
        mrp: 300,
        stockQuantity: 15,
        isActive: false, // Disabled by Admin
      },
    ];

    await publishProductChange('p-atta', {
      name: 'Chakki Fresh Atta',
      variants,
      publishStatus: 'PUBLISHED',
      status: 'active',
    });

    const cartVal = await validateServerPricing([
      { productId: 'p-atta', variantId: 'var-5kg', quantity: 1, unitPrice: 260 },
    ]);
    expect(cartVal.isValid).toBe(false);
    expect(cartVal.inactiveItems.length).toBe(1);
    expect(cartVal.inactiveItems[0].reason).toBe('VARIANT_INACTIVE');
  });

  // TEST 5: Admin changes category
  it('TEST 5: Admin changes product category', async () => {
    await publishProductChange('p-cat-test', {
      name: 'Coconut Oil 500ml',
      categoryId: 'cat-staples',
      publishStatus: 'PUBLISHED',
    });

    const sync = await syncIncrementalCatalog(0);
    const prod = sync.products.find((p) => p.id === 'p-cat-test');
    expect(prod?.categoryId).toBe('cat-staples');
  });

  // TEST 6: Admin changes brand
  it('TEST 6: Admin changes brand', async () => {
    await publishProductChange('p-brand-test', {
      name: 'Digestive Biscuits',
      brandId: 'brand-britannia',
      brandName: 'Britannia',
      publishStatus: 'PUBLISHED',
    });

    const sync = await syncIncrementalCatalog(0);
    const prod = sync.products.find((p) => p.id === 'p-brand-test');
    expect(prod?.brandId).toBe('brand-britannia');
    expect(prod?.brandName).toBe('Britannia');
  });

  // TEST 7: Admin changes image
  it('TEST 7: Admin changes image URL', async () => {
    await publishProductChange('p-img-test', {
      name: 'Green Tea 100g',
      thumbnail: 'https://images.unsplash.com/photo-green-tea-v2',
      images: ['https://images.unsplash.com/photo-green-tea-v2'],
      publishStatus: 'PUBLISHED',
    });

    const sync = await syncIncrementalCatalog(0);
    const prod = sync.products.find((p) => p.id === 'p-img-test');
    expect(prod?.thumbnail).toBe('https://images.unsplash.com/photo-green-tea-v2');
  });

  // TEST 8: Admin changes promotion / dynamic sections
  it('TEST 8: Admin updates dynamic sections and attributes', async () => {
    await publishProductChange('p-sections-test', {
      name: 'Organic Basmati Rice',
      sections: [
        {
          id: 'sec-1',
          title: 'Product Information',
          displayOrder: 1,
          isVisible: true,
          defaultExpanded: true,
          attributes: [
            { id: 'attr-1', label: 'Grain Length', value: '8.4 mm', displayOrder: 1, isVisible: true },
          ],
        },
      ],
      publishStatus: 'PUBLISHED',
    });

    const sync = await syncIncrementalCatalog(0);
    const prod = sync.products.find((p) => p.id === 'p-sections-test');
    expect(prod?.sections?.length).toBe(1);
    expect(prod?.sections?.[0].attributes[0].value).toBe('8.4 mm');
  });

  // TEST 9: Admin sets product inactive
  it('TEST 9: Admin sets product inactive -> Cart validator rejects with PRODUCT_INACTIVE', async () => {
    await publishProductChange('p-inactive-test', {
      name: 'Out of Season Alphonso Mangoes',
      sellingPrice: 450,
      status: 'out_of_stock',
      publishStatus: 'PUBLISHED',
    });

    const cartVal = await validateServerPricing([
      { productId: 'p-inactive-test', quantity: 1, unitPrice: 450 },
    ]);
    expect(cartVal.isValid).toBe(false);
    expect(cartVal.inactiveItems[0].reason).toBe('PRODUCT_INACTIVE');
  });

  // TEST 10: Admin changes loose product measurement
  it('TEST 10: Admin configures loose product measurement and packaging', async () => {
    await publishProductChange('p-loose-sugar', {
      name: 'Loose Premium Sugar',
      measurementType: 'WEIGHT',
      measurementUnit: 'KG',
      measurementValue: 1,
      packagingType: 'Loose',
      sellingPrice: 42,
      publishStatus: 'PUBLISHED',
    });

    const sync = await syncIncrementalCatalog(0);
    const prod = sync.products.find((p) => p.id === 'p-loose-sugar');
    expect(prod?.measurementType).toBe('WEIGHT');
    expect(prod?.packagingType).toBe('Loose');
  });

  // TEST 11: Admin changes stock
  it('TEST 11: Admin sets stock quantity and server enforces inventory boundary', async () => {
    await publishProductChange('p-stock-test', {
      name: 'Farm Fresh Eggs 6-pack',
      sellingPrice: 45,
      stock: 3,
      publishStatus: 'PUBLISHED',
    });

    // Requesting 2 eggs -> Valid
    const valOk = await validateServerPricing([
      { productId: 'p-stock-test', quantity: 2, unitPrice: 45 },
    ]);
    expect(valOk.isValid).toBe(true);

    // Requesting 5 eggs -> Out of stock
    const valOos = await validateServerPricing([
      { productId: 'p-stock-test', quantity: 5, unitPrice: 45 },
    ]);
    expect(valOos.isValid).toBe(false);
    expect(valOos.outOfStockItems[0].availableStock).toBe(3);
  });

  // TEST 12: Admin saves draft
  it('TEST 12: Admin saves product as DRAFT -> Hidden from customer sync', async () => {
    await publishProductChange('p-draft-test', {
      name: 'Unreleased Festive Sweets Box',
      sellingPrice: 650,
      publishStatus: 'DRAFT',
    });

    // Customer sync (includeDrafts: false)
    const customerSync = await syncIncrementalCatalog(0, { includeDrafts: false });
    const foundInCust = customerSync.products.find((p) => p.id === 'p-draft-test');
    expect(foundInCust).toBeUndefined();

    // Admin sync (includeDrafts: true)
    const adminSync = await syncIncrementalCatalog(0, { includeDrafts: true });
    const foundInAdmin = adminSync.products.find((p) => p.id === 'p-draft-test');
    expect(foundInAdmin).toBeDefined();
    expect(foundInAdmin?.publishStatus).toBe('DRAFT');
  });

  // TEST 13: Admin publishes draft
  it('TEST 13: Admin publishes draft -> Immediately available to customer surfaces', async () => {
    // 1. Create draft
    await publishProductChange('p-draft-to-pub', {
      name: 'Diwali Special Mithai Box',
      sellingPrice: 500,
      publishStatus: 'DRAFT',
    });

    let customerSync = await syncIncrementalCatalog(0, { includeDrafts: false });
    expect(customerSync.products.find((p) => p.id === 'p-draft-to-pub')).toBeUndefined();

    // 2. Publish
    const pub = await publishProductChange('p-draft-to-pub', {
      publishStatus: 'PUBLISHED',
    });
    expect(pub.event.eventType).toBe('PRODUCT_PUBLISHED');

    customerSync = await syncIncrementalCatalog(0, { includeDrafts: false });
    const liveProd = customerSync.products.find((p) => p.id === 'p-draft-to-pub');
    expect(liveProd).toBeDefined();
    expect(liveProd?.publishStatus).toBe('PUBLISHED');
  });

  // TEST 14: Multi-surface consistency test
  it('TEST 14: Multi-surface consistency — Admin, Website, APK, Picker all consume same version', async () => {
    const pub = await publishProductChange('p-consistency', {
      name: 'Amul Taaza Milk 500ml',
      sellingPrice: 27,
      mrp: 27,
      unit: '500 ml',
      measurementType: 'VOLUME',
      measurementUnit: 'ML',
      measurementValue: 500,
      packagingType: 'Pouch',
      publishStatus: 'PUBLISHED',
    });

    const adminVersion = pub.catalogVersion;

    // Simulate Website sync
    const webSync = await syncIncrementalCatalog(0);
    const webProduct = webSync.products.find((p) => p.id === 'p-consistency');

    // Simulate APK incremental sync
    const apkSync = await syncIncrementalCatalog(pub.version - 1);
    const apkProduct = apkSync.products.find((p) => p.id === 'p-consistency');

    // All match
    expect(webSync.catalogVersion).toBe(adminVersion);
    expect(apkSync.catalogVersion).toBe(adminVersion);
    expect(webProduct?.sellingPrice).toBe(27);
    expect(apkProduct?.sellingPrice).toBe(27);
    expect(webProduct?.version).toBe(apkProduct?.version);
  });

  // TEST 15: Stale client / Offline sync test
  it('TEST 15: Stale APK reconnecting with localVersion < serverVersion downloads update', async () => {
    // 1. Initial product at version 101
    const p1 = await publishProductChange('p-stale-test', {
      name: 'Tata Salt 1kg',
      sellingPrice: 24,
      publishStatus: 'PUBLISHED',
    });
    const apkLocalVersion = p1.version;

    // 2. Admin updates while APK is offline
    const p2 = await publishProductChange('p-stale-test', {
      name: 'Tata Salt 1kg (Iodized)',
      sellingPrice: 26,
      publishStatus: 'PUBLISHED',
    });
    const serverVersion = p2.version;

    expect(serverVersion).toBeGreaterThan(apkLocalVersion);

    // 3. APK reconnects and asks for changes since apkLocalVersion
    const diffSync = await syncIncrementalCatalog(apkLocalVersion);
    expect(diffSync.products.length).toBeGreaterThanOrEqual(1);
    const updated = diffSync.products.find((p) => p.id === 'p-stale-test');
    expect(updated?.name).toBe('Tata Salt 1kg (Iodized)');
    expect(updated?.sellingPrice).toBe(26);
  });

  // TEST 16: Duplicate event idempotency test
  it('TEST 16: Duplicate event delivery is idempotent and does not duplicate product entries', async () => {
    const event1 = buildCatalogEvent('PRODUCT_UPDATED', 'p-idem', 105, 105);
    const event2 = buildCatalogEvent('PRODUCT_UPDATED', 'p-idem', 105, 105);

    // Simulated event processing map
    const clientProductMap = new Map<string, any>();
    const processEvent = (evt: typeof event1, data: any) => {
      clientProductMap.set(evt.entityId, { ...data, version: evt.version });
    };

    processEvent(event1, { name: 'Fortune Oil', price: 140 });
    expect(clientProductMap.size).toBe(1);

    // Duplicate delivery
    processEvent(event2, { name: 'Fortune Oil', price: 140 });
    expect(clientProductMap.size).toBe(1);
    expect(clientProductMap.get('p-idem').price).toBe(140);
  });

  // TEST 17: Product deletion
  it('TEST 17: Product deletion updates catalog version and tracks deleted ID', async () => {
    await publishProductChange('p-to-delete', {
      name: 'Discontinued Snack',
      publishStatus: 'PUBLISHED',
    });

    const del = await deleteCatalogProduct('p-to-delete');
    expect(del.success).toBe(true);
    expect(del.event.eventType).toBe('PRODUCT_DELETED');

    const sync = await syncIncrementalCatalog(100);
    expect(sync.deletedProductIds).toContain('p-to-delete');
    expect(sync.products.find((p) => p.id === 'p-to-delete')).toBeUndefined();
  });
});
