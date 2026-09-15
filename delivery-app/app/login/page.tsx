'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { 
  Bike, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  MapPin, 
  Navigation, 
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

export default function DeliveryLoginPage() {
  const router = useRouter();
  const { loginPartnerByCredentials, authenticatedPartnerId } = useAppStore();

  const [step, setStep] = useState<'login' | 'location'>('login');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);

  // If already authenticated and location is granted, auto-redirect to home
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedAuth = localStorage.getItem('pk_delivery_authenticated_partner');
    const storedLoc = localStorage.getItem('pk_delivery_location_granted');

    if ((authenticatedPartnerId || storedAuth) && storedLoc === 'true') {
      router.replace('/home');
    }
  }, [authenticatedPartnerId, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId.trim()) {
      showToast('Please enter your Login ID or Mobile number', 'error');
      return;
    }
    if (!password.trim()) {
      showToast('Please enter your Password', 'error');
      return;
    }

    setIsLoading(true);
    const res = loginPartnerByCredentials(loginId, password);
    setIsLoading(false);

    if (res.success) {
      showToast(res.message, 'success');
      
      const locGranted = typeof window !== 'undefined' && localStorage.getItem('pk_delivery_location_granted') === 'true';
      if (locGranted) {
        router.replace('/home');
      } else {
        // Proceed to Location Permission step
        setStep('location');
      }
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleAllowLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      showToast('Geolocation is not supported on this device.', 'error');
      localStorage.setItem('pk_delivery_location_granted', 'true');
      router.replace('/home');
      return;
    }

    setIsRequestingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsRequestingLocation(false);
        localStorage.setItem('pk_delivery_location_granted', 'true');
        showToast('📍 Location access enabled! Loading orders…', 'success');
        router.replace('/home');
      },
      (err) => {
        setIsRequestingLocation(false);
        // Save that prompt was answered so partner can still proceed to orders
        localStorage.setItem('pk_delivery_location_granted', 'true');
        showToast('Proceeding to orders. Enable device GPS for live map navigation.', 'info');
        router.replace('/home');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: LOCATION PERMISSION SCREEN (AFTER LOGIN)
  // ═══════════════════════════════════════════════════════════════════════════
  if (step === 'location') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-slate-50 to-white text-slate-900 flex flex-col justify-between p-6 font-sans">
        
        {/* Top Header */}
        <div className="pt-8 text-center space-y-3 max-w-sm mx-auto">
          <div className="w-18 h-18 rounded-3xl bg-[#0F532B] text-white flex items-center justify-center mx-auto shadow-xl shadow-emerald-900/20 ring-4 ring-emerald-100 animate-bounce">
            <MapPin className="w-9 h-9 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Location Access</h1>
            <p className="text-xs text-slate-500 font-medium mt-1">Required for Live Navigation & Orders</p>
          </div>
        </div>

        {/* Location Card */}
        <div className="bg-white border border-emerald-100 rounded-3xl p-6 sm:p-8 shadow-xl shadow-emerald-950/5 max-w-sm mx-auto w-full space-y-4">
          <div className="space-y-2 text-center">
            <h2 className="text-base font-black text-slate-900">
              Enable Precise GPS Tracking
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Pocket Kirana Delivery requires foreground location permissions to display precise road navigation from the Store Hub to customer doorsteps.
            </p>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3.5 space-y-2 text-left">
            <div className="flex items-center gap-2 text-emerald-900 text-xs font-bold">
              <Navigation className="w-4 h-4 text-[#0F532B] shrink-0" />
              <span>Turn-by-turn road routes</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-900 text-xs font-bold">
              <ShieldCheck className="w-4 h-4 text-[#0F532B] shrink-0" />
              <span>Accurate customer drop-off location</span>
            </div>
          </div>

          <div className="space-y-2.5 pt-2">
            <button
              onClick={handleAllowLocation}
              disabled={isRequestingLocation}
              className="w-full py-4 bg-[#0F532B] hover:bg-[#0c4323] active:scale-[0.98] text-white font-black text-xs rounded-2xl shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 transition-all cursor-pointer uppercase tracking-wider disabled:opacity-50"
            >
              <Navigation className="w-4 h-4 stroke-[2.5]" />
              <span>{isRequestingLocation ? 'Requesting GPS…' : 'Allow Location & Go to Orders'}</span>
            </button>

            <button
              onClick={() => {
                localStorage.setItem('pk_delivery_location_granted', 'true');
                router.replace('/home');
              }}
              className="w-full py-3 text-slate-500 hover:text-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer text-center"
            >
              Skip for Now & View Orders →
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-[11px] text-slate-400 font-mono pb-2">
          Pocket Kirana Delivery Workspace • Location Guard
        </div>

      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: LOGIN FORM
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/80 via-slate-50 to-white text-slate-900 flex flex-col justify-between p-6 font-sans relative overflow-hidden">
      
      {/* Background soft emerald glow */}
      <div className="fixed inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-[500px] h-[500px] bg-emerald-400/10 rounded-full blur-[140px]" />
      </div>

      {/* Top Brand Hero */}
      <div className="pt-8 text-center space-y-3 max-w-sm mx-auto relative z-10">
        <div className="w-18 h-18 rounded-3xl bg-[#0F532B] text-white flex items-center justify-center mx-auto shadow-xl shadow-emerald-900/20 ring-4 ring-emerald-100">
          <Bike className="w-9 h-9" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">PocketKirana</h1>
          <div className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200/80 px-3 py-1 rounded-full mt-1.5 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
              Delivery Partner App
            </span>
          </div>
        </div>
      </div>

      {/* Login Card */}
      <div className="bg-white border border-emerald-100 rounded-3xl p-6 sm:p-8 shadow-xl shadow-emerald-950/5 max-w-sm mx-auto w-full space-y-5 relative z-10">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-900">Partner Sign In</h2>
          <p className="text-xs text-slate-500">
            Sign in with your Delivery Partner ID or Phone number.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Login ID / Mobile Number
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-3.5 w-4 h-4 text-[#0F532B]" />
              <input
                type="text"
                placeholder="e.g. DP001 or 9112009988"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                autoFocus
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#0F532B] focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-[#0F532B]" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-11 py-3 text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#0F532B] focus:ring-2 focus:ring-emerald-500/20 transition-all"
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
            className="w-full py-3.5 bg-[#0F532B] hover:bg-[#0c4323] active:scale-[0.98] text-white font-bold text-xs rounded-2xl shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 transition-all cursor-pointer uppercase tracking-wider mt-2 disabled:opacity-50"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{isLoading ? 'VERIFYING CREDENTIALS...' : 'SIGN IN TO SHIFT'}</span>
          </button>
        </form>

      </div>

      {/* Footer */}
      <div className="text-center text-[11px] text-slate-400 font-mono pb-2 relative z-10">
        Pocket Kirana Delivery Workspace • v1.2.0 (APK)
      </div>

    </div>
  );
}
