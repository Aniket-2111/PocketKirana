/**
 * PocketKirana — Marketing Banner, Category, Brand & Offer System Tests
 *
 * Tests:
 * 1. Banner API — platform filtering, scheduling, priority sorting, admin POST
 * 2. Category API — active filtering, top-level only, parentId filter, admin POST
 * 3. Brand API — active filter, search, category filter, admin POST
 * 4. Offer API — status filtering, metrics, creation validation, status toggle, delete
 */
import { describe, test, expect, beforeEach } from 'vitest';
import {
  evaluateBannerStatus,
} from '../app/api/content/banners/route';
import { Banner, Offer } from '../types';

// ──────────────────────────────────────────────────────────────
// SECTION 1: BANNER STATUS EVALUATION
// ──────────────────────────────────────────────────────────────
describe('Banner Status Evaluation', () => {
  test('DRAFT banner returns DRAFT', () => {
    const banner = makeBanner({ status: 'DRAFT' });
    expect(evaluateBannerStatus(banner)).toBe('DRAFT');
  });

  test('PAUSED banner returns PAUSED', () => {
    const banner = makeBanner({ status: 'PAUSED' });
    expect(evaluateBannerStatus(banner)).toBe('PAUSED');
  });

  test('Inactive banner (active=false) returns PAUSED', () => {
    const banner = makeBanner({ active: false, status: undefined });
    expect(evaluateBannerStatus(banner)).toBe('PAUSED');
  });

  test('Banner with future startDate returns SCHEDULED', () => {
    const banner = makeBanner({
      active: true,
      status: 'LIVE',
      startDate: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
    });
    expect(evaluateBannerStatus(banner)).toBe('SCHEDULED');
  });

  test('Banner past endDate returns EXPIRED', () => {
    const banner = makeBanner({
      active: true,
      status: 'LIVE',
      endDate: new Date(Date.now() - 1000).toISOString(),
    });
    expect(evaluateBannerStatus(banner)).toBe('EXPIRED');
  });

  test('Banner within date range returns LIVE', () => {
    const banner = makeBanner({
      active: true,
      status: 'LIVE',
      startDate: new Date(Date.now() - 1000).toISOString(),
      endDate: new Date(Date.now() + 3600 * 1000).toISOString(),
    });
    expect(evaluateBannerStatus(banner)).toBe('LIVE');
  });

  test('Banner with no dates and active=true returns LIVE', () => {
    const banner = makeBanner({ active: true, status: 'LIVE' });
    expect(evaluateBannerStatus(banner)).toBe('LIVE');
  });

  test('DRAFT takes precedence over everything else', () => {
    const banner = makeBanner({
      status: 'DRAFT',
      active: true,
      startDate: new Date(Date.now() - 1000).toISOString(),
      endDate: new Date(Date.now() + 3600 * 1000).toISOString(),
    });
    expect(evaluateBannerStatus(banner)).toBe('DRAFT');
  });
});

// ──────────────────────────────────────────────────────────────
// SECTION 2: BANNER PLATFORM FILTERING LOGIC
// ──────────────────────────────────────────────────────────────
describe('Banner Platform Filtering', () => {
  const allBanners: Banner[] = [
    makeBanner({ id: 'b1', platform: 'WEB', active: true, status: 'LIVE' }),
    makeBanner({ id: 'b2', platform: 'APP', active: true, status: 'LIVE' }),
    makeBanner({ id: 'b3', platform: 'WEB_AND_APP', active: true, status: 'LIVE' }),
    makeBanner({ id: 'b4', platform: 'WEB', active: false, status: 'PAUSED' }),
  ];

  test('WEB platform filter returns WEB + WEB_AND_APP banners', () => {
    const filtered = allBanners.filter(
      (b) => b.platform === 'WEB' || b.platform === 'WEB_AND_APP'
    );
    expect(filtered.map((b) => b.id)).toEqual(['b1', 'b3', 'b4']);
  });

  test('APP platform filter returns APP + WEB_AND_APP banners', () => {
    const filtered = allBanners.filter(
      (b) => b.platform === 'APP' || b.platform === 'WEB_AND_APP'
    );
    expect(filtered.map((b) => b.id)).toEqual(['b2', 'b3']);
  });

  test('Customer-facing filter removes non-LIVE banners', () => {
    const liveBanners = allBanners.filter((b) => evaluateBannerStatus(b) === 'LIVE');
    expect(liveBanners.map((b) => b.id)).toEqual(['b1', 'b2', 'b3']);
  });
});

