'use client';

import React from 'react';
import { PickingItem } from '@/types';
import {
  detectMeasurementType,
  detectWeightUnit,
  formatQuantity,
  isQuantityComplete,
  calculateRemaining,
} from '@/lib/measurementUtils';
import { CheckCircle2, Circle, Check, ChevronRight, Package, MapPin } from 'lucide-react';

interface PickingChecklistProps {
  items: PickingItem[];
  currentIndex: number;
  onSelectItem: (index: number) => void;
  className?: string;
}

export const PickingChecklist: React.FC<PickingChecklistProps> = ({
  items = [],
  currentIndex,
  onSelectItem,
  className = '',
}) => {
  const completedCount = items.filter((i) => {
    const type = detectMeasurementType(i);
    return isQuantityComplete(i.quantityPicked, i.quantityRequired, type);
  }).length;

  return (
    <div className={`bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-xs ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
            Order Checklist
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {completedCount} of {items.length} products completed
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2.5 text-[10px] font-bold text-slate-500">
          <span className="inline-flex items-center gap-1 text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5" /> Done
          </span>
          <span className="inline-flex items-center gap-1 text-slate-900">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" /> Current
          </span>
          <span className="inline-flex items-center gap-1 text-slate-400">
            <Circle className="w-3.5 h-3.5" /> Pending
          </span>
        </div>
      </div>

      {/* Item List */}
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {items.map((item, idx) => {
          const type = detectMeasurementType(item);
          const weightUnit = detectWeightUnit(item);
          const isDone = isQuantityComplete(item.quantityPicked, item.quantityRequired, type);
          const isCurrent = idx === currentIndex;
          const remaining = calculateRemaining(item.quantityRequired, item.quantityPicked, type);

          return (
            <div
              key={item.id || idx}
              onClick={() => onSelectItem(idx)}
              className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                isCurrent
                  ? 'bg-emerald-50/80 border-emerald-500 shadow-xs ring-1 ring-emerald-500/30'
                  : isDone
                  ? 'bg-slate-50/80 border-slate-200 text-slate-500'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Status Indicator Icon */}
                <div className="shrink-0">
                  {isDone ? (
                    <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  ) : isCurrent ? (
                    <div className="w-6 h-6 rounded-full border-2 border-emerald-600 flex items-center justify-center">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full border-2 border-slate-300 flex items-center justify-center text-slate-400 font-mono text-[10px] font-bold">
                      {idx + 1}
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <strong
                    className={`text-xs block truncate ${
                      isCurrent
                        ? 'font-black text-slate-900'
                        : isDone
                        ? 'font-bold text-slate-600 line-through decoration-slate-400'
                        : 'font-bold text-slate-800'
                    }`}
                  >
                    {item.productName}
                  </strong>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                    <span className="font-semibold text-slate-600">
                      {item.unit || (type === 'WEIGHT' ? 'Loose' : 'Unit')}
                    </span>
                    {item.price ? (
                      <>
                        <span>•</span>
                        <span className="font-semibold text-slate-600">₹{item.price}</span>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Quantity info */}
              <div className="text-right shrink-0 flex items-center gap-2">
                <div>
                  <span
                    className={`font-mono text-xs font-black px-2 py-0.5 rounded-md block ${
                      isDone
                        ? 'bg-emerald-100 text-emerald-800'
                        : isCurrent
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {formatQuantity(item.quantityPicked || 0, type, weightUnit)} / {formatQuantity(item.quantityRequired, type, weightUnit)}
                  </span>
                  {!isDone && remaining > 0 && (
                    <span className="text-[9px] font-bold text-rose-600 block mt-0.5 font-mono">
                      -{formatQuantity(remaining, type, weightUnit)} left
                    </span>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
