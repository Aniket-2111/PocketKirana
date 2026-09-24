import { MeasurementType, WeightUnit, VolumeUnit, MeasurementUnit, PackagingType, ProductVariant } from '@/types';

export const UNIT_OPTIONS = [
  'piece',
  'pack',
  'packet',
  'bottle',
  'box',
  'can',
  'jar',
  'tube',
  'dozen',
] as const;

export const WEIGHT_OPTIONS: WeightUnit[] = ['KG', 'G'];
export const VOLUME_OPTIONS: VolumeUnit[] = ['LTR', 'ML'];

export const PACKAGING_OPTIONS: PackagingType[] = [
  'Loose',
  'Packet',
  'Box',
  'Bottle',
  'Jar',
  'Can',
  'Pouch',
  'Other',
];

/**
 * Normalizes a number to avoid JavaScript floating point arithmetic artifacts.
 * Defaults to 3 decimal places (standard for dark store kg/g measurements).
 */
export function normalizeDecimal(value: number | string | undefined | null, precision: number = 3): number {
  const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
  if (isNaN(num)) return 0;
  const factor = Math.pow(10, precision);
  return Math.round(num * factor) / factor;
}

/**
 * Authoritatively detects whether a product or order item is sold by UNIT, WEIGHT or VOLUME.
 */
export function detectMeasurementType(itemOrProduct: any): MeasurementType {
  if (!itemOrProduct) return 'UNIT';

  // Explicit schema fields
  const explicit = (itemOrProduct.measurementType || itemOrProduct.measurement_type || '').toUpperCase();
  if (explicit === 'WEIGHT') return 'WEIGHT';
  if (explicit === 'VOLUME') return 'VOLUME';
  if (explicit === 'UNIT') return 'UNIT';

  // Check product / item name and unit heuristics
  const name = String(itemOrProduct.name || itemOrProduct.productName || '').toLowerCase();
  const isLoose = itemOrProduct.isLoose === true || itemOrProduct.is_loose === true || itemOrProduct.packagingType === 'Loose';

  if (isLoose) return 'WEIGHT';

  // Check if name denotes loose groceries
  if (
    name.startsWith('loose ') ||
    name.includes(' loose') ||
    name.includes('loose rice') ||
    name.includes('loose atta') ||
    name.includes('loose flour') ||
    name.includes('loose sugar') ||
    name.includes('loose dal') ||
    name.includes('loose pulses') ||
    name.includes('loose grains')
  ) {
    return 'WEIGHT';
  }

  return 'UNIT';
}

/**
 * Detects weight unit (KG or G)
 */
export function detectWeightUnit(itemOrProduct: any): WeightUnit {
  const explicit = itemOrProduct?.weightUnit || itemOrProduct?.weight_unit || itemOrProduct?.measurementUnit;
  if (explicit === 'G' || explicit === 'g') return 'G';
  if (explicit === 'KG' || explicit === 'kg') return 'KG';

  const unit = String(itemOrProduct?.unit || itemOrProduct?.quantityUnit || '').toLowerCase();
  if (unit.endsWith('g') && !unit.endsWith('kg')) return 'G';
  return 'KG';
}

/**
 * Detects volume unit (LTR or ML)
 */
export function detectVolumeUnit(itemOrProduct: any): VolumeUnit {
  const explicit = itemOrProduct?.volumeUnit || itemOrProduct?.measurementUnit;
  if (explicit === 'ML' || explicit === 'ml') return 'ML';
  if (explicit === 'LTR' || explicit === 'ltr' || explicit === 'L' || explicit === 'l') return 'LTR';

  const unit = String(itemOrProduct?.unit || itemOrProduct?.quantityUnit || '').toLowerCase();
  if (unit.includes('ml')) return 'ML';
  return 'LTR';
}

/**
 * Parses a legacy free-text unit (e.g. "1 kg", "500 g", "1 L", "400 g", "1 packet")
 * into a structured measurement model.
 */
