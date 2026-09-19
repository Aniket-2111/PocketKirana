import { Brand, Product } from '@/types';
import { INITIAL_BRANDS, INITIAL_PRODUCTS } from './mockData';

/**
 * Resolves the Brand object for a given product through multiple fallback strategies:
 * 1. Direct brandId on product
 * 2. Direct brandName on product
 * 3. Matched mock catalog product brandId
 * 4. Fuzzy brand name lookup in product title
 */
export function getProductBrand(
  product: Product,
  allBrands?: Brand[]
): Brand | undefined {
  const brandsList = allBrands && allBrands.length > 0 ? allBrands : INITIAL_BRANDS;

  // 1. Direct brandId match
  if (product.brandId) {
    const found = brandsList.find((b) => b.id === product.brandId);
    if (found) return found;
  }

  // 2. Direct brandName match
  if (product.brandName) {
    const found = brandsList.find(
      (b) => b.name.toLowerCase() === product.brandName?.toLowerCase()
    );
    if (found) return found;
  }

  // 3. Match from INITIAL_PRODUCTS catalog in non-production only
  if (process.env.NODE_ENV !== 'production') {
    const mock = INITIAL_PRODUCTS.find(
      (m) => m.id === product.id || m.slug === product.slug
    );
    if (mock?.brandId) {
      const found = brandsList.find((b) => b.id === mock.brandId);
      if (found) return found;
    }
  }

  // 4. Name prefix / keyword matching (e.g. "Amul Fresh Milk", "Mother Dairy Toned Milk", "Tata Salt", etc.)
  const lowerName = product.name.toLowerCase();
  for (const b of brandsList) {
    if (
      lowerName.startsWith(b.name.toLowerCase() + ' ') ||
      lowerName.includes(b.name.toLowerCase())
    ) {
      return b;
    }
  }

  return undefined;
}
