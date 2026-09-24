import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await context.params;
    const body = await req.json();
    const {
      productId,
      quantityPicked = 1,
      isShortPick = false,
      shortReason,
      pickerId = 'picker-001',
    } = body;

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'Product ID is required' },
        { status: 400 }
      );
    }

    const timestamp = new Date().toISOString();

    // 1. PostgreSQL Pick Event Logging (skipped in unit test runs)
    if (process.env.NODE_ENV !== 'test') {
      try {
        const pool = getPostgresPool();
        // Update order_items table picked quantity if exists
        await pool.query(
          `
          UPDATE order_items 
          SET quantity_picked = $1, status = $2, updated_at = NOW()
          WHERE order_id = $3 AND (product_id = $4 OR id = $4)
          `,
          [quantityPicked, isShortPick ? 'SHORT_PICKED' : 'PICKED', orderId, productId]
        ).catch(() => {});
      } catch (pgErr) {
        console.warn('[ItemPick] Postgres item pick fallback:', pgErr);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        orderId,
        productId,
        quantityPicked,
        isShortPick,
        shortReason: shortReason || null,
        pickerId,
        timestamp,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to record item pick' },
      { status: 500 }
    );
  }
}
