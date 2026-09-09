'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import PickerShell from '../../../components/PickerShell';
import { PackingHandoverModal } from '@/components/picker/PackingHandoverModal';
import { showToast } from '@/components/ui/Toast';
import { ArrowLeft } from 'lucide-react';

export default function HandoffClient({ taskId: propTaskId }: { taskId?: string }) {
  const router = useRouter();
  const params = useParams();
  const taskId = propTaskId || (params?.id as string) || 'default';

  const {
    pickingTasks,
    packOrderTask,
    verifyOrderHandover,
  } = useAppStore();

  const task = pickingTasks.find((t) => t.id === taskId);

  if (!task) {
    return (
      <PickerShell>
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4 shadow-xl">
          <h3 className="font-extrabold text-sm text-white">Handoff Task Not Found</h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            The active task ID `#{taskId}` could not be resolved.
          </p>
          <button
            onClick={() => router.push('/tasks')}
            className="px-4 py-2 bg-slate-850 hover:bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl"
          >
            Return to Tasks Queue
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
      <div className="space-y-4">
        {/* Back Link */}
        <button
          onClick={() => router.push('/home')}
          className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer group pb-2"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Home</span>
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
