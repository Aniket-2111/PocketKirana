'use client';

/**
 * NotificationWrapper — Client Component shell for RealtimeNotificationToast.
 *
 * next/dynamic with ssr: false may ONLY be used inside Client Components.
 * This thin wrapper satisfies that requirement, allowing app/layout.tsx
 * (a Server Component) to mount the notification toast without a build error.
 */

import dynamic from 'next/dynamic';

const RealtimeNotificationToast = dynamic(
  () =>
    import('@/components/customer/RealtimeNotificationToast').then(
      (m) => ({ default: m.RealtimeNotificationToast })
    ),
  { ssr: false }
);

export function NotificationWrapper() {
  return <RealtimeNotificationToast />;
}
