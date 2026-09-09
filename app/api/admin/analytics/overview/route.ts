import { NextResponse } from 'next/server';
import { fetchOrdersFS, fetchProductsFS, fetchDeliveryPartnersFS } from '@/lib/firebaseServices';

export async function GET() {
  try {
    const [orders, products, partners] = await Promise.all([
      fetchOrdersFS(),
      fetchProductsFS(),
      fetchDeliveryPartnersFS(),
    ]);

    const totalSales = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const totalOrders = orders.length;
    const pendingOrders = orders.filter((o) => o.orderStatus !== 'delivered' && o.orderStatus !== 'cancelled').length;
    const lowStockCount = products.filter((p) => p.status === 'out_of_stock').length;
    const activePartners = partners.filter((p) => p.currentStatus === 'online').length;

    return NextResponse.json({
      success: true,
      data: {
        metrics: {
          totalSales,
          totalOrders,
          pendingOrders,
          lowStockCount,
          activePartners,
          averageOrderValue: totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0,
        },
        charts: {
          revenueMonthly: [
            { month: 'Mar', revenue: 142000 },
            { month: 'Apr', revenue: 185000 },
            { month: 'May', revenue: 210000 },
            { month: 'Jun', revenue: 245000 },
            { month: 'Jul', revenue: 298000 },
            { month: 'Aug', revenue: totalSales },
          ],
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Analytics error' },
      { status: 500 }
    );
  }
}
