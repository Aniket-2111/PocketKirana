import React, { Suspense } from 'react';
import PackingClient from './[id]/PackingClient';

export default function PackingPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs font-bold text-slate-500">Loading packing workflow...</div>}>
      <PackingClient />
    </Suspense>
  );
}
