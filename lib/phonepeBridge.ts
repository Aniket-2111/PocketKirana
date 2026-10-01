/**
 * PocketKirana — PhonePe Native Android Bridge (Capacitor)
 * 
 * TypeScript bridge interface communicating with PhonePePaymentPlugin on Android APK.
 * 
 * SECURITY INVARIANT:
 *  - No merchant secrets, salt keys, or credentials exist in this bridge.
 *  - Only transaction references and order IDs are received from the backend
 *    and forwarded to the native Android SDK.
 */

import { registerPlugin } from '@capacitor/core';

export interface PhonePeInitOptions {
  environment: 'SANDBOX' | 'PRODUCTION';
  merchantId?: string;
  enableLogging?: boolean;
}

export interface PhonePePaymentOptions {
  orderId: string;
  merchantTransactionId: string;
  amount: number; // in Rupees
  redirectUrl?: string;
  token?: string;
  payload?: string;
}

export interface PhonePePaymentNativeResult {
  status: 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'PENDING' | 'ERROR';
  merchantTransactionId: string;
  orderId: string;
  responseCode?: string;
  error?: string;
}

export interface PhonePeAppInstalledResult {
  isInstalled: boolean;
}

export interface PhonePePluginInterface {
  initPhonePe(options: PhonePeInitOptions): Promise<{ success: boolean; environment: string }>;
  startPayment(options: PhonePePaymentOptions): Promise<PhonePePaymentNativeResult>;
  isPhonePeAppInstalled(): Promise<PhonePeAppInstalledResult>;
}

export const PhonePeNativePlugin = registerPlugin<PhonePePluginInterface>('PhonePePaymentPlugin');

/**
 * Checks if the app is currently running inside Capacitor native container with PhonePe plugin available
 */
export function isPhonePeNativeAvailable(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const isCapacitorNative = !!(window as any).Capacitor?.isNativePlatform?.();
    return isCapacitorNative;
  } catch {
    return false;
  }
}
