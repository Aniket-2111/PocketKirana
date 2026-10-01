import { NextRequest, NextResponse } from 'next/server';
import { Product, ProductSection } from '@/types';
import { normalizeProductSections, sanitizeVisibleSectionsForCustomer, getDefaultProductSections } from '@/lib/productSectionUtils';
import { logAuditEvent } from '@/lib/auditLogger';
import { getCatalogVersion, publishProductChange, syncIncrementalCatalog } from '@/lib/catalogSync';

/**
 * GET /api/v1/products
 * List products with optional category, search, and status filters.
 * Returns authoritative catalog version and data.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const search = searchParams.get('q')?.toLowerCase();
    const role = req.headers.get('x-pk-role') || 'customer';
    const isAdmin = role === 'admin' || role === 'store_manager';

    const syncResult = await syncIncrementalCatalog(0, { includeDrafts: isAdmin });
    let list = syncResult.products;

    if (category) {
      list = list.filter((p) => p.categoryId === category || p.category === category);
    }

    if (search) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(search) ||
          p.description?.toLowerCase().includes(search) ||
          p.brandName?.toLowerCase().includes(search) ||
          p.sku?.toLowerCase().includes(search)
      );
    }

    // Format sections
    const formatted = list.map((p) => ({
      ...p,
      sections: isAdmin ? normalizeProductSections(p) : sanitizeVisibleSectionsForCustomer(normalizeProductSections(p)),
    }));

    return NextResponse.json(
      {
        success: true,
        count: formatted.length,
        catalogVersion: syncResult.catalogVersion,
        lastUpdatedAt: syncResult.lastUpdatedAt,
        data: formatted,
      },
      {
        headers: {
          'Cache-Control': isAdmin ? 'no-cache, no-store' : 'public, s-maxage=30, stale-while-revalidate=60',
          'X-Catalog-Version': String(syncResult.catalogVersion),
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/products
 * Admin endpoint to create and publish a new product with default or custom sections.
 */
export async function POST(req: NextRequest) {
  try {
    const role = req.headers.get('x-pk-role');
    const adminUid = req.headers.get('x-pk-uid') || 'admin_operator';

    if (role !== 'admin' && role !== 'store_manager') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    if (!body || !body.name) {
      return NextResponse.json(
        { success: false, error: 'Product name is required.' },
        { status: 400 }
      );
    }

    const id = body.id || `prod-${Date.now()}`;
    const slug = body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const sections: ProductSection[] = body.sections && Array.isArray(body.sections) && body.sections.length > 0
      ? body.sections
      : getDefaultProductSections();

    const newProductData: Partial<Product> = {
      ...body,
      id,
      slug,
      name: body.name.trim(),
      description: body.description || '',
      categoryId: body.categoryId || 'cat-veg',
      brandId: body.brandId || '',
      brandName: body.brandName || '',
      storeId: body.storeId || 'store-1',
      sku: body.sku || `SKU-${Date.now().toString().slice(-6)}`,
      barcode: body.barcode || `${Date.now().toString().slice(-12)}`,
      unit: body.unit || '1 kg',
      weight: body.weight || 1,
      mrp: Number(body.mrp || 0),
      sellingPrice: Number(body.sellingPrice || 0),
      taxPercentage: Number(body.taxPercentage || 0),
      thumbnail: body.thumbnail || (body.images && body.images[0]) || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
      images: body.images || [],
      status: body.status || 'active',
      publishStatus: body.publishStatus || 'PUBLISHED',
      rating: body.rating || 4.8,
      reviewsCount: body.reviewsCount || 12,
      sections,
    };

    const publishResult = await publishProductChange(id, newProductData, {
      eventType: 'PRODUCT_CREATED',
      adminUid,
      adminRole: role,
    });

    await logAuditEvent({
      userId: adminUid,
      userRole: role,
      action: 'PRODUCT_CREATE_DYNAMIC',
      entityType: 'PRODUCT',
      entityId: id,
      details: {
        productName: publishResult.product.name,
        sectionCount: sections.length,
        version: publishResult.version,
        catalogVersion: publishResult.catalogVersion,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Product created and synchronized successfully.',
      version: publishResult.version,
      catalogVersion: publishResult.catalogVersion,
      data: publishResult.product,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to create product' },
      { status: 500 }
    );
  }
}
