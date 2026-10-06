import { NextRequest, NextResponse } from 'next/server';
import { PromotionOffer, OfferStatus } from '@/lib/promotionsEngine';
import { DEFAULT_ACTIVE_OFFERS } from '@/lib/promotionsEngine';
import { getPostgresPool } from '@/lib/postgres';
import { logAuditEvent } from '@/lib/auditLogger';

declare global {
  // eslint-disable-next-line no-var
  var _pkOfferCache: Map<string, PromotionOffer> | undefined;
}

function getOfferCache(): Map<string, PromotionOffer> {
  if (!globalThis._pkOfferCache) {
    globalThis._pkOfferCache = new Map<string, PromotionOffer>();
    DEFAULT_ACTIVE_OFFERS.forEach((o) => {
      globalThis._pkOfferCache!.set(o.id, o);
    });
  }
  return globalThis._pkOfferCache;
}

function evaluateOfferStatus(offer: PromotionOffer): OfferStatus {
  if (offer.status === 'DRAFT' || offer.status === 'PAUSED' || offer.status === 'CANCELLED') {
    return offer.status;
  }
  const now = Date.now();
  if (offer.startDate) {
    const start = new Date(offer.startDate).getTime();
    if (!isNaN(start) && now < start) return 'SCHEDULED';
  }
  if (offer.endDate) {
    const end = new Date(offer.endDate).getTime();
    if (!isNaN(end) && now > end) return 'EXPIRED';
  }
  return 'ACTIVE';
}

/**
 * GET /api/content/offers
 * Returns promotional offers.
 * Query params:
 *   - status=ACTIVE|DRAFT|SCHEDULED|PAUSED|EXPIRED  → filter by status
 *   - includeAll=true                                → admin: return all statuses
 *   - categoryId=<id>                               → offers for a specific category
 *   - offerType=PERCENTAGE|FIXED|BOGO|...           → filter by type
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const role = req.headers.get('x-pk-role') || 'customer';
    const isAdmin = role === 'admin' || role === 'store_manager';
    const statusFilter = searchParams.get('status')?.toUpperCase();
    const includeAll = searchParams.get('includeAll') === 'true' && isAdmin;
    const categoryId = searchParams.get('categoryId');
    const offerType = searchParams.get('offerType');

    let offers: PromotionOffer[] = [];
    let usedDB = false;

    try {
      const pool = getPostgresPool();
      if (pool) {
        let query = `
          SELECT
            o.id,
            o.name,
            o.internal_name AS "internalName",
            o.customer_title AS "customerTitle",
            o.description,
            o.banner_image AS "bannerImage",
            o.offer_type AS "offerType",
            o.status,
            o.priority,
            o.stacking_rule AS "stackingRule",
            o.min_cart_value AS "minCartValue",
            o.max_discount AS "maxDiscount",
            o.discount_value AS "discountValue",
            o.buy_product_id AS "buyProductId",
            o.buy_quantity AS "buyQuantity",
            o.reward_product_id AS "rewardProductId",
            o.reward_product_name AS "rewardProductName",
            o.reward_quantity AS "rewardQuantity",
            o.category_id AS "categoryId",
            o.start_date AS "startDate",
            o.end_date AS "endDate",
            o.usage_count AS "usageCount",
            o.max_usage_limit AS "maxUsageLimit",
            o.per_customer_limit AS "perCustomerLimit",
            o.festival_name AS "festivalName",
            o.created_at AS "createdAt",
            o.updated_at AS "updatedAt"
          FROM promotional_offers o
          WHERE 1=1
        `;
        const values: any[] = [];
        let p = 1;

        if (offerType) {
          query += ` AND o.offer_type = $${p++}`;
          values.push(offerType);
        }
        if (categoryId) {
          query += ` AND o.category_id = $${p++}`;
          values.push(categoryId);
        }
        if (!includeAll) {
          query += ` AND o.status = 'ACTIVE'`;
        } else if (statusFilter) {
          query += ` AND o.status = $${p++}`;
          values.push(statusFilter);
        }

        query += ` ORDER BY o.priority ASC, o.created_at DESC`;
        const result = await pool.query(query, values);
        if (result.rows.length > 0) {
          offers = result.rows;
          usedDB = true;
        }
      }
    } catch (_) {}

    if (!usedDB) {
      const cache = getOfferCache();
      offers = Array.from(cache.values());

      // Evaluate computed status
      offers = offers.map((o) => ({ ...o, status: evaluateOfferStatus(o) }));

      if (!includeAll) {
        offers = offers.filter((o) => o.status === 'ACTIVE');
      } else if (statusFilter) {
        offers = offers.filter((o) => o.status === statusFilter);
      }
      if (categoryId) {
        offers = offers.filter((o) => o.categoryId === categoryId);
      }
      if (offerType) {
        offers = offers.filter((o) => o.offerType === offerType);
      }
      offers.sort((a, b) => a.priority - b.priority);
    }

    return NextResponse.json(
      {
        success: true,
        count: offers.length,
        data: offers,
        metrics: {
          total: Array.from(getOfferCache().values()).length,
          active: Array.from(getOfferCache().values()).filter(
            (o) => evaluateOfferStatus(o) === 'ACTIVE'
          ).length,
          scheduled: Array.from(getOfferCache().values()).filter(
            (o) => evaluateOfferStatus(o) === 'SCHEDULED'
          ).length,
          expired: Array.from(getOfferCache().values()).filter(
            (o) => evaluateOfferStatus(o) === 'EXPIRED'
          ).length,
          draft: Array.from(getOfferCache().values()).filter(
            (o) => evaluateOfferStatus(o) === 'DRAFT'
          ).length,
        },
      },
      {
        headers: {
          'Cache-Control': isAdmin
            ? 'no-cache, no-store'
            : 'public, s-maxage=30, stale-while-revalidate=60',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch offers' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/content/offers
 * Admin endpoint to create or update a promotional offer.
 */
