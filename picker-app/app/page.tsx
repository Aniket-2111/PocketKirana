'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';

export default function EntryPage() {
  const router = useRouter();
  const { isLoggedIn, currentUser } = useAppStore();

  useEffect(() => {
    if (isLoggedIn && currentUser?.role === 'picker') {
      router.replace('/home');
    } else {
      router.replace('/login');
    }
  }, [isLoggedIn, currentUser, router]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <span className="w-10 h-10 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
        <span className="text-xs text-slate-400 font-medium">Entering Picker Workspace...</span>
      </div>
    </div>
  );
}
