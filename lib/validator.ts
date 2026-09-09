/**
 * PocketKirana — Production Payload & Identity Validator
 *
 * Provides strict validation and normalization for:
 *   - EAN-13 barcodes with GS1 check digit algorithm
 *   - 4-digit and 6-digit OTPs
 *   - Indian 10-digit mobile numbers
 *   - Quantities and financial decimals
 */

/**
 * Validates whether a given string is a valid 13-digit EAN-13 barcode with correct check digit.
 */
export function isValidEan13(code: string): boolean {
  const clean = (code || '').trim();
  if (!/^\d{13}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(clean[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(clean[12], 10);
}

/**
 * Validates and normalizes an Indian phone number to +91XXXXXXXXXX format.
 */
export function normalizeIndianPhone(phone: string): string | null {
  const clean = (phone || '').replace(/\D/g, '');
  if (clean.length === 10) {
    return `+91${clean}`;
  }
  if (clean.length === 12 && clean.startsWith('91')) {
    return `+${clean}`;
  }
  return null;
}

/**
 * Validates a 4-digit or 6-digit numeric OTP.
 */
export function isValidOtp(otp: string, length: 4 | 6 = 4): boolean {
  const clean = (otp || '').trim();
  const regex = length === 4 ? /^\d{4}$/ : /^\d{6}$/;
  return regex.test(clean);
}

/**
 * Sanitizes and asserts a positive integer quantity (e.g. for picking/packing/ordering).
 */
export function sanitizePositiveInt(val: any, fallback = 1, max = 99999): number {
  const parsed = parseInt(String(val), 10);
  if (isNaN(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

/**
 * Sanitizes a price / currency float to 2 decimal places.
 */
export function sanitizePrice(val: any): number {
  const parsed = parseFloat(String(val));
  if (isNaN(parsed) || parsed < 0) return 0.00;
  return Math.round(parsed * 100) / 100;
}
