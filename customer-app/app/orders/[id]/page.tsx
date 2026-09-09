import React from 'react';
import OrderTrackingClient from './OrderTrackingClient';

import { INITIAL_ORDERS } from '@/lib/mockData';

export function generateStaticParams() {
  const ids = new Set<string>(['default', 'PK-10245', 'PK-10240']);
  INITIAL_ORDERS.forEach((o) => {
    if (o.id) ids.add(o.id);
  });
  return Array.from(ids).map((id) => ({ id }));
}

export default function OrderTrackingPage() {
  return <OrderTrackingClient />;
}
