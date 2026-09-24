import { NextRequest, NextResponse } from 'next/server';
import { getCatalogVersion } from '@/lib/catalogSync';

/**
 * GET /api/v1/catalog/version
 * Fast version freshness probe for Web clients, Customer APK, and Picker APK.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get('storeId') || 'store-001';
    const { catalogVersion, lastUpdatedAt } = await getCatalogVersion();

    return NextResponse.json(
      {
        success: true,
        data: {
          catalogVersion,
          lastUpdatedAt,
          storeId,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Catalog-Version': String(catalogVersion),
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch catalog version' },
      { status: 500 }
    );
  }
}
