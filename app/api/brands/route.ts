import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres';
import { Brand } from '@/types';

export const revalidate = 30; // 30s cache

/**
 * GET /api/brands
 * Returns brands with dynamic category mapping and product counts.
 * Optional query params:
 * - categoryId: Filter brands belonging to (or having products in) this category
 * - subcategoryId: Filter brands for a specific subcategory
 * - includeInactive: 'true' for admin to see inactive brands
 * - search: Filter brands by name / slug
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const subcategoryId = searchParams.get('subcategoryId');
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const search = searchParams.get('search');

    const pool = getPostgresPool();

    // Query all brands with aggregated categories and product counts
    let query = `
      SELECT 
        b.id,
        b.name,
        b.slug,
        b.description,
        COALESCE(b.logo_url, '') AS "logoUrl",
        COALESCE(b.logo_url, '') AS "logo",
        COALESCE(b.banner_url, '') AS "bannerUrl",
        COALESCE(b.banner_url, '') AS "banner",
        b.is_active AS "isActive",
        b.display_order AS "displayOrder",
        b.seo_title AS "seoTitle",
        b.seo_description AS "seoDescription",
        b.seo_keywords AS "seoKeywords",
        b.meta_image AS "metaImage",
        b.created_at AS "createdAt",
        b.updated_at AS "updatedAt",
        COALESCE(
          (SELECT ARRAY_AGG(bc.category_id) FROM brand_categories bc WHERE bc.brand_id = b.id),
          ARRAY[]::varchar[]
        ) AS "categoryIds",
        COALESCE(
          (SELECT ARRAY_AGG(bsc.subcategory_id) FROM brand_subcategories bsc WHERE bsc.brand_id = b.id),
          ARRAY[]::varchar[]
        ) AS "subcategoryIds",
        (
          SELECT COUNT(*) 
          FROM products p 
          WHERE p.brand_id = b.id
        )::int AS "productCount",
        (
          SELECT COUNT(*) 
          FROM products p 
          WHERE p.brand_id = b.id AND p.status = 'active'
        )::int AS "activeProductCount"
      FROM brands b
      WHERE 1=1
    `;

    const values: any[] = [];
    let paramIndex = 1;

    if (!includeInactive) {
      query += ` AND b.is_active = true`;
    }

    if (search) {
      query += ` AND (b.name ILIKE $${paramIndex} OR b.slug ILIKE $${paramIndex})`;
      values.push(`%${search}%`);
      paramIndex++;
    }

    if (categoryId) {
      // Brand is assigned to category OR has active products in this category
      query += ` AND (
        EXISTS (SELECT 1 FROM brand_categories bc WHERE bc.brand_id = b.id AND bc.category_id = $${paramIndex})
        OR EXISTS (SELECT 1 FROM products p WHERE p.brand_id = b.id AND (p.category_id = $${paramIndex} OR p.subcategory_id = $${paramIndex}))
      )`;
      values.push(categoryId);
      paramIndex++;
    }

    if (subcategoryId) {
      query += ` AND (
        EXISTS (SELECT 1 FROM brand_subcategories bsc WHERE bsc.brand_id = b.id AND bsc.subcategory_id = $${paramIndex})
        OR EXISTS (SELECT 1 FROM products p WHERE p.brand_id = b.id AND p.subcategory_id = $${paramIndex})
      )`;
      values.push(subcategoryId);
      paramIndex++;
    }

    query += ` ORDER BY b.display_order ASC, b.name ASC;`;

    const result = await pool.query(query, values);

    const brands: Brand[] = result.rows.map((row) => ({
      ...row,
      status: row.isActive ? 'active' : 'inactive',
      displayOrder: Number(row.displayOrder) || 0,
      productCount: Number(row.productCount) || 0,
      activeProductCount: Number(row.activeProductCount) || 0,
    }));

    const response = NextResponse.json({
      success: true,
      data: brands,
      brands,
      count: brands.length,
    });

    response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
    return response;
  } catch (error: any) {
    console.error('Error fetching brands:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch brands' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/brands
 * Create a new brand with category/subcategory associations.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      slug: customSlug,
      description,
      logoUrl,
      bannerUrl,
      isActive = true,
      displayOrder,
      categoryIds = [],
      subcategoryIds = [],
      seoTitle,
      seoDescription,
      seoKeywords,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Brand name is required' },
        { status: 400 }
      );
    }

    const brandName = name.trim();
    const slug = (customSlug || brandName).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const brandId = `brand-${slug}-${Date.now().toString().slice(-4)}`;

    const pool = getPostgresPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Check if slug is unique
      const existingSlug = await client.query('SELECT id FROM brands WHERE slug = $1', [slug]);
      let finalSlug = slug;
      if (existingSlug.rows.length > 0) {
        finalSlug = `${slug}-${Date.now().toString().slice(-4)}`;
      }

      // Determine display order
      let finalDisplayOrder = displayOrder;
      if (finalDisplayOrder === undefined) {
        const maxOrderRes = await client.query('SELECT COALESCE(MAX(display_order), 0) + 1 as next_order FROM brands');
        finalDisplayOrder = parseInt(maxOrderRes.rows[0].next_order, 10);
      }

      const insertBrandQuery = `
        INSERT INTO brands (
          id, name, slug, description, logo_url, banner_url, is_active,
          display_order, seo_title, seo_description, seo_keywords,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
        RETURNING 
          id, name, slug, description, logo_url AS "logoUrl", banner_url AS "bannerUrl",
          is_active AS "isActive", display_order AS "displayOrder",
          seo_title AS "seoTitle", seo_description AS "seoDescription",
          seo_keywords AS "seoKeywords", created_at AS "createdAt", updated_at AS "updatedAt";
      `;

      const brandRes = await client.query(insertBrandQuery, [
        brandId,
        brandName,
        finalSlug,
        description || null,
        logoUrl || null,
        bannerUrl || null,
        Boolean(isActive),
        finalDisplayOrder,
        seoTitle || `${brandName} Products Online | PocketKirana`,
        seoDescription || `Buy authentic ${brandName} products with fastest 15-minute delivery at best prices on PocketKirana.`,
        seoKeywords || `${brandName}, grocery, pocketkirana`,
      ]);

      const createdBrand = brandRes.rows[0];

      // Insert category mappings
      if (Array.isArray(categoryIds) && categoryIds.length > 0) {
        for (const catId of categoryIds) {
          const jId = `bc_${brandId}_${catId}`;
          await client.query(
            `INSERT INTO brand_categories (id, brand_id, category_id, created_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (brand_id, category_id) DO NOTHING;`,
            [jId, brandId, catId]
          );
        }
      }

      // Insert subcategory mappings
      if (Array.isArray(subcategoryIds) && subcategoryIds.length > 0) {
        for (const subId of subcategoryIds) {
          const jId = `bsc_${brandId}_${subId}`;
          await client.query(
            `INSERT INTO brand_subcategories (id, brand_id, subcategory_id, created_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (brand_id, subcategory_id) DO NOTHING;`,
            [jId, brandId, subId]
          );
        }
      }

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        brand: {
          ...createdBrand,
          logo: createdBrand.logoUrl,
          banner: createdBrand.bannerUrl,
          status: createdBrand.isActive ? 'active' : 'inactive',
          categoryIds,
          subcategoryIds,
          productCount: 0,
          activeProductCount: 0,
        },
        message: `Brand "${brandName}" created successfully`,
      });
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Error creating brand:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create brand' },
      { status: 500 }
    );
  }
}
