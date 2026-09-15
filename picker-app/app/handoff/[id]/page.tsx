import React from 'react';
import HandoffClient from './HandoffClient';

export function generateStaticParams() {
  return [
    { id: 'default' },
    { id: 'task-1' },
    { id: 'task-2' },
    { id: 'task-3' },
    { id: 'PK26081991761' },
  ];
}

export default function HandoffPage() {
  return <HandoffClient />;
}
