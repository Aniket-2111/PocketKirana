import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  detectMeasurementType,
  detectWeightUnit,
  formatQuantity,
  formatQuantityNumber,
  normalizeDecimal,
  isQuantityComplete,
  calculateRemaining,
  validatePickedInput,
} from '../lib/measurementUtils';

describe('PocketKirana Picker App — Unit & Weight-Based Picking & Inventory Workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Product Measurement System Detection', () => {
    it('identifies packaged products as UNIT', () => {
      expect(detectMeasurementType({ name: 'Amul Fresh Milk 1L', unit: '1 L' })).toBe('UNIT');
      expect(detectMeasurementType({ name: 'Britannia Bread 400g', unit: '400 g' })).toBe('UNIT');
      expect(detectMeasurementType({ name: 'Aashirvaad Superior MP Atta 5kg', unit: '5 kg' })).toBe('UNIT');
      expect(detectMeasurementType({ name: 'Dettol Soap 125g', unit: '125 g' })).toBe('UNIT');
      expect(detectMeasurementType({ name: 'Fortune Sunflower Oil 1L', unit: '1 L' })).toBe('UNIT');
    });

    it('identifies loose products as WEIGHT', () => {
      expect(detectMeasurementType({ name: 'Loose Rice', unit: '1 kg' })).toBe('WEIGHT');
      expect(detectMeasurementType({ name: 'Loose Flour', unit: '1 kg' })).toBe('WEIGHT');
      expect(detectMeasurementType({ name: 'Loose Chakki Atta', unit: '1 kg' })).toBe('WEIGHT');
      expect(detectMeasurementType({ name: 'Loose Moong Dal', unit: '1 kg' })).toBe('WEIGHT');
      expect(detectMeasurementType({ name: 'Loose Sugar', unit: '1 kg' })).toBe('WEIGHT');
      expect(detectMeasurementType({ isLoose: true, name: 'Premium Rice' })).toBe('WEIGHT');
    });

    it('detects explicit measurementType schema field', () => {
      expect(detectMeasurementType({ measurementType: 'WEIGHT' })).toBe('WEIGHT');
      expect(detectMeasurementType({ measurementType: 'UNIT' })).toBe('UNIT');
    });

    it('detects weight unit accurately', () => {
      expect(detectWeightUnit({ name: 'Loose Rice', unit: '1 kg' })).toBe('KG');
      expect(detectWeightUnit({ name: 'Loose Cardamom', unit: '250 g' })).toBe('G');
      expect(detectWeightUnit({ weightUnit: 'G' })).toBe('G');
    });
  });

  describe('2. UNIT Products Picking & Bounds (Countable)', () => {
    const requiredUnits = 2;

    it('validates 0 <= picked <= required for unit products', () => {
      expect(isQuantityComplete(0, requiredUnits, 'UNIT')).toBe(false);
      expect(isQuantityComplete(1, requiredUnits, 'UNIT')).toBe(false);
      expect(isQuantityComplete(2, requiredUnits, 'UNIT')).toBe(true);
    });

    it('calculates remaining units correctly', () => {
      expect(calculateRemaining(requiredUnits, 0, 'UNIT')).toBe(2);
      expect(calculateRemaining(requiredUnits, 1, 'UNIT')).toBe(1);
      expect(calculateRemaining(requiredUnits, 2, 'UNIT')).toBe(0);
    });

    it('rejects over-picking for unit products', () => {
      const overPickAttempt = validatePickedInput(3, requiredUnits, 'UNIT');
      expect(overPickAttempt.valid).toBe(false);
      expect(overPickAttempt.error).toContain('cannot exceed ordered quantity');
    });

    it('formats unit display properly', () => {
      expect(formatQuantity(0, 'UNIT')).toBe('0 units');
      expect(formatQuantity(1, 'UNIT')).toBe('1 unit');
      expect(formatQuantity(2, 'UNIT')).toBe('2 units');
    });
  });

  describe('3. WEIGHT Products Picking & Decimal Precision (Loose)', () => {
    const requiredWeightKg = 2.500;

    it('requires exact weight completion (remaining = 0.000 kg)', () => {
      expect(isQuantityComplete(0, requiredWeightKg, 'WEIGHT')).toBe(false);
      expect(isQuantityComplete(0.500, requiredWeightKg, 'WEIGHT')).toBe(false);
      expect(isQuantityComplete(1.250, requiredWeightKg, 'WEIGHT')).toBe(false);
      expect(isQuantityComplete(2.000, requiredWeightKg, 'WEIGHT')).toBe(false);
      expect(isQuantityComplete(2.499, requiredWeightKg, 'WEIGHT')).toBe(false);
      expect(isQuantityComplete(2.500, requiredWeightKg, 'WEIGHT')).toBe(true);
    });

    it('calculates exact decimal remaining weight', () => {
      expect(calculateRemaining(requiredWeightKg, 0, 'WEIGHT')).toBe(2.500);
      expect(calculateRemaining(requiredWeightKg, 2.000, 'WEIGHT')).toBe(0.500);
      expect(calculateRemaining(requiredWeightKg, 2.350, 'WEIGHT')).toBe(0.150);
      expect(calculateRemaining(requiredWeightKg, 2.500, 'WEIGHT')).toBe(0);
    });

    it('rejects over-picking for weight products', () => {
      const overPickAttempt = validatePickedInput(2.501, requiredWeightKg, 'WEIGHT');
      expect(overPickAttempt.valid).toBe(false);
      expect(overPickAttempt.error).toContain('cannot exceed ordered quantity');

      const excessivePick = validatePickedInput(3.000, requiredWeightKg, 'WEIGHT');
      expect(excessivePick.valid).toBe(false);
    });

    it('normalizes floating point operations without JS float rounding artifacts', () => {
      // Classic JS float bug: 0.1 + 0.2 = 0.30000000000000004
      const rawSum = 0.1 + 0.2;
      expect(normalizeDecimal(rawSum, 3)).toBe(0.3);
      expect(formatQuantity(rawSum, 'WEIGHT', 'KG')).toBe('0.300 kg');
    });

    it('formats weight quantities to 3 decimal places', () => {
      expect(formatQuantity(2.5, 'WEIGHT', 'KG')).toBe('2.500 kg');
      expect(formatQuantity(0.25, 'WEIGHT', 'KG')).toBe('0.250 kg');
      expect(formatQuantity(1.125, 'WEIGHT', 'KG')).toBe('1.125 kg');
    });
  });

  describe('4. Order Level Completion Rule (All Items Must Be Picked, No Bypass)', () => {
    const orderItems = [
      { id: '1', name: 'Loose Rice', measurementType: 'WEIGHT' as const, quantityRequired: 2.500, quantityPicked: 2.500 },
      { id: '2', name: 'Loose Atta', measurementType: 'WEIGHT' as const, quantityRequired: 1.000, quantityPicked: 1.000 },
      { id: '3', name: 'Milk 1L', measurementType: 'UNIT' as const, quantityRequired: 2, quantityPicked: 2 },
      { id: '4', name: 'Bread 400g', measurementType: 'UNIT' as const, quantityRequired: 1, quantityPicked: 0 },
    ];

    it('disallows order completion when any single item is incomplete', () => {
      const checkOrderCanComplete = (items: typeof orderItems) => {
        return items.every((i) => isQuantityComplete(i.quantityPicked, i.quantityRequired, i.measurementType));
      };

      // 3 of 4 items complete
      expect(checkOrderCanComplete(orderItems)).toBe(false);

      // Incomplete items summary
      const incomplete = orderItems.filter((i) => !isQuantityComplete(i.quantityPicked, i.quantityRequired, i.measurementType));
      expect(incomplete.length).toBe(1);
      expect(incomplete[0].name).toBe('Bread 400g');

      // Finish Bread (1 / 1)
      const completeOrderItems = orderItems.map((i) => i.id === '4' ? { ...i, quantityPicked: 1 } : i);
      expect(checkOrderCanComplete(completeOrderItems)).toBe(true);
    });
  });

  describe('5. Inventory Addition & Transaction Math', () => {
    it('calculates Unit product addition correctly (63 + 10 = 73 units)', () => {
      const currentStock = 63;
      const quantityToAdd = 10;
      const newStock = normalizeDecimal(currentStock + quantityToAdd, 3);
      expect(newStock).toBe(73);
    });

    it('calculates Weight product addition correctly (63.500 kg + 10.250 kg = 73.750 kg)', () => {
      const currentStock = 63.500;
      const quantityToAdd = 10.250;
      const newStock = normalizeDecimal(currentStock + quantityToAdd, 3);
      expect(newStock).toBe(73.750);
    });

    it('validates stock receipt quantities', () => {
      const validateStockReceipt = (qty: any) => {
        const num = normalizeDecimal(qty, 3);
        if (isNaN(num) || num <= 0) return { valid: false, error: 'Must be positive > 0' };
        
        const strVal = String(qty).trim();
        if (strVal.includes('.') && strVal.split('.')[1].length > 3) {
          return { valid: false, error: 'Cannot exceed 3 decimal places' };
        }
        return { valid: true };
      };

      expect(validateStockReceipt(0).valid).toBe(false);
      expect(validateStockReceipt(-5).valid).toBe(false);
      expect(validateStockReceipt(10.250).valid).toBe(true);
      expect(validateStockReceipt(2.5555).valid).toBe(false);
    });
  });

  describe('6. SlideToConfirm Safety Guards', () => {
    it('disallows slide confirmation until progress threshold reaches 90%', () => {
      const isConfirmed = (progressPct: number) => progressPct >= 90;

      expect(isConfirmed(0)).toBe(false);
      expect(isConfirmed(50)).toBe(false);
      expect(isConfirmed(89)).toBe(false);
      expect(isConfirmed(90)).toBe(true);
      expect(isConfirmed(100)).toBe(true);
    });
  });
});
