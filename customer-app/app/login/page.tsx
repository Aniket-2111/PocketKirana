'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { ArrowLeft, ChevronDown, ShieldCheck, Loader2, AlertCircle, Sparkles, RefreshCw } from 'lucide-react';
import { showToast } from '@/components/ui/Toast';
import { sendMsg91Otp, verifyMsg91Otp, resendMsg91Otp, initMsg91CustomUI, cleanupMsg91Widget } from '@/lib/msg91Widget';

// Curated grocery collage items mirroring the Blinkit screenshot aesthetic
const COLLAGE_ITEMS = [
  // Row 1
  [
    { name: 'Toor Dal', label: 'Tata Sampann', icon: '🌾', bg: 'from-amber-900/30 to-amber-950/50', img: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=200&q=80' },
    { name: 'Broccoli', label: 'Fresh Green', icon: '🥦', bg: 'from-emerald-900/30 to-emerald-950/50', img: 'https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?auto=format&fit=crop&w=200&q=80' },
    { name: 'Curd / Dahi', label: 'Classic Dairy', icon: '🥛', bg: 'from-blue-900/30 to-blue-950/50', img: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=200&q=80' },
    { name: 'Fresh Fruits', label: 'Daily Harvest', icon: '🍎', bg: 'from-rose-900/30 to-rose-950/50', img: 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=200&q=80' },
  ],
  // Row 2
  [
    { name: 'Fortune Oil', label: 'Pure Cooking Oil', icon: '🌻', bg: 'from-yellow-900/30 to-yellow-950/50', img: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=200&q=80' },
    { name: 'LED Bulb', label: 'Home Living', icon: '💡', bg: 'from-zinc-800/40 to-zinc-900/60', img: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=200&q=80' },
    { name: 'Glue Stick', label: 'Stationery', icon: '✏️', bg: 'from-indigo-900/30 to-indigo-950/50', img: 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&w=200&q=80' },
    { name: 'Tea & Coffee', label: 'Chai Time', icon: '☕', bg: 'from-stone-900/30 to-stone-950/50', img: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=200&q=80' },
  ],
  // Row 3
  [
    { name: 'Sandwich Maker', label: 'Appliances', icon: '🥪', bg: 'from-zinc-800/30 to-zinc-900/50', img: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=200&q=80' },
    { name: 'Wooden Spoons', label: 'Kitchenware', icon: '🥄', bg: 'from-amber-900/20 to-amber-950/40', img: 'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?auto=format&fit=crop&w=200&q=80' },
    { name: 'Strawberry', label: 'Sweet Treat', icon: '🍓', bg: 'from-red-900/30 to-red-950/50', img: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?auto=format&fit=crop&w=200&q=80' },
    { name: 'Snacks & Chips', label: 'Quick Munch', icon: '🍿', bg: 'from-orange-900/30 to-orange-950/50', img: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=200&q=80' },
  ],
];

export default function CustomerLoginPage() {
  const router = useRouter();
  const { verifyMsg91Token, sendOtp, verifyOtp } = useAppStore();

  const [phone, setPhone] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '']);
  const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [resendAttempts, setResendAttempts] = useState(0);

  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const isSubmittingRef = useRef(false);

  const cleanPhone = phone.replace(/\D/g, '').slice(-10);

  // Pre-load MSG91 custom UI on mount
  useEffect(() => {
    initMsg91CustomUI().catch(() => {});
    return () => {
      cleanupMsg91Widget();
    };
  }, []);

  // Resend Countdown Timer tick down (10s throttle per MSG91 config)
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Focus first OTP box on entering OTP step
  useEffect(() => {
    if (step === 'OTP') {
      setTimeout(() => {
        otpInputsRef.current[0]?.focus();
      }, 150);
    }
  }, [step]);

  // Handle Send OTP
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmittingRef.current || isLoading) return;

    if (cleanPhone.length !== 10) {
      setErrorMsg('Please enter a valid 10-digit Indian mobile number');
      showToast('Please enter a valid 10-digit Indian mobile number', 'error');
      return;
    }

    setErrorMsg('');
    setIsLoading(true);
    isSubmittingRef.current = true;

    try {
      // 1. Call MSG91 Custom UI Send OTP (Real SMS)
      const msg91Res = await sendMsg91Otp(cleanPhone);

      if (msg91Res.success) {
        setStep('OTP');
        setCountdown(10);
        setResendAttempts(0);
        setOtpDigits(['', '', '', '']);
        showToast(`OTP sent to +91 ${cleanPhone}`, 'success');
      } else {
        setErrorMsg(msg91Res.error || 'Failed to send OTP. Please check mobile number.');
        showToast(msg91Res.error || 'Failed to send OTP', 'error');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error while sending OTP');
      showToast('Network error. Please try again.', 'error');
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  };

  // Handle OTP Digit Input Change
  const handleOtpChange = (index: number, val: string) => {
    const sanitized = val.replace(/\D/g, '');
    setErrorMsg('');

    if (sanitized.length > 1) {
      // Handle Paste of multi-digit OTP
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

    // Auto-advance to next input box
    if (sanitized && index < 3) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  // Handle Backspace Key Navigation
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  // Handle Resend OTP (Max 2 resends per MSG91 config)
  const handleResendOtp = async () => {
    if (countdown > 0 || isResending) return;

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
        setCountdown(10);
        setResendAttempts((prev) => prev + 1);
        setOtpDigits(['', '', '', '']);
        showToast('New OTP sent successfully!', 'success');
        otpInputsRef.current[0]?.focus();
      } else {
        setErrorMsg(res.error || 'Unable to resend OTP. Please wait a moment.');
        showToast(res.error || 'Resend failed', 'error');
      }
    } catch (err: any) {
      setErrorMsg('Failed to resend OTP. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  // Handle Change / Edit Number
  const handleChangeNumber = () => {
    setStep('PHONE');
    setOtpDigits(['', '', '', '']);
    setErrorMsg('');
    setCountdown(0);
    setResendAttempts(0);
    setIsLoading(false);
  };

  // Handle OTP Verification
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmittingRef.current || isLoading) return;

    const otpCode = otpDigits.join('').trim();
    if (otpCode.length < 4) {
      setErrorMsg('Please enter the complete 4-digit verification code');
      showToast('Please enter complete 4-digit OTP', 'error');
      return;
    }

    setIsLoading(true);
    isSubmittingRef.current = true;
    setErrorMsg('');

    try {
      // 1. Verify OTP with MSG91 custom UI client
      const verifyRes = await verifyMsg91Otp(otpCode);

      if (verifyRes.success && verifyRes.access_token) {
        // 2. Server-side token verification (AuthKey securely verified on backend)
        const serverAuthRes = await verifyMsg91Token(verifyRes.access_token);

        if (serverAuthRes.success) {
          showToast('Login successful! Welcome to Pocket Kirana 🎉', 'success');
          router.replace('/home');
          return;
        } else {
          setErrorMsg(serverAuthRes.error || 'Server authentication failed. Please try again.');
          showToast(serverAuthRes.error || 'Authentication failed', 'error');
        }
      } else {
        const err = verifyRes.error || 'Incorrect OTP code entered. Please check and try again.';
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

  return (
    <div className="min-h-screen bg-[#0e1217] text-white flex flex-col justify-between font-sans overflow-x-hidden relative select-none">
      
      {/* ── Top Header / Product Collage Area ── */}
      <div className="relative w-full overflow-hidden pt-4 pb-2">
        
        {/* Circular Back Button */}
        <button
          type="button"
          onClick={() => {
            if (step === 'OTP') {
              handleChangeNumber();
            } else {
              router.push('/home');
            }
          }}
          className="absolute top-4 left-4 z-30 w-10 h-10 rounded-full bg-[#1e242e]/90 hover:bg-[#28313e] border border-white/10 flex items-center justify-center text-white transition-transform active:scale-90 shadow-md cursor-pointer"
          aria-label="Go Back"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>

        {/* Staggered Grocery Products Collage Grid */}
        <div className="px-4 pt-10 space-y-2.5 max-w-md mx-auto opacity-95">
          {COLLAGE_ITEMS.map((row, rIdx) => (
            <div
              key={rIdx}
              className={`flex items-center justify-center gap-2.5 ${
                rIdx === 1 ? '-translate-x-3' : rIdx === 2 ? 'translate-x-3' : ''
              }`}
            >
              {row.map((item, iIdx) => (
                <div
                  key={iIdx}
                  className="w-[74px] h-[74px] sm:w-[84px] sm:h-[84px] rounded-[22px] bg-[#1a202c]/90 border border-white/5 shadow-inner shadow-white/5 flex flex-col items-center justify-center p-2 relative overflow-hidden group transition-all duration-300 hover:scale-105"
                >
                  {/* Subtle card glow */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${item.bg} opacity-60`} />
                  
                  {/* Product Visual */}
                  <img
                    src={item.img}
                    alt={item.name}
                    className="w-11 h-11 sm:w-12 sm:h-12 object-cover rounded-xl z-10 drop-shadow-md group-hover:scale-110 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <span className="text-xl z-10 drop-shadow hidden group-has-[img[style*='display: none']]:inline">
                    {item.icon}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Seamless dark gradient fade towards the form */}
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#0e1217] via-[#0e1217]/90 to-transparent pointer-events-none z-10" />
      </div>

      {/* ── Middle Interactive Section ── */}
      <div className="relative z-20 px-6 max-w-sm mx-auto w-full flex-1 flex flex-col justify-center -mt-6">
        
        {/* Central Logo Squircle Badge (PocketKirana Brand Green) */}
        <div className="flex flex-col items-center justify-center mb-3">
          <div className="w-[72px] h-[72px] rounded-[24px] bg-gradient-to-br from-emerald-500 to-[#006E2F] shadow-xl shadow-emerald-900/40 flex flex-col items-center justify-center p-2 border border-emerald-400/30 transform hover:scale-105 transition-transform">
            <div className="flex flex-col items-center leading-none">
              <span className="text-white font-black text-sm tracking-tight">pocket</span>
              <span className="text-[#acf847] font-black text-xs tracking-wider mt-0.5">kirana</span>
            </div>
          </div>

          {/* Main Title & Subtitle */}
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-3 text-center">
            {step === 'PHONE' ? "India's last minute app" : "Verify your number"}
          </h1>
          <p className="text-sm font-semibold text-zinc-400 mt-1 text-center">
            {step === 'PHONE' ? (
              'Log In or Sign Up'
            ) : (
              <span className="flex items-center justify-center gap-1.5 font-mono text-zinc-300">
                <span>Code sent to +91 {cleanPhone.slice(0, 2)}••••••{cleanPhone.slice(-2)}</span>
              </span>
            )}
          </p>
        </div>

        {/* Inline Error Message Banner */}
        {errorMsg && (
          <div className="mb-3 p-3 rounded-2xl bg-red-950/70 border border-red-500/40 text-red-300 text-xs flex items-center gap-2 animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="leading-snug">{errorMsg}</span>
          </div>
        )}

        {/* ── Step 1: Phone Input ── */}
        {step === 'PHONE' ? (
          <form onSubmit={handleSendOtp} className="space-y-4 mt-2">
            
            {/* Input Row: Flag Box + Mobile Input Box */}
            <div className="flex items-center gap-2.5">
              
              {/* Flag Pill with crisp SVG Tricolor */}
              <div className="h-14 px-3.5 rounded-2xl bg-[#1a202c] border border-zinc-700/60 flex items-center gap-2 shadow-sm shrink-0">
                <svg viewBox="0 0 640 480" className="w-5 h-3.5 rounded-xs shadow-xs overflow-hidden" aria-hidden="true">
                  <path fill="#f93" d="M0 0h640v160H0z" />
                  <path fill="#fff" d="M0 160h640v160H0z" />
                  <path fill="#128807" d="M0 320h640v160H0z" />
                  <circle cx="320" cy="240" r="40" fill="none" stroke="#008" strokeWidth="6" />
                  <circle cx="320" cy="240" r="10" fill="#008" />
                </svg>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              </div>

              {/* Number Input */}
              <div className="h-14 flex-1 rounded-2xl bg-[#1a202c] border border-zinc-700/60 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500/40 flex items-center px-4 gap-2.5 transition-all shadow-sm">
                <span className="text-base font-bold text-zinc-200 font-mono">+91</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  placeholder="Enter mobile number"
                  value={phone}
                  onChange={(e) => {
                    setErrorMsg('');
                    setPhone(e.target.value.replace(/\D/g, ''));
                  }}
                  autoFocus
                  required
                  className="w-full bg-transparent text-base font-bold text-white placeholder:text-zinc-500 placeholder:font-normal focus:outline-none font-mono tracking-wide"
                />
              </div>
            </div>

            {/* Primary Continue Button */}
            <button
              type="submit"
              disabled={cleanPhone.length < 10 || isLoading}
              className={`w-full h-14 rounded-2xl font-bold text-base transition-all duration-200 flex items-center justify-center gap-2 ${
                cleanPhone.length === 10 && !isLoading
                  ? 'bg-[#006E2F] hover:bg-[#005a26] text-white font-black shadow-lg shadow-emerald-900/50 active:scale-[0.98] cursor-pointer'
                  : 'bg-[#2b3340] text-zinc-400 cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Sending OTP...</span>
                </>
              ) : (
                <span>Continue</span>
              )}
            </button>
          </form>
        ) : (
          /* ── Step 2: Custom Pocket Kirana OTP Verification ── */
          <form onSubmit={handleVerifyOtp} className="space-y-4 mt-2 animate-in fade-in duration-300">
            
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-zinc-400 font-medium">Enter 4-digit code</span>
                <button
                  type="button"
                  onClick={handleChangeNumber}
                  className="text-emerald-400 hover:text-emerald-300 font-bold underline cursor-pointer"
                >
                  Change number
                </button>
              </div>

              {/* 4 Separate Clean OTP Digit Boxes */}
              <div className="flex items-center justify-center gap-3">
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
                    className="w-14 h-16 rounded-2xl bg-[#1a202c] border border-zinc-700/70 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40 text-center text-2xl sm:text-3xl font-black text-white font-mono shadow-inner focus:outline-none transition-all"
                  />
                ))}
              </div>
            </div>

            {/* Verify Button */}
            <button
              type="submit"
              disabled={otpDigits.join('').length < 4 || isLoading}
              className={`w-full h-14 rounded-2xl font-bold text-base transition-all duration-200 flex items-center justify-center gap-2 ${
                otpDigits.join('').length >= 4 && !isLoading
                  ? 'bg-[#006E2F] hover:bg-[#005a26] text-white font-black shadow-lg shadow-emerald-900/50 active:scale-[0.98] cursor-pointer'
                  : 'bg-[#2b3340] text-zinc-400 cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Verifying Code...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  <span>Verify &amp; Continue</span>
                </>
              )}
            </button>

            {/* Resend Link with Countdown */}
            <div className="text-center pt-1">
              {countdown > 0 ? (
                <span className="text-xs text-zinc-400 font-medium font-mono">
                  Resend OTP in <strong className="text-emerald-400 font-bold">{countdown}s</strong>
                </span>
              ) : resendAttempts >= 2 ? (
                <span className="text-xs text-zinc-500 font-medium">
                  Resend limit reached (2/2)
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={isResending}
                  className="text-xs font-bold text-emerald-400 hover:text-emerald-300 underline inline-flex items-center gap-1 cursor-pointer"
                >
                  {isResending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending new code...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Didn&apos;t receive code? Resend OTP</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </form>
        )}

      </div>

      {/* ── Footer ── */}
      <div className="relative z-20 px-6 py-4 text-center text-[11px] text-zinc-500 max-w-xs mx-auto">
        By continuing, you agree to our{' '}
        <span className="text-zinc-300 underline cursor-pointer">Terms of service</span> &amp;{' '}
        <span className="text-zinc-300 underline cursor-pointer">Privacy policy</span>
      </div>

    </div>
  );
}

