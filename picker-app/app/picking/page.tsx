import React, { Suspense } from 'react';
import PickingClient from './[id]/PickingClient';

export default function PickingPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs font-bold text-slate-500">Loading picking workflow...</div>}>
      <PickingClient />
    </Suspense>
  );
}
