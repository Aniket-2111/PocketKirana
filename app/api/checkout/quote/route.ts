import { NextResponse } from 'next/server';
import { INITIAL_COUPONS } from '@/lib/mockData';
import { fetchProductsFS } from '@/lib/firebaseServices';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { cartItems = [], couponCode } = body;

    const liveProducts = await fetchProductsFS();

    // Server recalculates subtotal from authoritative product database
    let subtotal = 0;
    for (const item of cartItems) {
      const product = liveProducts.find((p) => p.id === item.productId);
      const unitPrice = product ? product.sellingPrice : item.price;
      subtotal += unitPrice * item.quantity;
    }

    let discount = 0;
    let appliedCouponCode: string | undefined = undefined;

    if (couponCode) {
      const coupon = INITIAL_COUPONS.find(
        (c) => c.code.toUpperCase() === couponCode.toUpperCase() && c.active
      );
      if (coupon && subtotal >= coupon.minimumOrder) {
        appliedCouponCode = coupon.code;
        if (coupon.type === 'fixed') {
          discount = coupon.value;
        } else {
          discount = Math.min((subtotal * coupon.value) / 100, coupon.maxDiscount);
        }
      }
    }

    const deliveryCharge = subtotal > 499 || subtotal === 0 ? 0 : 20;
    const tax = Math.round((subtotal - discount) * 0.05);
    const total = Math.max(0, subtotal - discount + deliveryCharge + tax);

    return NextResponse.json({
      success: true,
      data: {
        subtotal,
        discount,
        deliveryCharge,
        tax,
        total,
        appliedCouponCode,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Server quote error' },
      { status: 500 }
    );
  }
}
