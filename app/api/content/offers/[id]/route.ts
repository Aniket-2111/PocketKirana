import { NextRequest, NextResponse } from 'next/server';
import { PromotionOffer, OfferStatus } from '@/lib/promotionsEngine';
import { getPostgresPool } from '@/lib/postgres';
import { logAuditEvent } from '@/lib/auditLogger';

declare global {
  var _pkOfferCache: Map<string, PromotionOffer> | undefined;
}

/**
 * GET /api/content/offers/[id]
 * Returns a single offer by ID.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cache = globalThis._pkOfferCache;
    if (cache?.has(id)) {
      return NextResponse.json({ success: true, data: cache.get(id) });
    }
    try {
      const pool = getPostgresPool();
      if (pool) {
        const result = await pool.query(
          `SELECT * FROM promotional_offers WHERE id = $1`,
          [id]
        );
        if (result.rows.length > 0) {
          return NextResponse.json({ success: true, data: result.rows[0] });
        }
      }
    } catch (_) {}

    return NextResponse.json({ success: false, error: 'Offer not found' }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch offer' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/content/offers/[id]
 * Admin endpoint to partially update an offer (e.g. toggle status).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const role = req.headers.get('x-pk-role');
    const adminUid = req.headers.get('x-pk-uid') || 'admin_operator';

    if (role !== 'admin' && role !== 'store_manager') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const cache = globalThis._pkOfferCache;

    const existing = cache?.get(id);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Offer not found' }, { status: 404 });
    }

    const updated = {
      ...existing,
      ...body,
      id,
      updatedAt: new Date().toISOString(),
    };

    if (cache) {
      cache.set(id, updated);
    }

    try {
      const pool = getPostgresPool();
      if (pool && body.status) {
        await pool.query(
          `UPDATE promotional_offers SET status = $1, updated_at = NOW() WHERE id = $2`,
          [body.status, id]
        );
      }
    } catch (_) {}

    await logAuditEvent({
      userId: adminUid,
      userRole: role,
      action: 'OFFER_STATUS_TOGGLE',
      entityType: 'OFFER',
      entityId: id,
      details: { newStatus: body.status },
    });

    return NextResponse.json({ success: true, message: 'Offer updated.', data: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update offer' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/content/offers/[id]
 * Admin endpoint to delete an offer.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const role = req.headers.get('x-pk-role');
    const adminUid = req.headers.get('x-pk-uid') || 'admin_operator';

    if (role !== 'admin' && role !== 'store_manager') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const cache = globalThis._pkOfferCache;
    const existed = cache?.has(id) ?? false;
    if (cache) cache.delete(id);

    try {
      const pool = getPostgresPool();
      if (pool) {
        await pool.query(`DELETE FROM promotional_offers WHERE id = $1`, [id]);
      }
    } catch (_) {}

    await logAuditEvent({
      userId: adminUid,
      userRole: role,
      action: 'OFFER_DELETE',
      entityType: 'OFFER',
      entityId: id,
      details: { deleted: existed },
    });

    return NextResponse.json({ success: true, message: 'Offer deleted.' });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete offer' },
      { status: 500 }
    );
  }
}
