import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { productId, physicalStock, reservedStock = 0, lowStockThreshold = 5 } = body;

    if (!productId || physicalStock === undefined) {
      return NextResponse.json(
        { success: false, error: 'Product ID and physical stock required' },
        { status: 400 }
      );
    }

    // Core Inventory Formula: availableStock = physicalStock - reservedStock
    const availableStock = Math.max(0, physicalStock - reservedStock);
    const isLowStock = availableStock <= lowStockThreshold;

    return NextResponse.json({
      success: true,
      data: {
        productId,
        physicalStock,
        reservedStock,
        availableStock,
        isLowStock,
        status: availableStock === 0 ? 'out_of_stock' : isLowStock ? 'low_stock' : 'in_stock',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Inventory adjustment failed' },
      { status: 500 }
    );
  }
}
