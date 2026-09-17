import { NextRequest, NextResponse } from 'next/server';
import { Product, ProductSection } from '@/types';
import { INITIAL_PRODUCTS } from '@/lib/mockData';
import { normalizeProductSections, sanitizeVisibleSectionsForCustomer } from '@/lib/productSectionUtils';
import { logAuditEvent } from '@/lib/auditLogger';
import { queryPostgres } from '@/lib/postgres';

// In-memory runtime cache / store for dynamic updates
declare global {
  // eslint-disable-next-line no-var
  var _pkProductCache: Map<string, Product> | undefined;
}

function getProductCache(): Map<string, Product> {
  if (!globalThis._pkProductCache) {
    globalThis._pkProductCache = new Map<string, Product>();
    INITIAL_PRODUCTS.forEach((p) => {
      const normalizedSections = normalizeProductSections(p);
      globalThis._pkProductCache!.set(p.id, {
        ...p,
        publishStatus: p.publishStatus || 'PUBLISHED',
        sections: normalizedSections,
      });
      if (p.slug) {
        globalThis._pkProductCache!.set(p.slug, {
          ...p,
          publishStatus: p.publishStatus || 'PUBLISHED',
          sections: normalizedSections,
        });
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
                thumbnail, images, sections
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

    const payload = {
      ...product,
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
    const existing = cache.get(id) || { id, name: body.name || 'Product', slug: body.slug || id } as Product;

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

    const updatedProduct: Product = {
      ...existing,
      ...body,
      id,
      sections: validatedSections,
      publishStatus: body.publishStatus || existing.publishStatus || 'PUBLISHED',
    };

    // Update in-memory cache
    cache.set(id, updatedProduct);
    if (updatedProduct.slug) {
      cache.set(updatedProduct.slug, updatedProduct);
    }

    // Sync to PostgreSQL if DB table is present
    try {
      await queryPostgres(
        `INSERT INTO products (id, name, slug, description, category_id, brand_id, selling_price, mrp, unit, status, publish_status, thumbnail, images, sections, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           slug = EXCLUDED.slug,
           description = EXCLUDED.description,
           category_id = EXCLUDED.category_id,
           brand_id = EXCLUDED.brand_id,
           selling_price = EXCLUDED.selling_price,
           mrp = EXCLUDED.mrp,
           unit = EXCLUDED.unit,
           status = EXCLUDED.status,
           publish_status = EXCLUDED.publish_status,
           thumbnail = EXCLUDED.thumbnail,
           images = EXCLUDED.images,
           sections = EXCLUDED.sections,
           updated_at = NOW()`,
        [
          id,
          updatedProduct.name,
          updatedProduct.slug || id,
          updatedProduct.description || '',
          updatedProduct.categoryId || 'cat-veg',
          updatedProduct.brandId || null,
          updatedProduct.sellingPrice || 0,
          updatedProduct.mrp || 0,
          updatedProduct.unit || '1 kg',
          updatedProduct.status || 'active',
          updatedProduct.publishStatus || 'PUBLISHED',
          updatedProduct.thumbnail || '',
          JSON.stringify(updatedProduct.images || []),
          JSON.stringify(validatedSections),
        ]
      );
    } catch (_) {
      // Non-fatal PostgreSQL fallback
    }

    // Record Audit Log
    await logAuditEvent({
      userId: adminUid,
      userRole: role,
      action: 'PRODUCT_UPDATE_DYNAMIC_SECTIONS',
      entityType: 'PRODUCT',
      entityId: id,
      details: {
        productName: updatedProduct.name,
        sectionCount: validatedSections.length,
        publishStatus: updatedProduct.publishStatus,
        modifiedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Product information and dynamic sections updated successfully.',
      data: updatedProduct,
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
 * Authorized Admin endpoint to delete a product.
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
    const cache = getProductCache();
    const existing = cache.get(id);

    cache.delete(id);
    if (existing?.slug) cache.delete(existing.slug);

    try {
      await queryPostgres(`DELETE FROM products WHERE id = $1`, [id]);
    } catch (_) {}

    await logAuditEvent({
      userId: adminUid,
      userRole: role,
      action: 'PRODUCT_DELETE',
      entityType: 'PRODUCT',
      entityId: id,
      details: { productName: existing?.name },
    });

    return NextResponse.json({
      success: true,
      message: 'Product deleted successfully.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to delete product.' },
      { status: 500 }
    );
  }
}
