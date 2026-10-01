'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { showToast } from '@/components/ui/Toast';
import {
  sendMsg91Otp,
  verifyMsg91Otp,
  resendMsg91Otp,
  initMsg91CustomUI,
  cleanupMsg91Widget,
} from '@/lib/msg91Widget';
import {
  X,
  Smartphone,
  Loader2,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Edit2,
  RefreshCw,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { verifyMsg91Token } = useAppStore();

  const [step, setStep] = useState<'PHONE' | 'OTP' | 'SUCCESS'>('PHONE');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [resendCountdown, setResendCountdown] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [resendAttempts, setResendAttempts] = useState(0);

  const phoneInputRef = useRef<HTMLInputElement>(null);
  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const isSubmittingRef = useRef(false);

  const cleanPhone = phoneNumber.replace(/\D/g, '').slice(-10);

  // Initialize MSG91 custom UI on mount
  useEffect(() => {
    initMsg91CustomUI().catch(() => {});
    return () => {
      cleanupMsg91Widget();
    };
  }, []);

  // Reset states when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('PHONE');
      setPhoneNumber('');
      setOtpDigits(['', '', '', '']);
      setErrorMsg('');
      setIsLoading(false);
      setIsResending(false);
      setResendAttempts(0);
      setResendCountdown(30);
      setCanResend(false);
      setTimeout(() => phoneInputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Resend OTP countdown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 'OTP' && resendCountdown > 0) {
      timer = setInterval(() => {
        setResendCountdown((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, resendCountdown]);

  // Focus first OTP input when reaching OTP step
  useEffect(() => {
    if (step === 'OTP') {
      setTimeout(() => {
        otpInputsRef.current[0]?.focus();
      }, 150);
    }
  }, [step]);

  if (!isOpen) return null;

  // Handle Send OTP (Real MSG91 SMS)
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || isLoading) return;

    if (cleanPhone.length !== 10) {
      setErrorMsg('Please enter a valid 10-digit Indian mobile number.');
      showToast('Please enter a valid 10-digit mobile number', 'error');
      return;
    }

    setIsLoading(true);
    isSubmittingRef.current = true;
    setErrorMsg('');

    try {
      // 1. Trigger Real MSG91 SMS OTP
      const msg91Res = await sendMsg91Otp(cleanPhone);

      if (msg91Res.success) {
        setStep('OTP');
        setResendCountdown(30);
        setCanResend(false);
        setResendAttempts(0);
        setOtpDigits(['', '', '', '']);
        showToast(`OTP sent to +91 ${cleanPhone} via SMS`, 'success');
      } else {
        setErrorMsg(msg91Res.error || 'Failed to send OTP. Please check mobile number and try again.');
        showToast(msg91Res.error || 'Failed to send OTP', 'error');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error while sending OTP.');
      showToast('Network error. Please try again.', 'error');
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  };

  // Handle OTP digit input changes
  const handleOtpChange = (index: number, val: string) => {
    const sanitized = val.replace(/\D/g, '');
    setErrorMsg('');

    if (sanitized.length > 1) {
      // Handle paste
      const pastedChars = sanitized.slice(0, 4).split('');
      const newDigits = [...otpDigits];
      pastedChars.forEach((c, idx) => {
        if (idx < 4) newDigits[idx] = c;
      });
      setOtpDigits(newDigits);
      const focusIndex = Math.min(pastedChars.length, 3);
      otpInputsRef.current[focusIndex]?.focus();
      return;
    }

    const newDigits = [...otpDigits];
    newDigits[index] = sanitized;
    setOtpDigits(newDigits);

    // Auto advance
    if (sanitized && index < 3) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  // Handle Backspace navigation
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  // Handle Verify OTP (Real MSG91 verification + Server Token Auth)
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || isLoading) return;

    const otpCode = otpDigits.join('').trim();
    if (otpCode.length < 4) {
      setErrorMsg('Please enter the complete 4-digit verification code.');
      showToast('Please enter complete 4-digit OTP', 'error');
      return;
    }

    setIsLoading(true);
    isSubmittingRef.current = true;
    setErrorMsg('');

    try {
      // 1. Verify Real OTP with MSG91 SMS Gateway
      const verifyRes = await verifyMsg91Otp(otpCode);

      if (verifyRes.success && verifyRes.access_token) {
        // 2. Server-side token verification (sets session cookie & resolves user)
        const serverAuthRes = await verifyMsg91Token(verifyRes.access_token);

        if (serverAuthRes.success) {
          setStep('SUCCESS');
          showToast('Login successful! Welcome to PocketKirana 🎉', 'success');
          setTimeout(() => {
            onClose();
          }, 800);
          return;
        } else {
          setErrorMsg(serverAuthRes.error || 'Server authentication failed. Please try again.');
          showToast(serverAuthRes.error || 'Authentication failed', 'error');
        }
      } else {
        const err = verifyRes.error || 'Invalid verification code entered. Please enter the OTP sent to your phone.';
        setErrorMsg(err);
        showToast(err, 'error');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Verification error. Please try again.');
      showToast('Verification failed. Please try again.', 'error');
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  };

  // Handle Resend OTP (Real MSG91 Resend)
  const handleResendOtp = async () => {
    if (!canResend || isLoading || isResending) return;

    if (resendAttempts >= 2) {
      setErrorMsg('Maximum resend attempts reached. Please wait or change number.');
      showToast('Maximum resend limit reached', 'error');
      return;
    }

    setIsResending(true);
    setErrorMsg('');

    try {
      const res = await resendMsg91Otp();
      if (res.success) {
        setResendCountdown(30);
        setCanResend(false);
        setResendAttempts((prev) => prev + 1);
        setOtpDigits(['', '', '', '']);
        showToast('New verification code sent via SMS!', 'success');
        otpInputsRef.current[0]?.focus();
      } else {
        setErrorMsg(res.error || 'Unable to resend OTP. Please wait a moment.');
        showToast(res.error || 'Resend failed', 'error');
      }
    } catch (err: any) {
      setErrorMsg('Failed to resend verification code. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isLoading && step === 'SUCCESS'}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors p-1.5 rounded-full hover:bg-slate-100 cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* ── HEADER ── */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mx-auto mb-3 shadow-2xs">
            {step === 'SUCCESS' ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            ) : (
              <Smartphone className="w-6 h-6" />
            )}
          </div>

          <h2 className="font-black text-slate-900 text-xl tracking-tight">
            {step === 'SUCCESS'
              ? 'Login Successful!'
              : step === 'OTP'
              ? 'Verify Mobile Number'
              : 'Welcome to PocketKirana'}
          </h2>

          <p className="text-xs text-slate-500 mt-1">
            {step === 'SUCCESS'
              ? 'Taking you to your account...'
              : step === 'OTP'
              ? 'Enter the 4-digit OTP sent to your phone'
              : 'Verify your mobile number to continue'}
          </p>
        </div>

        {/* ── ERROR MESSAGE ── */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="font-medium leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {/* ── STEP 1: PHONE NUMBER INPUT ── */}
        {step === 'PHONE' && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                Mobile Number
              </label>
              <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 focus-within:border-emerald-600 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all overflow-hidden p-1">
                <div className="px-3 py-2 bg-slate-100 rounded-xl text-slate-700 font-bold text-xs flex items-center gap-1.5 select-none shrink-0 border border-slate-200/60">
                  <span>🇮🇳</span>
                  <span>+91</span>
                </div>
                <input
                  ref={phoneInputRef}
                  type="tel"
                  maxLength={10}
                  placeholder="Enter 10-digit number"
                  value={phoneNumber}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setPhoneNumber(val);
                    if (errorMsg) setErrorMsg('');
                  }}
                  className="w-full bg-transparent px-3 py-2 text-sm font-bold text-slate-900 tracking-wider placeholder:font-medium placeholder:text-slate-400 placeholder:tracking-normal focus:outline-none"
                  autoComplete="tel-national"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || cleanPhone.length < 10}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black text-xs py-3.5 rounded-2xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending Real OTP...</span>
                </>
              ) : (
                <>
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* ── STEP 2: OTP VERIFICATION INPUT ── */}
        {step === 'OTP' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            
            {/* Phone Info & Edit */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Sent to:</span>
                <span className="text-xs font-black text-slate-900 font-mono">+91 {cleanPhone}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStep('PHONE');
                  setOtpDigits(['', '', '', '']);
                  setErrorMsg('');
                  setResendCountdown(30);
                  setCanResend(false);
                }}
                className="text-emerald-700 hover:text-emerald-800 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
              >
                <Edit2 className="w-3 h-3" />
                <span>Change</span>
              </button>
            </div>

            {/* 4 Clean OTP Digit Boxes */}
            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-2 text-center">
                Enter Verification Code
              </label>
              <div className="flex items-center justify-center gap-2.5">
                {otpDigits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      otpInputsRef.current[index] = el;
                    }}
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    className="w-12 h-14 rounded-2xl bg-slate-50 border border-slate-200 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 text-center text-2xl font-black text-slate-900 font-mono shadow-inner focus:outline-none transition-all"
                  />
                ))}
              </div>
            </div>

            {/* Verify Button */}
            <button
              type="submit"
              disabled={isLoading || otpDigits.join('').length < 4}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black text-xs py-3.5 rounded-2xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Code...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Verify &amp; Sign In</span>
                </>
              )}
            </button>

            {/* Resend Timer / Action */}
            <div className="text-center pt-1">
              {canResend ? (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={isLoading || isResending}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {isResending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending new code...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Resend Verification Code</span>
                    </>
                  )}
                </button>
              ) : (
                <span className="text-xs text-slate-400 font-medium">
                  Resend code in <strong className="text-slate-700 font-bold">{resendCountdown}s</strong>
                </span>
              )}
            </div>
          </form>
        )}

        {/* ── STEP 3: SUCCESS STATE ── */}
        {step === 'SUCCESS' && (
          <div className="py-6 flex flex-col items-center justify-center gap-3">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <p className="text-sm font-black text-slate-900">Welcome Back!</p>
          </div>
        )}

        {/* ── TRUST BADGE ── */}
        {step !== 'SUCCESS' && (
          <div className="flex items-center justify-center gap-1.5 mt-5 text-[11px] text-slate-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Secured by PocketKirana SMS Gateway</span>
          </div>
        )}

        {/* ── FOOTER TERMS ── */}
        <div className="mt-4 pt-3 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-400 leading-tight">
            By continuing, you agree to PocketKirana&apos;s{' '}
            <a href="/terms" className="underline text-slate-600 font-semibold">
              Terms of Service
            </a>{' '}
            &amp;{' '}
            <a href="/privacy" className="underline text-slate-600 font-semibold">
              Privacy Policy
            </a>
            .
          </p>
        </div>

      </div>
    </div>
  );
};

