import { redirect } from 'next/navigation';

/**
 * PocketKirana — Legacy Admin Stores Route Redirect
 *
 * Notice: The legacy in-memory /admin/stores editor has been permanently retired.
 * Darkstore configuration authority is consolidated under /admin/service-area
 * backed directly by PostgreSQL `stores`.
 */
export default function AdminStoresPage() {
  redirect('/admin/service-area');
}
