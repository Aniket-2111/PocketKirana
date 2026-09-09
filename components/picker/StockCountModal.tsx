'use client';

import React, { useState } from 'react';
import { StorageLocation, Product } from '@/types';
import {
  ClipboardCheck,
  Scan,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  X,
  Calculator
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

interface StockCountModalProps {
  isOpen: boolean;
  onClose: () => void;
  storageLocations: StorageLocation[];
  products: Product[];
  onSubmitStockCount: (locationId: string, productId: string, physicalCount: number, reason: string) => void;
}

export const StockCountModal: React.FC<StockCountModalProps> = ({
  isOpen,
  onClose,
  storageLocations,
  products,
  onSubmitStockCount,
}) => {
  const [selectedLocation, setSelectedLocation] = useState(storageLocations[0]?.displayCode || 'A-02-B-04');
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id || 'p-tata-salt-1kg');
  const [systemQuantity, setSystemQuantity] = useState(47);
  const [physicalQuantity, setPhysicalQuantity] = useState(45);
  const [reason, setReason] = useState('Shelf physical recount audit');

  if (!isOpen) return null;

  const diff = physicalQuantity - systemQuantity;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitStockCount(selectedLocation, selectedProductId, physicalQuantity, reason);
    showToast(`Stock audit submitted! Variance: ${diff > 0 ? `+${diff}` : diff} units`, 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-end sm:items-center justify-center p-0 sm:p-4 text-white animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 space-y-4 shadow-2xl animate-in slide-in-from-bottom-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base">Shelf Stock Count Mode</h3>
              <p className="text-xs text-slate-400">Scan &amp; verify physical inventory</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
              Shelf Location
            </label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono font-bold focus:border-emerald-500 focus:outline-none"
            >
              {storageLocations.map((loc) => (
                <option key={loc.id} value={loc.displayCode}>
                  {loc.displayCode} - {loc.aisle}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
              Product
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-bold focus:border-emerald-500 focus:outline-none"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.unit})
                </option>
              ))}
            </select>
          </div>

          {/* Comparison Matrix */}
          <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">System Qty</span>
              <strong className="text-xl font-black text-white font-mono">{systemQuantity}</strong>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Physical Count</span>
              <input
                type="number"
                value={physicalQuantity}
                onChange={(e) => setPhysicalQuantity(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-emerald-400 font-mono font-black text-lg focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Difference Callout */}
          <div
            className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
              diff === 0
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            }`}
          >
            <span>Variance Difference:</span>
            <strong className="font-mono text-sm">
              {diff > 0 ? `+${diff}` : diff} Units
            </strong>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
              Reason / Observation
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Shelf physical count discrepancy"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-bold focus:border-emerald-500 focus:outline-none"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg transition-transform active:scale-95 cursor-pointer"
          >
            Submit Stock Adjustment Request
          </button>
        </form>
      </div>
    </div>
  );
};
