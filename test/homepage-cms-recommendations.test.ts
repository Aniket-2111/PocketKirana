import { describe, it, expect, beforeEach } from 'vitest';
import {
  getBuyAgainProducts,
  getBecauseYouBought,
  getFrequentlyBoughtTogether,
  getPersonalizedRecommendations,
  getSmartCartOffers,
  evaluateSectionVisibilityForPersona,
  filterPurchasableProducts,
} from '@/lib/recommendationsEngine';
import { INDIAN_FESTIVAL_CMS_TEMPLATES, getFestivalTemplateById } from '@/lib/festivalTemplates';
import { DEFAULT_HOMEPAGE_LAYOUT } from '@/lib/defaultHomepageLayout';
import { useAppStore } from '@/lib/store';
import { Product, Order, CartItem, User } from '@/types';
import { HomepageSectionConfig, CustomerPersona } from '@/types/homepageCms';

const mockProducts: Product[] = [
  {
    id: 'prod-milk',
    name: 'Amul Taaza Homogenised Toned Milk 1L',
    slug: 'amul-taaza-toned-milk-1l',
    sku: 'MILK-001',
    categoryId: 'cat-dairy',
    brandId: 'brand-amul',
    brandName: 'Amul',
    mrp: 75,
    sellingPrice: 70,
    costPrice: 60,
    stock: 25,
    unit: '1 L',
    images: ['/images/milk.jpg'],
    description: 'Fresh toned milk',
    rating: 4.8,
    reviewsCount: 150,
    isPopular: true,
    isFeatured: true,
    status: 'active',
  } as unknown as Product,
  {
    id: 'prod-bread',
    name: 'Harvest Gold White Bread 400g',
    slug: 'harvest-gold-white-bread-400g',
    sku: 'BREAD-001',
    categoryId: 'cat-bakery',
    brandId: 'brand-harvest',
    brandName: 'Harvest Gold',
    mrp: 45,
    sellingPrice: 40,
    costPrice: 32,
    stock: 15,
    unit: '400 g',
    images: ['/images/bread.jpg'],
    description: 'Soft sliced bread',
    rating: 4.6,
    reviewsCount: 95,
    isPopular: true,
    status: 'active',
  } as unknown as Product,
  {
    id: 'prod-butter',
    name: 'Amul Salted Butter 100g',
    slug: 'amul-salted-butter-100g',
    sku: 'BUTTER-001',
    categoryId: 'cat-dairy',
    brandId: 'brand-amul',
    brandName: 'Amul',
    mrp: 58,
    sellingPrice: 56,
    costPrice: 48,
    stock: 30,
    unit: '100 g',
    images: ['/images/butter.jpg'],
    description: 'Delicious butter',
    rating: 4.9,
    reviewsCount: 220,
    isFeatured: true,
    status: 'active',
  } as unknown as Product,
  {
    id: 'prod-eggs',
    name: 'Farm Fresh White Eggs 6 pcs',
    slug: 'farm-fresh-white-eggs-6pcs',
    sku: 'EGGS-001',
    categoryId: 'cat-dairy',
    brandId: 'brand-fresheggs',
    brandName: 'Eggoz',
    mrp: 60,
    sellingPrice: 52,
    costPrice: 42,
    stock: 0, // Out of stock
    unit: '6 pcs',
    images: ['/images/eggs.jpg'],
    description: 'Farm eggs',
    rating: 4.5,
    reviewsCount: 80,
    status: 'active',
  } as unknown as Product,
  {
    id: 'prod-chips',
    name: 'Lays Magic Masala Potato Chips 50g',
    slug: 'lays-magic-masala-50g',
    sku: 'SNACK-001',
    categoryId: 'cat-snacks',
    brandId: 'brand-lays',
    brandName: 'Lays',
    mrp: 20,
    sellingPrice: 18,
    costPrice: 14,
    stock: 50,
    unit: '50 g',
    images: ['/images/chips.jpg'],
    description: 'Crunchy potato chips',
    rating: 4.4,
    reviewsCount: 300,
    isPopular: true,
    status: 'active',
  } as unknown as Product,
];

