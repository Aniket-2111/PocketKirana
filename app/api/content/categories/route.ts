import { NextRequest, NextResponse } from 'next/server';
import { Category } from '@/types';
import { INITIAL_CATEGORIES } from '@/lib/mockData';
import { getPostgresPool } from '@/lib/postgres';
import { logAuditEvent } from '@/lib/auditLogger';

declare global {
  // eslint-disable-next-line no-var
  var _pkCategoryCache: Map<string, Category> | undefined;
}

function getCategoryCache(): Map<string, Category> {
  if (!globalThis._pkCategoryCache) {
    globalThis._pkCategoryCache = new Map<string, Category>();
    // Seed from mock data (top-level categories only, no subcats mixed)
    INITIAL_CATEGORIES.forEach((c, idx) => {
      globalThis._pkCategoryCache!.set(c.id, {
        ...c,
        sortOrder: c.sortOrder ?? idx + 1,
        displayOrder: c.displayOrder ?? idx + 1,
        isActive: c.isActive !== false,
      });
    });
  }
  return globalThis._pkCategoryCache;
}

/**
 * GET /api/content/categories
 * Returns active categories sorted by sortOrder.
 * Query params:
 *   - includeInactive=true  → admin view, returns all
 *   - parentId=<id>         → returns subcategories under given parent
 *   - topLevel=true         → only top-level categories (no parentId)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const role = req.headers.get('x-pk-role') || 'customer';
    const isAdmin = role === 'admin' || role === 'store_manager';
    const includeInactive = searchParams.get('includeInactive') === 'true' && isAdmin;
    const parentId = searchParams.get('parentId');
    const topLevel = searchParams.get('topLevel') === 'true';

    // Try PostgreSQL first
    let categories: Category[] = [];
    let usedDB = false;
    try {
      const pool = getPostgresPool();
      if (pool) {
        let query = `
          SELECT
            c.id,
            c.name,
            c.slug,
            c.description,
            c.image,
            c.banner_image AS "bannerImage",
            c.is_active AS "isActive",
            c.parent_id AS "parentId",
            COALESCE(c.sort_order, 0) AS "sortOrder",
            COALESCE(c.display_order, 0) AS "displayOrder",
            c.meta_title AS "metaTitle",
            c.meta_description AS "metaDescription",
            c.created_at AS "createdAt",
            c.updated_at AS "updatedAt"
          FROM categories c
          WHERE 1=1
        `;
        const values: any[] = [];
        let p = 1;

        if (!includeInactive) {
          query += ` AND c.is_active = true`;
        }
        if (parentId) {
          query += ` AND c.parent_id = $${p++}`;
          values.push(parentId);
        } else if (topLevel) {
          query += ` AND c.parent_id IS NULL`;
        }
        query += ` ORDER BY c.sort_order ASC, c.display_order ASC, c.name ASC`;

        const result = await pool.query(query, values);
        if (result.rows.length > 0) {
          categories = result.rows;
          usedDB = true;
        }
      }
    } catch (_) {}

    // Fallback to in-memory cache
    if (!usedDB) {
      const cache = getCategoryCache();
      categories = Array.from(cache.values());

      if (!includeInactive) {
        categories = categories.filter((c) => c.isActive !== false);
      }
      if (parentId) {
        categories = categories.filter((c) => (c as any).parentId === parentId);
      } else if (topLevel) {
        categories = categories.filter((c) => !(c as any).parentId);
      }

      categories.sort((a, b) => {
        const sa = a.sortOrder ?? a.displayOrder ?? 0;
        const sb = b.sortOrder ?? b.displayOrder ?? 0;
        return sa - sb;
      });
    }

    return NextResponse.json(
      {
        success: true,
        count: categories.length,
        data: categories,
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
      { success: false, error: error.message || 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/content/categories
 * Admin endpoint to create or update a category.
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
        { success: false, error: 'Category name and slug are required.' },
        { status: 400 }
      );
    }

    const id = body.id || `cat-${Date.now()}`;
    const cache = getCategoryCache();
    const existing = cache.get(id);

    const category: Category = {
      ...existing,
      ...body,
      id,
      name: body.name.trim(),
      slug: body.slug.trim(),
      isActive: body.isActive !== false,
      sortOrder: Number(body.sortOrder) || existing?.sortOrder || cache.size + 1,
      displayOrder: Number(body.displayOrder) || existing?.displayOrder || cache.size + 1,
      updatedAt: new Date().toISOString(),
      createdAt: existing?.createdAt || new Date().toISOString(),
    };

    cache.set(id, category);

    try {
      const pool = getPostgresPool();
      if (pool) {
        await pool.query(
          `INSERT INTO categories (id, name, slug, description, image, is_active, sort_order, display_order, parent_id, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             slug = EXCLUDED.slug,
             description = EXCLUDED.description,
             image = EXCLUDED.image,
             is_active = EXCLUDED.is_active,
             sort_order = EXCLUDED.sort_order,
             display_order = EXCLUDED.display_order,
             parent_id = EXCLUDED.parent_id,
             updated_at = NOW()`,
          [
            category.id,
            category.name,
            category.slug,
            category.description || '',
            category.image || '',
            category.isActive,
            category.sortOrder,
            category.displayOrder,
            (category as any).parentId || null,
          ]
        );
      }
    } catch (_) {}

    await logAuditEvent({
      userId: adminUid,
      userRole: role,
      action: 'CATEGORY_SAVE',
      entityType: 'CATEGORY',
      entityId: id,
      details: { name: category.name, slug: category.slug, isActive: category.isActive },
    });

    return NextResponse.json({ success: true, message: 'Category saved.', data: category });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save category' },
      { status: 500 }
    );
  }
}
