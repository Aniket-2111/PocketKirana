import { NextRequest, NextResponse } from 'next/server';
import { Banner } from '@/types';
import { INITIAL_BANNERS } from '@/lib/mockData';
import { queryPostgres } from '@/lib/postgres';
import { logAuditEvent } from '@/lib/auditLogger';

declare global {
  // eslint-disable-next-line no-var
  var _pkBannerCache: Map<string, Banner> | undefined;
}

function getBannerCache(): Map<string, Banner> {
  if (!globalThis._pkBannerCache) {
    globalThis._pkBannerCache = new Map<string, Banner>();
    INITIAL_BANNERS.forEach((b, idx) => {
      globalThis._pkBannerCache!.set(b.id, {
        ...b,
        platform: b.platform || 'WEB_AND_APP',
        status: b.status || (b.active ? 'LIVE' : 'PAUSED'),
        priority: b.priority || 10 - idx,
        displayOrder: b.displayOrder || idx + 1,
        version: b.version || 1,
      });
    });
  }
  return globalThis._pkBannerCache;
}

export function evaluateBannerStatus(banner: Banner): 'LIVE' | 'SCHEDULED' | 'PAUSED' | 'EXPIRED' | 'DRAFT' {
  if (banner.status === 'DRAFT') return 'DRAFT';
  if (banner.status === 'PAUSED' || banner.active === false) return 'PAUSED';

  const now = Date.now();
  if (banner.startDate) {
    const start = new Date(banner.startDate).getTime();
    if (!isNaN(start) && now < start) return 'SCHEDULED';
  }
  if (banner.endDate) {
    const end = new Date(banner.endDate).getTime();
    if (!isNaN(end) && now > end) return 'EXPIRED';
  }

  return 'LIVE';
}

/**
 * GET /api/content/banners
 * Returns eligible banners filtered by platform (WEB, APP, ALL) and active status.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const platform = (searchParams.get('platform') || 'ALL').toUpperCase();
    const role = req.headers.get('x-pk-role') || 'customer';
    const isAdmin = role === 'admin' || role === 'store_manager';

    const cache = getBannerCache();
    let banners = Array.from(cache.values());

    // Filter by platform for customer surfaces
    if (platform === 'WEB') {
      banners = banners.filter((b) => (b.platform || 'WEB_AND_APP') === 'WEB' || (b.platform || 'WEB_AND_APP') === 'WEB_AND_APP');
    } else if (platform === 'APP') {
      banners = banners.filter((b) => (b.platform || 'WEB_AND_APP') === 'APP' || (b.platform || 'WEB_AND_APP') === 'WEB_AND_APP');
    }

    // Filter by live eligibility for customers
    if (!isAdmin) {
      banners = banners.filter((b) => {
        const computedStatus = evaluateBannerStatus(b);
        return computedStatus === 'LIVE';
      });
    }

    // Sort by priority (descending) and displayOrder (ascending)
    banners.sort((a, b) => {
      const pDiff = (b.priority || 0) - (a.priority || 0);
      if (pDiff !== 0) return pDiff;
      return (a.displayOrder || 0) - (b.displayOrder || 0);
    });

    return NextResponse.json(
      {
        success: true,
        count: banners.length,
        data: banners,
      },
      {
        headers: {
          'Cache-Control': isAdmin ? 'no-cache, no-store' : 'public, s-maxage=30, stale-while-revalidate=60',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch banners' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/content/banners
 * Admin endpoint to create/publish a banner.
 */
export async function POST(req: NextRequest) {
  try {
    const role = req.headers.get('x-pk-role');
    const adminUid = req.headers.get('x-pk-uid') || 'admin_operator';

    if (role !== 'admin' && role !== 'store_manager') {
      return NextResponse.json({ success: false, error: 'Unauthorized. Admin access required.' }, { status: 403 });
    }

    const body = await req.json();
    if (!body || !body.title || !body.image) {
      return NextResponse.json({ success: false, error: 'Banner title and image are required.' }, { status: 400 });
    }

    const id = body.id || `banner-${Date.now()}`;
    const cache = getBannerCache();
    const existing = cache.get(id);

    const newBanner: Banner = {
      ...existing,
      ...body,
      id,
      title: body.title.trim(),
      subtitle: body.subtitle || '',
      description: body.description || '',
      image: body.image.trim(),
      desktopImage: body.desktopImage || body.image,
      mobileImage: body.mobileImage || body.image,
      apkImage: body.apkImage || body.mobileImage || body.image,
      redirectUrl: body.redirectUrl || '/categories',
      platform: body.platform || 'WEB_AND_APP',
      status: body.status || 'LIVE',
      active: body.status !== 'PAUSED' && body.status !== 'DRAFT',
      destinationType: body.destinationType || 'CATEGORY',
      destinationId: body.destinationId || '',
      startDate: body.startDate || undefined,
      endDate: body.endDate || undefined,
      priority: Number(body.priority) || 1,
      displayOrder: Number(body.displayOrder) || cache.size + 1,
      version: (existing?.version || 0) + 1,
      updatedAt: new Date().toISOString(),
    };

    cache.set(id, newBanner);

    // Save to PostgreSQL if available
    try {
      await queryPostgres(
        `INSERT INTO banners (id, title, subtitle, image_url, redirect_url, platform, status, is_active, priority, display_order, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           subtitle = EXCLUDED.subtitle,
           image_url = EXCLUDED.image_url,
           redirect_url = EXCLUDED.redirect_url,
           platform = EXCLUDED.platform,
           status = EXCLUDED.status,
           is_active = EXCLUDED.is_active,
           priority = EXCLUDED.priority,
           display_order = EXCLUDED.display_order,
           updated_at = NOW()`,
        [
          newBanner.id,
          newBanner.title,
          newBanner.subtitle,
          newBanner.image,
          newBanner.redirectUrl,
          newBanner.platform,
          newBanner.status,
          newBanner.active,
          newBanner.priority,
          newBanner.displayOrder,
        ]
      );
    } catch (_) {}

    await logAuditEvent({
      userId: adminUid,
      userRole: role,
      action: 'BANNER_SAVE_PUBLISH',
      entityType: 'BANNER',
      entityId: id,
      details: { title: newBanner.title, platform: newBanner.platform, status: newBanner.status },
    });

    return NextResponse.json({
      success: true,
      message: 'Banner saved and synchronized successfully.',
      data: newBanner,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save banner' },
      { status: 500 }
    );
  }
}
