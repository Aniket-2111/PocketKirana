import { NextRequest, NextResponse } from 'next/server';
import { syncIncrementalCatalog } from '@/lib/catalogSync';
import { sanitizeVisibleSectionsForCustomer, normalizeProductSections } from '@/lib/productSectionUtils';

/**
 * GET /api/v1/catalog/sync
 * Incremental catalog synchronization endpoint for Website, Customer APK, and Picker APK.
 * Query parameters:
 *  - sinceVersion: number (default: 0 = full sync)
 *  - storeId: string
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sinceVersion = parseInt(searchParams.get('sinceVersion') || '0', 10);
    const storeId = searchParams.get('storeId') || 'store-001';
    const role = req.headers.get('x-pk-role') || 'customer';
    const isAdmin = role === 'admin' || role === 'store_manager';

    const result = await syncIncrementalCatalog(sinceVersion, {
      storeId,
      includeDrafts: isAdmin,
    });

    const sanitizedProducts = result.products.map((p) => ({
      ...p,
      sections: isAdmin
        ? normalizeProductSections(p)
        : sanitizeVisibleSectionsForCustomer(normalizeProductSections(p)),
    }));

    return NextResponse.json(
      {
        success: true,
        data: {
          catalogVersion: result.catalogVersion,
          lastUpdatedAt: result.lastUpdatedAt,
          isFullSync: result.isFullSync,
          count: sanitizedProducts.length,
          products: sanitizedProducts,
          deletedProductIds: result.deletedProductIds,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Catalog-Version': String(result.catalogVersion),
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Catalog sync failed' },
      { status: 500 }
    );
  }
}