export function parseLegacyUnit(rawUnit: string | undefined | null, productName?: string): {
  measurementType: MeasurementType;
  measurementUnit: MeasurementUnit;
  measurementValue: number;
  packagingType: PackagingType;
} {
  const clean = (rawUnit || '').trim().toLowerCase();
  const name = (productName || '').toLowerCase();

  // Check if loose
  const isLoose = clean.includes('loose') || name.startsWith('loose ') || name.includes(' loose');

  // Regex matches: "1.5 kg", "500g", "1 L", "500 ml", "1 packet", "6 pieces", "1 box"
  const match = clean.match(/^([\d.]+)\s*([a-z]+.*)?$/i);
  if (match) {
    const val = parseFloat(match[1]) || 1;
    const rawU = (match[2] || '').trim();

    if (rawU.includes('kg') || rawU === 'kilo' || rawU === 'kilogram') {
      return {
        measurementType: 'WEIGHT',
        measurementUnit: 'KG',
        measurementValue: val,
        packagingType: isLoose ? 'Loose' : 'Packet',
      };
    }

    if (rawU.includes('gm') || rawU.includes('gram') || rawU === 'g') {
      return {
        measurementType: 'WEIGHT',
        measurementUnit: 'G',
        measurementValue: val,
        packagingType: isLoose ? 'Loose' : 'Packet',
      };
    }

    if (rawU === 'l' || rawU === 'ltr' || rawU === 'liter' || rawU === 'litre') {
      return {
        measurementType: 'VOLUME',
        measurementUnit: 'LTR',
        measurementValue: val,
        packagingType: 'Bottle',
      };
    }

    if (rawU.includes('ml') || rawU === 'milli' || rawU === 'milliliter') {
      return {
        measurementType: 'VOLUME',
        measurementUnit: 'ML',
        measurementValue: val,
        packagingType: 'Bottle',
      };
    }

    if (rawU.includes('bottle')) {
      return {
        measurementType: 'UNIT',
        measurementUnit: 'BOTTLE',
        measurementValue: val,
        packagingType: 'Bottle',
      };
    }

    if (rawU.includes('box')) {
      return {
        measurementType: 'UNIT',
        measurementUnit: 'BOX',
        measurementValue: val,
        packagingType: 'Box',
      };
    }

    if (rawU.includes('can')) {
      return {
        measurementType: 'UNIT',
        measurementUnit: 'CAN',
        measurementValue: val,
        packagingType: 'Can',
      };
    }

    if (rawU.includes('jar')) {
      return {
        measurementType: 'UNIT',
        measurementUnit: 'JAR',
        measurementValue: val,
        packagingType: 'Jar',
      };
    }

    if (rawU.includes('tube')) {
      return {
        measurementType: 'UNIT',
        measurementUnit: 'TUBE',
        measurementValue: val,
        packagingType: 'Pouch',
      };
    }

    if (rawU.includes('dozen')) {
      return {
        measurementType: 'UNIT',
        measurementUnit: 'DOZEN',
        measurementValue: val,
        packagingType: 'Packet',
      };
    }

    if (rawU.includes('pack') || rawU.includes('pkt')) {
      return {
        measurementType: 'UNIT',
        measurementUnit: 'PACKET',
        measurementValue: val,
        packagingType: 'Packet',
      };
    }

    if (rawU.includes('piece') || rawU.includes('pc')) {
      return {
        measurementType: 'UNIT',
        measurementUnit: 'PCS',
        measurementValue: val,
        packagingType: 'Packet',
      };
    }
  }

  // Fallback heuristic based on product name if unit is empty or arbitrary
  if (isLoose) {
    return {
      measurementType: 'WEIGHT',
      measurementUnit: 'KG',
      measurementValue: 1,
      packagingType: 'Loose',
    };
  }

  return {
    measurementType: 'UNIT',
    measurementUnit: 'PACKET',
    measurementValue: 1,
    packagingType: 'Packet',
  };
}

/**
 * Formats structured measurement into customer-friendly display text
 * e.g. "1 kg", "500 g", "1 L", "500 ml", "1 packet", "5 kg packet", "1 kg (Loose)"
 */
export function formatCustomerDisplay(
  measurementType?: MeasurementType,
  measurementValue?: number | string,
  measurementUnit?: MeasurementUnit | string,
  packagingType?: PackagingType | string,
  options: { showPackaging?: boolean; showLooseLabel?: boolean } = {}
): string {
  const type = measurementType || 'UNIT';
  const val = typeof measurementValue === 'string' ? parseFloat(measurementValue) : (measurementValue ?? 1);
  const u = String(measurementUnit || '').toUpperCase();
  const pkg = String(packagingType || '');

  let base = '';
  if (type === 'WEIGHT') {
    if (u === 'G' || u === 'GM' || u === 'GRAM') {
      base = `${val} g`;
    } else {
      // KG
      const numStr = Number.isInteger(val) ? `${val}` : `${normalizeDecimal(val, 3)}`;
      base = `${numStr} kg`;
    }
  } else if (type === 'VOLUME') {
    if (u === 'ML') {
      base = `${val} ml`;
    } else {
      // LTR
      const numStr = Number.isInteger(val) ? `${val}` : `${normalizeDecimal(val, 3)}`;
      base = `${numStr} L`;
    }
  } else {
    // UNIT
    const unitWord = (measurementUnit || 'piece').toLowerCase();
    base = `${val} ${unitWord}`;
  }

  if (pkg === 'Loose') {
    if (options.showLooseLabel) {
      return `${base} (Loose)`;
    }
    return base;
  }

  if (options.showPackaging && pkg && pkg !== 'Other' && !base.toLowerCase().includes(pkg.toLowerCase())) {
    return `${base} ${pkg.toLowerCase()}`;
  }

  return base;
}

/**
 * Normalizes a variant measurement to a canonical base number for deduplication
 * - WEIGHT: returns normalized grams
 * - VOLUME: returns normalized milliliters
 * - UNIT: returns `${measurementValue}_${measurementUnit.toUpperCase()}`
 */
