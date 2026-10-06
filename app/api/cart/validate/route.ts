import { NextResponse } from 'next/server';
import { validateServerPricing } from '@/lib/catalogSync';

/**
 * POST /api/cart/validate
 * Server-authoritative cart validation endpoint for Web & APK clients.
 * Validates:
 * - Authoritative base/variant selling price vs submitted item price
 * - Variant active status & product publish status
 * - Current stock availability
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { items = [], storeId = 'store-001' } = body;

    const formattedItems = items.map((it: any) => ({
      productId: it.productId || it.id,
      variantId: it.variantId,
      quantity: Number(it.quantity) || 1,
      unitPrice: it.price !== undefined ? Number(it.price) : (it.unitPrice !== undefined ? Number(it.unitPrice) : undefined),
      productName: it.name || it.product?.name || it.productName,
    }));

    const result = await validateServerPricing(formattedItems, { storeId });

    return NextResponse.json({
      success: true,
      data: {
        isValid: result.isValid,
        recalculatedSubtotal: result.recalculatedSubtotal,
        priceChanges: result.priceChanges,
        outOfStockItems: result.outOfStockItems,
        inactiveItems: result.inactiveItems,
        validatedItems: result.items,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Validation error' },
      { status: 500 }
    );
  }
}
