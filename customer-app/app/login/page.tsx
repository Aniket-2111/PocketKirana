'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

export default function CustomerLoginPage() {
  const router = useRouter();
  const { sendOtp, verifyOtp, currentUser, isLoggedIn } = useAppStore();

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 10) {
      showToast('Please enter a valid 10-digit mobile number', 'error');
      return;
    }

    setIsLoading(true);
    const res = await sendOtp(clean);
    setIsLoading(false);

    if (res.success) {
      setStep('OTP');
      showToast('OTP sent successfully. Demo OTP: 1234', 'success');
    } else {
      showToast(res.error || 'Failed to send OTP', 'error');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) {
      showToast('Please enter the 4-digit code', 'error');
      return;
    }

    setIsLoading(true);
    const success = await verifyOtp(otp);
    setIsLoading(false);

    if (success) {
      showToast('Login successful! Welcome to Pocket Kirana', 'success');
      // After login, go set up address (if they already have one, setup-address will redirect to /home)
      router.replace('/setup-address');
    } else {
      showToast('Invalid OTP code. Demo OTP is 1234', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between p-6 font-sans">
      
      {/* Top Brand Hero */}
      <div className="pt-12 text-center space-y-4 max-w-sm mx-auto">
        <div className="w-20 h-20 rounded-3xl bg-emerald-600 text-white flex items-center justify-center mx-auto font-black text-3xl shadow-xl shadow-emerald-600/30">
          PK
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Pocket Kirana</h1>
          <p className="text-xs text-emerald-800 font-bold mt-1">10-Minute Instant Grocery Delivery</p>
        </div>
      </div>

      {/* Form Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md max-w-sm mx-auto w-full space-y-5">
        
        {step === 'PHONE' ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                Mobile Number
              </label>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-3 focus-within:border-emerald-600">
                <span className="text-xs font-mono font-black text-slate-500">+91</span>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoFocus
                  required
                  className="flex-1 bg-transparent text-xs font-mono font-bold text-slate-900 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs rounded-2xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-transform cursor-pointer uppercase tracking-wider"
            >
              <span>{isLoading ? 'SENDING OTP...' : 'CONTINUE WITH OTP'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4 animate-in fade-in">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                  Enter 4-Digit OTP
                </label>
                <button
                  type="button"
                  onClick={() => setStep('PHONE')}
                  className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                >
                  Change Number
                </button>
              </div>

              <input
                type="text"
                maxLength={6}
                placeholder="1234"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                autoFocus
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-center text-lg font-mono font-black tracking-widest text-slate-900 focus:outline-none focus:border-emerald-600"
              />
              <span className="text-[10px] text-slate-400 font-bold block text-center mt-1.5">
                Demo Testing OTP: <strong className="text-emerald-700 font-mono">1234</strong>
              </span>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs rounded-2xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-transform cursor-pointer uppercase tracking-wider"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isLoading ? 'VERIFYING...' : 'VERIFY & SIGN IN'}</span>
            </button>
          </form>
        )}

      </div>

      {/* Footer info */}
      <div className="text-center text-[11px] text-slate-400 max-w-xs mx-auto pb-4">
        By proceeding, you agree to Pocket Kirana's Terms of Service &amp; Privacy Policy.
      </div>

    </div>
  );
}
