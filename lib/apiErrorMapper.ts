/**
 * PocketKirana — Centralized API Error Mapper & Normalizer
 * Translates raw HTTP codes, network errors, timeouts, and business rejections
 * into human-friendly, localized, and actionable UI error objects.
 */

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED' // 401: Session expired
  | 'FORBIDDEN' // 403: Permission denied
  | 'NOT_FOUND' // 404: Resource not found
  | 'CONFLICT' // 409: Resource conflict / already exists
  | 'VALIDATION_ERROR' // 422: Unprocessable entity / validation
  | 'RATE_LIMITED' // 429: Too many requests
  | 'SERVER_ERROR' // 500: Internal server error
  | 'SERVICE_UNAVAILABLE' // 502/503: Maintenance or outage
  | 'TIMEOUT' // Request timed out
  | 'OFFLINE' // Network offline / DNS failure
  | 'PAYMENT_FAILED' // Payment gateway rejection
  | 'OUT_OF_STOCK' // Inventory reservation failure
  | 'OUT_OF_SERVICE_AREA' // Delivery not serviceable
  | 'UNKNOWN';

export interface ActionConfig {
  label: string;
  action: 'retry' | 'home' | 'login' | 'settings' | 'support' | 'back' | 'custom';
  href?: string;
  onClick?: () => void;
}

export interface NormalizedApiError {
  code: ApiErrorCode;
  status?: number;
  title: string;
  message: string;
  userFacingMessage: string;
  canRetry: boolean;
  primaryAction?: ActionConfig;
  secondaryAction?: ActionConfig;
  timestamp: string;
  trackingId?: string;
  details?: Record<string, any>;
}

