import { NextRequest, NextResponse } from 'next/server';
import { Product, ProductSection } from '@/types';
import { INITIAL_PRODUCTS } from '@/lib/mockData';
import { normalizeProductSections, sanitizeVisibleSectionsForCustomer, getDefaultProductSections } from '@/lib/productSectionUtils';
import { logAuditEvent } from '@/lib/auditLogger';
import { queryPostgres } from '@/lib/postgres';

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
 * GET /api/v1/products
 * List products with optional category, search, and status filters.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const search = searchParams.get('q')?.toLowerCase();
    const role = req.headers.get('x-pk-role') || 'customer';
    const isAdmin = role === 'admin' || role === 'store_manager';

    const cache = getProductCache();
    // Unique products list
    const uniqueProductsMap = new Map<string, Product>();
    cache.forEach((p) => {
      if (p.id && !uniqueProductsMap.has(p.id)) {
        uniqueProductsMap.set(p.id, p);
      }
    });

    let list = Array.from(uniqueProductsMap.values());

    if (!isAdmin) {
      list = list.filter((p) => (p.publishStatus || 'PUBLISHED') === 'PUBLISHED');
    }

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

    return NextResponse.json({
      success: true,
      count: formatted.length,
      data: formatted,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/products
 * Admin endpoint to create a new product with default or custom sections.
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

    const newProduct: Product = {
      id,
      name: body.name,
      slug,
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
      rating: 4.8,
      reviewsCount: 12,
      sections,
    };

    const cache = getProductCache();
    cache.set(id, newProduct);
    cache.set(slug, newProduct);

    // Persist to PostgreSQL if available
    try {
      await queryPostgres(
        `INSERT INTO products (id, name, slug, description, category_id, brand_id, selling_price, mrp, unit, status, publish_status, thumbnail, images, sections, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())`,
        [
          id,
          newProduct.name,
          slug,
          newProduct.description,
          newProduct.categoryId,
          newProduct.brandId,
          newProduct.sellingPrice,
          newProduct.mrp,
          newProduct.unit,
          newProduct.status,
          newProduct.publishStatus,
          newProduct.thumbnail,
          JSON.stringify(newProduct.images || []),
          JSON.stringify(sections),
        ]
      );
    } catch (_) {}

    await logAuditEvent({
      userId: adminUid,
      userRole: role,
      action: 'PRODUCT_CREATE_DYNAMIC',
      entityType: 'PRODUCT',
      entityId: id,
      details: { productName: newProduct.name, sectionCount: sections.length },
    });

    return NextResponse.json({
      success: true,
      message: 'Product created successfully.',
      data: newProduct,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to create product' },
      { status: 500 }
    );
  }
}
