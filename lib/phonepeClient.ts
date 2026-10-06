/**
 * PocketKirana — PhonePe Business Payment Gateway Client & Native Android Bridge
 * 
 * Orchestrates:
 * 1. Server-side payment order creation (/api/payments/phonepe/create)
 * 2. Native Android SDK checkout via PhonePeNativePlugin (when running in APK)
 * 3. Web redirect fallback (when running in standard web browser)
 * 4. Authoritative server-side status verification (/api/payments/phonepe/verify)
 * 5. App restart / crash recovery checks (/api/payments/phonepe/status)
 * 
 * SECURITY RULES:
 *  - Client never handles secrets, salt keys, or direct gateway credentials.
 *  - Client amounts are NEVER trusted by the backend.
 *  - Native SDK callbacks are treated as hints; backend verification is strictly authoritative.
 */

import { apiFetch } from './apiClient';
import { PhonePeNativePlugin, isPhonePeNativeAvailable } from './phonepeBridge';

export interface InitiatePhonePeOptions {
  orderId: string;
  amount: number; // in Rupees (informational for UI, backend re-derives authoritatively)
  mobileNumber?: string;
  customerId?: string;
  redirectPath?: string;
}

export interface PhonePeInitiateResult {
  success: boolean;
  redirectUrl?: string;
  merchantTransactionId?: string;
  orderId?: string;
  isNativeFlow?: boolean;
  error?: string;
}

export interface PhonePeVerifyResult {
  success: boolean;
  verified: boolean;
  status: string;
  transactionId?: string;
  orderId?: string;
  error?: string;
}

/**
 * 1. Initiates PhonePe Payment via secure backend server API
 */
export async function initiatePhonePePayment(options: InitiatePhonePeOptions): Promise<PhonePeInitiateResult> {
  const { orderId } = options;

  try {
    const res = await apiFetch('/api/payments/phonepe/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orderId }),
    });

    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      return {
        success: false,
        error: `Server error (${res.status}): Payment gateway service is currently unreachable.`,
      };
    }

    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: json?.error || 'Failed to initiate PhonePe payment',
      };
    }

    const { merchantTransactionId, redirectUrl, token } = json.data || {};

    return {
      success: true,
      redirectUrl,
      merchantTransactionId,
      orderId,
    };
  } catch (err: any) {
    console.error('[PhonePe Client Initiate Error]', err);
    return {
      success: false,
      error: err.message || 'Network error connecting to payment gateway',
    };
  }
}

/**
 * 2. Full End-to-End PhonePe Checkout Flow:
 *    - Creates payment order on backend
 *    - Opens native PhonePe SDK in Android APK (or falls back to web redirect)
 *    - On native callback, calls backend verification immediately
 */
export async function startPhonePeCheckoutFlow(
  options: InitiatePhonePeOptions,
  callbacks?: {
    onPending?: () => void;
    onError?: (msg: string) => void;
  }
): Promise<PhonePeVerifyResult> {
  // Step 1: Create PhonePe order on backend
  const initResult = await initiatePhonePePayment(options);
  if (!initResult.success || !initResult.merchantTransactionId) {
    const errorMsg = initResult.error || 'Failed to initialize payment session';
    callbacks?.onError?.(errorMsg);
    return { success: false, verified: false, status: 'INITIATION_FAILED', error: errorMsg };
  }

  const { merchantTransactionId, redirectUrl } = initResult;
  const resolvedOrderId = initResult.orderId || options.orderId;

  // Step 2: Check if Native Android SDK (Capacitor) is active
  if (isPhonePeNativeAvailable()) {
    try {
      callbacks?.onPending?.();

      // Launch Native Android PhonePe SDK Plugin
      const nativeResult = await PhonePeNativePlugin.startPayment({
        orderId: resolvedOrderId,
        merchantTransactionId,
        amount: options.amount,
        redirectUrl,
      });

      // Handle user cancellation explicitly
      if (nativeResult.status === 'CANCELLED') {
        return {
          success: false,
          verified: false,
          status: 'CANCELLED',
          orderId: resolvedOrderId,
          error: 'Payment was cancelled by user.',
        };
      }

      // Step 3: Server Verification (MANDATORY — DO NOT TRUST CLIENT ALONE)
      const verifyResult = await verifyPhonePeStatus(merchantTransactionId, resolvedOrderId);
      return verifyResult;
    } catch (nativeErr: any) {
      console.warn('[PhonePe Native Flow Fallback]', nativeErr);
      // If native plugin invocation fails, fallback to web redirect if available
      if (redirectUrl && typeof window !== 'undefined') {
        window.location.href = redirectUrl;
        return { success: true, verified: false, status: 'REDIRECTED', orderId: resolvedOrderId };
      }
      return {
        success: false,
        verified: false,
        status: 'ERROR',
        orderId: resolvedOrderId,
        error: nativeErr.message || 'Native payment checkout failed',
      };
    }
  }

  // Step 4: Web Browser Fallback (Standard Redirect)
  if (redirectUrl && typeof window !== 'undefined') {
    window.location.href = redirectUrl;
    return { success: true, verified: false, status: 'REDIRECTED', orderId: resolvedOrderId };
  }

  return {
    success: false,
    verified: false,
    status: 'NO_REDIRECT_URL',
    orderId: resolvedOrderId,
    error: 'No payment redirect URL provided by gateway',
  };
}

/**
 * 3. Authoritative Server-Side Payment Status Verification
 */
export async function verifyPhonePeStatus(merchantTransactionId: string, orderId?: string): Promise<PhonePeVerifyResult> {
  try {
    const res = await apiFetch('/api/payments/phonepe/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        merchantTransactionId,
        orderId,
      }),
    });

    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      return {
        success: false,
        verified: false,
        status: 'SERVER_ERROR',
        error: `Server error (${res.status}): Verification service returned invalid response.`,
      };
    }

    if (!res.ok || !json?.success) {
      return {
        success: false,
        verified: false,
        status: json?.data?.status || json?.error || 'VERIFICATION_FAILED',
        error: json?.error,
        orderId,
      };
    }

    return {
      success: true,
      verified: !!json.data?.verified,
      status: json.data?.status || 'UNKNOWN',
      transactionId: json.data?.transactionId,
      orderId: json.data?.orderId || orderId,
    };
  } catch (err: any) {
    console.error('[PhonePe Client Verify Error]', err);
    return {
      success: false,
      verified: false,
      status: 'NETWORK_ERROR',
      error: err.message || 'Unable to connect to verification server',
      orderId,
    };
  }
}

/**
 * 4. App Restart / Crash Recovery Status Check
 */
export async function checkPhonePePaymentRecovery(
  orderId?: string,
  merchantTransactionId?: string
): Promise<PhonePeVerifyResult> {
  try {
    const params = new URLSearchParams();
    if (orderId) params.set('orderId', orderId);
    if (merchantTransactionId) params.set('merchantTransactionId', merchantTransactionId);

    const res = await apiFetch(`/api/payments/phonepe/status?${params.toString()}`, {
      method: 'GET',
    });

    const json = await res.json();
    if (!res.ok || !json?.success) {
      return {
        success: false,
        verified: false,
        status: 'PENDING',
        orderId,
        error: json?.error || 'Unable to fetch recovery status',
      };
    }

    return {
      success: true,
      verified: !!json.data?.verified,
      status: json.data?.status || 'PENDING',
      transactionId: json.data?.transactionId,
      orderId: json.data?.orderId || orderId,
    };
  } catch (err: any) {
    return {
      success: false,
      verified: false,
      status: 'NETWORK_ERROR',
      error: err.message,
      orderId,
    };
  }
}
