import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from './firebase';

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
    confirmationResult?: ConfirmationResult;
  }
}

/**
 * Destroys any existing reCAPTCHA verifier and clears the container DOM.
 */
export function clearRecaptcha(elementId: string = 'recaptcha-container') {
  if (typeof window === 'undefined') return;

  if (window.recaptchaVerifier) {
    try {
      window.recaptchaVerifier.clear();
    } catch (_) {}
    window.recaptchaVerifier = undefined;
  }

  const el = document.getElementById(elementId);
  if (el) {
    el.innerHTML = '';
  }
}

/**
 * Safely initializes or retrieves an existing RecaptchaVerifier instance.
 * Avoids the "reCAPTCHA has already been rendered in this element" error.
 */
export function getOrCreateRecaptchaVerifier(elementId: string = 'recaptcha-container'): RecaptchaVerifier | null {
  if (typeof window === 'undefined') return null;
  const auth = getFirebaseAuth();
  if (!auth) return null;

  // If a valid verifier already exists, reuse it
  if (window.recaptchaVerifier) {
    return window.recaptchaVerifier;
  }

  const container = document.getElementById(elementId);
  if (!container) {
    console.warn(`reCAPTCHA container #${elementId} not found in DOM.`);
    return null;
  }

  // Clear any existing children inside the container
  container.innerHTML = '';

  try {
    const verifier = new RecaptchaVerifier(auth, container, {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA solved
      },
      'expired-callback': () => {
        clearRecaptcha(elementId);
      },
    });

    window.recaptchaVerifier = verifier;
    return verifier;
  } catch (err: any) {
    console.error('Error creating RecaptchaVerifier:', err);
    clearRecaptcha(elementId);
    return null;
  }
}

/**
 * Initializes invisible reCAPTCHA on the given container
 */
export async function setupRecaptcha(elementId: string = 'recaptcha-container'): Promise<RecaptchaVerifier | null> {
  return getOrCreateRecaptchaVerifier(elementId);
}

/**
 * Sends a real Firebase Phone Auth SMS OTP.
 */
export async function sendFirebasePhoneOtp(
  phone: string,
  customVerifier?: RecaptchaVerifier
): Promise<{ success: boolean; error?: string; code?: string }> {
  if (!isFirebaseConfigured()) {
    return { success: false, error: 'Firebase is not configured with valid project credentials.' };
  }

  const auth = getFirebaseAuth();
  if (!auth) {
    return { success: false, error: 'Firebase Auth instance unavailable. Check your Firebase config.' };
  }

  const cleanPhone = phone.replace(/\D/g, '');
  if (!cleanPhone || cleanPhone.length < 10) {
    return { success: false, error: 'Please enter a valid 10-digit Indian mobile number.' };
  }

  const formattedPhone = `+91${cleanPhone.slice(-10)}`;

  let verifier = customVerifier ?? getOrCreateRecaptchaVerifier('recaptcha-container');

  if (!verifier) {
    clearRecaptcha('recaptcha-container');
    verifier = getOrCreateRecaptchaVerifier('recaptcha-container');
    if (!verifier) {
      return { success: false, error: 'Failed to initialize security verification. Please refresh the page and try again.' };
    }
  }

  try {
    const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, verifier);
    window.confirmationResult = confirmationResult;
    return { success: true };
  } catch (error: any) {
    const code: string = error?.code ?? 'unknown';
    const message: string = error?.message ?? '';
    console.error(`[Firebase Phone Auth] Error code: ${code}`, error);

    // Reset reCAPTCHA on error so user can retry immediately without double-render error
    clearRecaptcha('recaptcha-container');

    let friendlyError = message;

    if (
      message.includes('region enabled') ||
      code === 'auth/operation-not-allowed' ||
      code === 'auth/sms-quota-exceeded'
    ) {
      friendlyError = 'SMS Region Policy / Phone Auth disabled: Please enable Phone Authentication in Firebase Console (Authentication → Sign-in method → Phone) and enable India (+91) under Settings → SMS Regions Policy.';
    } else if (code === 'auth/invalid-phone-number') {
      friendlyError = 'Invalid phone number format. Please enter a valid 10-digit Indian mobile number.';
    } else if (code === 'auth/too-many-requests') {
      friendlyError = 'Too many requests. Please wait 1-2 minutes before requesting another OTP.';
    } else if (code === 'auth/captcha-check-failed') {
      friendlyError = 'Security verification failed. Please click "Send Verification Code" again.';
    } else if (code === 'auth/quota-exceeded') {
      friendlyError = 'Daily SMS quota exceeded on Firebase free plan. Add billing or add a test phone number in Firebase Console (Authentication → Sign-in method → Phone numbers for testing).';
    } else if (code === 'auth/unauthorized-domain') {
      friendlyError = 'Unauthorized domain. Add "localhost" to Firebase Console → Authentication → Settings → Authorized domains.';
    } else if (code === 'auth/billing-not-enabled') {
      friendlyError = 'SMS sending requires phone authentication enabled in Firebase Console.';
    }

    return {
      success: false,
      error: friendlyError,
      code,
    };
  }
}

/**
 * Verifies the SMS OTP code entered by the user.
 */
export async function verifyFirebasePhoneOtp(
  otpCode: string
): Promise<{ success: boolean; user?: any; error?: string }> {
  if (!isFirebaseConfigured()) return { success: false, error: 'Firebase not configured.' };

  const cr = typeof window !== 'undefined' ? window.confirmationResult : undefined;
  if (!cr) return { success: false, error: 'No active OTP session. Please request a new code.' };

  try {
    const result = await cr.confirm(otpCode);
    return { success: true, user: result.user };
  } catch (error: any) {
    const code: string = error?.code ?? '';
    console.error(`[Firebase OTP Verify] Error code: ${code}`, error);
    const friendly: Record<string, string> = {
      'auth/invalid-verification-code': 'Incorrect OTP code. Please check and try again.',
      'auth/code-expired': 'OTP has expired. Please request a new code.',
      'auth/session-expired': 'Session expired. Please request a new OTP.',
    };
    return { success: false, error: friendly[code] ?? error?.message ?? 'OTP verification failed.' };
  }
}

/**
 * Signs out from Firebase Auth.
 */
export async function logoutFirebaseUser(): Promise<void> {
  const auth = getFirebaseAuth();
  if (auth) {
    try { await firebaseSignOut(auth); } catch (_) {}
  }
}
