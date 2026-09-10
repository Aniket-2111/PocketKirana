/**
 * PhonePe Payment Gateway Client Helper
 * 
 * Secure frontend wrapper for initiating payments and checking verification status.
 * All sensitive operations (secret keys, SHA256 checksums, and PhonePe API credentials)
 * remain exclusively on the server backend.
 */

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

function getApiBaseUrl(): string {
  // If running in browser or Capacitor with backend env URL
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  if (typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost:')) {
    // If in Capacitor WebView on Android (origin is https://localhost), fallback to current dev server
    if (window.location.origin === 'https://localhost') {
      return 'http://192.168.0.103:3000'; // Client LAN server or production API
    }
    return window.location.origin;
  }
  return '';
}

/**
 * Initiates PhonePe Payment via secure backend server API
 */
export async function initiatePhonePePayment(options: InitiatePhonePeOptions): Promise<PhonePeInitiateResult> {
  const { orderId } = options;

  try {
    const apiBase = getApiBaseUrl();
    const endpoint = apiBase ? `${apiBase}/api/payments/phonepe/create` : '/api/payments/phonepe/create';

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orderId }),
    });

    const json = await res.json();

    if (!res.ok || !json.success) {
      return {
        success: false,
        error: json.error || 'Failed to initiate PhonePe payment',
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
    const apiBase = getApiBaseUrl();
    const endpoint = apiBase ? `${apiBase}/api/payments/phonepe/verify` : '/api/payments/phonepe/verify';

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        merchantTransactionId,
        orderId,
      }),
    });

    const json = await res.json();

    if (!res.ok || !json.success) {
      return {
        success: false,
        verified: false,
        status: json.error || 'VERIFICATION_FAILED',
        error: json.error,
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