export async function POST(req: NextRequest) {
  try {
    const role = req.headers.get('x-pk-role');
    const adminUid = req.headers.get('x-pk-uid') || 'admin_operator';

    if (role !== 'admin' && role !== 'store_manager') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    if (!body?.name?.trim() || !body?.customerTitle?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Offer name and customerTitle are required.' },
        { status: 400 }
      );
    }
    if (!body?.startDate || !body?.endDate) {
      return NextResponse.json(
        { success: false, error: 'startDate and endDate are required.' },
        { status: 400 }
      );
    }
    const start = new Date(body.startDate);
    const end = new Date(body.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return NextResponse.json(
        { success: false, error: 'endDate must be after startDate.' },
        { status: 400 }
      );
    }

    const id = body.id || `off-${Date.now()}`;
    const cache = getOfferCache();
    const existing = cache.get(id);

    const offer: PromotionOffer = {
      ...existing,
      ...body,
      id,
      name: body.name.trim(),
      customerTitle: body.customerTitle.trim(),
      status: body.status || 'ACTIVE',
      priority: Number(body.priority) || existing?.priority || 1,
      stackingRule: body.stackingRule || existing?.stackingRule || 'ALLOW',
      offerType: body.offerType || existing?.offerType || 'PERCENTAGE',
      startDate: body.startDate,
      endDate: body.endDate,
    } as PromotionOffer;

    cache.set(id, offer);

    // Persist to PostgreSQL if available
    try {
      const pool = getPostgresPool();
      if (pool) {
        await pool.query(
          `INSERT INTO promotional_offers (
             id, name, internal_name, customer_title, description, banner_image,
             offer_type, status, priority, stacking_rule, min_cart_value, max_discount,
             discount_value, buy_product_id, buy_quantity, reward_product_id,
             reward_product_name, reward_quantity, category_id,
             start_date, end_date, max_usage_limit, per_customer_limit,
             festival_name, created_at, updated_at
           ) VALUES (
             $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,NOW(),NOW()
           )
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             internal_name = EXCLUDED.internal_name,
             customer_title = EXCLUDED.customer_title,
             description = EXCLUDED.description,
             banner_image = EXCLUDED.banner_image,
             offer_type = EXCLUDED.offer_type,
             status = EXCLUDED.status,
             priority = EXCLUDED.priority,
             stacking_rule = EXCLUDED.stacking_rule,
             min_cart_value = EXCLUDED.min_cart_value,
             max_discount = EXCLUDED.max_discount,
             discount_value = EXCLUDED.discount_value,
             buy_product_id = EXCLUDED.buy_product_id,
             buy_quantity = EXCLUDED.buy_quantity,
             reward_product_id = EXCLUDED.reward_product_id,
             reward_product_name = EXCLUDED.reward_product_name,
             reward_quantity = EXCLUDED.reward_quantity,
             category_id = EXCLUDED.category_id,
             start_date = EXCLUDED.start_date,
             end_date = EXCLUDED.end_date,
             max_usage_limit = EXCLUDED.max_usage_limit,
             per_customer_limit = EXCLUDED.per_customer_limit,
             festival_name = EXCLUDED.festival_name,
             updated_at = NOW()`,
          [
            offer.id,
            offer.name,
            offer.internalName || null,
            offer.customerTitle,
            offer.description || null,
            offer.bannerImage || null,
            offer.offerType,
            offer.status,
            offer.priority,
            offer.stackingRule,
            offer.minCartValue || null,
            offer.maxDiscount || null,
            offer.discountValue || null,
            offer.buyProductId || null,
            offer.buyQuantity || null,
            offer.rewardProductId || null,
            offer.rewardProductName || null,
            offer.rewardQuantity || null,
            offer.categoryId || null,
            offer.startDate,
            offer.endDate,
            offer.maxUsageLimit || null,
            offer.perCustomerLimit || null,
            offer.festivalName || null,
          ]
        );
      }
    } catch (_) {}

    await logAuditEvent({
      userId: adminUid,
      userRole: role,
      action: 'OFFER_SAVE',
      entityType: 'OFFER',
      entityId: id,
      details: {
        name: offer.name,
        offerType: offer.offerType,
        status: offer.status,
        startDate: offer.startDate,
        endDate: offer.endDate,
      },
    });

    return NextResponse.json({ success: true, message: 'Offer saved successfully.', data: offer });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save offer' },
      { status: 500 }
    );
  }
}
