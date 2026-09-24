/**
 * PhonePe Payment Gateway Client Helper
 * 
 * Secure frontend wrapper for initiating payments and checking verification status.
 * All sensitive operations (secret keys, SHA256 checksums, and PhonePe API credentials)
 * remain exclusively on the server backend.
 */

import { buildApiUrl, apiFetch } from './apiClient';

export interface InitiatePhonePeOptions {
  orderId: string;
  amount: number; // in Rupees
  mobileNumber?: string;
  customerId?: string;
  redirectPath?: string;
}

export interface PhonePeInitiateResult {
  success: boolean;
  redirectUrl?: string;
  merchantTransactionId?: string;
  error?: string;
}

export interface PhonePeVerifyResult {
  success: boolean;
  verified: boolean;
  status: string;
  transactionId?: string;
  error?: string;
}

/**
 * Initiates PhonePe Payment via secure backend server API
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
      // Non-JSON response (e.g. 404 or 502 HTML)
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

    return {
      success: true,
      redirectUrl: json.data?.redirectUrl,
      merchantTransactionId: json.data?.merchantTransactionId,
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
 * Verifies PhonePe Payment status via secure backend server API
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
        status: json?.error || 'VERIFICATION_FAILED',
        error: json?.error,
      };
    }

    return {
      success: true,
      verified: !!json.data?.verified,
      status: json.data?.status || 'UNKNOWN',
      transactionId: json.data?.transactionId,
    };
  } catch (err: any) {
    console.error('[PhonePe Client Verify Error]', err);
    return {
      success: false,
      verified: false,
      status: 'NETWORK_ERROR',
      error: err.message || 'Unable to connect to verification server',
    };
  }
}
