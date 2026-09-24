import { describe, it, expect } from 'vitest';
import { getProductDetailRecommendations } from '../lib/recommendationsEngine';
import { Product } from '../types';

const mockProducts: Product[] = ([
  {
    id: 'prod-target',
    name: 'Target Green Beans',
    slug: 'target-green-beans',
    categoryId: 'cat-veg',
    subcategoryId: 'subcat-beans',
    brandId: 'brand-fresh',
    sellingPrice: 20,
    mrp: 25,
    unit: '250g',
    stock: 50,
    status: 'active',
    publishStatus: 'PUBLISHED',
    rating: 4.8,
  },
  // Same Category & Same Brand
  {
    id: 'prod-veg-fresh-1',
    name: 'Fresh Carrots',
    slug: 'fresh-carrots',
    categoryId: 'cat-veg',
    brandId: 'brand-fresh',
    sellingPrice: 30,
    mrp: 35,
    unit: '500g',
    stock: 20,
    status: 'active',
    publishStatus: 'PUBLISHED',
    rating: 4.9,
  },
  // Same Category & Different Brand
  {
    id: 'prod-veg-other-1',
    name: 'Green Peas',
    slug: 'green-peas',
    categoryId: 'cat-veg',
    brandId: 'brand-nature',
    sellingPrice: 40,
    mrp: 45,
    unit: '250g',
    stock: 15,
    status: 'active',
    publishStatus: 'PUBLISHED',
    rating: 4.7,
  },
  // Same Category, Out of Stock
  {
    id: 'prod-veg-oos',
    name: 'Organic Spinach',
    slug: 'organic-spinach',
    categoryId: 'cat-veg',
    brandId: 'brand-organic',
    sellingPrice: 25,
    mrp: 30,
    unit: '1 bunch',
    stock: 0,
    status: 'out_of_stock',
    publishStatus: 'PUBLISHED',
    rating: 4.5,
  },
  // Same Brand, Different Category
  {
    id: 'prod-dairy-fresh-1',
    name: 'Fresh Cow Milk',
    slug: 'fresh-cow-milk',
    categoryId: 'cat-dairy',
    brandId: 'brand-fresh',
    sellingPrice: 32,
    mrp: 35,
    unit: '500ml',
    stock: 100,
    status: 'active',
    publishStatus: 'PUBLISHED',
    rating: 4.8,
  },
  {
    id: 'prod-dairy-fresh-2',
    name: 'Fresh Paneer',
    slug: 'fresh-paneer',
    categoryId: 'cat-dairy',
    brandId: 'brand-fresh',
    sellingPrice: 85,
    mrp: 90,
    unit: '200g',
    stock: 40,
    status: 'active',
    publishStatus: 'PUBLISHED',
    rating: 4.9,
  },
  // Discovery / Broader Catalog Products
  {
    id: 'prod-staples-1',
    name: 'Fortune Sunlite Oil',
    slug: 'fortune-sunlite-oil',
    categoryId: 'cat-staples',
    brandId: 'brand-fortune',
    sellingPrice: 140,
    mrp: 160,
    unit: '1L',
    stock: 80,
    status: 'active',
    publishStatus: 'PUBLISHED',
    rating: 4.6,
  },
  {
    id: 'prod-staples-2',
    name: 'Aashirvaad Atta',
    slug: 'aashirvaad-atta',
    categoryId: 'cat-staples',
    brandId: 'brand-itc',
    sellingPrice: 250,
    mrp: 275,
    unit: '5kg',
    stock: 60,
    status: 'active',
    publishStatus: 'PUBLISHED',
    rating: 4.8,
  },
  {
    id: 'prod-snacks-1',
    name: 'Kurkure Masala Munch',
    slug: 'kurkure-masala-munch',
    categoryId: 'cat-snacks',
    brandId: 'brand-pepsi',
    sellingPrice: 20,
    mrp: 20,
    unit: '90g',
    stock: 120,
    status: 'active',
    publishStatus: 'PUBLISHED',
    rating: 4.5,
  },
  {
    id: 'prod-snacks-2',
    name: 'Good Day Butter Cookies',
    slug: 'good-day-cookies',
    categoryId: 'cat-snacks',
    brandId: 'brand-britannia',
    sellingPrice: 30,
    mrp: 35,
    unit: '120g',
    stock: 90,
    status: 'active',
    publishStatus: 'PUBLISHED',
    rating: 4.7,
  },
] as unknown as Product[]);

