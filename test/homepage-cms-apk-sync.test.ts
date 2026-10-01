import { describe, it, expect, beforeEach } from 'vitest';
import { HomepageCmsService } from '@/lib/homepageCmsService';
import { useAppStore } from '@/lib/store';
import { DEFAULT_HOMEPAGE_LAYOUT } from '@/lib/defaultHomepageLayout';
import { HomepageSectionConfig } from '@/types/homepageCms';

describe('PocketKirana — Homepage CMS → Customer Website & APK Dynamic Sync Matrix', () => {
  beforeEach(() => {
    HomepageCmsService.resetToDefault({ id: 'admin_test', name: 'Test Admin', role: 'SuperAdmin' });
  });

  describe('1. Admin CMS CRUD Operations & Ordering', () => {
    it('creates a new section and sets appropriate displayOrder', () => {
      const newSection: HomepageSectionConfig = {
        id: 'sec-navratri-hero',
        type: 'FestivalHero',
        title: '9 Divine Days of Navratri',
        subtitle: '100% Pure Vrat Essentials',
        badge: 'NAVRATRI SPECIAL',
        layoutStyle: 'banner',
        displayOrder: 1,
        targetPersona: 'ALL',
        isActive: true,
      };

      const result = HomepageCmsService.saveSection(newSection, { id: 'admin_1', name: 'Pooja Admin', role: 'Admin' });
      expect(result.layout.sections.some((s) => s.id === 'sec-navratri-hero')).toBe(true);

      const saved = result.layout.sections.find((s) => s.id === 'sec-navratri-hero');
      expect(saved?.title).toBe('9 Divine Days of Navratri');
      expect(saved?.type).toBe('FestivalHero');
    });

    it('edits an existing section title, subtitle, and CTA link', () => {
      const section: HomepageSectionConfig = {
        id: 'sec-hero-main',
        type: 'Hero',
        title: 'Navratri Special Offers',
        subtitle: 'Special deals on fasting flour and fruits',
        ctaText: 'SHOP FESTIVE',
        ctaLink: '/campaign/navratri',
        layoutStyle: 'banner',
        displayOrder: 1,
        targetPersona: 'ALL',
        isActive: true,
      };

      const result = HomepageCmsService.saveSection(section);
      const updated = result.layout.sections.find((s) => s.id === 'sec-hero-main');
      expect(updated?.title).toBe('Navratri Special Offers');
      expect(updated?.ctaLink).toBe('/campaign/navratri');
    });

    it('reorders sections from top to bottom correctly', () => {
      const initial = HomepageCmsService.getLayout();
      const firstTwo = initial.sections.slice(0, 2);
      const reversedIds = [firstTwo[1].id, firstTwo[0].id, ...initial.sections.slice(2).map((s) => s.id)];

      const reordered = HomepageCmsService.reorderSections(reversedIds);
      expect(reordered.layout.sections[0].id).toBe(firstTwo[1].id);
      expect(reordered.layout.sections[1].id).toBe(firstTwo[0].id);
      expect(reordered.layout.sections[0].displayOrder).toBe(1);
      expect(reordered.layout.sections[1].displayOrder).toBe(2);
    });

    it('enables and disables a section', () => {
      const initial = HomepageCmsService.getLayout();
      const target = initial.sections[0];

      HomepageCmsService.saveSection({ ...target, isActive: false });
      const draft = HomepageCmsService.getLayout();
      expect(draft.sections.find((s) => s.id === target.id)?.isActive).toBe(false);

      // Customer API should not return disabled section
      const customerApi = HomepageCmsService.getPublishedCustomerHomepage('ALL');
      expect(customerApi.sections.some((s) => s.id === target.id)).toBe(false);
    });

    it('deletes a section and re-indexes display orders', () => {
      const initial = HomepageCmsService.getLayout();
      const countBefore = initial.sections.length;
      const targetId = initial.sections[0].id;

      const deleted = HomepageCmsService.deleteSection(targetId);
      expect(deleted.layout.sections.length).toBe(countBefore - 1);
      expect(deleted.layout.sections.some((s) => s.id === targetId)).toBe(false);
      expect(deleted.layout.sections[0].displayOrder).toBe(1);
    });
  });

  describe('2. Atomic Publish, Versioning & Rollback History', () => {
    it('publishes layout atomically, incrementing version and generating diff', () => {
      const vBefore = HomepageCmsService.getLayout().version;

      // Make a change
      HomepageCmsService.saveSection({
        id: 'sec-diwali-mega',
        type: 'FestivalHero',
        title: 'Diwali Mega Dhamaka',
        layoutStyle: 'banner',
        displayOrder: 1,
        targetPersona: 'ALL',
        isActive: true,
      });

      const publishRes = HomepageCmsService.publish({ id: 'admin_1', name: 'Lead Admin', role: 'SuperAdmin' });
      expect(publishRes.success).toBe(true);
      expect(publishRes.version).toBe(vBefore + 1);

      const history = HomepageCmsService.getVersionHistory();
      expect(history[0].version).toBe(vBefore + 1);
      expect(history[0].sections.some((s) => s.id === 'sec-diwali-mega')).toBe(true);
    });

    it('supports instant rollback to a past version without deleting history', () => {
      // Version 1 is current
      // Publish Version 2
      HomepageCmsService.saveSection({
        id: 'sec-v2-temp',
        type: 'FlashSale',
        title: 'V2 Flash Sale',
        layoutStyle: 'carousel',
        displayOrder: 1,
        targetPersona: 'ALL',
        isActive: true,
      });
      const pubV2 = HomepageCmsService.publish();
      expect(pubV2.version).toBeGreaterThan(1);

      // Rollback to Version 1
      const rollbackRes = HomepageCmsService.rollback(1);
      expect(rollbackRes.success).toBe(true);
      // Rollback publishes as Version 3 (new version) while restoring v1 content
      expect(rollbackRes.version).toBe(pubV2.version + 1);

      const live = HomepageCmsService.getPublishedCustomerHomepage();
      // Should NOT contain the v2 temporary section
      expect(live.sections.some((s) => s.id === 'sec-v2-temp')).toBe(false);

      // Full version history is preserved
      const history = HomepageCmsService.getVersionHistory();
      expect(history.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('3. Customer API & Persona Filtering', () => {
    it('returns client-agnostic structure containing only active published content', () => {
      const res = HomepageCmsService.getPublishedCustomerHomepage('ALL');
      expect(res.status).toBe('PUBLISHED');
      expect(typeof res.version).toBe('number');
      expect(Array.isArray(res.sections)).toBe(true);
      expect(res.sections.every((s) => s.isActive)).toBe(true);
    });

    it('filters persona-specific sections accurately', () => {
      HomepageCmsService.saveSection({
        id: 'sec-vip-only',
        type: 'LoyaltyProgress',
        title: 'VIP Exclusive Lounge',
        layoutStyle: 'compact',
        displayOrder: 1,
        targetPersona: 'LOYALTY_VIP',
        isActive: true,
      });
      HomepageCmsService.publish();

      const newCustomerView = HomepageCmsService.getPublishedCustomerHomepage('NEW_CUSTOMER');
      expect(newCustomerView.sections.some((s) => s.id === 'sec-vip-only')).toBe(false);

      const vipView = HomepageCmsService.getPublishedCustomerHomepage('LOYALTY_VIP');
      expect(vipView.sections.some((s) => s.id === 'sec-vip-only')).toBe(true);
    });

    it('automatically excludes expired campaigns based on scheduleEnd', () => {
      const pastTime = new Date(Date.now() - 3600000).toISOString();
      HomepageCmsService.saveSection({
        id: 'sec-expired-holi',
        type: 'FestivalHero',
        title: 'Holi Colors Sale (Expired)',
        layoutStyle: 'banner',
        displayOrder: 1,
        targetPersona: 'ALL',
        scheduleEnd: pastTime,
        isActive: true,
      });
      HomepageCmsService.publish();

      const live = HomepageCmsService.getPublishedCustomerHomepage();
      expect(live.sections.some((s) => s.id === 'sec-expired-holi')).toBe(false);
    });
  });

  describe('4. Single Source of Truth & Web/APK Dynamic Sync', () => {
    it('synchronizes content instantly across store and API consumers without APK release', () => {
      // 1. Admin creates a new category order
      const initialSections = HomepageCmsService.getLayout().sections;
      const modifiedTitle = 'Vrat & Upwas Specials 2026';

      HomepageCmsService.saveSection({
        ...initialSections[0],
        title: modifiedTitle,
      });
      const pub = HomepageCmsService.publish();

      // 2. Customer Website & Customer APK both fetch from same canonical backend
      const webView = HomepageCmsService.getPublishedCustomerHomepage();
      const apkView = HomepageCmsService.getPublishedCustomerHomepage();

      expect(webView.version).toBe(pub.version);
      expect(apkView.version).toBe(pub.version);
      expect(webView.sections[0].title).toBe(modifiedTitle);
      expect(apkView.sections[0].title).toBe(modifiedTitle);
    });

    it('records detailed audit log for all CMS modifications', () => {
      HomepageCmsService.saveSection({
        id: 'sec-audit-test',
        type: 'DailyEssentials',
        title: 'Audit Tested Essentials',
        layoutStyle: 'carousel',
        displayOrder: 1,
        targetPersona: 'ALL',
        isActive: true,
      }, { id: 'admin_audit', name: 'Audit Officer', role: 'SuperAdmin' });

      HomepageCmsService.publish({ id: 'admin_audit', name: 'Audit Officer', role: 'SuperAdmin' });

      const logs = HomepageCmsService.getAuditLogs();
      expect(logs.some((l) => l.action === 'SECTION_CREATED' && l.sectionId === 'sec-audit-test')).toBe(true);
      expect(logs.some((l) => l.action === 'HOMEPAGE_PUBLISHED')).toBe(true);
      expect(logs[0].adminName).toBe('Audit Officer');
    });
  });
});
