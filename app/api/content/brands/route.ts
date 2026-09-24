import { NextRequest, NextResponse } from 'next/server';
import { Brand } from '@/types';
import { INITIAL_BRANDS } from '@/lib/mockData';
import { getPostgresPool } from '@/lib/postgres';
import { logAuditEvent } from '@/lib/auditLogger';

declare global {
  // eslint-disable-next-line no-var
  var _pkBrandContentCache: Map<string, Brand> | undefined;
}

function getBrandCache(): Map<string, Brand> {
  if (!globalThis._pkBrandContentCache) {
    globalThis._pkBrandContentCache = new Map<string, Brand>();
    INITIAL_BRANDS.forEach((b, idx) => {
      globalThis._pkBrandContentCache!.set(b.id, {
        ...b,
        displayOrder: b.displayOrder ?? idx + 1,
        isActive: b.isActive !== false,
      });
    });
  }
  return globalThis._pkBrandContentCache;
}

/**
 * GET /api/content/brands
 * Returns active brands sorted by displayOrder.
 * Query params:
 *   - includeInactive=true  → admin only, returns all brands
 *   - categoryId=<id>       → filter brands associated with given category
 *   - search=<q>            → partial name/slug match
 *   - withProductCount=true → include product count per brand
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const role = req.headers.get('x-pk-role') || 'customer';
    const isAdmin = role === 'admin' || role === 'store_manager';
    const includeInactive = searchParams.get('includeInactive') === 'true' && isAdmin;
    const categoryId = searchParams.get('categoryId');
    const search = searchParams.get('search');

    let brands: Brand[] = [];
    let usedDB = false;

    try {
      const pool = getPostgresPool();
      if (pool) {
        let query = `
          SELECT
            b.id,
            b.name,
            b.slug,
            b.description,
            COALESCE(b.logo_url, '') AS logo,
            COALESCE(b.logo_url, '') AS "logoUrl",
            COALESCE(b.banner_url, '') AS banner,
            COALESCE(b.banner_url, '') AS "bannerUrl",
            b.is_active AS "isActive",
            COALESCE(b.display_order, 0) AS "displayOrder",
            b.seo_title AS "seoTitle",
            b.seo_description AS "seoDescription",
            b.created_at AS "createdAt",
            b.updated_at AS "updatedAt",
            COALESCE(
              (SELECT ARRAY_AGG(bc.category_id) FROM brand_categories bc WHERE bc.brand_id = b.id),
              ARRAY[]::varchar[]
            ) AS "categoryIds",
            (
              SELECT COUNT(*)::int FROM products p WHERE p.brand_id = b.id AND p.status = 'active'
            ) AS "activeProductCount",
            (
              SELECT COUNT(*)::int FROM products p WHERE p.brand_id = b.id
            ) AS "productCount"
          FROM brands b
          WHERE 1=1
        `;
        const values: any[] = [];
        let p = 1;

        if (!includeInactive) {
          query += ` AND b.is_active = true`;
        }
        if (search) {
          query += ` AND (b.name ILIKE $${p} OR b.slug ILIKE $${p})`;
          values.push(`%${search}%`);
          p++;
        }
        if (categoryId) {
          query += ` AND EXISTS (
            SELECT 1 FROM brand_categories bc2
            WHERE bc2.brand_id = b.id AND bc2.category_id = $${p}
          )`;
          values.push(categoryId);
          p++;
        }
        query += ` ORDER BY b.display_order ASC, b.name ASC`;

        const result = await pool.query(query, values);
        if (result.rows.length > 0) {
          brands = result.rows;
          usedDB = true;
        }
      }
    } catch (_) {}

    if (!usedDB) {
      const cache = getBrandCache();
      brands = Array.from(cache.values());

      if (!includeInactive) {
        brands = brands.filter((b) => b.isActive !== false);
      }
      if (search) {
        const q = search.toLowerCase();
        brands = brands.filter(
          (b) => b.name.toLowerCase().includes(q) || b.slug.toLowerCase().includes(q)
        );
      }
      if (categoryId) {
        brands = brands.filter((b) => b.categoryIds?.includes(categoryId));
      }
      brands.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
    }

    return NextResponse.json(
      {
        success: true,
        count: brands.length,
        data: brands,
      },
      {
        headers: {
          'Cache-Control': isAdmin
            ? 'no-cache, no-store'
            : 'public, s-maxage=60, stale-while-revalidate=120',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch brands' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/content/brands
 * Admin endpoint to create or update a brand.
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
    if (!body?.name?.trim() || !body?.slug?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Brand name and slug are required.' },
        { status: 400 }
      );
    }

    const id = body.id || `brand-${Date.now()}`;
    const cache = getBrandCache();
    const existing = cache.get(id);

    const brand: Brand = {
      ...existing,
      ...body,
      id,
      name: body.name.trim(),
      slug: body.slug.trim(),
      logoUrl: body.logoUrl || body.logo || existing?.logoUrl || '',
      logo: body.logo || body.logoUrl || existing?.logo || '',
      bannerUrl: body.bannerUrl || body.banner || existing?.bannerUrl || '',
      banner: body.banner || body.bannerUrl || existing?.banner || '',
      isActive: body.isActive !== false,
      displayOrder: Number(body.displayOrder) || existing?.displayOrder || cache.size + 1,
      updatedAt: new Date().toISOString(),
      createdAt: existing?.createdAt || new Date().toISOString(),
    };

    cache.set(id, brand);

    try {
      const pool = getPostgresPool();
      if (pool) {
        await pool.query(
          `INSERT INTO brands (id, name, slug, description, logo_url, banner_url, is_active, display_order, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             slug = EXCLUDED.slug,
             description = EXCLUDED.description,
             logo_url = EXCLUDED.logo_url,
             banner_url = EXCLUDED.banner_url,
             is_active = EXCLUDED.is_active,
             display_order = EXCLUDED.display_order,
             updated_at = NOW()`,
          [
            brand.id,
            brand.name,
            brand.slug,
            brand.description || '',
            brand.logoUrl || '',
            brand.bannerUrl || '',
            brand.isActive,
            brand.displayOrder,
          ]
        );
      }
    } catch (_) {}

    await logAuditEvent({
      userId: adminUid,
      userRole: role,
      action: 'BRAND_SAVE',
      entityType: 'BRAND',
      entityId: id,
      details: { name: brand.name, slug: brand.slug, isActive: brand.isActive },
    });

    return NextResponse.json({ success: true, message: 'Brand saved.', data: brand });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save brand' },
      { status: 500 }
    );
  }
}
