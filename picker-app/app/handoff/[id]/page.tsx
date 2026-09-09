import React from 'react';
import HandoffClient from './HandoffClient';

export function generateStaticParams() {
  return [{ id: 'default' }];
}

export default function HandoffPage() {
  return <HandoffClient />;
}
