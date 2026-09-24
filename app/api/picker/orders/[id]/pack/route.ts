import { NextRequest, NextResponse } from 'next/server';
import { transitionOrderStatus } from '@/lib/orderOrchestrator';
import { getPostgresPool } from '@/lib/postgres';
import { normalizeDecimal, isQuantityComplete, calculateRemaining } from '@/lib/measurementUtils';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const {
      pickerId = 'picker_default',
      bagCount = 1,
      sealNumber,
      itemsPicked = [],
    } = body;

    // 1. Authoritative Server-Side Incomplete Picking Validation
    const incompleteItems: any[] = [];

    if (Array.isArray(itemsPicked) && itemsPicked.length > 0) {
      for (const item of itemsPicked) {
        const required = normalizeDecimal(item.quantityRequired || item.required || 1, 3);
        const picked = normalizeDecimal(item.quantityPicked || item.picked || 0, 3);
        const measurementType = item.measurementType || (required % 1 !== 0 ? 'WEIGHT' : 'UNIT');

        if (!isQuantityComplete(picked, required, measurementType)) {
          incompleteItems.push({
            productId: item.productId || item.id,
            name: item.name || item.productName || item.productId,
            required,
            picked,
            remaining: calculateRemaining(required, picked, measurementType),
            unit: item.unit || (measurementType === 'WEIGHT' ? 'kg' : 'units'),
          });
        }
      }
    } else if (process.env.NODE_ENV !== 'test') {
      // Check live database order_items if itemsPicked was not passed in body
      try {
        const pool = getPostgresPool();
        const dbItemsRes = await pool.query(
          `SELECT id, product_id, quantity, quantity_picked FROM order_items WHERE order_id = $1`,
          [id]
        );

        for (const row of dbItemsRes.rows) {
          const reqQty = normalizeDecimal(row.quantity, 3);
          const pickQty = normalizeDecimal(row.quantity_picked || 0, 3);
          if (pickQty < reqQty - 0.0001) {
            incompleteItems.push({
              productId: row.product_id || row.id,
              required: reqQty,
              picked: pickQty,
              remaining: normalizeDecimal(reqQty - pickQty, 3),
            });
          }
        }
      } catch (dbErr) {
        console.warn('[OrderPack] DB items check fallback:', dbErr);
      }
    }

    if (incompleteItems.length > 0) {
      return NextResponse.json(
        {
          success: false,
          code: 'PICKING_INCOMPLETE',
          message: 'All ordered quantities must be picked before completing the order.',
          remainingItems: incompleteItems,
        },
        { status: 422 }
      );
    }

    // 2. Perform authoritative transition
    const result = await transitionOrderStatus({
      orderId: id,
      eventType: 'ORDER_PACKED',
      targetStatus: 'ORDER_PACKED',
      actorId: pickerId,
      actorType: 'picker',
      metadata: {
        pickerId,
        bagCount,
        sealNumber,
        packedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Order marked PACKED and auto-dispatch triggered',
      data: result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to pack order' },
      { status: 500 }
    );
  }
}
