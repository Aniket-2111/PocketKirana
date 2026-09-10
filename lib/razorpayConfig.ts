/**
 * PocketKirana — Razorpay Gateway Configuration
 *
 * Same fail-closed rules as lib/phonepeConfig.ts (cso Finding #3):
 *  1. Credentials come ONLY from environment variables. The old hardcoded
 *     fallbacks ('rzp_test_PocketKiranaKey' / 'pocketkirana_secret_test_key')
 *     are removed — a missing env var must disable the gateway (or run
 *     simulation) rather than silently auto-verify payments.
 *  2. Simulation mode must be EXPLICITLY opted into via
 *     RAZORPAY_SIMULATION_MODE=true, and is refused in production
 *     (VERCEL_ENV=production or NODE_ENV=production).
 *
 * Required env vars for REAL payments:
 *   RAZORPAY_KEY_ID       — key id from the Razorpay dashboard
 *   RAZORPAY_KEY_SECRET   — key secret (server-side only)
 *   NEXT_PUBLIC_SITE_URL  — public base URL (redirects)
 */

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
}

/**
 * True when simulation mode is explicitly enabled via env AND we are not in a
 * production deployment. Never true by default.
 */
export function isRazorpaySimulationMode(): boolean {
  if (process.env.RAZORPAY_SIMULATION_MODE !== 'true') return false;
  const isProdDeploy =
    process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  return !isProdDeploy;
}

/**
 * Load real gateway credentials. Returns null when any required variable is
 * missing so callers can fail closed instead of auto-verifying payments.
 */
export function getRazorpayConfig(): RazorpayConfig | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) return null;

  return { keyId, keySecret };
}
