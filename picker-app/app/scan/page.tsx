'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ScanRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/inventory');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen text-xs text-slate-400">
      Redirecting to Inventory...
    </div>
  );
}