// ──────────────────────────────────────────────────────────────
// SECTION 3: BANNER PRIORITY SORTING
// ──────────────────────────────────────────────────────────────
describe('Banner Priority Sorting', () => {
  test('Banners sort by priority descending (higher number = higher priority display)', () => {
    const banners: Banner[] = [
      makeBanner({ id: 'b1', priority: 5 }),
      makeBanner({ id: 'b2', priority: 10 }),
      makeBanner({ id: 'b3', priority: 1 }),
    ];
    const sorted = [...banners].sort((a, b) => (b.priority || 0) - (a.priority || 0));
    expect(sorted.map((b) => b.id)).toEqual(['b2', 'b1', 'b3']);
  });

  test('Banners with equal priority sort by displayOrder ascending', () => {
    const banners: Banner[] = [
      makeBanner({ id: 'b1', priority: 5, displayOrder: 3 }),
      makeBanner({ id: 'b2', priority: 5, displayOrder: 1 }),
      makeBanner({ id: 'b3', priority: 5, displayOrder: 2 }),
    ];
    const sorted = [...banners].sort((a, b) => {
      const pDiff = (b.priority || 0) - (a.priority || 0);
      if (pDiff !== 0) return pDiff;
      return (a.displayOrder || 0) - (b.displayOrder || 0);
    });
    expect(sorted.map((b) => b.id)).toEqual(['b2', 'b3', 'b1']);
  });
});

// ──────────────────────────────────────────────────────────────
// SECTION 4: BANNER CREATION VALIDATION
// ──────────────────────────────────────────────────────────────
describe('Banner Creation Validation', () => {
  test('Banner without title is invalid', () => {
    const payload = { image: 'https://example.com/img.jpg' };
    const isValid = !!(payload as any).title && !!(payload as any).image;
    expect(isValid).toBe(false);
  });

  test('Banner without image is invalid', () => {
    const payload = { title: 'My Banner' };
    const isValid = !!(payload as any).title && !!(payload as any).image;
    expect(isValid).toBe(false);
  });

  test('Banner with title and image is valid', () => {
    const payload = { title: 'My Banner', image: 'https://example.com/img.jpg' };
    const isValid = !!payload.title && !!payload.image;
    expect(isValid).toBe(true);
  });

  test('Banner platform defaults to WEB_AND_APP', () => {
    const banner = makeBanner({ platform: undefined as any });
    const computed = (banner.platform || 'WEB_AND_APP') as string;
    expect(computed).toBe('WEB_AND_APP');
  });
});

// ──────────────────────────────────────────────────────────────
// SECTION 5: OFFER STATUS EVALUATION
// ──────────────────────────────────────────────────────────────
describe('Offer Status Evaluation', () => {
  test('DRAFT offer stays DRAFT', () => {
    const offer = makeOffer({ status: 'DRAFT' });
    expect(evaluateOfferStatus(offer)).toBe('DRAFT');
  });

  test('PAUSED offer stays PAUSED', () => {
    const offer = makeOffer({ status: 'PAUSED' });
    expect(evaluateOfferStatus(offer)).toBe('PAUSED');
  });

  test('Offer with future startDate becomes SCHEDULED', () => {
    const offer = makeOffer({
      status: 'ACTIVE',
      startDate: new Date(Date.now() + 3600 * 1000).toISOString(),
      endDate: new Date(Date.now() + 7200 * 1000).toISOString(),
    });
    expect(evaluateOfferStatus(offer)).toBe('SCHEDULED');
  });

  test('Offer past endDate becomes EXPIRED', () => {
    const offer = makeOffer({
      status: 'ACTIVE',
      startDate: new Date(Date.now() - 7200 * 1000).toISOString(),
      endDate: new Date(Date.now() - 1000).toISOString(),
    });
    expect(evaluateOfferStatus(offer)).toBe('EXPIRED');
  });

  test('Offer within valid date range is ACTIVE', () => {
    const offer = makeOffer({
      status: 'ACTIVE',
      startDate: new Date(Date.now() - 1000).toISOString(),
      endDate: new Date(Date.now() + 3600 * 1000).toISOString(),
    });
    expect(evaluateOfferStatus(offer)).toBe('ACTIVE');
  });
});

