/**
 * Fail-closed gateway config regression tests (design-review B4.5).
 *
 * These encode the exact bug class the security audit found: config helpers
 * that fell back to public UAT credentials instead of returning null. If
 * someone reintroduces a hardcoded fallback, these fail.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getPhonePeConfig, isSimulationMode } from '@/lib/phonepeConfig';
import { getRazorpayConfig, isRazorpaySimulationMode } from '@/lib/razorpayConfig';

const PHONEPE_VARS = ['PHONEPE_MERCHANT_ID', 'PHONEPE_SALT_KEY', 'PHONEPE_SALT_INDEX', 'PHONEPE_ENV'] as const;
const RZP_VARS = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'] as const;
const MODE_VARS = ['PHONEPE_SIMULATION_MODE', 'RAZORPAY_SIMULATION_MODE', 'VERCEL_ENV', 'NODE_ENV'] as const;

// NODE_ENV is typed read-only by Next.js; tests need to simulate it.
const setEnv = (k: string, v: string | undefined) => {
  (process.env as Record<string, string | undefined>)[k] = v;
};

beforeEach(() => {
  for (const k of [...PHONEPE_VARS, ...RZP_VARS, ...MODE_VARS]) delete process.env[k];
});

afterEach(() => {
  for (const k of [...PHONEPE_VARS, ...RZP_VARS, ...MODE_VARS]) delete process.env[k];
});

describe('getPhonePeConfig', () => {
  it('returns null when credentials are missing (fail closed)', () => {
    expect(getPhonePeConfig()).toBeNull();
  });

  it('returns null when only one credential is set', () => {
    process.env.PHONEPE_MERCHANT_ID = 'MERCHANT123';
    expect(getPhonePeConfig()).toBeNull();
  });

  it('returns config when both credentials are present, defaulting saltIndex to 1', () => {
    process.env.PHONEPE_MERCHANT_ID = 'MERCHANT123';
    process.env.PHONEPE_SALT_KEY = 'salt-key-value';
    const cfg = getPhonePeConfig();
    expect(cfg).toEqual({
      merchantId: 'MERCHANT123',
      saltKey: 'salt-key-value',
      saltIndex: '1',
      isProduction: false,
      baseUrl: 'https://api-preprod.phonepe.com/apis/pg-sandbox',
    });
  });

  it('uses the production base URL when PHONEPE_ENV=production', () => {
    process.env.PHONEPE_MERCHANT_ID = 'M';
    process.env.PHONEPE_SALT_KEY = 'K';
    process.env.PHONEPE_ENV = 'production';
    expect(getPhonePeConfig()?.baseUrl).toBe('https://api.phonepe.com/apis/hermes');
    expect(getPhonePeConfig()?.isProduction).toBe(true);
  });
});

describe('isSimulationMode', () => {
  it('is never on by default', () => {
    expect(isSimulationMode()).toBe(false);
  });

  it('requires the explicit env flag', () => {
    process.env.PHONEPE_SIMULATION_MODE = 'true';
    expect(isSimulationMode()).toBe(true);
  });

  it('is hard-refused in production deployments', () => {
    process.env.PHONEPE_SIMULATION_MODE = 'true';
    setEnv('NODE_ENV', 'production');
    expect(isSimulationMode()).toBe(false);
    setEnv('NODE_ENV', undefined);
    process.env.VERCEL_ENV = 'production';
    expect(isSimulationMode()).toBe(false);
  });
});

describe('getRazorpayConfig', () => {
  it('returns null when credentials are missing (fail closed, no hardcoded key)', () => {
    expect(getRazorpayConfig()).toBeNull();
  });

  it('returns config only when both credentials are present', () => {
    process.env.RAZORPAY_KEY_ID = 'rzp_live_abc';
    expect(getRazorpayConfig()).toBeNull();
    process.env.RAZORPAY_KEY_SECRET = 'secret';
    expect(getRazorpayConfig()).toEqual({ keyId: 'rzp_live_abc', keySecret: 'secret' });
  });
});

describe('isRazorpaySimulationMode', () => {
  it('is never on by default and is refused in production', () => {
    expect(isRazorpaySimulationMode()).toBe(false);
    process.env.RAZORPAY_SIMULATION_MODE = 'true';
    expect(isRazorpaySimulationMode()).toBe(true);
    setEnv('NODE_ENV', 'production');
    expect(isRazorpaySimulationMode()).toBe(false);
  });
});