describe('Product Detail Page Recommendation System', () => {
  const targetProduct = mockProducts[0];

  it('1. Returns sameCategory, sameBrand, and random sections', () => {
    const recs = getProductDetailRecommendations(targetProduct, mockProducts);
    expect(recs).toHaveProperty('sameCategory');
    expect(recs).toHaveProperty('sameBrand');
    expect(recs).toHaveProperty('random');
  });

  it('2. Excludes the target product from all recommendation sections', () => {
    const recs = getProductDetailRecommendations(targetProduct, mockProducts);

    const allRecommendedIds = [
      ...recs.sameCategory.map((p) => p.id),
      ...recs.sameBrand.map((p) => p.id),
      ...recs.random.map((p) => p.id),
    ];

    expect(allRecommendedIds).not.toContain(targetProduct.id);
    expect(allRecommendedIds).not.toContain(targetProduct.slug);
  });

  it('3. Populates sameCategory when >= 2 valid products exist', () => {
    const recs = getProductDetailRecommendations(targetProduct, mockProducts);
    expect(recs.sameCategory.length).toBeGreaterThanOrEqual(2);
    recs.sameCategory.forEach((p) => {
      expect(p.categoryId).toBe(targetProduct.categoryId);
    });
  });

  it('4. Hides sameCategory (returns empty array) if fewer than 2 valid products exist', () => {
    const isolatedProduct = {
      id: 'prod-solo',
      name: 'Rare Saffron',
      slug: 'rare-saffron',
      categoryId: 'cat-exotic',
      brandId: 'brand-fresh',
      sellingPrice: 500,
      mrp: 600,
      unit: '1g',
      stock: 10,
      status: 'active',
      publishStatus: 'PUBLISHED',
    } as unknown as Product;

    // Only 1 product with cat-exotic in pool
    const poolWithOneCategory = [
      isolatedProduct,
      {
        id: 'prod-exotic-1',
        name: 'Truffle Oil',
        slug: 'truffle-oil',
        categoryId: 'cat-exotic',
        brandId: 'brand-exotic',
        sellingPrice: 800,
        mrp: 900,
        unit: '100ml',
        stock: 5,
        status: 'active',
        publishStatus: 'PUBLISHED',
      },
      ...mockProducts.slice(4),
    ] as unknown as Product[];

    const recs = getProductDetailRecommendations(isolatedProduct, poolWithOneCategory);
    expect(recs.sameCategory).toHaveLength(0); // Under 2 products -> hidden
  });

  it('5. Strictly deduplicates products across sameCategory, sameBrand, and random', () => {
    const recs = getProductDetailRecommendations(targetProduct, mockProducts);

    const categoryIds = new Set(recs.sameCategory.map((p) => p.id));
    const brandIds = new Set(recs.sameBrand.map((p) => p.id));
    const randomIds = new Set(recs.random.map((p) => p.id));

    // No brand product should already be in category section
    recs.sameBrand.forEach((p) => {
      expect(categoryIds.has(p.id)).toBe(false);
    });

    // No random product should be in category or brand section
    recs.random.forEach((p) => {
      expect(categoryIds.has(p.id)).toBe(false);
      expect(brandIds.has(p.id)).toBe(false);
    });
  });

  it('6. Completely hides sameBrand if the product has no brand or 0 same-brand items exist', () => {
    const unbrandedProduct = {
      id: 'prod-unbranded',
      name: 'Loose Potatoes',
      slug: 'loose-potatoes',
      categoryId: 'cat-veg',
      sellingPrice: 20,
      mrp: 25,
      unit: '1kg',
      stock: 100,
      status: 'active',
      publishStatus: 'PUBLISHED',
    } as unknown as Product;

    const recs = getProductDetailRecommendations(unbrandedProduct, mockProducts);
    expect(recs.sameBrand).toHaveLength(0);
  });

  it('7. Excludes out-of-stock and inactive products from recommendations', () => {
    const recs = getProductDetailRecommendations(targetProduct, mockProducts);
    const allIds = [
      ...recs.sameCategory.map((p) => p.id),
      ...recs.sameBrand.map((p) => p.id),
      ...recs.random.map((p) => p.id),
    ];

    expect(allIds).not.toContain('prod-veg-oos');
  });

  it('8. Random section stably supplies discovery products', () => {
    const recs1 = getProductDetailRecommendations(targetProduct, mockProducts, { seed: 100 });
    const recs2 = getProductDetailRecommendations(targetProduct, mockProducts, { seed: 100 });

    expect(recs1.random.map((p) => p.id)).toEqual(recs2.random.map((p) => p.id));
    expect(recs1.random.length).toBeGreaterThanOrEqual(4);
  });
});
