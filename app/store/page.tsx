'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import UnifiedAdminDashboardPage from '../admin/page';

export default function StorePortalPageRedirect() {
  // Store Portal is now merged directly into Admin Console
  return <UnifiedAdminDashboardPage />;
}
