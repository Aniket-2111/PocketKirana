import { NextRequest, NextResponse } from 'next/server';
import { Product, ProductSection } from '@/types';
import { normalizeProductSections, sanitizeVisibleSectionsForCustomer } from '@/lib/productSectionUtils';
import { logAuditEvent } from '@/lib/auditLogger';
import { queryPostgres } from '@/lib/postgres';
import { publishProductChange, deleteCatalogProduct, getCatalogVersion } from '@/lib/catalogSync';
import { INITIAL_PRODUCTS } from '@/lib/mockData';

declare global {
  // eslint-disable-next-line no-var
  var _pkProductCache: Map<string, Product> | undefined;
}

function getProductCache(): Map<string, Product> {
  if (!globalThis._pkProductCache) {
    globalThis._pkProductCache = new Map<string, Product>();
    INITIAL_PRODUCTS.forEach((p, idx) => {
      const normalizedSections = normalizeProductSections(p);
      const withVersion = {
        ...p,
        version: p.version || 100 + idx,
        catalogVersion: p.catalogVersion || 100,
        publishStatus: p.publishStatus || 'PUBLISHED',
        sections: normalizedSections,
      };
      globalThis._pkProductCache!.set(p.id, withVersion);
      if (p.slug) {
        globalThis._pkProductCache!.set(p.slug, withVersion);
      }
    });
  }
  return globalThis._pkProductCache;
}

/**
 * GET /api/v1/products/:id
 * Fetches dynamic product information by ID or Slug.
 * Respects RBAC: Customers only receive PUBLISHED data & visible sections/attributes.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const cache = getProductCache();
    const role = req.headers.get('x-pk-role') || 'customer';
    const isAdmin = role === 'admin' || role === 'store_manager';

    // 1. Try DB lookup (if available) or fallback to cache
    let product: Product | null = null;
    try {
      const res = await queryPostgres(
        `SELECT id, name, slug, description, category_id as "categoryId", brand_id as "brandId",
                selling_price as "sellingPrice", mrp, unit, status, publish_status as "publishStatus",
                thumbnail, images, sections, version
         FROM products WHERE id = $1 OR slug = $1 LIMIT 1`,
        [id]
      );
      if (res.rows.length > 0) {
        const row = res.rows[0];
        product = {
          ...row,
          sections: row.sections ? (typeof row.sections === 'string' ? JSON.parse(row.sections) : row.sections) : undefined,
        };
      }
    } catch (_) {
      // PostgreSQL fallback to runtime cache
    }

    if (!product) {
      product = cache.get(id) || null;
    }

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    // Ensure sections are normalized
    const allSections = normalizeProductSections(product);
    const publishStatus = product.publishStatus || 'PUBLISHED';

    // If customer and not published, return 404
    if (!isAdmin && publishStatus !== 'PUBLISHED') {
      return NextResponse.json(
        { success: false, error: 'Product is currently not available.' },
        { status: 404 }
      );
    }

    // Sanitize sections for customer
    const returnedSections = isAdmin
      ? allSections
      : sanitizeVisibleSectionsForCustomer(allSections);

    // Dynamic images with deduplication
    const imageList: string[] = [];
    if (product.thumbnail) imageList.push(product.thumbnail);
    if (product.image && !imageList.includes(product.image)) imageList.push(product.image);
    if (product.images && Array.isArray(product.images)) {
      product.images.forEach((img) => {
        if (img && !imageList.includes(img)) imageList.push(img);
      });
    }

    const { catalogVersion } = await getCatalogVersion();

    const payload = {
      ...product,
      version: product.version || 100,
      catalogVersion,
      sections: returnedSections,
      images: imageList,
      publishStatus,
    };

    return NextResponse.json(
      {
        success: true,
        data: payload,
      },
      {
        headers: {
          'Cache-Control': isAdmin ? 'no-cache, no-store' : 'public, s-maxage=30, stale-while-revalidate=60',
          'X-Catalog-Version': String(catalogVersion),
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/products/:id
 * Authorized Admin endpoint to update product details, dynamic sections, and attributes.
 * Commits change, increments version, logs outbox event, and syncs Firestore read collection.
 */
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const role = req.headers.get('x-pk-role');
    const adminUid = req.headers.get('x-pk-uid') || 'admin_operator';

    if (role !== 'admin' && role !== 'store_manager') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const body = await req.json();

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid request payload.' },
        { status: 400 }
      );
    }

    const cache = getProductCache();
    const existing = cache.get(id) || ({ id, name: body.name || 'Product', slug: body.slug || id } as Product);

    // Validate and clean sections
    let validatedSections: ProductSection[] = [];
    if (body.sections && Array.isArray(body.sections)) {
      validatedSections = body.sections.map((sec: any, sIdx: number) => ({
        id: sec.id || `sec-${Date.now()}-${sIdx}`,
        productId: id,
        title: String(sec.title || 'Untitled Section').trim(),
        displayOrder: typeof sec.displayOrder === 'number' ? sec.displayOrder : sIdx + 1,
        isVisible: sec.isVisible !== false,
        defaultExpanded: !!sec.defaultExpanded,
        attributes: Array.isArray(sec.attributes)
          ? sec.attributes.map((attr: any, aIdx: number) => ({
              id: attr.id || `attr-${Date.now()}-${sIdx}-${aIdx}`,
              sectionId: sec.id,
              label: String(attr.label || 'Attribute').trim(),
              value: String(attr.value || '').trim(),
              unit: attr.unit ? String(attr.unit).trim() : '',
              displayOrder: typeof attr.displayOrder === 'number' ? attr.displayOrder : aIdx + 1,
              isVisible: attr.isVisible !== false,
            }))
          : [],
      }));
    } else {
      validatedSections = normalizeProductSections({ ...existing, ...body });
    }

    const updatePayload: Partial<Product> = {
      ...body,
      sections: validatedSections,
      publishStatus: body.publishStatus || existing.publishStatus || 'PUBLISHED',
    };

    const publishResult = await publishProductChange(id, updatePayload, {
      adminUid,
      adminRole: role,
    });

    // Record Audit Log
    await logAuditEvent({
      userId: adminUid,
      userRole: role,
      action: 'PRODUCT_UPDATE_DYNAMIC_SECTIONS',
      entityType: 'PRODUCT',
      entityId: id,
      details: {
        productName: publishResult.product.name,
        sectionCount: validatedSections.length,
        publishStatus: publishResult.product.publishStatus,
        version: publishResult.version,
        catalogVersion: publishResult.catalogVersion,
        modifiedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Product information and catalog synchronized successfully.',
      version: publishResult.version,
      catalogVersion: publishResult.catalogVersion,
      data: publishResult.product,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to update product.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/products/:id
 * Authorized Admin endpoint to delete a product and record outbox event.
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const role = req.headers.get('x-pk-role');
    const adminUid = req.headers.get('x-pk-uid') || 'admin_operator';

    if (role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const deleteResult = await deleteCatalogProduct(id, { adminUid, adminRole: role });

    await logAuditEvent({
      userId: adminUid,
      userRole: role,
      action: 'PRODUCT_DELETE',
      entityType: 'PRODUCT',
      entityId: id,
      details: { catalogVersion: deleteResult.catalogVersion },
    });

    return NextResponse.json({
      success: true,
      message: 'Product deleted and catalog updated successfully.',
      catalogVersion: deleteResult.catalogVersion,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to delete product.' },
      { status: 500 }
    );
  }
}
