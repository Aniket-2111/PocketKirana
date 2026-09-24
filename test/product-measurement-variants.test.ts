import { describe, it, expect } from 'vitest';
import {
  parseLegacyUnit,
  formatCustomerDisplay,
  normalizeVariantMeasurement,
  areVariantsDuplicate,
  calculateLoosePrice,
  detectMeasurementType,
  detectWeightUnit,
  detectVolumeUnit,
  UNIT_OPTIONS,
  WEIGHT_OPTIONS,
  VOLUME_OPTIONS,
  PACKAGING_OPTIONS,
} from '../lib/measurementUtils';
import { Product, ProductVariant, CartItem, OrderItem } from '../types';

describe('PocketKirana Admin — Measurement, Unit & Variant System', () => {

  describe('1. Controlled Measurement & Packaging Enums', () => {
    it('should expose standardized unit and packaging option lists', () => {
      expect(UNIT_OPTIONS).toContain('piece');
      expect(UNIT_OPTIONS).toContain('packet');
      expect(UNIT_OPTIONS).toContain('bottle');
      expect(UNIT_OPTIONS).toContain('can');

      expect(WEIGHT_OPTIONS).toEqual(['KG', 'G']);
      expect(VOLUME_OPTIONS).toEqual(['LTR', 'ML']);

      expect(PACKAGING_OPTIONS).toContain('Loose');
      expect(PACKAGING_OPTIONS).toContain('Packet');
      expect(PACKAGING_OPTIONS).toContain('Bottle');
      expect(PACKAGING_OPTIONS).toContain('Jar');
    });
  });

  describe('2. Legacy Unit Parser (Migration & Backward Compatibility)', () => {
    it('should accurately parse weight expressions', () => {
      const parsed1 = parseLegacyUnit('1 kg');
      expect(parsed1).toEqual({
        measurementType: 'WEIGHT',
        measurementUnit: 'KG',
        measurementValue: 1,
        packagingType: 'Packet',
      });

      const parsed2 = parseLegacyUnit('500 g');
      expect(parsed2).toEqual({
        measurementType: 'WEIGHT',
        measurementUnit: 'G',
        measurementValue: 500,
        packagingType: 'Packet',
      });

      const parsed3 = parseLegacyUnit('2.5 kg', 'Loose Rice');
      expect(parsed3).toEqual({
        measurementType: 'WEIGHT',
        measurementUnit: 'KG',
        measurementValue: 2.5,
        packagingType: 'Loose',
      });
    });

    it('should accurately parse volume expressions', () => {
      const parsed1 = parseLegacyUnit('1 L');
      expect(parsed1).toEqual({
        measurementType: 'VOLUME',
        measurementUnit: 'LTR',
        measurementValue: 1,
        packagingType: 'Bottle',
      });

      const parsed2 = parseLegacyUnit('500 ml');
      expect(parsed2).toEqual({
        measurementType: 'VOLUME',
        measurementUnit: 'ML',
        measurementValue: 500,
        packagingType: 'Bottle',
      });

      const parsed3 = parseLegacyUnit('2 LTR');
      expect(parsed3).toEqual({
        measurementType: 'VOLUME',
        measurementUnit: 'LTR',
        measurementValue: 2,
        packagingType: 'Bottle',
      });
    });

    it('should accurately parse countable unit expressions', () => {
      const parsed1 = parseLegacyUnit('1 packet');
      expect(parsed1.measurementType).toBe('UNIT');
      expect(parsed1.measurementUnit).toBe('PACKET');
      expect(parsed1.measurementValue).toBe(1);

      const parsed2 = parseLegacyUnit('6 pieces');
      expect(parsed2.measurementType).toBe('UNIT');
      expect(parsed2.measurementUnit).toBe('PCS');
      expect(parsed2.measurementValue).toBe(6);

      const parsed3 = parseLegacyUnit('1 bottle');
      expect(parsed3.measurementType).toBe('UNIT');
      expect(parsed3.measurementUnit).toBe('BOTTLE');
      expect(parsed3.measurementValue).toBe(1);
    });
  });

  describe('3. Customer Display Formatting', () => {
    it('should format weight products cleanly', () => {
      expect(formatCustomerDisplay('WEIGHT', 1, 'KG')).toBe('1 kg');
      expect(formatCustomerDisplay('WEIGHT', 5, 'KG', 'Packet', { showPackaging: true })).toBe('5 kg packet');
      expect(formatCustomerDisplay('WEIGHT', 500, 'G')).toBe('500 g');
      expect(formatCustomerDisplay('WEIGHT', 2.5, 'KG', 'Loose', { showLooseLabel: true })).toBe('2.5 kg (Loose)');
    });

    it('should format volume products cleanly', () => {
      expect(formatCustomerDisplay('VOLUME', 1, 'LTR')).toBe('1 L');
      expect(formatCustomerDisplay('VOLUME', 500, 'ML')).toBe('500 ml');
      expect(formatCustomerDisplay('VOLUME', 2, 'LTR', 'Bottle', { showPackaging: true })).toBe('2 L bottle');
    });

    it('should format countable unit products cleanly', () => {
      expect(formatCustomerDisplay('UNIT', 1, 'packet')).toBe('1 packet');
      expect(formatCustomerDisplay('UNIT', 1, 'bottle')).toBe('1 bottle');
      expect(formatCustomerDisplay('UNIT', 6, 'piece')).toBe('6 piece');
    });
  });

  describe('4. Variant Measurement Normalization & Duplicate Prevention', () => {
    it('should detect identical weights in different units as duplicates', () => {
      const v1: Partial<ProductVariant> = {
        measurementType: 'WEIGHT',
        measurementValue: 1,
        measurementUnit: 'KG',
      };
      const v2: Partial<ProductVariant> = {
        measurementType: 'WEIGHT',
        measurementValue: 1000,
        measurementUnit: 'G',
      };
      expect(areVariantsDuplicate(v1, v2)).toBe(true);
    });

    it('should detect identical volumes in different units as duplicates', () => {
      const v1: Partial<ProductVariant> = {
        measurementType: 'VOLUME',
        measurementValue: 1,
        measurementUnit: 'LTR',
      };
      const v2: Partial<ProductVariant> = {
        measurementType: 'VOLUME',
        measurementValue: 1000,
        measurementUnit: 'ML',
      };
      expect(areVariantsDuplicate(v1, v2)).toBe(true);
    });

    it('should distinguish distinct variant sizes', () => {
      const v1: Partial<ProductVariant> = {
        measurementType: 'WEIGHT',
        measurementValue: 2,
        measurementUnit: 'KG',
      };
      const v2: Partial<ProductVariant> = {
        measurementType: 'WEIGHT',
        measurementValue: 5,
        measurementUnit: 'KG',
      };
      expect(areVariantsDuplicate(v1, v2)).toBe(false);
    });
  });

  describe('5. Loose Grocery Pricing with Exact Decimal Math', () => {
    it('should calculate fractional loose item pricing without floating point artifacts', () => {
      // 2.500 kg @ ₹60 / kg = ₹150.00
      expect(calculateLoosePrice(60, 2.5)).toBe(150);

      // 0.500 kg @ ₹120 / kg = ₹60.00
      expect(calculateLoosePrice(120, 0.5)).toBe(60);

      // 1.250 kg @ ₹45 / kg = ₹56.25
      expect(calculateLoosePrice(45, 1.25)).toBe(56.25);
    });
  });

  describe('6. Cart Uniqueness & Variant Isolation', () => {
    it('should construct distinct cart IDs for different variants of the same product', () => {
      const prodId = 'prod-atta-1';
      const variant1: ProductVariant = {
        id: 'var-2kg',
        productId: prodId,
        variantName: '2 kg',
        sellingPrice: 120,
        mrp: 140,
        stockQuantity: 15,
        isActive: true,
      };
      const variant2: ProductVariant = {
        id: 'var-5kg',
        productId: prodId,
        variantName: '5 kg',
        sellingPrice: 265,
        mrp: 295,
        stockQuantity: 40,
        isActive: true,
      };

      const cartItemId1 = `${prodId}::${variant1.id}`;
      const cartItemId2 = `${prodId}::${variant2.id}`;

      expect(cartItemId1).not.toBe(cartItemId2);
      expect(cartItemId1).toBe('prod-atta-1::var-2kg');
      expect(cartItemId2).toBe('prod-atta-1::var-5kg');
    });
  });

  describe('7. Order Item Snapshot Immutability', () => {
    it('should retain variant attributes and original pricing in order items', () => {
      const orderItem: OrderItem = {
        id: 'oi-12345',
        orderId: 'ord-101',
        productId: 'prod-atta-1',
        product: {
          id: 'prod-atta-1',
          name: 'Aashirvaad Atta',
          categoryId: 'cat-staples',
          storeId: 'store-1',
          sku: 'ATTA-AASH',
          barcode: '8901234567890',
          slug: 'aashirvaad-atta',
          description: 'Whole wheat flour',
          unit: '5 kg packet',
          weight: 5,
          mrp: 295,
          sellingPrice: 265,
          taxPercentage: 5,
          thumbnail: 'https://example.com/atta.jpg',
          status: 'active',
          rating: 4.8,
          reviewsCount: 120,
        },
        quantity: 2,
        unitPrice: 265,
        totalPrice: 530,
        subtotal: 530,
        variantId: 'var-5kg',
        variantName: '5 kg',
        measurementType: 'WEIGHT',
        measurementUnit: 'KG',
        measurementValue: 5,
        packagingType: 'Packet',
        mrp: 295,
        sellingPrice: 265,
      };

      expect(orderItem.variantId).toBe('var-5kg');
      expect(orderItem.variantName).toBe('5 kg');
      expect(orderItem.measurementType).toBe('WEIGHT');
      expect(orderItem.measurementUnit).toBe('KG');
      expect(orderItem.measurementValue).toBe(5);
      expect(orderItem.unitPrice).toBe(265);
      expect(orderItem.totalPrice).toBe(530);
    });
  });

});
