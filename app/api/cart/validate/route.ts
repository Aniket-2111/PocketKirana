import { NextResponse } from 'next/server';
import { fetchProductsFS } from '@/lib/firebaseServices';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { items = [] } = body;

    const liveProducts = await fetchProductsFS();
    const outOfStockItems: any[] = [];
    const priceChanges: any[] = [];

    for (const item of items) {
      const liveProduct = liveProducts.find((p) => p.id === item.productId);
      if (!liveProduct || liveProduct.status === 'out_of_stock') {
        outOfStockItems.push({
          productId: item.productId,
          productName: item.product?.name || 'Item',
          available: 0,
        });
      } else if (liveProduct.sellingPrice !== item.price) {
        priceChanges.push({
          productId: item.productId,
          oldPrice: item.price,
          newPrice: liveProduct.sellingPrice,
        });
      }
    }

    const isValid = outOfStockItems.length === 0 && priceChanges.length === 0;

    return NextResponse.json({
      success: true,
      data: {
        isValid,
        outOfStockItems,
        priceChanges,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Validation error' },
      { status: 500 }
    );
  }
}