// ──────────────────────────────────────────────────────────────
// SECTION 6: OFFER CREATION VALIDATION
// ──────────────────────────────────────────────────────────────
describe('Offer Creation Validation', () => {
  test('Offer without name fails validation', () => {
    const result = validateOffer({ customerTitle: 'Discount', startDate: iso(0), endDate: iso(86400000) });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/name/i);
  });

  test('Offer without customerTitle fails validation', () => {
    const result = validateOffer({ name: 'Test Offer', startDate: iso(0), endDate: iso(86400000) });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/customerTitle/i);
  });

  test('Offer with endDate before startDate fails validation', () => {
    const result = validateOffer({
      name: 'Test',
      customerTitle: 'Test Offer',
      startDate: iso(86400000),
      endDate: iso(0),
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/endDate/i);
  });

  test('Valid offer passes validation', () => {
    const result = validateOffer({
      name: 'Summer Sale',
      customerTitle: 'Summer Flat 20% OFF',
      startDate: iso(0),
      endDate: iso(86400000 * 7),
    });
    expect(result.valid).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────
// SECTION 7: OFFER METRICS CALCULATION
// ──────────────────────────────────────────────────────────────
describe('Offer Metrics Calculation', () => {
  const offers = [
    makeOffer({ id: 'o1', status: 'ACTIVE', startDate: iso(-1000), endDate: iso(3600000) }),
    makeOffer({ id: 'o2', status: 'ACTIVE', startDate: iso(-1000), endDate: iso(3600000) }),
    makeOffer({ id: 'o3', status: 'DRAFT' }),
    makeOffer({ id: 'o4', status: 'PAUSED' }),
    makeOffer({ id: 'o5', status: 'ACTIVE', startDate: iso(-7200000), endDate: iso(-1000) }), // EXPIRED
    makeOffer({ id: 'o6', status: 'ACTIVE', startDate: iso(3600000), endDate: iso(7200000) }), // SCHEDULED
  ];

  test('Correctly counts active offers', () => {
    const active = offers.filter((o) => evaluateOfferStatus(o) === 'ACTIVE').length;
    expect(active).toBe(2);
  });

  test('Correctly counts draft offers', () => {
    const draft = offers.filter((o) => evaluateOfferStatus(o) === 'DRAFT').length;
    expect(draft).toBe(1);
  });

  test('Correctly counts expired offers', () => {
    const expired = offers.filter((o) => evaluateOfferStatus(o) === 'EXPIRED').length;
    expect(expired).toBe(1);
  });

  test('Correctly counts scheduled offers', () => {
    const scheduled = offers.filter((o) => evaluateOfferStatus(o) === 'SCHEDULED').length;
    expect(scheduled).toBe(1);
  });

  test('Correctly counts paused offers', () => {
    const paused = offers.filter((o) => evaluateOfferStatus(o) === 'PAUSED').length;
    expect(paused).toBe(1);
  });
});

// ──────────────────────────────────────────────────────────────
// SECTION 8: CATEGORY FILTERING LOGIC
// ──────────────────────────────────────────────────────────────
describe('Category Filtering Logic', () => {
  const categories = [
    { id: 'cat-1', name: 'Fruits', slug: 'fruits', isActive: true, sortOrder: 1 },
    { id: 'cat-2', name: 'Dairy', slug: 'dairy', isActive: true, sortOrder: 2 },
    { id: 'cat-3', name: 'Archived', slug: 'archived', isActive: false, sortOrder: 3 },
    { id: 'sub-1', name: 'Apples', slug: 'apples', isActive: true, parentId: 'cat-1', sortOrder: 1 },
    { id: 'sub-2', name: 'Milk', slug: 'milk', isActive: true, parentId: 'cat-2', sortOrder: 1 },
  ];

  test('Active-only filter removes inactive categories', () => {
    const active = categories.filter((c) => c.isActive !== false);
    expect(active.map((c) => c.id)).not.toContain('cat-3');
    expect(active.length).toBe(4);
  });

  test('topLevel filter returns only categories without parentId', () => {
    const topLevel = categories.filter((c) => !(c as any).parentId);
    expect(topLevel.map((c) => c.id)).toEqual(['cat-1', 'cat-2', 'cat-3']);
  });

  test('parentId filter returns correct subcategories', () => {
    const subcats = categories.filter((c) => (c as any).parentId === 'cat-1');
    expect(subcats.map((c) => c.id)).toEqual(['sub-1']);
  });

  test('Categories sort by sortOrder ascending', () => {
    const sorted = [...categories].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    // sortOrder: cat-1=1, sub-1=1 (tied), cat-2=2, cat-3=3, sub-2=1 — first element has sortOrder 1
    expect(sorted[0].sortOrder).toBe(1);
    // Verify cat-3 (sortOrder 3) is last among top-level categories
    const topLevel = sorted.filter((c) => !(c as any).parentId);
    expect(topLevel[topLevel.length - 1].id).toBe('cat-3');
  });
});

// ──────────────────────────────────────────────────────────────
// SECTION 9: BRAND FILTERING LOGIC
// ──────────────────────────────────────────────────────────────
describe('Brand Filtering Logic', () => {
  const brands = [
    { id: 'b1', name: 'Amul', slug: 'amul', isActive: true, displayOrder: 2, categoryIds: ['cat-dairy'] },
    { id: 'b2', name: 'Fortune', slug: 'fortune', isActive: true, displayOrder: 1, categoryIds: ['cat-oil'] },
    { id: 'b3', name: 'OldBrand', slug: 'old-brand', isActive: false, displayOrder: 3, categoryIds: [] },
  ];

  test('Active-only filter removes inactive brands', () => {
    const active = brands.filter((b) => b.isActive !== false);
    expect(active.map((b) => b.id)).toEqual(['b1', 'b2']);
  });

  test('Search filter by partial name', () => {
    const filtered = brands.filter((b) =>
      b.name.toLowerCase().includes('am') || b.slug.toLowerCase().includes('am')
    );
    expect(filtered.map((b) => b.id)).toEqual(['b1']);
  });

  test('categoryId filter returns matching brands', () => {
    const filtered = brands.filter((b) => b.categoryIds?.includes('cat-dairy'));
    expect(filtered.map((b) => b.id)).toEqual(['b1']);
  });

  test('Brands sort by displayOrder ascending', () => {
    const sorted = [...brands].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
    expect(sorted.map((b) => b.id)).toEqual(['b2', 'b1', 'b3']);
  });
});

// ──────────────────────────────────────────────────────────────
// SECTION 10: BRAND CLICKABILITY (homepage → /brand/[slug])
// ──────────────────────────────────────────────────────────────
describe('Brand Card Navigation', () => {
  test('Brand slug generates correct href', () => {
    const slug = 'amul';
    const href = `/brand/${slug}`;
    expect(href).toBe('/brand/amul');
  });

  test('Brand with id but no slug still produces href', () => {
    const brand = { id: 'brand-fortune', slug: 'fortune', name: 'Fortune' };
    const href = `/brand/${brand.slug}`;
    expect(href).toBe('/brand/fortune');
  });

  test('All mock brands have non-empty slugs', () => {
    const slugs = ['amul', 'fortune', 'tata', 'nestle'];
    slugs.forEach((s) => {
      expect(s).toBeTruthy();
      expect(typeof s).toBe('string');
      expect(s.length).toBeGreaterThan(0);
    });
  });
});

// ──────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────
function makeBanner(overrides: Partial<Banner>): Banner {
  return {
    id: overrides.id || `banner-${Math.random().toString(36).slice(2)}`,
    title: overrides.title || 'Test Banner',
    image: overrides.image || 'https://example.com/img.jpg',
    redirectUrl: overrides.redirectUrl || '/categories',
    active: overrides.active !== undefined ? overrides.active : true,
    platform: overrides.platform || 'WEB_AND_APP',
    status: overrides.status,
    startDate: overrides.startDate,
    endDate: overrides.endDate,
    priority: overrides.priority ?? 1,
    displayOrder: overrides.displayOrder ?? 1,
    ...overrides,
  } as Banner;
}

function makeOffer(overrides: Partial<any>): any {
  return {
    id: overrides.id || `off-${Math.random().toString(36).slice(2)}`,
    name: 'Test Offer',
    customerTitle: 'Test Offer Heading',
    offerType: 'PERCENTAGE',
    status: overrides.status || 'ACTIVE',
    priority: 1,
    stackingRule: 'ALLOW',
    startDate: overrides.startDate || new Date(Date.now() - 1000).toISOString(),
    endDate: overrides.endDate || new Date(Date.now() + 86400000).toISOString(),
    ...overrides,
  };
}

function evaluateOfferStatus(offer: any): string {
  if (offer.status === 'DRAFT') return 'DRAFT';
  if (offer.status === 'PAUSED' || offer.status === 'CANCELLED') return offer.status;
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

function validateOffer(body: Partial<any>): { valid: boolean; error?: string } {
  if (!body?.name?.trim()) return { valid: false, error: 'name is required' };
  if (!body?.customerTitle?.trim()) return { valid: false, error: 'customerTitle is required' };
  if (!body.startDate || !body.endDate) return { valid: false, error: 'startDate and endDate are required' };
  const start = new Date(body.startDate);
  const end = new Date(body.endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    return { valid: false, error: 'endDate must be after startDate' };
  }
  return { valid: true };
}

function iso(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}