const mockOrders: Order[] = [
  {
    id: 'ord-101',
    orderNumber: 'PK-101',
    customerId: 'cust-1',
    customerName: 'Aarav Sharma',
    customerPhone: '+91 9876543210',
    deliveryAddress: {
      id: 'addr-1',
      addressType: 'Home',
      addressLine1: '123 Park Street',
      city: 'Mumbai',
      state: 'MH',
      postalCode: '400001',
      isDefault: true,
    } as any,
    items: [
      {
        id: 'item-1',
        productId: 'prod-milk',
        unitPrice: 70,
        mrp: 75,
        quantity: 2,
        totalPrice: 140,
      } as any,
      {
        id: 'item-2',
        productId: 'prod-bread',
        unitPrice: 40,
        mrp: 45,
        quantity: 1,
        totalPrice: 40,
      } as any,
    ],
    subtotal: 180,
    discount: 0,
    deliveryFee: 0,
    deliveryCharge: 0,
    tax: 0,
    total: 180,
    paymentMethod: 'upi',
    paymentStatus: 'paid',
    orderStatus: 'delivered',
    placedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    deliverySlot: 'Standard',
    deliveryOtp: '1234',
    statusHistory: [],
  } as unknown as Order,
  {
    id: 'ord-102',
    orderNumber: 'PK-102',
    customerId: 'cust-1',
    customerName: 'Aarav Sharma',
    customerPhone: '+91 9876543210',
    deliveryAddress: {
      id: 'addr-1',
      addressType: 'Home',
      addressLine1: '123 Park Street',
      city: 'Mumbai',
      state: 'MH',
      postalCode: '400001',
      isDefault: true,
    } as any,
    items: [
      {
        id: 'item-3',
        productId: 'prod-milk',
        unitPrice: 70,
        mrp: 75,
        quantity: 1,
        totalPrice: 70,
      } as any,
    ],
    subtotal: 70,
    discount: 0,
    deliveryFee: 25,
    deliveryCharge: 25,
    tax: 0,
    total: 95,
    paymentMethod: 'upi',
    paymentStatus: 'paid',
    orderStatus: 'delivered',
    placedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    deliverySlot: 'Standard',
    deliveryOtp: '1234',
    statusHistory: [],
  } as unknown as Order,
];