export function normalizeVariantMeasurement(
  measurementType?: MeasurementType,
  measurementValue?: number | string,
  measurementUnit?: MeasurementUnit | string
): string {
  const type = measurementType || 'UNIT';
  const val = typeof measurementValue === 'string' ? parseFloat(measurementValue) : (measurementValue ?? 0);
  const u = String(measurementUnit || '').toUpperCase();

  if (type === 'WEIGHT') {
    const grams = (u === 'KG' || u === 'KILO') ? val * 1000 : val;
    return `WEIGHT_${normalizeDecimal(grams, 2)}g`;
  }

  if (type === 'VOLUME') {
    const ml = (u === 'LTR' || u === 'L') ? val * 1000 : val;
    return `VOLUME_${normalizeDecimal(ml, 2)}ml`;
  }

  return `UNIT_${val}_${u}`;
}

/**
 * Checks if two product variants represent a duplicate measurement size
 */
export function areVariantsDuplicate(
  v1: Partial<ProductVariant>,
  v2: Partial<ProductVariant>
): boolean {
  const k1 = normalizeVariantMeasurement(v1.measurementType, v1.measurementValue ?? v1.quantityValue, v1.measurementUnit ?? v1.quantityUnit);
  const k2 = normalizeVariantMeasurement(v2.measurementType, v2.measurementValue ?? v2.quantityValue, v2.measurementUnit ?? v2.quantityUnit);
  return k1 === k2;
}

/**
 * Formats a quantity with its appropriate unit descriptor for pickers & logistics
 * UNIT: "2 units", "1 unit"
 * WEIGHT: "2.500 kg", "0.250 kg"
 */
export function formatQuantity(
  quantity: number | string,
  measurementType?: MeasurementType,
  weightUnit: WeightUnit = 'KG'
): string {
  const num = typeof quantity === 'string' ? parseFloat(quantity) : (quantity ?? 0);
  const type = measurementType || 'UNIT';

  if (type === 'WEIGHT') {
    const norm = normalizeDecimal(num, 3);
    return `${norm.toFixed(3)} ${weightUnit.toLowerCase()}`;
  }

  if (type === 'VOLUME') {
    const norm = normalizeDecimal(num, 3);
    return `${norm.toFixed(3)} ${weightUnit.toLowerCase() === 'g' ? 'ml' : 'l'}`;
  }

  const rounded = Math.round(num);
  return `${rounded} unit${rounded === 1 ? '' : 's'}`;
}

/**
 * Formats raw numeric string for display
 * UNIT: "2"
 * WEIGHT: "2.500"
 */
export function formatQuantityNumber(
  quantity: number | string,
  measurementType?: MeasurementType
): string {
  const num = typeof quantity === 'string' ? parseFloat(quantity) : (quantity ?? 0);
  const type = measurementType || 'UNIT';

  if (type === 'WEIGHT' || type === 'VOLUME') {
    return normalizeDecimal(num, 3).toFixed(3);
  }

  return `${Math.round(num)}`;
}

/**
 * Checks if picked quantity strictly satisfies the required quantity
 */
export function isQuantityComplete(
  picked: number | string,
  required: number | string,
  measurementType?: MeasurementType
): boolean {
  const p = normalizeDecimal(picked, 3);
  const r = normalizeDecimal(required, 3);

  if (measurementType === 'WEIGHT' || measurementType === 'VOLUME') {
    return p >= r - 0.0001;
  }

  return Math.floor(p) >= Math.floor(r) && r > 0;
}

/**
 * Calculates remaining quantity strictly (no negative values)
 */
export function calculateRemaining(
  required: number | string,
  picked: number | string,
  measurementType?: MeasurementType
): number {
  const r = normalizeDecimal(required, 3);
  const p = normalizeDecimal(picked, 3);
  const rem = normalizeDecimal(r - p, 3);

  if (measurementType === 'WEIGHT' || measurementType === 'VOLUME') {
    return Math.max(0, rem);
  }

  return Math.max(0, Math.round(r - p));
}

/**
 * Validates picked quantity input: rejects over-picking and negative quantities
 */
export function validatePickedInput(
  picked: number | string,
  required: number | string,
  measurementType?: MeasurementType
): { valid: boolean; error?: string; normalizedValue: number } {
  const p = normalizeDecimal(picked, 3);
  const r = normalizeDecimal(required, 3);

  if (isNaN(p) || p < 0) {
    return { valid: false, error: 'Picked quantity cannot be negative.', normalizedValue: 0 };
  }

  if (p > r + 0.0001) {
    return {
      valid: false,
      error: `Picked quantity cannot exceed ordered quantity (${formatQuantity(r, measurementType)}).`,
      normalizedValue: r,
    };
  }

  return { valid: true, normalizedValue: p };
}

/**
 * Calculates exact decimal line price for loose or fractional product ordering
 * Avoids JavaScript floating point inaccuracies (e.g. 2.500 * 60 = 150)
 */
export function calculateLoosePrice(unitPrice: number, quantity: number): number {
  const price = normalizeDecimal(unitPrice, 2);
  const qty = normalizeDecimal(quantity, 3);
  return normalizeDecimal(price * qty, 2);
}
