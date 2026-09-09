import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/categories/[id]
 * Fetch single category/subcategory details with child counts.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const pool = getPostgresPool();

    const query = `
      SELECT 
        c.id,
        c.parent_id AS "parentId",
        c.name,
        c.slug,
        c.description,
        COALESCE(c.image_url, c.image) AS "image",
        c.banner_image AS "bannerImage",
        c.display_order AS "displayOrder",
        c.display_order AS "sortOrder",
        c.is_active AS "isActive",
        c.meta_title AS "metaTitle",
        c.meta_description AS "metaDescription",
        c.created_at AS "createdAt",
        c.updated_at AS "updatedAt",
        (SELECT COUNT(*) FROM categories sub WHERE sub.parent_id = c.id) AS "subcategoriesCount",
        (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id OR p.subcategory_id = c.id) AS "productsCount"
      FROM categories c
      WHERE c.id = $1 OR c.slug = $1
      LIMIT 1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Category not found' },
        { status: 404 }
      );
    }

    const row = result.rows[0];
    const category = {
      ...row,
      subcategoriesCount: parseInt(row.subcategoriesCount || '0', 10),
      productsCount: parseInt(row.productsCount || '0', 10),
    };

    return NextResponse.json({ success: true, category });
  } catch (error: any) {
    console.error('Error fetching category details:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch category' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/categories/[id]
 * Updates category or subcategory properties.
 */
export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const {
      name,
      slug: customSlug,
      parentId,
      image,
      imageUrl,
      bannerImage,
      description,
      displayOrder,
      isActive,
      metaTitle,
      metaDescription,
    } = body;

    const pool = getPostgresPool();

    // Check if category exists
    const checkRes = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Category not found' },
        { status: 404 }
      );
    }

    const current = checkRes.rows[0];

    // Format slug if modified
    let finalSlug = current.slug;
    if (customSlug && customSlug.trim() !== current.slug) {
      finalSlug = customSlug
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');

      // Verify uniqueness excluding self
      const slugCheck = await pool.query(
        'SELECT id FROM categories WHERE slug = $1 AND id != $2',
        [finalSlug, id]
      );
      if (slugCheck.rows.length > 0) {
        finalSlug = `${finalSlug}-${Date.now().toString().slice(-4)}`;
      }
    } else if (name && !customSlug && name.trim() !== current.name) {
      // Auto update slug if name changed and no custom slug given
      finalSlug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
    }

    const finalName = name !== undefined ? name.trim() : current.name;
    const finalParentId =
      parentId !== undefined
        ? parentId && parentId !== 'root' && parentId !== 'null'
          ? parentId
          : null
        : current.parent_id;
    const finalImage = imageUrl || image || current.image_url || current.image;
    const finalBanner = bannerImage !== undefined ? bannerImage : current.banner_image;
    const finalDesc = description !== undefined ? description : current.description;
    const finalOrder = displayOrder !== undefined ? displayOrder : current.display_order;
    const finalStatus = isActive !== undefined ? Boolean(isActive) : current.is_active;
    const finalMetaTitle = metaTitle !== undefined ? metaTitle : current.meta_title;
    const finalMetaDesc = metaDescription !== undefined ? metaDescription : current.meta_description;

    // Prevent making a category its own parent
    if (finalParentId === id) {
      return NextResponse.json(
        { success: false, error: 'A category cannot be its own parent' },
        { status: 400 }
      );
    }

    const updateQuery = `
      UPDATE categories SET
        name = $1,
        slug = $2,
        parent_id = $3,
        image = $4,
        image_url = $5,
        banner_image = $6,
        description = $7,
        display_order = $8,
        is_active = $9,
        meta_title = $10,
        meta_description = $11,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $12
      RETURNING 
        id, parent_id AS "parentId", name, slug, description,
        image_url AS "image", banner_image AS "bannerImage", display_order AS "displayOrder",
        display_order AS "sortOrder", is_active AS "isActive", meta_title AS "metaTitle",
        meta_description AS "metaDescription", created_at AS "createdAt", updated_at AS "updatedAt"
    `;

    const updateRes = await pool.query(updateQuery, [
      finalName,
      finalSlug,
      finalParentId,
      finalImage,
      finalImage,
      finalBanner,
      finalDesc,
      finalOrder,
      finalStatus,
      finalMetaTitle,
      finalMetaDesc,
      id,
    ]);

    const updatedCategory = updateRes.rows[0];

    return NextResponse.json({
      success: true,
      category: updatedCategory,
      message: 'Category updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating category:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update category' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/categories/[id]
 * Safe deletion of category or subcategory with product reassignment.
 *
 * Query params / Body options:
 * - reassignCategoryId: Target category ID to move products/subcategories to.
 * - reassignSubcategoryId: Target subcategory ID to move products to.
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    let body: any = {};
    try {
      body = await req.json();
    } catch (_) {}

    const pool = getPostgresPool();

    // Check category and counts
    const catRes = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
    if (catRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Category not found' },
        { status: 404 }
      );
    }

    const category = catRes.rows[0];
    const isTopLevel = !category.parent_id;

    // Count subcategories
    const subRes = await pool.query('SELECT COUNT(*) as count FROM categories WHERE parent_id = $1', [id]);
    const subCount = parseInt(subRes.rows[0]?.count || '0', 10);

    // Count products
    const prodRes = await pool.query(
      'SELECT COUNT(*) as count FROM products WHERE category_id = $1 OR subcategory_id = $1',
      [id]
    );
    const prodCount = parseInt(prodRes.rows[0]?.count || '0', 10);

    const reassignCategoryId = body.reassignCategoryId || null;
    const reassignSubcategoryId = body.reassignSubcategoryId || null;

    // Reassign products if requested
    if (reassignCategoryId) {
      await pool.query(
        'UPDATE products SET category_id = $1 WHERE category_id = $2',
        [reassignCategoryId, id]
      );
    }

    if (reassignSubcategoryId) {
      await pool.query(
        'UPDATE products SET subcategory_id = $1 WHERE subcategory_id = $2',
        [reassignSubcategoryId, id]
      );
    } else if (reassignCategoryId) {
      await pool.query(
        'UPDATE products SET subcategory_id = NULL WHERE subcategory_id = $1',
        [id]
      );
    }

    // Reassign subcategories if deleting a parent category and target category given
    if (isTopLevel && subCount > 0) {
      if (reassignCategoryId) {
        await pool.query(
          'UPDATE categories SET parent_id = $1 WHERE parent_id = $2',
          [reassignCategoryId, id]
        );
      } else {
        // Cascade delete subcategories safely
        await pool.query('DELETE FROM categories WHERE parent_id = $1', [id]);
      }
    }

    // Delete the category itself
    await pool.query('DELETE FROM categories WHERE id = $1', [id]);

    return NextResponse.json({
      success: true,
      message: `Category "${category.name}" deleted successfully`,
      reassignedProducts: prodCount,
      reassignedSubcategories: subCount,
    });
  } catch (error: any) {
    console.error('Error deleting category:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete category' },
      { status: 500 }
    );
  }
}