export function mapApiError(error: unknown, context?: string): NormalizedApiError {
  const timestamp = new Date().toISOString();
  const trackingId = `err_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

  // Default fallback
  let code: ApiErrorCode = 'UNKNOWN';
  let status: number | undefined = undefined;
  let title = 'Something went wrong';
  let message = 'We could not complete your request. Please try again.';
  let canRetry = true;
  let primaryAction: ActionConfig = { label: 'Try Again', action: 'retry' };
  let secondaryAction: ActionConfig | undefined = { label: 'Go Home', action: 'home', href: '/' };
  let details: Record<string, any> | undefined = undefined;

  // 1. Check if browser is completely offline
  if (typeof window !== 'undefined' && !navigator.onLine) {
    return {
      code: 'OFFLINE',
      title: 'No Internet Connection',
      message: 'Please check your Wi-Fi or mobile data connection and try again.',
      userFacingMessage: 'You are currently offline. PocketKirana needs an active connection.',
      canRetry: true,
      primaryAction: { label: 'Retry Connection', action: 'retry' },
      secondaryAction: { label: 'Go Home', action: 'home', href: '/' },
      timestamp,
      trackingId,
    };
  }

  // 2. Normalize Fetch Response or Axios-like error
  if (error && typeof error === 'object') {
    const errObj = error as any;

    if (typeof errObj.status === 'number') {
      status = errObj.status;
    } else if (errObj.response && typeof errObj.response.status === 'number') {
      status = errObj.response.status;
    }

    // Check for Network Error / Offline Fetch Failure
    if (
      errObj.message?.toLowerCase().includes('failed to fetch') ||
      errObj.message?.toLowerCase().includes('network') ||
      errObj.name === 'NetworkError'
    ) {
      return {
        code: 'OFFLINE',
        title: 'No Internet Connection',
        message: 'Please check your Wi-Fi or mobile data connection and try again.',
        userFacingMessage: 'You are currently offline. PocketKirana needs an active connection.',
        canRetry: true,
        primaryAction: { label: 'Retry Connection', action: 'retry' },
        secondaryAction: { label: 'Go Home', action: 'home', href: '/' },
        timestamp,
        trackingId,
      };
    }

    // Check for Abort / Timeout
    if (errObj.name === 'AbortError' || errObj.name === 'TimeoutError' || errObj.message?.toLowerCase().includes('timeout')) {
      return {
        code: 'TIMEOUT',
        title: 'Request Timed Out',
        message: 'The server took too long to respond. Your connection might be slow.',
        userFacingMessage: 'Taking longer than usual. Please check your signal and try again.',
        canRetry: true,
        primaryAction: { label: 'Try Again', action: 'retry' },
        secondaryAction: { label: 'Go Home', action: 'home', href: '/' },
        timestamp,
        trackingId,
      };
    }

    // Extract detail message if provided by backend API
    const backendMsg = errObj.data?.message || errObj.message || errObj.error || errObj.statusText;
    if (typeof backendMsg === 'string' && backendMsg.length > 0) {
      details = { rawMessage: backendMsg };
    }
  }

  // 3. Map HTTP Status Codes
  if (status !== undefined) {
    switch (status) {
      case 400:
        code = 'BAD_REQUEST';
        title = 'Invalid Request';
        message = 'We could not process this request. Please verify the information entered.';
        canRetry = false;
        primaryAction = { label: 'Go Back', action: 'back' };
        break;

      case 401:
        code = 'UNAUTHORIZED';
        title = 'Session Expired';
        message = 'Your login session has expired for security. Please log in again to continue.';
        canRetry = false;
        primaryAction = { label: 'Log In Again', action: 'login' };
        secondaryAction = { label: 'Go Home', action: 'home', href: '/' };
        break;

      case 403:
        code = 'FORBIDDEN';
        title = 'Access Restricted';
        message = 'You do not have permission to view this resource or perform this action.';
        canRetry = false;
        primaryAction = { label: 'Go Home', action: 'home', href: '/' };
        break;

      case 404:
        code = 'NOT_FOUND';
        title = 'Not Found';
        message = context ? `We couldn't find the requested ${context}. It may have been moved or removed.` : 'We could not find the page or item you were looking for.';
        canRetry = false;
        primaryAction = { label: 'Browse Products', action: 'home', href: '/' };
        break;

      case 409:
        code = 'CONFLICT';
        title = 'Item Already Updated';
        message = 'The information has changed since you opened it. Please refresh and try again.';
        canRetry = true;
        primaryAction = { label: 'Refresh', action: 'retry' };
        break;

      case 422:
        code = 'VALIDATION_ERROR';
        title = 'Validation Failed';
        message = 'Please check the entered values and correct any highlighted errors.';
        canRetry = false;
        primaryAction = { label: 'Review Details', action: 'back' };
        break;

      case 429:
        code = 'RATE_LIMITED';
        title = 'Too Many Requests';
        message = 'You are sending requests too quickly. Please wait a moment and try again.';
        canRetry = true;
        primaryAction = { label: 'Wait and Retry', action: 'retry' };
        break;

      case 500:
      case 502:
      case 503:
      case 504:
        code = status === 500 ? 'SERVER_ERROR' : 'SERVICE_UNAVAILABLE';
        title = 'Server Busy';
        message = 'Our servers are experiencing heavy load. Please give us a few moments and try again.';
        canRetry = true;
        primaryAction = { label: 'Try Again', action: 'retry' };
        secondaryAction = { label: 'Contact Support', action: 'support', href: '/contact' };
        break;

      default:
        if (status >= 400 && status < 500) {
          code = 'BAD_REQUEST';
          title = 'Unable to Process';
          message = 'We encountered an issue with your request. Please try again.';
        } else if (status >= 500) {
          code = 'SERVER_ERROR';
          title = 'Service Temporarily Unavailable';
          message = 'We are working to resolve this issue quickly. Please try again in a few moments.';
        }
        break;
    }
  }

  // Internal logging without leaking secrets or server stack traces
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[PocketKirana ErrorMapper] [${trackingId}] ${code} (${status || 'N/A'}):`, {
      context,
      error,
    });
  }

  return {
    code,
    status,
    title,
    message,
    userFacingMessage: message,
    canRetry,
    primaryAction,
    secondaryAction,
    timestamp,
    trackingId,
    details,
  };
}
