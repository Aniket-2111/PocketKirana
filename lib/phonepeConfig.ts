/**
 * PocketKirana — PhonePe Gateway Configuration
 *
 * Single source of truth for PhonePe credentials across the payment routes.
 *
 * SECURITY RULES:
 *  1. Credentials come ONLY from environment variables. There are intentionally
 *     NO hardcoded fallback merchant IDs or salt keys — a missing env var must
 *     disable the gateway (or run simulation) rather than silently hit the
 *     PhonePe sandbox with public UAT credentials.
 *  2. Simulation/mock mode must be EXPLICITLY opted into via
 *     PHONEPE_SIMULATION_MODE=true. It can never be triggered implicitly by
 *     missing config, and NEVER by client-supplied strings (e.g. a transaction
 *     id containing the word "MOCK").
 *  3. Simulation is hard-refused in production deployments
 *     (VERCEL_ENV=production or NODE_ENV=production).
 *
 * Required env vars for REAL payments:
 *   PHONEPE_MERCHANT_ID   — merchant id from PhonePe business dashboard
 *   PHONEPE_SALT_KEY      — salt key for checksum generation
 *   PHONEPE_SALT_INDEX    — salt index (usually "1")
 *   PHONEPE_ENV           — "sandbox" | "production"
 *   NEXT_PUBLIC_SITE_URL  — public base URL used for redirect/callback URLs
 */

export interface PhonePeConfig {
  merchantId: string;
  saltKey: string;
  saltIndex: string;
  isProduction: boolean;
  baseUrl: string;
}

const SANDBOX_URL = 'https://api-preprod.phonepe.com/apis/pg-sandbox';
const PROD_URL = 'https://api.phonepe.com/apis/hermes';

/**
 * True when simulation mode is explicitly enabled via env AND we are not in a
 * production deployment. Never true by default.
 */
export function isSimulationMode(): boolean {
  if (process.env.PHONEPE_SIMULATION_MODE !== 'true') return false;
  const isProdDeploy =
    process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  return !isProdDeploy;
}

/**
 * Load real gateway credentials. Returns null when any required variable is
 * missing so callers can fail closed instead of falling back to UAT defaults.
 */
export function getPhonePeConfig(): PhonePeConfig | null {
  const merchantId = process.env.PHONEPE_MERCHANT_ID;
  const saltKey = process.env.PHONEPE_SALT_KEY;

  if (!merchantId || !saltKey) return null;

  return {
    merchantId,
    saltKey,
    saltIndex: process.env.PHONEPE_SALT_INDEX || '1',
    isProduction: process.env.PHONEPE_ENV === 'production',
    baseUrl: process.env.PHONEPE_ENV === 'production' ? PROD_URL : SANDBOX_URL,
  };
}
