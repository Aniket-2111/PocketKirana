'use client';

/**
 * PocketKirana — Customer Authentication Modal (MSG91 OTP Widget)
 *
 * How the MSG91 widget works (from source inspection):
 *  - window.initSendOTP() appends a <msg91-otp-provider> custom element to <body>
 *  - The widget renders its own floating UI (phone input + OTP input)
 *  - On OTP verified: it calls the `success` function with { access_token }
 *  - The modal shows a "Loading widget…" state while the widget loads,
 *    then becomes a thin backdrop container (user interacts with the widget UI)
 *
 * Flow:
 *  1. Modal opens → initSendOTP called → widget appears in page (appended to body)
 *  2. Customer enters phone + OTP inside the MSG91 widget
 *  3. Widget fires success({ access_token })
 *  4. We POST access_token to /api/auth/verify-otp-token (AuthKey server-side only)
 *  5. Server verifies with MSG91 → looks up / creates Firestore user
 *  6. Zustand: isLoggedIn = true, currentUser hydrated → modal closes
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import {
  initMsg91Widget,
  cleanupMsg91Widget,
  type Msg91SuccessPayload,
} from '@/lib/msg91Widget';
import {
  X,
  Smartphone,
  Loader2,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

// ── Widget states ─────────────────────────────────────────────────────────────
type WidgetState =
  | 'idle'         // modal not yet opened
  | 'loading'      // loading MSG91 script / calling initSendOTP
  | 'ready'        // widget mounted, user interacting with MSG91 UI
  | 'verifying'    // access_token received, POSTing to backend
  | 'success'      // login complete — closing modal
  | 'error';       // unrecoverable error

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { verifyMsg91Token } = useAppStore();

  const [widgetState, setWidgetState] = useState<WidgetState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Guards against duplicate initSendOTP or verifyMsg91Token calls
  const initLockRef = useRef(false);
  const verifyLockRef = useRef(false);

  // ── Initialise MSG91 widget ───────────────────────────────────────────────
  const initWidget = useCallback(async () => {
    if (initLockRef.current) return;
    initLockRef.current = true;
    verifyLockRef.current = false;
    setWidgetState('loading');
    setErrorMsg('');

    try {
      await initMsg91Widget(
        // ── OTP verified: widget calls this with { access_token } ──────────
        async (payload: Msg91SuccessPayload) => {
          if (verifyLockRef.current) return; // prevent duplicate calls
          verifyLockRef.current = true;

          setWidgetState('verifying');

          const result = await verifyMsg91Token(payload.access_token);

          if (result.success) {
            setWidgetState('success');
            setTimeout(() => onClose(), 700);
          } else {
            setWidgetState('error');
            setErrorMsg(result.error || 'Login failed. Please try again.');
            verifyLockRef.current = false;
          }
        },

        // ── Widget-level error ─────────────────────────────────────────────
        (error: unknown) => {
          const msg =
            error instanceof Error
              ? error.message
              : typeof error === 'string'
              ? error
              : 'OTP widget error. Please try again.';
          setWidgetState('error');
          setErrorMsg(msg);
          initLockRef.current = false;
        }
      );

      setWidgetState('ready');
    } catch (err: any) {
      setWidgetState('error');
      setErrorMsg(
        err?.message ||
          'Could not load OTP service. Check your internet connection and try again.'
      );
    } finally {
      initLockRef.current = false;
    }
  }, [verifyMsg91Token, onClose]);

  // Open → init widget; Close → clean up widget
  useEffect(() => {
    if (!isOpen) {
      cleanupMsg91Widget();
      setWidgetState('idle');
      setErrorMsg('');
      initLockRef.current = false;
      verifyLockRef.current = false;
      return;
    }

    // Small delay ensures React has flushed DOM updates before we call initSendOTP
    const timer = setTimeout(() => initWidget(), 100);
    return () => clearTimeout(timer);
  }, [isOpen, initWidget]);

  if (!isOpen) return null;

  const isLoading = widgetState === 'loading';
  const isVerifying = widgetState === 'verifying';
  const isSuccess = widgetState === 'success';
  const isError = widgetState === 'error';

  const handleRetry = () => {
    cleanupMsg91Widget();
    initLockRef.current = false;
    verifyLockRef.current = false;
    initWidget();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">

        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isVerifying}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-1 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Close login dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#0B8F5A] border border-emerald-100 flex items-center justify-center mx-auto mb-3 shadow-2xs">
            {isSuccess ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            ) : isError ? (
              <AlertCircle className="w-6 h-6 text-red-500" />
            ) : (
              <Smartphone className="w-6 h-6" />
            )}
          </div>

          <h2 className="font-black text-gray-900 text-xl tracking-tight">
            {isSuccess
              ? "You're logged in!"
              : isError
              ? 'Something went wrong'
              : 'Welcome to PocketKirana'}
          </h2>

          <p className="text-xs text-gray-500 mt-1">
            {isSuccess
              ? 'Taking you to your account…'
              : isError
              ? 'Please try again or contact support.'
              : 'Verify your mobile number to continue'}
          </p>
        </div>

        {/* Loading state */}
        {(isLoading || isVerifying) && (
          <div className="flex flex-col items-center justify-center gap-3 py-8">
            <Loader2 className="w-8 h-8 animate-spin text-[#0B8F5A]" />
            <p className="text-sm font-semibold text-gray-600">
              {isVerifying
                ? 'Verifying OTP & logging you in…'
                : 'Loading secure OTP widget…'}
            </p>
          </div>
        )}

        {/* Success state */}
        {isSuccess && (
          <div className="flex flex-col items-center justify-center gap-3 py-6">
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <p className="text-sm font-bold text-emerald-700">Login successful!</p>
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-xs text-red-600 font-bold leading-relaxed">{errorMsg}</p>
            </div>
            <button
              type="button"
              onClick={handleRetry}
              className="w-full bg-[#0B8F5A] hover:bg-[#075C3C] text-white font-black text-sm py-3.5 rounded-xl shadow-md transition-all cursor-pointer"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Ready state info — MSG91 widget is floating above the page (appended to body) */}
        {widgetState === 'ready' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-[#0B8F5A]" />
            </div>
            <p className="text-sm text-gray-600 text-center leading-relaxed">
              An OTP verification screen has opened.<br />
              <span className="font-bold text-gray-800">Enter your mobile number</span> in the popup to receive your OTP.
            </p>
          </div>
        )}

        {/* Trust badge */}
        {(widgetState === 'ready' || widgetState === 'idle') && (
          <div className="flex items-center justify-center gap-1.5 mt-3 text-[11px] text-gray-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Secured by MSG91 · OTP via SMS</span>
          </div>
        )}

        {/* Footer */}
        <div className="mt-5 pt-4 border-t border-gray-100 text-center">
          <p className="text-[10px] text-gray-400 leading-tight">
            By continuing, you agree to PocketKirana&apos;s{' '}
            <a href="/terms" className="underline text-gray-600 font-semibold">
              Terms of Service
            </a>{' '}
            &amp;{' '}
            <a href="/privacy" className="underline text-gray-600 font-semibold">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
};
