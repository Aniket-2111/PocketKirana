'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { Package, Smartphone, Lock, ArrowRight, ShieldCheck, UserCheck } from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

export default function PickerLoginPage() {
  const router = useRouter();
  const { 
    sendOtp, 
    verifyOtp, 
    setActivePickerId 
  } = useAppStore();

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 10) {
      showToast('Please enter a valid 10-digit mobile number', 'error');
      return;
    }
    setLoading(true);
    try {
      // Enforce picker role before OTP so Firebase sync uses picker query (all orders)
      useAppStore.setState({ phoneInput: phone, activeRole: 'picker', hasSyncedFirebase: false } as any);
      await sendOtp(phone);
      setStep('otp');
      showToast('Test OTP is 1234', 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to send OTP', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 4) {
      showToast('Please enter the 4-digit code', 'error');
      return;
    }
    setLoading(true);
    try {
      const success = await verifyOtp(otp);
      if (success) {
        // Enforce role-based access: set picker user profile details
        const state = useAppStore.getState();
        if (state.currentUser) {
          state.currentUser.role = 'picker'; // Force picker role in session
          setActivePickerId('picker-1'); // Default to Rahul/Aniket profile
        }
        showToast('Access Granted! Welcome to Picker Workspace.', 'success');
        router.replace('/home');
      } else {
        showToast('Invalid verification code', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Verification failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Quick Login Bypass for Developers
  const handleQuickLogin = async (pickerId: string, name: string) => {
    setLoading(true);
    try {
      useAppStore.setState({
        isLoggedIn: true,
        activeRole: 'picker',
        hasSyncedFirebase: false, // Force re-init as picker so orders stream correctly
        currentUser: {
          id: pickerId,
          role: 'picker',
          firstName: name,
          mobile: pickerId === 'picker-1' ? '+91 9999999999' : '+91 8888888888',
          status: 'active',
          createdAt: new Date().toISOString(),
        }
      } as any);
      setActivePickerId(pickerId);
      // Force Firebase sync with picker role immediately
      await useAppStore.getState().initializeFirebaseSync(true);
      showToast(`Logged in as ${name} (UAT)`, 'success');
      router.replace('/home');
    } catch (err: any) {
      showToast('Quick login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background radial highlight */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-[32px] p-8 shadow-xl relative z-10 space-y-8 text-slate-900">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-3xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600 shadow-xs">
            <Package className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">PocketKirana</h1>
            <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 font-extrabold text-[10px] px-3 py-1 rounded-full uppercase tracking-wider inline-block mt-1">
              Picker Workspace
            </span>
          </div>
        </div>

        {/* Form Steps */}
        {step === 'phone' ? (
          <form onSubmit={handleSendOtp} className="space-y-4 animate-in fade-in duration-200">
            <div className="space-y-2">
              <label htmlFor="phone" className="text-xs font-bold text-slate-500 block uppercase tracking-wider">
                Mobile Number
              </label>
              <div className="relative">
                <Smartphone className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                <input
                  id="phone"
                  type="tel"
                  placeholder="Enter 10-digit mobile"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-mono text-sm placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition-colors"
                  required
                  suppressHydrationWarning
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              suppressHydrationWarning
            >
              <span>Request Verification Code</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4 animate-in fade-in duration-200">
            <div className="space-y-2">
              <label htmlFor="otp" className="text-xs font-bold text-slate-500 block uppercase tracking-wider">
                Verification Code
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                <input
                  id="otp"
                  type="text"
                  placeholder="Enter code (1234)"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-mono text-sm tracking-[0.3em] placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition-colors"
                  required
                  suppressHydrationWarning
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              suppressHydrationWarning
            >
              <ShieldCheck className="w-5 h-5" />
              <span>Verify &amp; Enter Workspace</span>
            </button>

            <button
              type="button"
              onClick={() => setStep('phone')}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-900 font-semibold transition-colors cursor-pointer"
              suppressHydrationWarning
            >
              Change Mobile Number
            </button>
          </form>
        )}

        {/* Quick Dev Login */}
        <div className="border-t border-slate-100 pt-6 space-y-3">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block text-center">
            🚀 Quick UAT Sign-in
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleQuickLogin('picker-1', 'Aniket Yadav')}
              className="p-3 bg-slate-50 hover:bg-emerald-50/60 border border-slate-200 rounded-2xl text-left transition-colors flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer group"
              suppressHydrationWarning
            >
              <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="min-w-0">
                <span className="block truncate text-slate-900 font-extrabold">Aniket Y.</span>
                <span className="text-[9px] text-slate-400 block font-normal">Shift Leader</span>
              </div>
            </button>

            <button
              onClick={() => handleQuickLogin('picker-2', 'Rahul')}
              className="p-3 bg-slate-50 hover:bg-amber-50/60 border border-slate-200 rounded-2xl text-left transition-colors flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer group"
              suppressHydrationWarning
            >
              <UserCheck className="w-4 h-4 text-amber-600 shrink-0" />
              <div className="min-w-0">
                <span className="block truncate text-slate-900 font-extrabold">Rahul</span>
                <span className="text-[9px] text-slate-400 block font-normal">Store Picker</span>
              </div>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
