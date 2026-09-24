import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool, getPostgresPoolStats, categorizeDbError } from '@/lib/postgres';
import { INITIAL_PRODUCTS } from '@/lib/mockData';
import { Product, ProductVariant } from '@/types';
import { filterPurchasableProducts } from '@/lib/recommendationsEngine';

export const revalidate = 30; // 30s cache revalidation

/**
 * GET /api/products/discover
 * High-performance continuous catalog-discovery endpoint.
 *
 * Performance Architecture:
 * - Uses `limit + 1` cursor-less pagination: avoids heavy, unindexed COUNT(*) scans.
 * - Optional `includeTotal=true`: executes COUNT only when explicitly requested.
 * - Parameterized array exclusion (`ANY($1::varchar[])`) with cap of 100 items.
 * - Strict PostgreSQL statement/query timeout (3500ms max).
 * - Instant in-memory static catalog fallback if PostgreSQL is temporarily slow or offline.
 * - Structured request duration & connection pool observability logging.
 */
export async function GET(request: NextRequest) {
  const reqStart = Date.now();
  const requestId = 'disc_' + Math.random().toString(36).slice(2, 9);

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '12', 10)));
    const includeTotal = searchParams.get('includeTotal') === 'true' || searchParams.get('includeCount') === 'true';
    const excludeParam = searchParams.get('exclude') || '';
    const cursorParam = searchParams.get('cursor') || '';
    const categoryId = searchParams.get('category') || searchParams.get('categoryId') || '';
    const brandId = searchParams.get('brand') || searchParams.get('brandId') || '';
    const search = searchParams.get('search') || searchParams.get('q') || '';

    // Decode cursor if present
    let cursorData: { createdAt: string; id: string } | null = null;
    if (cursorParam) {
      try {
        const decoded = Buffer.from(cursorParam, 'base64').toString('utf-8');
        cursorData = JSON.parse(decoded);
      } catch {
        cursorData = null;
      }
    }

    // Sanitize and cap exclusion list to prevent oversized SQL parameters
    const rawExcluded = excludeParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const excludedIds = Array.from(new Set(rawExcluded)).slice(0, 100);

    const offset = cursorData ? 0 : (page - 1) * limit;
    // Fetch limit + 1 to determine hasMore without running an expensive full-table COUNT(*)
    const fetchLimit = limit + 1;

    // 1. Try PostgreSQL Database with limit + 1 pagination
    if (process.env.NODE_ENV !== 'test') {
      try {
        const pool = getPostgresPool();
        const dbQueryStart = Date.now();

        const whereConditions: string[] = [
          `(p.status IS NULL OR LOWER(p.status) NOT IN ('inactive', 'discontinued'))`,
        ];
        const queryParams: any[] = [];

        if (excludedIds.length > 0) {
          queryParams.push(excludedIds);
          const idx = queryParams.length;
          whereConditions.push(
            `NOT (p.id = ANY($${idx}::varchar[]) OR (p.slug IS NOT NULL AND p.slug = ANY($${idx}::varchar[])))`
          );
        }

        if (categoryId) {
          queryParams.push(categoryId);
          const idx = queryParams.length;
          whereConditions.push(`(p.category_id = $${idx} OR p.subcategory_id = $${idx})`);
        }

        if (brandId) {
          queryParams.push(brandId);
          const idx = queryParams.length;
          whereConditions.push(`p.brand_id = $${idx}`);
        }

        if (search.trim()) {
          queryParams.push(`%${search.trim().toLowerCase()}%`);
          const idx = queryParams.length;
          whereConditions.push(`(LOWER(p.name) LIKE $${idx} OR LOWER(COALESCE(p.description, '')) LIKE $${idx})`);
        }

        if (cursorData?.createdAt && cursorData?.id) {
          queryParams.push(cursorData.createdAt);
          const cIdx1 = queryParams.length;
          queryParams.push(cursorData.id);
          const cIdx2 = queryParams.length;
          whereConditions.push(`(p.created_at, p.id) < ($${cIdx1}::timestamptz, $${cIdx2})`);
        }

        const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

        // Query limit + 1 records
        queryParams.push(fetchLimit);
        const limitParamIdx = queryParams.length;
        let offsetClause = '';
        if (!cursorData) {
          queryParams.push(offset);
          const offsetParamIdx = queryParams.length;
          offsetClause = `OFFSET $${offsetParamIdx}`;
        }

        const prodQuery = `
          SELECT 
            p.id,
            p.category_id as "categoryId",
            p.subcategory_id as "subcategoryId",
            p.brand_id as "brandId",
            p.sku,
            p.barcode,
            p.name,
            p.slug,
            p.description,
            p.unit,
            p.mrp,
            p.selling_price as "sellingPrice",
            p.stock,
            p.status,
            p.thumbnail_url as thumbnail,
            p.is_featured as "isFeatured",
            p.created_at as "createdAt"
          FROM products p
          ${whereClause}
          ORDER BY 
            CASE WHEN COALESCE(p.stock, 0) > 0 THEN 0 ELSE 1 END,
            p.is_featured DESC,
            p.created_at DESC,
            p.id DESC
          LIMIT $${limitParamIdx} ${offsetClause}
        `;

        const prodRes = await pool.query(prodQuery, queryParams);

        const prodQueryDuration = Date.now() - dbQueryStart;

        // If records were found
        if (prodRes.rows.length > 0) {
          const hasMore = prodRes.rows.length > limit;
          const returnedRows = hasMore ? prodRes.rows.slice(0, limit) : prodRes.rows;
          const productIds = returnedRows.map((r: any) => r.id);

          // Fetch variants for enriched pricing
          const varStart = Date.now();
          const varRes = await pool.query(
            `
              SELECT 
                id,
                product_id as "productId",
                variant_name as "variantName",
                quantity_value as "quantityValue",
                quantity_unit as "quantityUnit",
                quantity_unit as unit,
                selling_price as "sellingPrice",
                selling_price as price,
                mrp,
                stock_quantity as "stockQuantity",
                stock_quantity as stock,
                is_active as "isActive",
                is_default as "isDefault",
                display_order as "displayOrder"
              FROM product_variants
              WHERE product_id = ANY($1::varchar[])
              ORDER BY display_order ASC, created_at ASC;
            `,
            [productIds]
          );
          const varDuration = Date.now() - varStart;

          const variantsByProdId: Record<string, ProductVariant[]> = {};
          for (const row of varRes.rows as any[]) {
            if (!variantsByProdId[row.productId]) {
              variantsByProdId[row.productId] = [];
            }
            variantsByProdId[row.productId].push({
              ...row,
              sellingPrice: Number(row.sellingPrice),
              price: Number(row.sellingPrice),
              mrp: Number(row.mrp),
              stockQuantity: Number(row.stockQuantity) || 0,
              stock: Number(row.stockQuantity) || 0,
            });
          }

          const enrichedProducts: Product[] = returnedRows.map((p: any) => {
            const variants = variantsByProdId[p.id] || [];
            const lowestVariantPrice =
              variants.length > 0
                ? Math.min(...variants.filter((v) => v.isActive).map((v) => v.sellingPrice))
                : Number(p.sellingPrice);

            return {
              ...p,
              sellingPrice: lowestVariantPrice || Number(p.sellingPrice) || 0,
              mrp: Number(p.mrp) || Number(p.sellingPrice) || 0,
              stock: Number(p.stock) || 0,
              rating: 4.8,
              reviewsCount: 124,
              variants,
            };
          });

          // Optional COUNT(*) query ONLY when client requested includeTotal
          let totalCount: number = hasMore ? page * limit + 1 : offset + enrichedProducts.length;
          let countDuration = 0;
          if (includeTotal) {
            const countStart = Date.now();
            try {
              // Extract params excluding limit & offset
              const countParams = queryParams.slice(0, queryParams.length - 2);
              const countRes = await pool.query(
                `SELECT COUNT(*)::int as total FROM products p ${whereClause}`,
                countParams
              );
              totalCount = parseInt(countRes.rows[0]?.total || '0', 10);
            } catch (countErr) {
              console.warn('[DISCOVER] Optional COUNT(*) skipped due to query timeout');
            }
            countDuration = Date.now() - countStart;
          }

          const totalReqTime = Date.now() - reqStart;
          const stats = getPostgresPoolStats();

          // Structured Observability Logging (Phase 9)
          if (process.env.NODE_ENV === 'development' || totalReqTime > 300) {
            console.log(
              `[DISCOVER] DISCOVER_SOURCE=postgres req=${requestId} page=${page} limit=${limit} excl=${excludedIds.length} prodMs=${prodQueryDuration} varMs=${varDuration} countMs=${countDuration} totalMs=${totalReqTime} poolTotal=${stats.totalCount} poolIdle=${stats.idleCount} poolWait=${stats.waitingCount} hasNext=${hasMore}`
            );
          }

          const lastItem = enrichedProducts[enrichedProducts.length - 1];
          const nextCursor =
            hasMore && lastItem?.createdAt && lastItem?.id
              ? Buffer.from(JSON.stringify({ createdAt: lastItem.createdAt, id: lastItem.id })).toString('base64')
              : null;

          const pagination = {
            page,
            limit,
            total: totalCount,
            hasMore,
            nextPage: hasMore ? page + 1 : null,
            nextCursor,
          };

          const response = NextResponse.json({
            success: true,
            source: 'postgres',
            postgres_available: true,
            products: enrichedProducts,
            page,
            limit,
            total: totalCount,
            hasMore,
            nextPage: pagination.nextPage,
            nextCursor,
            pagination,
          });

          response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
          response.headers.set('X-Data-Source', 'postgres');
          return response;
        }
      } catch (pgErr: any) {
        const { category, message } = categorizeDbError(pgErr);
        console.warn(`⚠️ [DISCOVER Postgres Fallback] [${category}]: ${message}`);
      }
    }

    // 2. High-speed In-Memory Catalog Fallback
    // Never blocks or triggers hanging background Firestore connections on server routes
    const fallbackStart = Date.now();
    let allProducts: Product[] = INITIAL_PRODUCTS;

    // Filter purchasable
    let filtered = filterPurchasableProducts(allProducts);

    // Apply exclusions
    if (excludedIds.length > 0) {
      const excludeSet = new Set(excludedIds);
      filtered = filtered.filter((p) => !excludeSet.has(p.id) && (!p.slug || !excludeSet.has(p.slug)));
    }

    // Filter category
    if (categoryId) {
      filtered = filtered.filter((p) => p.categoryId === categoryId || p.subcategoryId === categoryId);
    }

    // Filter brand
    if (brandId) {
      filtered = filtered.filter((p) => p.brandId === brandId);
    }

    // Filter search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(
        (p) => p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q))
      );
    }

    // Sort: in-stock first, featured first, then rating
    filtered.sort((a, b) => {
      const stockA = (a.stock ?? 0) > 0 ? 1 : 0;
      const stockB = (b.stock ?? 0) > 0 ? 1 : 0;
      if (stockB !== stockA) return stockB - stockA;
      const featA = a.isFeatured ? 1 : 0;
      const featB = b.isFeatured ? 1 : 0;
      if (featB !== featA) return featB - featA;
      return (b.rating ?? 4.5) - (a.rating ?? 4.5);
    });

    const total = filtered.length;
    const paginatedProducts = filtered.slice(offset, offset + limit);
    const hasMore = offset + paginatedProducts.length < total;
    const lastFallbackItem = paginatedProducts[paginatedProducts.length - 1];
    const nextCursor =
      hasMore && lastFallbackItem
        ? Buffer.from(JSON.stringify({ createdAt: new Date().toISOString(), id: lastFallbackItem.id })).toString(
            'base64'
          )
        : null;

    const pagination = {
      page,
      limit,
      total,
      hasMore,
      nextPage: hasMore ? page + 1 : null,
      nextCursor,
    };

    const totalReqTime = Date.now() - reqStart;
    const stats = getPostgresPoolStats();

    if (process.env.NODE_ENV === 'development' || totalReqTime > 200) {
      console.log(
        `[DISCOVER] DISCOVER_SOURCE=fallback req=${requestId} page=${page} limit=${limit} excl=${excludedIds.length} fallbackMs=${Date.now() - fallbackStart} totalMs=${totalReqTime} poolTotal=${stats.totalCount} poolIdle=${stats.idleCount} poolWait=${stats.waitingCount} hasNext=${hasMore}`
      );
    }

    const response = NextResponse.json({
      success: true,
      source: 'fallback',
      postgres_available: false,
      products: paginatedProducts,
      page,
      limit,
      total,
      hasMore,
      nextPage: pagination.nextPage,
      nextCursor,
      pagination,
    });

    response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
    response.headers.set('X-Data-Source', 'in-memory-fallback');
    return response;
  } catch (error: any) {
    const { category, message } = categorizeDbError(error);
    console.error(`❌ [DISCOVER Fatal] [${category}]:`, message);
    return NextResponse.json(
      { success: false, error: 'Failed to discover products', errorCategory: category },
      { status: 500 }
    );
  }
}
