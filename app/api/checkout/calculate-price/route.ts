/**
 * POST /api/checkout/calculate-price
 *
 * Authoritative Server-Side Pricing & Promotion Evaluator
 * Accepts customer cart items, coupon codes, and customer context, fetches real product prices
 * from PostgreSQL database, and returns the transparent calculated invoice with free gifts and discounts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres';
import { evaluatePromotionsEngine, ProductCatalogItem } from '@/lib/promotionsEngine';
import { checkoutLimiter } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  // 1. Rate limiting check (max 30 price evaluations per minute per IP)
  const rateLimitResponse = await checkoutLimiter.check(req, 30, 'CALCULATE_PRICE');
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await req.json();
    const { items = [], couponCode, customer = {}, customerSegment = 'ALL' } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Cart items array cannot be empty.' },
        { status: 400 }
      );
    }

    const productIds = items.map((it: any) => it.productId).filter(Boolean);
    const pool = getPostgresPool();

    // Fetch authoritative live prices and stock from PostgreSQL
    const catalog: Record<string, ProductCatalogItem> = {};

    try {
      const dbRes = await pool.query(
        `SELECT id, name, mrp, selling_price, category_id, stock, lifecycle_status 
         FROM products 
         WHERE id = ANY($1::varchar[])`,
        [productIds]
      );

      dbRes.rows.forEach((row) => {
        catalog[row.id] = {
          id: row.id,
          name: row.name,
          mrp: parseFloat(row.mrp || '0'),
          sellingPrice: parseFloat(row.selling_price || '0'),
          categoryId: row.category_id,
          stock: parseInt(row.stock || '0', 10),
        };
      });
    } catch (dbErr) {
      console.warn('[CalculatePrice DB Fallback]', (dbErr as any)?.message);
    }

    // Run authoritative promotions evaluation
    const pricingBreakdown = evaluatePromotionsEngine({
      cartItems: items,
      catalog,
      couponCode,
      customer: {
        ...customer,
        segment: customer.segment || customerSegment,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: pricingBreakdown,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('[CalculatePrice API Error]', err.message);
    return NextResponse.json(
      { error: 'Failed to calculate price.', details: err.message },
      { status: 500 }
    );
  }
}
