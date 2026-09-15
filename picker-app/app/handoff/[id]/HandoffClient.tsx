'use client';

import React, { Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import PickerShell from '../../../components/PickerShell';
import { PackingHandoverModal } from '@/components/picker/PackingHandoverModal';
import { showToast } from '@/components/ui/Toast';
import { ArrowLeft, Loader2 } from 'lucide-react';

function HandoffContent({ taskId: propTaskId }: { taskId?: string }) {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const {
    pickers,
    activePickerId,
    pickingTasks,
    packOrderTask,
    verifyOrderHandover,
  } = useAppStore();

  const picker = pickers.find((p) => p.id === activePickerId) || pickers[0];

  let taskId = propTaskId || (params?.id as string) || searchParams?.get('id') || searchParams?.get('taskId') || '';
  if (!taskId || taskId === 'default') {
    taskId = picker?.activeTaskId || '';
  }

  let task = pickingTasks.find((t) => t.id === taskId || t.orderNumber === taskId);
  if (!task) {
    task = pickingTasks.find(t => t.status === 'packed');
  }

  if (!task) {
    return (
      <PickerShell>
        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-4 shadow-sm text-slate-900">
          <h3 className="font-extrabold text-sm text-slate-900">Handoff Task Not Found</h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            The active task ID `#{taskId || 'N/A'}` could not be resolved.
          </p>
          <button
            onClick={() => router.push('/home')}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-bold rounded-xl text-slate-700 cursor-pointer"
          >
            Return to Home
          </button>
        </div>
      </PickerShell>
    );
  }

  const handleVerifyHandover = (orderNumber: string, partnerId: string) => {
    try {
      const res = verifyOrderHandover(orderNumber, partnerId);
      if (res.success) {
        showToast('Dispatch handover completed successfully!', 'success');
        setTimeout(() => {
          router.push('/home');
        }, 1500);
      }
      return res;
    } catch (err: any) {
      showToast('Verify handover failed', 'error');
      return { success: false, message: 'Verify handover failed' };
    }
  };

  return (
    <PickerShell>
      <div className="space-y-4 text-slate-900">
        {/* Back Link */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer group pb-2"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back</span>
        </button>

        <PackingHandoverModal
          task={task}
          onPackOrder={packOrderTask}
          onVerifyHandover={handleVerifyHandover}
        />
      </div>
    </PickerShell>
  );
}

export default function HandoffClient({ taskId }: { taskId?: string }) {
  return (
    <Suspense
      fallback={
        <PickerShell>
          <div className="flex flex-col items-center justify-center p-12 text-slate-500 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            <span className="text-xs font-bold">Loading handoff workflow...</span>
          </div>
        </PickerShell>
      }
    >
      <HandoffContent taskId={taskId} />
    </Suspense>
  );
}
