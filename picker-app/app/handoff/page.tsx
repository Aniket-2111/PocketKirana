import React, { Suspense } from 'react';
import HandoffClient from './[id]/HandoffClient';

export default function HandoffPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs font-bold text-slate-500">Loading handoff workflow...</div>}>
      <HandoffClient />
    </Suspense>
  );
}
