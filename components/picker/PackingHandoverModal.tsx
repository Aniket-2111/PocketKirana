'use client';

import React, { useState, useEffect } from 'react';
import { PickingTask } from '@/types';
import {
  Package,
  QrCode,
  CheckCircle2,
  ShieldCheck,
  Bike,
  Store,
  Tag,
  Sparkles,
  ArrowRight,
  X,
  Layers,
  Copy
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';
import { QRCodeVisual } from '@/components/common/QRCodeVisual';

interface PackingHandoverModalProps {
  task: PickingTask;
  onPackOrder: (taskId: string, bagsCount: number, bagTypes: string[]) => void;
  onVerifyHandover: (orderNumber: string, partnerId: string) => { success: boolean; message: string };
  onClose?: () => void;
}

export const PackingHandoverModal: React.FC<PackingHandoverModalProps> = ({
  task,
  onPackOrder,
  onVerifyHandover,
  onClose,
}) => {
  const [isHandoverSuccess, setIsHandoverSuccess] = useState(task.status === 'handed_over');

  // Automatically mark order as packed if not already packed
  useEffect(() => {
    if (task.status !== 'packed' && task.status !== 'handed_over') {
      onPackOrder(task.id, 1, ['Standard Grocery']);
    }
  }, [task.id, task.status, onPackOrder]);

  const handleSimulateHandover = () => {
    const res = onVerifyHandover(task.orderNumber, task.assignedPartnerId || 'partner-1');
    if (res.success) {
      showToast(res.message, 'success');
      setIsHandoverSuccess(true);
    } else {
      showToast(res.message, 'error');
    }
  };

  return (
    <div className="space-y-4 text-slate-900">
      {/* ── HANDOVER TO DELIVERY RIDER (QR VERIFICATION) ── */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-xl text-center animate-in zoom-in-95 duration-200 text-slate-900">
        
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 text-left">
          <div>
            <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider block">
              Ready for Dispatch
            </span>
            <h3 className="font-black text-base text-slate-900">Order #{task.orderNumber} Handover</h3>
          </div>

          <span className="bg-emerald-600 text-white font-black text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider">
            {isHandoverSuccess ? 'Handed Over ✓' : 'Packed & Ready'}
          </span>
        </div>

        {/* Large Handover QR Code for Rider */}
        <div className="bg-slate-50 border-2 border-dashed border-emerald-500 rounded-3xl p-5 max-w-xs mx-auto flex flex-col items-center justify-center space-y-3 shadow-xs">
          <QRCodeVisual
            value={task.handoverQrCode || `PK-HO-${task.orderNumber}-DP102`}
            size={160}
            label={task.handoverQrCode || `PK-HO-${task.orderNumber}-DP102`}
            sublabel="Order Items Sealed & Tagged ✓"
            isUsed={isHandoverSuccess}
          />
        </div>

        {/* Assigned Driver Details */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center justify-between text-left text-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold">
              <Bike className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">Assigned Rider</span>
              <strong className="text-slate-900 block font-bold">{task.assignedPartnerName || 'Sunil Kumar (DP-102)'}</strong>
            </div>
          </div>

          <span className="text-emerald-800 font-bold text-[10px] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            At Store Counter
          </span>
        </div>

        {/* Handover Trigger Simulator */}
        {!isHandoverSuccess ? (
          <button
            type="button"
            onClick={handleSimulateHandover}
            className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
          >
            <ShieldCheck className="w-5 h-5 text-white" />
            <span>SIMULATE DRIVER SCAN &amp; HANDOVER</span>
          </button>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center space-y-2">
            <strong className="text-sm font-black text-emerald-800 block">
              ✓ Handover Authenticated &amp; Complete!
            </strong>
            <p className="text-xs text-slate-600">
              Order #{task.orderNumber} is now out for delivery with {task.assignedPartnerName || 'rider'}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
