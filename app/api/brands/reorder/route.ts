import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres';
import { requireRole } from '@/lib/routeAuth';

/**
 * POST /api/brands/reorder
 * Batch update display_order for brands
 * Body: { items: Array<{ id: string; displayOrder: number }> }
 */
export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['admin']);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: 'Forbidden: Admin role required to reorder brands' },
      { status: 403 }
    );
  }
  try {
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
            'UPDATE brands SET display_order = $1, updated_at = NOW() WHERE id = $2',
            [item.displayOrder, item.id]
          );
        }
      }

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        message: 'Brands reordered successfully',
      });
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Error reordering brands:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to reorder brands' },
      { status: 500 }
    );
  }
}
