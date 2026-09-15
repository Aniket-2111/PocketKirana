import React from 'react';
import OrderDetailsClient from './OrderDetailsClient';
import { INITIAL_ORDERS } from '@/lib/mockData';

export function generateStaticParams() {
  const ids = new Set<string>(['default', 'order-1', 'order-2', 'PK-10245', 'PK-10240']);
  INITIAL_ORDERS.forEach((o) => {
    if (o.id) ids.add(o.id);
  });
  return Array.from(ids).map((id) => ({ id }));
}

export default function OrderDetailsPage() {
  return <OrderDetailsClient />;
}
