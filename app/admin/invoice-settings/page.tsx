'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminInvoiceSettingsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin?tab=invoice-settings');
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 text-xs text-gray-500 font-bold">
      Loading Invoice Template Settings...
    </div>
  );
}
