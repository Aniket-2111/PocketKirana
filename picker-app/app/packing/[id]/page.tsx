import React from 'react';
import PackingClient from './PackingClient';

export function generateStaticParams() {
  return [{ id: 'default' }];
}

export default function PackingWorkflowPage() {
  return <PackingClient />;
}