describe('Homepage CMS & Recommendation Engine Test Suite', () => {
  describe('1. Inventory & Purchasability Guardrails', () => {
    it('filters out products with 0 stock or discontinued status', () => {
      const purchasable = filterPurchasableProducts(mockProducts);
      expect(purchasable.find((p) => p.id === 'prod-eggs')).toBeUndefined();
      expect(purchasable.length).toBe(4);
    });
  });

  describe('2. Buy Again & Repeat Purchase Logic', () => {
    it('ranks frequently ordered products at top and excludes out of stock items', () => {
      const buyAgain = getBuyAgainProducts(mockOrders, mockProducts);
      expect(buyAgain.length).toBeGreaterThan(0);
      // Milk ordered in 2 orders with total qty 3 -> should be top item
      expect(buyAgain[0].id).toBe('prod-milk');
      expect(buyAgain[1].id).toBe('prod-bread');
      // Eggs is out of stock -> must never be recommended
      expect(buyAgain.find((p) => p.id === 'prod-eggs')).toBeUndefined();
    });

    it('falls back to essentials when user has no past delivered orders', () => {
      const buyAgain = getBuyAgainProducts([], mockProducts);
      expect(buyAgain.length).toBeGreaterThan(0);
      expect(buyAgain.find((p) => p.id === 'prod-eggs')).toBeUndefined();
    });
  });

  describe('3. Because You Bought Cross-Sell Logic', () => {
    it('suggests products from the same category as past purchases', () => {
      const recommendations = getBecauseYouBought(mockOrders, mockProducts);
      expect(recommendations.length).toBeGreaterThan(0);
      const dairyGroup = recommendations.find((r) => r.triggerProduct.id === 'prod-milk');
      if (dairyGroup) {
        expect(dairyGroup.recommendations.some((p) => p.id === 'prod-butter')).toBe(true);
      }
    });
  });

  describe('4. Frequently Bought Together & Bundle Offers', () => {
    it('creates intelligent bundles with calculated savings', () => {
      const bundle = getFrequentlyBoughtTogether('prod-bread', mockProducts, mockOrders);
      expect(bundle).not.toBeNull();
      if (bundle) {
        expect(bundle.mainProductId).toBe('prod-bread');
        expect(bundle.bundledProductIds.length).toBeGreaterThan(0);
        expect(bundle.bundlePrice).toBeLessThanOrEqual(bundle.totalMrp);
        expect(bundle.savings).toBe(bundle.totalMrp - (bundle.bundlePrice || 0));
      }
    });
  });

  describe('5. Multi-Signal Persona Recommendations', () => {
    it('scores and ranks personalized recommendations', () => {
      const mockUser: User = {
        id: 'cust-1',
        firstName: 'Aarav',
        mobile: '+919876543210',
        role: 'customer',
        status: 'active',
        createdAt: new Date().toISOString(),
      };

      const recs = getPersonalizedRecommendations(
        mockUser,
        { orders: mockOrders },
        mockProducts
      );

      expect(recs.length).toBeGreaterThan(0);
      // Out of stock items must never be included
      expect(recs.find((r) => r.product.id === 'prod-eggs')).toBeUndefined();
    });
  });

  describe('6. Smart Cart Offers & Free Delivery / Gift Progress', () => {
    it('calculates progress accurately when below threshold', () => {
      const smartOffers = getSmartCartOffers(140, mockProducts, 299, 499);
      expect(smartOffers.subtotal).toBe(140);
      expect(smartOffers.freeDeliveryUnlocked).toBe(false);
      expect(smartOffers.freeDeliveryAmountNeeded).toBe(159);
      expect(smartOffers.freeGiftUnlocked).toBe(false);
    });

    it('unlocks free delivery when above delivery threshold', () => {
      const smartOffers = getSmartCartOffers(350, mockProducts, 299, 499);
      expect(smartOffers.subtotal).toBe(350);
      expect(smartOffers.freeDeliveryUnlocked).toBe(true);
      expect(smartOffers.freeDeliveryAmountNeeded).toBe(0);
      expect(smartOffers.freeGiftUnlocked).toBe(false);
      expect(smartOffers.freeGiftAmountNeeded).toBe(149);
    });

    it('unlocks both free delivery and free gift when above gift threshold', () => {
      const smartOffers = getSmartCartOffers(560, mockProducts, 299, 499);
      expect(smartOffers.subtotal).toBe(560);
      expect(smartOffers.freeDeliveryUnlocked).toBe(true);
      expect(smartOffers.freeGiftUnlocked).toBe(true);
      expect(smartOffers.freeGiftAmountNeeded).toBe(0);
    });
  });

  describe('7. Section Visibility & Persona Targeting', () => {
    const section: HomepageSectionConfig = {
      id: 'sec-1',
      title: 'Member Only Deals',
      type: 'FlashSale',
      layoutStyle: 'carousel',
      isActive: true,
      displayOrder: 1,
      targetPersona: 'LOYALTY_VIP',
    };

    it('shows section when persona matches', () => {
      expect(evaluateSectionVisibilityForPersona(section, 'LOYALTY_VIP')).toBe(true);
    });

    it('hides section when persona does not match and is not ALL', () => {
      expect(evaluateSectionVisibilityForPersona(section, 'NEW_CUSTOMER')).toBe(false);
    });

    it('shows section for all personas when targetPersona is ALL', () => {
      const openSection: HomepageSectionConfig = {
        ...section,
        targetPersona: 'ALL',
      };
      expect(evaluateSectionVisibilityForPersona(openSection, 'NEW_CUSTOMER')).toBe(true);
      expect(evaluateSectionVisibilityForPersona(openSection, 'RETURNING_CUSTOMER')).toBe(true);
    });

    it('hides section if isActive is false', () => {
      const disabledSection: HomepageSectionConfig = {
        ...section,
        isActive: false,
        targetPersona: 'ALL',
      };
      expect(evaluateSectionVisibilityForPersona(disabledSection, 'ALL')).toBe(false);
    });
  });

  describe('8. 20+ Ready-Made Indian Festival & Sale Templates', () => {
    it('contains at least 20 festival & sale presets', () => {
      expect(INDIAN_FESTIVAL_CMS_TEMPLATES.length).toBeGreaterThanOrEqual(20);
    });

    it('verifies all presets have required metadata, theme colors, banners, and sections', () => {
      INDIAN_FESTIVAL_CMS_TEMPLATES.forEach((tpl) => {
        expect(tpl.id).toBeDefined();
        expect(tpl.name).toBeTruthy();
        expect(tpl.theme.primaryColor).toMatch(/^#/);
        expect(tpl.sections.length).toBeGreaterThan(0);
      });
    });

    it('retrieves template by ID accurately', () => {
      const ganesh = getFestivalTemplateById('tpl-ganesh-chaturthi-premium');
      expect(ganesh).toBeDefined();
      expect(ganesh?.name).toContain('Ganesh');

      const diwali = getFestivalTemplateById('tpl-diwali-grand-lights');
      expect(diwali).toBeDefined();
      expect(diwali?.name).toContain('Diwali');
    });
  });

  describe('9. Store CMS Actions: Save, Reordering, and Publishing', () => {
    beforeEach(() => {
      useAppStore.setState({
        activeHomepageLayout: DEFAULT_HOMEPAGE_LAYOUT,
        homepageLayouts: [DEFAULT_HOMEPAGE_LAYOUT],
      });
    });

    it('saves a new section in active layout', () => {
      const store = useAppStore.getState();
      const initialCount = store.activeHomepageLayout.sections.length;

      const newSection: HomepageSectionConfig = {
        id: 'sec-custom-flash',
        title: 'Super Flash Deals',
        type: 'FlashSale',
        layoutStyle: 'carousel',
        isActive: true,
        displayOrder: 99,
        targetPersona: 'ALL',
      };

      store.saveHomepageSection(newSection);

      const updated = useAppStore.getState().activeHomepageLayout;
      expect(updated.sections.length).toBe(initialCount + 1);
      const added = updated.sections.find((s) => s.title === 'Super Flash Deals');
      expect(added).toBeDefined();
    });

    it('updates existing section configuration', () => {
      const store = useAppStore.getState();
      const firstSec = store.activeHomepageLayout.sections[0];

      store.saveHomepageSection({
        ...firstSec,
        title: 'Updated Hero Banner Title',
      });

      const updated = useAppStore.getState().activeHomepageLayout;
      const target = updated.sections.find((s) => s.id === firstSec.id);
      expect(target?.title).toBe('Updated Hero Banner Title');
    });

    it('deletes section', () => {
      const store = useAppStore.getState();
      const firstSec = store.activeHomepageLayout.sections[0];

      store.deleteHomepageSection(firstSec.id);

      const updated = useAppStore.getState().activeHomepageLayout;
      expect(updated.sections.find((s) => s.id === firstSec.id)).toBeUndefined();
    });

    it('reorders sections correctly', () => {
      const store = useAppStore.getState();
      const [sec1, sec2] = store.activeHomepageLayout.sections;

      store.reorderHomepageSections([sec2.id, sec1.id]);

      const updated = useAppStore.getState().activeHomepageLayout;
      expect(updated.sections[0].id).toBe(sec2.id);
      expect(updated.sections[1].id).toBe(sec1.id);
    });

    it('publishes layout with incremented version number', () => {
      const store = useAppStore.getState();
      const initialVersion = store.activeHomepageLayout.version;

      const result = store.publishHomepageLayout();
      expect(result.success).toBe(true);
      expect(result.version).toBe(initialVersion + 1);

      const active = useAppStore.getState().activeHomepageLayout;
      expect(active.version).toBe(initialVersion + 1);
      expect(active.status).toBe('PUBLISHED');
    });
  });
});
