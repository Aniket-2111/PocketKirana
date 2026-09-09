import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres';
import { Brand } from '@/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/brands/[id]
 * Fetch brand details, category mappings, and products list.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const pool = getPostgresPool();

    const query = `
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
      WHERE b.id = $1 OR b.slug = $1
      LIMIT 1;
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Brand not found' },
        { status: 404 }
      );
    }

    const row = result.rows[0];

    // Fetch assigned categories objects
    const catQuery = `
      SELECT c.id, c.name, c.slug, c.parent_id AS "parentId"
      FROM categories c
      JOIN brand_categories bc ON bc.category_id = c.id
      WHERE bc.brand_id = $1
      ORDER BY c.display_order ASC;
    `;
    const catRes = await pool.query(catQuery, [row.id]);

    // Fetch products belonging to this brand
    const prodQuery = `
      SELECT 
        p.id, p.name, p.slug, p.unit, p.mrp, p.selling_price AS "sellingPrice",
        p.thumbnail_url AS thumbnail, p.status, p.category_id AS "categoryId",
        p.subcategory_id AS "subcategoryId"
      FROM products p
      WHERE p.brand_id = $1
      ORDER BY p.name ASC;
    `;
    const prodRes = await pool.query(prodQuery, [row.id]);

    const brand: Brand = {
      ...row,
      status: row.isActive ? 'active' : 'inactive',
      displayOrder: Number(row.displayOrder) || 0,
      productCount: Number(row.productCount) || 0,
      activeProductCount: Number(row.activeProductCount) || 0,
      categories: catRes.rows,
    };

    return NextResponse.json({
      success: true,
      brand,
      products: prodRes.rows,
    });
  } catch (error: any) {
    console.error('Error fetching brand details:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch brand' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/brands/[id]
 * Updates a brand's metadata, logo, banner, and category associations.
 */
export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const pool = getPostgresPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const checkRes = await client.query('SELECT * FROM brands WHERE id = $1', [id]);
      if (checkRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { success: false, error: 'Brand not found' },
          { status: 404 }
        );
      }

      const current = checkRes.rows[0];

      const finalName = body.name !== undefined ? body.name.trim() : current.name;
      const finalSlug = body.slug !== undefined ? body.slug.trim() : current.slug;
      const finalDesc = body.description !== undefined ? body.description : current.description;
      const finalLogo = body.logoUrl !== undefined ? body.logoUrl : (body.logo !== undefined ? body.logo : current.logo_url);
      const finalBanner = body.bannerUrl !== undefined ? body.bannerUrl : (body.banner !== undefined ? body.banner : current.banner_url);
      const finalIsActive = body.isActive !== undefined ? Boolean(body.isActive) : (body.status !== undefined ? (body.status === 'active' || body.status === true) : current.is_active);
      const finalDisplayOrder = body.displayOrder !== undefined ? Number(body.displayOrder) : current.display_order;
      const finalSeoTitle = body.seoTitle !== undefined ? body.seoTitle : current.seo_title;
      const finalSeoDesc = body.seoDescription !== undefined ? body.seoDescription : current.seo_description;
      const finalSeoKeywords = body.seoKeywords !== undefined ? body.seoKeywords : current.seo_keywords;

      const updateQuery = `
        UPDATE brands SET
          name = $1,
          slug = $2,
          description = $3,
          logo_url = $4,
          banner_url = $5,
          is_active = $6,
          display_order = $7,
          seo_title = $8,
          seo_description = $9,
          seo_keywords = $10,
          updated_at = NOW()
        WHERE id = $11
        RETURNING 
          id, name, slug, description, logo_url AS "logoUrl", banner_url AS "bannerUrl",
          is_active AS "isActive", display_order AS "displayOrder",
          seo_title AS "seoTitle", seo_description AS "seoDescription",
          seo_keywords AS "seoKeywords", created_at AS "createdAt", updated_at AS "updatedAt";
      `;

      const updateRes = await client.query(updateQuery, [
        finalName,
        finalSlug,
        finalDesc,
        finalLogo,
        finalBanner,
        finalIsActive,
        finalDisplayOrder,
        finalSeoTitle,
        finalSeoDesc,
        finalSeoKeywords,
        id,
      ]);

      const updatedBrand = updateRes.rows[0];

      // Update category mappings if supplied
      if (Array.isArray(body.categoryIds)) {
        await client.query('DELETE FROM brand_categories WHERE brand_id = $1', [id]);
        for (const catId of body.categoryIds) {
          const jId = `bc_${id}_${catId}`;
          await client.query(
            `INSERT INTO brand_categories (id, brand_id, category_id, created_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (brand_id, category_id) DO NOTHING;`,
            [jId, id, catId]
          );
        }
      }

      // Update subcategory mappings if supplied
      if (Array.isArray(body.subcategoryIds)) {
        await client.query('DELETE FROM brand_subcategories WHERE brand_id = $1', [id]);
        for (const subId of body.subcategoryIds) {
          const jId = `bsc_${id}_${subId}`;
          await client.query(
            `INSERT INTO brand_subcategories (id, brand_id, subcategory_id, created_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (brand_id, subcategory_id) DO NOTHING;`,
            [jId, id, subId]
          );
        }
      }

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        brand: {
          ...updatedBrand,
          logo: updatedBrand.logoUrl,
          banner: updatedBrand.bannerUrl,
          status: updatedBrand.isActive ? 'active' : 'inactive',
          categoryIds: body.categoryIds || current.categoryIds,
          subcategoryIds: body.subcategoryIds || current.subcategoryIds,
        },
        message: `Brand "${finalName}" updated successfully`,
      });
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Error updating brand:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update brand' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/brands/[id]
 * Safe deletion: Checks for products linked to this brand.
 * Query params:
 * - reassignBrandId: Optional brand ID to reassign products to before deletion.
 * - forceDeactivate: If true, deactivates the brand instead of raw deletion.
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const reassignBrandId = searchParams.get('reassignBrandId');
    const forceDeactivate = searchParams.get('forceDeactivate') === 'true';

    const pool = getPostgresPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const checkRes = await client.query('SELECT * FROM brands WHERE id = $1', [id]);
      if (checkRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { success: false, error: 'Brand not found' },
          { status: 404 }
        );
      }

      const brand = checkRes.rows[0];

      // Check how many products are linked
      const prodCheck = await client.query('SELECT COUNT(*) AS count FROM products WHERE brand_id = $1', [id]);
      const productCount = parseInt(prodCheck.rows[0].count || '0', 10);

      if (productCount > 0 && !reassignBrandId && !forceDeactivate) {
        await client.query('ROLLBACK');
        return NextResponse.json({
          success: false,
          hasProducts: true,
          productCount,
          error: `Brand "${brand.name}" has ${productCount} active products. Please reassign products or deactivate the brand instead.`,
          options: ['reassign', 'deactivate', 'cancel'],
        }, { status: 409 });
      }

      // If user chose to deactivate
      if (forceDeactivate) {
        await client.query('UPDATE brands SET is_active = false, updated_at = NOW() WHERE id = $1', [id]);
        await client.query('COMMIT');
        return NextResponse.json({
          success: true,
          deactivated: true,
          message: `Brand "${brand.name}" has been deactivated safely. All historical products preserved.`,
        });
      }

      // If user provided a reassignment target
      if (reassignBrandId) {
        await client.query('UPDATE products SET brand_id = $1 WHERE brand_id = $2', [reassignBrandId, id]);
      } else if (productCount > 0) {
        // Unlink brand (set null)
        await client.query('UPDATE products SET brand_id = NULL WHERE brand_id = $1', [id]);
      }

      // Delete brand categories
      await client.query('DELETE FROM brand_categories WHERE brand_id = $1', [id]);
      await client.query('DELETE FROM brand_subcategories WHERE brand_id = $1', [id]);

      // Delete brand
      await client.query('DELETE FROM brands WHERE id = $1', [id]);

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        deleted: true,
        message: `Brand "${brand.name}" deleted successfully.`,
      });
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Error deleting brand:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete brand' },
      { status: 500 }
    );
  }
}
