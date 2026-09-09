'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ShieldAlert, Home, LogIn, RefreshCw } from 'lucide-react';

const REASON_MESSAGES: Record<string, { title: string; description: string; action: string }> = {
  unauthenticated: {
    title: 'Login Required',
    description: 'You need to be logged in to access this area.',
    action: 'login',
  },
  token_expired: {
    title: 'Session Expired',
    description: 'Your session has expired. Please log in again to continue.',
    action: 'refresh',
  },
  invalid_token: {
    title: 'Invalid Session',
    description: 'Your session appears to be invalid. Please log in again.',
    action: 'login',
  },
  insufficient_role: {
    title: 'Access Denied',
    description: 'You do not have permission to access this area. This portal is restricted to authorised staff only.',
    action: 'home',
  },
};

function AccessDeniedContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason') || 'insufficient_role';
  const redirect = searchParams.get('redirect') || '/';

  const info = REASON_MESSAGES[reason] || REASON_MESSAGES.insufficient_role;
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Give Firebase Auth time to refresh the token
    try {
      const { getFirebaseAuth } = await import('@/lib/firebase');
      const auth = getFirebaseAuth();
      if (auth?.currentUser) {
        const newToken = await auth.currentUser.getIdToken(true);
        document.cookie = `__pk_session=${newToken}; path=/; secure; samesite=strict; max-age=3600`;
        window.location.href = redirect;
        return;
      }
    } catch (e) {
      console.error('Token refresh failed:', e);
    }
    setRefreshing(false);
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-8 md:p-12 max-w-md w-full text-center">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <ShieldAlert className="w-10 h-10 text-red-400" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-white mb-2">
          {info.title}
        </h1>
        <p className="text-slate-400 mb-8 leading-relaxed">
          {info.description}
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {info.action === 'login' && (
            <Link
              href="/"
              className="flex items-center justify-center gap-2 w-full bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              <LogIn className="w-4 h-4" />
              Go to Login
            </Link>
          )}

          {info.action === 'refresh' && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center justify-center gap-2 w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing Session…' : 'Refresh Session'}
            </button>
          )}

          <Link
            href="/"
            className="flex items-center justify-center gap-2 w-full bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 border border-white/10 hover:border-white/20"
          >
            <Home className="w-4 h-4" />
            Go to Homepage
          </Link>
        </div>

        {/* Footer note */}
        <p className="mt-8 text-xs text-slate-500">
          If you believe this is an error, contact your store administrator.
        </p>
      </div>
    </div>
  );
}

export default function AccessDeniedPage() {
  return (
    <React.Suspense fallback={
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <AccessDeniedContent />
    </React.Suspense>
  );
}
