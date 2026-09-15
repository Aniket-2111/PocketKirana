'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  MapPin,
  ArrowLeft,
  HelpCircle,
  Info,
  ChevronRight,
  User,
  RefreshCw,
  Share2
} from 'lucide-react';
import { useAppStore } from '@/lib/store';

export default function NotServiceablePage() {
  const router = useRouter();
  const { currentUser, addresses } = useAppStore();
  const defaultAddr = addresses.find((a) => a.isDefault) || addresses[0];

  return (
    <div className="min-h-screen bg-[#FFF8F0] flex flex-col font-sans select-none pb-10">
      {/* Top Bar with Location Header */}
      <div className="bg-[#004D21] text-white px-5 pt-12 pb-5 rounded-b-[28px] shadow-md">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex-1 min-w-0 pr-3">
            <h1 className="text-lg font-black text-[#FFB4A2] tracking-tight">
              Unserviceable area
            </h1>
            <div className="flex items-center gap-1.5 text-xs text-white/80 font-medium truncate mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-[#acf847] shrink-0" />
              <span className="truncate">
                {defaultAddr ? defaultAddr.addressLine1 : 'Your current location'}
              </span>
            </div>
          </div>
          <button
            onClick={() => router.push('/profile')}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
          >
            <User className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Main Card Content */}
      <div className="flex-1 max-w-md mx-auto w-full px-5 py-6 flex flex-col justify-between">
        <div className="space-y-6">
          {/* Apology Heading */}
          <div className="text-center space-y-2 pt-2">
            <h2 className="text-2xl font-black text-[#004D21]">Hello!</h2>
            <p className="text-lg font-black text-[#1a1a1a]">It's not you, it's us.</p>
            <p className="text-sm font-semibold text-[#4a5568] max-w-xs mx-auto leading-relaxed">
              We are not serving this area at the moment.
            </p>
            <p className="text-sm font-bold text-[#e65100]">
              Sorry for the inconvenience 😔
            </p>
          </div>

          {/* Store Illustration in Green & Cream Theme */}
          <div className="relative w-full h-44 rounded-3xl bg-gradient-to-b from-[#003B19] to-[#005C28] overflow-hidden p-4 flex flex-col justify-end items-center shadow-inner border border-[#006E2F]/30">
            {/* Stars & Moon */}
            <div className="absolute top-4 right-8 w-8 h-8 rounded-full bg-[#FFF8E7] shadow-[0_0_15px_#FFF8E7] flex items-center justify-center">
              <div className="w-6 h-6 rounded-full bg-[#FFFDF0]" />
            </div>
            <div className="absolute top-6 left-10 w-1.5 h-1.5 rounded-full bg-white/70 animate-pulse" />
            <div className="absolute top-12 left-24 w-1 h-1 rounded-full bg-white/50" />
            <div className="absolute top-8 right-28 w-1 h-1 rounded-full bg-white/60" />

            {/* Clouds */}
            <div className="absolute top-10 left-4 w-16 h-5 rounded-full bg-white/10 blur-[1px]" />
            <div className="absolute top-14 right-12 w-20 h-6 rounded-full bg-white/10 blur-[1px]" />

            {/* Store SVG Graphic */}
            <div className="relative z-10 w-48 flex flex-col items-center">
              {/* Store Board */}
              <div className="bg-[#acf847] text-[#004D21] text-[10px] font-black px-4 py-0.5 rounded-t-md shadow-md border-b border-[#004D21]/20">
                POCKET KIRANA
              </div>
              {/* Awning */}
              <div className="w-44 h-5 bg-[#E88B00] rounded-sm flex overflow-hidden shadow-sm">
                <div className="flex-1 bg-[#E88B00]" />
                <div className="flex-1 bg-[#FFF8F0]" />
                <div className="flex-1 bg-[#E88B00]" />
                <div className="flex-1 bg-[#FFF8F0]" />
                <div className="flex-1 bg-[#E88B00]" />
                <div className="flex-1 bg-[#FFF8F0]" />
                <div className="flex-1 bg-[#E88B00]" />
              </div>
              {/* Store Building */}
              <div className="w-40 h-16 bg-[#FFF8F0] rounded-b-md border-x-2 border-b-2 border-[#003B19] flex justify-around items-end p-2 gap-2 shadow-lg">
                {/* Window 1 */}
                <div className="w-10 h-10 bg-[#FFECB3] border border-[#004D21]/30 rounded-t flex items-center justify-center">
                  <div className="w-full h-[1px] bg-[#004D21]/20" />
                </div>
                {/* Door */}
                <div className="w-8 h-12 bg-[#004D21] rounded-t flex flex-col justify-end p-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#acf847] self-end mr-1 mb-4" />
                </div>
                {/* Window 2 */}
                <div className="w-10 h-10 bg-[#FFECB3] border border-[#004D21]/30 rounded-t flex items-center justify-center">
                  <div className="w-full h-[1px] bg-[#004D21]/20" />
                </div>
              </div>
              {/* Ground line */}
              <div className="w-56 h-1 bg-[#002710] rounded-full mt-1" />
            </div>
          </div>

          {/* Change Location Button (Prominent) */}
          <button
            onClick={() => router.replace('/setup-address')}
            className="w-full py-3.5 bg-[#006E2F] hover:bg-[#005a26] text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-[#006E2F]/20 transition-all active:scale-95 cursor-pointer uppercase tracking-wider"
          >
            <MapPin className="w-4 h-4" />
            Select A Different Location
          </button>

          {/* Service Links Card */}
          <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden shadow-sm">
            <button
              onClick={() => router.push('/orders')}
              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[#FFF8F0] transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#FFF3E6] flex items-center justify-center shrink-0">
                  <HelpCircle className="w-4 h-4 text-[#E88B00]" />
                </div>
                <span className="text-xs font-bold text-[#1a1a1a]">
                  Need help with your previous orders?
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>

            <button
              onClick={() => router.push('/about')}
              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[#FFF8F0] transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#E8F5E9] flex items-center justify-center shrink-0">
                  <Info className="w-4 h-4 text-[#006E2F]" />
                </div>
                <span className="text-xs font-bold text-[#1a1a1a]">About us</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>

            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[#FFF8F0] transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-pink-50 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-pink-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.13-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </div>
                <span className="text-xs font-bold text-[#1a1a1a]">
                  Follow us on Instagram for updates
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </a>
          </div>
        </div>

        {/* Footer / Back */}
        <div className="pt-6 text-center space-y-3">
          <button
            onClick={() => router.replace('/login')}
            className="text-xs font-bold text-[#666] hover:text-[#006E2F] inline-flex items-center gap-1 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Login
          </button>
          <div className="text-[11px] text-[#999] font-bold">
            Pocket Kirana · 10-Minute Grocery Delivery
          </div>
        </div>
      </div>
    </div>
  );
}
