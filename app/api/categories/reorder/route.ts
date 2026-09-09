import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres';

/**
 * POST /api/categories/reorder
 * Body: { items: Array<{ id: string; displayOrder: number }> }
 * Batch updates display_order for categories or subcategories in PostgreSQL.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const items: Array<{ id: string; displayOrder: number }> = body.items || [];

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Items array with id and displayOrder is required' },
        { status: 400 }
      );
    }

    const pool = getPostgresPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      for (const item of items) {
        if (item.id && typeof item.displayOrder === 'number') {
          await client.query(
            'UPDATE categories SET display_order = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [item.displayOrder, item.id]
          );
        }
      }

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        message: 'Categories reordered successfully',
        updatedCount: items.length,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Error reordering categories:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to reorder categories' },
      { status: 500 }
    );
  }
}
