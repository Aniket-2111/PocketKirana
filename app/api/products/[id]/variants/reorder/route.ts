import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/products/[id]/variants/reorder
 * Batch update display_order for product variants
 *
 * Body: { items: Array<{ id: string; displayOrder: number }> }
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id: productId } = await context.params;
    const body = await req.json();
    const { items } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Items array is required for reordering' },
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
            'UPDATE product_variants SET display_order = $1, updated_at = NOW() WHERE id = $2 AND product_id = $3',
            [item.displayOrder, item.id, productId]
          );
        }
      }

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        message: 'Variants reordered successfully',
      });
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Error reordering variants:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to reorder variants' },
      { status: 500 }
    );
  }
}
