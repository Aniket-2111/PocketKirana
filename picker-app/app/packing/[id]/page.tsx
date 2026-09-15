import React from 'react';
import PackingClient from './PackingClient';

export function generateStaticParams() {
  return [
    { id: 'default' },
    { id: 'task-1' },
    { id: 'task-2' },
    { id: 'task-3' },
    { id: 'PK26081991761' },
  ];
}

export default function PackingWorkflowPage() {
  return <PackingClient />;
}
