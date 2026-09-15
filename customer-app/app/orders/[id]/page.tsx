import React from 'react';
import OrderTrackingClient from './OrderTrackingClient';

export function generateStaticParams() {
  return [{ id: 'default' }, { id: 'PK-10245' }, { id: 'PK-10240' }];
}

export default function OrderTrackingPage() {
  return <OrderTrackingClient />;
}
