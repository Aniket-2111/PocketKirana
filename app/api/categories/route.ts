import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres';

/**
 * GET /api/categories
 * Returns all categories and subcategories ordered by display_order.
 * Includes subcategories count and product count for admin and client.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parentId = searchParams.get('parentId');
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const pool = getPostgresPool();

    let query = `
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
      WHERE 1=1
    `;

    const params: any[] = [];

    if (!includeInactive) {
      params.push(true);
      query += ` AND c.is_active = $${params.length}`;
    }

    if (parentId !== null && parentId !== undefined) {
      if (parentId === 'root' || parentId === 'null' || parentId === '') {
        query += ` AND c.parent_id IS NULL`;
      } else {
        params.push(parentId);
        query += ` AND c.parent_id = $${params.length}`;
      }
    }

    query += ` ORDER BY c.display_order ASC, c.created_at ASC`;

    const result = await pool.query(query, params);

    const categories = result.rows.map((row) => ({
      ...row,
      subcategoriesCount: parseInt(row.subcategoriesCount || '0', 10),
      productsCount: parseInt(row.productsCount || '0', 10),
    }));

    return NextResponse.json({
      success: true,
      categories,
      count: categories.length,
    });
  } catch (error: any) {
    console.error('Error fetching categories from database:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/categories
 * Creates a new category or subcategory with unique slug validation and auto ordering.
 */
export async function POST(req: NextRequest) {
  try {
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
      isActive = true,
      metaTitle,
      metaDescription,
    } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Category name is required' },
        { status: 400 }
      );
    }

    const pool = getPostgresPool();

    // Generate or format slug
    const cleanName = name.trim();
    let generatedSlug = (customSlug || cleanName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    if (!generatedSlug) {
      generatedSlug = `cat-${Date.now()}`;
    }

    // Check slug uniqueness
    const existingSlug = await pool.query(
      'SELECT id FROM categories WHERE slug = $1',
      [generatedSlug]
    );

    if (existingSlug.rows.length > 0) {
      // Append random suffix if conflict
      generatedSlug = `${generatedSlug}-${Date.now().toString().slice(-4)}`;
    }

    // Determine parent_id
    const finalParentId = parentId && parentId !== 'root' && parentId !== 'null' ? parentId : null;

    // Determine display order
    let finalOrder = typeof displayOrder === 'number' ? displayOrder : 0;
    if (finalOrder === 0) {
      const orderQuery = finalParentId
        ? 'SELECT COALESCE(MAX(display_order), 0) + 1 AS next_order FROM categories WHERE parent_id = $1'
        : 'SELECT COALESCE(MAX(display_order), 0) + 1 AS next_order FROM categories WHERE parent_id IS NULL';
      const orderParams = finalParentId ? [finalParentId] : [];
      const orderRes = await pool.query(orderQuery, orderParams);
      finalOrder = parseInt(orderRes.rows[0]?.next_order || '1', 10);
    }

    const idPrefix = finalParentId ? 'sub' : 'cat';
    const categoryId = `${idPrefix}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const finalImage = imageUrl || image || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=200&q=80';

    const insertQuery = `
      INSERT INTO categories (
        id, parent_id, name, slug, description, image, image_url, banner_image, display_order, is_active, meta_title, meta_description, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      ) RETURNING 
        id, parent_id AS "parentId", name, slug, description, 
        image_url AS "image", banner_image AS "bannerImage", display_order AS "displayOrder",
        display_order AS "sortOrder", is_active AS "isActive", meta_title AS "metaTitle",
        meta_description AS "metaDescription", created_at AS "createdAt", updated_at AS "updatedAt"
    `;

    const insertRes = await pool.query(insertQuery, [
      categoryId,
      finalParentId,
      cleanName,
      generatedSlug,
      description || '',
      finalImage,
      finalImage,
      bannerImage || null,
      finalOrder,
      isActive,
      metaTitle || null,
      metaDescription || null,
    ]);

    const createdCategory = insertRes.rows[0];

    return NextResponse.json({
      success: true,
      category: {
        ...createdCategory,
        subcategoriesCount: 0,
        productsCount: 0,
      },
      message: finalParentId ? 'Subcategory created successfully' : 'Category created successfully',
    });
  } catch (error: any) {
    console.error('Error creating category:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create category' },
      { status: 500 }
    );
  }
}
