import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres';

/**
 * POST /api/categories/move
 * Body: { subcategoryId: string; newParentCategoryId: string }
 * Moves a subcategory to a new parent category and updates product associations.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { subcategoryId, newParentCategoryId } = body;

    if (!subcategoryId || !newParentCategoryId) {
      return NextResponse.json(
        { success: false, error: 'subcategoryId and newParentCategoryId are required' },
        { status: 400 }
      );
    }

    if (subcategoryId === newParentCategoryId) {
      return NextResponse.json(
        { success: false, error: 'Subcategory cannot be its own parent' },
        { status: 400 }
      );
    }

    const pool = getPostgresPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Verify subcategory exists
      const subRes = await client.query('SELECT * FROM categories WHERE id = $1', [subcategoryId]);
      if (subRes.rows.length === 0) {
        throw new Error('Subcategory not found');
      }

      // Verify new parent exists
      const parentRes = await client.query('SELECT * FROM categories WHERE id = $1', [newParentCategoryId]);
      if (parentRes.rows.length === 0) {
        throw new Error('Target parent category not found');
      }

      // Get next display order under new parent
      const orderRes = await client.query(
        'SELECT COALESCE(MAX(display_order), 0) + 1 as next_order FROM categories WHERE parent_id = $1',
        [newParentCategoryId]
      );
      const nextOrder = parseInt(orderRes.rows[0]?.next_order || '1', 10);

      // Update subcategory parent_id and display_order
      await client.query(
        'UPDATE categories SET parent_id = $1, display_order = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        [newParentCategoryId, nextOrder, subcategoryId]
      );

      // Update products attached to this subcategory to also point to the new parent category
      await client.query(
        'UPDATE products SET category_id = $1, updated_at = CURRENT_TIMESTAMP WHERE subcategory_id = $2',
        [newParentCategoryId, subcategoryId]
      );

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        message: `Subcategory "${subRes.rows[0].name}" moved to "${parentRes.rows[0].name}" successfully`,
      });
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Error moving subcategory:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to move subcategory' },
      { status: 500 }
    );
  }
}
