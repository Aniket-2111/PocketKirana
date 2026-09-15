'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { Package, Lock, User, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

export default function PickerLoginPage() {
  const router = useRouter();
  const { loginPickerByCredentials, isLoggedIn } = useAppStore();

  useEffect(() => {
    if (isLoggedIn) {
      router.replace('/home');
    }
  }, [isLoggedIn, router]);

  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId.trim()) {
      showToast('Please enter your Employee ID or Mobile number', 'error');
      return;
    }
    if (!password.trim()) {
      showToast('Please enter your Password', 'error');
      return;
    }

    setIsLoading(true);
    const res = loginPickerByCredentials(loginId, password);
    setIsLoading(false);

    if (res.success) {
      // Force Firebase sync with picker role if configured
      try {
        await useAppStore.getState().initializeFirebaseSync(true);
      } catch (err) {
        // non-blocking
      }
      showToast(res.message, 'success');
      router.replace('/home');
    } else {
      showToast(res.message, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/80 via-slate-50 to-white text-slate-900 flex flex-col justify-between p-6 font-sans relative overflow-hidden">
      
      {/* Background soft emerald glow */}
      <div className="fixed inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-[500px] h-[500px] bg-emerald-400/10 rounded-full blur-[140px]" />
      </div>

      {/* Top Brand Hero */}
      <div className="pt-8 text-center space-y-3 max-w-sm mx-auto relative z-10">
        <div className="w-18 h-18 rounded-3xl bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-xl shadow-emerald-600/20 ring-4 ring-emerald-100">
          <Package className="w-9 h-9" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">PocketKirana</h1>
          <div className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200/80 px-3 py-1 rounded-full mt-1.5 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
              Picker &amp; Warehouse App
            </span>
          </div>
        </div>
      </div>

      {/* Login Card */}
      <div className="bg-white border border-emerald-100 rounded-3xl p-6 sm:p-8 shadow-xl shadow-emerald-950/5 max-w-sm mx-auto w-full space-y-5 relative z-10">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-900">Picker Sign In</h2>
          <p className="text-xs text-slate-500">
            Enter the Employee ID and Password provided by Admin.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Employee ID / Mobile
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-3.5 w-4 h-4 text-emerald-600" />
              <input
                type="text"
                placeholder="e.g. PKP-014 or 8698893348"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                autoFocus
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-emerald-600" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-11 py-3 text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold text-xs rounded-2xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer uppercase tracking-wider mt-2 disabled:opacity-50"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{isLoading ? 'VERIFYING CREDENTIALS...' : 'ENTER PICKER WORKSPACE'}</span>
          </button>
        </form>
      </div>

      {/* Footer */}
      <div className="text-center text-[11px] text-slate-400 font-mono pb-2 relative z-10">
        Pocket Kirana Picker Workspace • v1.2.0 (APK)
      </div>

    </div>
  );
}
