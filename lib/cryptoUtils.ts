/**
 * PocketKirana — Cryptographic Security Utilities
 * 
 * Cryptographically secure OTP generation, token verification, and attempt controls.
 * Replaces all pseudo-random Math.random usage for security-sensitive tokens.
 */

import crypto from 'crypto';

/**
 * Generate a cryptographically secure numeric OTP using crypto.randomInt.
 * @param length Number of digits (default: 4)
 */
export function generateSecureOtp(length: number = 4): string {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length);
  return crypto.randomInt(min, max).toString();
}

/**
 * Constant-time comparison for security tokens / OTPs to mitigate timing attacks.
 */
export function timingSafeOtpCompare(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'utf-8'), Buffer.from(b, 'utf-8'));
  } catch {
    return false;
  }
}

/**
 * In-memory / transactional rate-limiter tracker for OTP attempts
 */
export interface OtpVerificationRecord {
  attempts: number;
  maxAttempts: number;
  locked: boolean;
  expiresAt: number; // Unix timestamp in ms
}

export function validateOtpAttempt(record: OtpVerificationRecord): { valid: boolean; reason?: string } {
  const now = Date.now();
  if (record.locked) {
    return { valid: false, reason: 'OTP verification locked due to excessive failed attempts.' };
  }
  if (record.expiresAt && now > record.expiresAt) {
    return { valid: false, reason: 'OTP has expired. Please request a new OTP.' };
  }
  if (record.attempts >= record.maxAttempts) {
    return { valid: false, reason: 'Maximum OTP verification attempts reached.' };
  }
  return { valid: true };
}

const otpRateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkOtpRateLimit(
  key: string,
  maxAttempts: number = 3,
  windowMs: number = 60000
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = otpRateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    otpRateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxAttempts - 1 };
  }
  if (entry.count >= maxAttempts) {
    return { allowed: false, remaining: 0 };
  }
  entry.count += 1;
  return { allowed: true, remaining: maxAttempts - entry.count };
}
