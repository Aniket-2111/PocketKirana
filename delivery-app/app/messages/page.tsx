'use client';
import DeliveryShell from '../../components/DeliveryShell';
import { MessageSquare } from 'lucide-react';

export default function MessagesPage() {
  return (
    <DeliveryShell>
      <div className="flex flex-col items-center justify-center py-20 space-y-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mx-auto">
          <MessageSquare className="w-7 h-7 text-slate-400" />
        </div>
        <div>
          <h3 className="text-base font-black text-slate-900">Messages</h3>
          <p className="text-sm text-slate-500 mt-1">No messages yet</p>
        </div>
      </div>
    </DeliveryShell>
  );
}
