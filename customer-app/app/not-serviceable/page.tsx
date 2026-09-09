'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, ArrowLeft, Bell, Share2 } from 'lucide-react';

export default function NotServiceablePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-red-100 opacity-50 blur-3xl" />
        <div className="absolute -bottom-24 -left-20 w-72 h-72 rounded-full bg-orange-100 opacity-40 blur-3xl" />
      </div>

      <div className="relative flex-1 flex flex-col items-center justify-center px-6 text-center space-y-7 py-16">
        {/* Animated Map Pin Illustration */}
        <div className="relative">
          <div className="w-28 h-28 rounded-full bg-red-100 border-4 border-red-200 flex items-center justify-center mx-auto">
            <div className="w-20 h-20 rounded-full bg-red-200 flex items-center justify-center animate-[pulse_2s_ease-in-out_infinite]">
              <MapPin className="w-10 h-10 text-red-500" strokeWidth={1.5} />
            </div>
          </div>
          {/* Ping ring */}
          <div className="absolute inset-0 rounded-full border-4 border-red-300 animate-ping opacity-30" />
        </div>

        {/* Text */}
        <div className="space-y-3 max-w-xs">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
            We're Not Here Yet 😔
          </h1>
          <p className="text-sm text-slate-600 font-medium leading-relaxed">
            Pocket Kirana doesn't deliver to your location right now. We're expanding rapidly and hope to reach you very soon!
          </p>
        </div>

        {/* Info card */}
        <div className="w-full max-w-xs bg-white border border-slate-200 rounded-2xl p-4 shadow-sm text-left space-y-3">
          <div className="text-xs font-black text-slate-700 uppercase tracking-wider">Currently serving</div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <div className="text-sm font-black text-slate-900">Neral & Surrounding Areas</div>
              <div className="text-[11px] text-slate-500 font-medium">Within 3 km of our darkstore hub</div>
            </div>
          </div>
          <div className="h-px bg-slate-100" />
          <div className="text-[11px] text-slate-500 font-medium leading-relaxed">
            📦 We're adding new delivery zones every week. Notify us your location so we can prioritize it!
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="w-full max-w-xs space-y-3">
          <button
            onClick={() => router.replace('/setup-address')}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all active:scale-95 cursor-pointer"
          >
            <MapPin className="w-4 h-4" />
            Try a Different Location
          </button>

          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: 'Pocket Kirana – 10 Min Grocery Delivery',
                  text: 'I want Pocket Kirana to deliver in my area! Check it out.',
                  url: 'https://pocketkirana.com',
                });
              } else {
                // Copy link fallback
                navigator.clipboard?.writeText('https://pocketkirana.com');
                alert('Link copied! Share it with your friends.');
              }
            }}
            className="w-full py-3.5 bg-white border-2 border-slate-200 hover:border-emerald-300 text-slate-700 font-black text-sm rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            Share with Neighbours
          </button>

          <button
            onClick={() => router.replace('/login')}
            className="w-full py-3 text-slate-500 font-bold text-xs flex items-center justify-center gap-1.5 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Login
          </button>
        </div>
      </div>

      {/* Bottom brand */}
      <div className="relative text-center pb-8 pt-2">
        <div className="text-[11px] text-slate-400 font-bold">Pocket Kirana · 10-Minute Delivery</div>
      </div>
    </div>
  );
}
