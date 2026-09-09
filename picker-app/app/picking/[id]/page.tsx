import React from 'react';
import PickingClient from './PickingClient';

export function generateStaticParams() {
  return [{ id: 'default' }];
}

export default function PickingWorkflowPage() {
  return <PickingClient />;
}
