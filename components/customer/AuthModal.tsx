'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { clearRecaptcha } from '@/lib/firebaseAuth';
import { X, Smartphone, KeyRound, ArrowRight, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { otpSent, sendOtp, verifyOtp, phoneInput, setPhoneInput } = useAppStore();
  const [otpCode, setOtpCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Countdown timer for Resend OTP
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Clean up when modal closes
  useEffect(() => {
    if (!isOpen) {
      setErrorMsg('');
      setOtpCode('');
      setIsLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phoneInput.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      setErrorMsg('Please enter a valid 10-digit Indian mobile number');
      return;
    }
    setErrorMsg('');
    setIsLoading(true);

    try {
      const result = await sendOtp(cleanPhone);
      if (!result.success) {
        setErrorMsg(result.error || 'Failed to send SMS OTP. Please try again.');
      } else {
        setCountdown(30); // 30s cooldown before next SMS
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to send SMS OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otpCode.trim();
    if (!cleanOtp || cleanOtp.length < 4) {
      setErrorMsg('Please enter the 6-digit SMS verification code');
      return;
    }
    setErrorMsg('');
    setIsLoading(true);

    try {
      const success = await verifyOtp(cleanOtp);
      if (success) {
        setOtpCode('');
        onClose();
      } else {
        setErrorMsg('Invalid OTP code. Please check your SMS and enter the code.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0 || isLoading) return;
    setErrorMsg('');
    setOtpCode('');
    setIsLoading(true);
    try {
      const result = await sendOtp(phoneInput);
      if (result.success) {
        setCountdown(30);
      } else {
        setErrorMsg(result.error || 'Failed to resend OTP.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-1"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-[#006E2F] flex items-center justify-center mx-auto mb-3 shadow-xs">
            {otpSent ? <KeyRound className="w-6 h-6" /> : <Smartphone className="w-6 h-6" />}
          </div>
          <h2 className="font-black text-gray-900 text-xl tracking-tight">
            {otpSent ? 'Enter SMS Code' : 'Welcome to PocketKirana'}
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {otpSent
              ? `We sent a 6-digit SMS verification code to +91 ${phoneInput.slice(-10)}`
              : 'Log in or sign up to get 8-min grocery deliveries'}
          </p>
        </div>

        {!otpSent ? (
          /* Step 1: Phone Number Input */
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Mobile Number
              </label>
              <div className="flex rounded-xl border border-gray-300 overflow-hidden focus-within:border-[#006E2F] focus-within:ring-2 focus-within:ring-emerald-500/20 bg-gray-50/50">
                <span className="bg-gray-100 text-gray-700 text-xs font-black px-3.5 flex items-center border-r border-gray-300">
                  +91
                </span>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="9876543210"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-sm font-bold px-3.5 py-3 text-gray-900 focus:outline-none bg-transparent"
                  suppressHydrationWarning
                  autoFocus
                />
              </div>
            </div>

            {errorMsg && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-xs text-red-600 font-bold leading-relaxed">{errorMsg}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#006E2F] hover:bg-emerald-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-black text-sm py-3.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending SMS OTP…</span>
                </>
              ) : (
                <>
                  <span>Send Verification Code</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          /* Step 2: OTP Verification Input */
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 text-center">
                6-Digit SMS Verification Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="••••••"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                className="w-full text-center tracking-[0.5em] text-2xl font-mono font-black py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-[#006E2F] focus:ring-2 focus:ring-emerald-500/20 bg-gray-50/50"
                suppressHydrationWarning
                autoFocus
              />
              <div className="flex flex-col items-center justify-center gap-1 text-[11px] text-gray-500 mt-2">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Enter the SMS code or use UAT test PIN</span>
                </div>
                <span className="bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 rounded-md font-mono font-black text-[10px] mt-1">
                  💡 Test OTP Code: 1234
                </span>
              </div>
            </div>

            {errorMsg && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-xs text-red-600 font-bold text-center leading-relaxed">{errorMsg}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#006E2F] hover:bg-emerald-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-black text-sm py-3.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying & Loading Profile…</span>
                </>
              ) : (
                'Verify & Log In'
              )}
            </button>

            <div className="flex items-center justify-between pt-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  useAppStore.setState({ otpSent: false });
                }}
                className="text-gray-500 hover:text-gray-800 font-bold cursor-pointer"
              >
                ← Change Number
              </button>
              <button
                type="button"
                disabled={isLoading || countdown > 0}
                onClick={handleResendOtp}
                className={`font-bold flex items-center gap-1 transition-colors ${
                  countdown > 0
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-[#006E2F] hover:text-emerald-800 cursor-pointer'
                }`}
              >
                <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                {countdown > 0 ? `Resend in ${countdown}s` : 'Resend SMS OTP'}
              </button>
            </div>
          </form>
        )}

        {/* Footer info */}
        <div className="mt-6 pt-4 border-t border-gray-100 text-center">
          <p className="text-[10px] text-gray-400 leading-tight">
            By continuing, you agree to PocketKirana&apos;s{' '}
            <a href="#" className="underline text-gray-600 font-semibold">Terms of Service</a> &{' '}
            <a href="#" className="underline text-gray-600 font-semibold">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
};

