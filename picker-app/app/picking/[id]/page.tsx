import React from 'react';
import PickingClient from './PickingClient';

export function generateStaticParams() {
  return [
    { id: 'default' },
    { id: 'task-1' },
    { id: 'task-2' },
    { id: 'task-3' },
    { id: 'PK26081991761' },
    { id: 'PK-10245' },
    { id: 'PK-10240' },
  ];
}

export default function PickingWorkflowPage() {
  return <PickingClient />;
}
