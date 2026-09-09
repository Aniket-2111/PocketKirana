'use client';

import React, { useState } from 'react';
import { Category, NewProductRequest } from '@/types';
import {
  Sparkles,
  Barcode as BarcodeIcon,
  UploadCloud,
  CheckCircle2,
  ShieldCheck,
  X,
  AlertCircle
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

interface NewProductRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  initialBarcode?: string;
  onRequestNewProduct: (request: Omit<NewProductRequest, 'id' | 'status' | 'submittedAt' | 'pickerId' | 'pickerName'>) => void;
}

export const NewProductRequestModal: React.FC<NewProductRequestModalProps> = ({
  isOpen,
  onClose,
  categories,
  initialBarcode = '8909876543210',
  onRequestNewProduct,
}) => {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || 'cat-staples');
  const [barcode, setBarcode] = useState(initialBarcode);
  const [unit, setUnit] = useState('500 g');
  const [suggestedMrp, setSuggestedMrp] = useState(50);
  const [notes, setNotes] = useState('New stock received from distributor without existing barcode listing');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !barcode.trim()) {
      showToast('Please fill in product name and barcode', 'error');
      return;
    }

    const cat = categories.find((c) => c.id === categoryId);

    onRequestNewProduct({
      name: name.trim(),
      brand: brand.trim() || 'General',
      categoryId,
      categoryName: cat?.name,
      barcode: barcode.trim(),
      unit,
      suggestedMrp,
      notes,
    });

    showToast('New product request submitted to Admin for approval!', 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-end sm:items-center justify-center p-0 sm:p-4 text-white animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base">Request New Product</h3>
              <p className="text-xs text-slate-400">Report unregistered barcode to Admin</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Security Warning Notice */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 text-xs text-amber-300 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            Pickers cannot publish products or set prices directly. This request will be reviewed by the Store Admin before adding to catalog.
          </span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
              Scanned Barcode / UPC
            </label>
            <input
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-emerald-400 font-mono font-black text-sm focus:border-emerald-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
              Product Name
            </label>
            <input
              type="text"
              placeholder="e.g. Haldiram Bhujia Sev"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-bold focus:border-emerald-500 focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Brand</label>
              <input
                type="text"
                placeholder="e.g. Haldiram"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-bold focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Unit / Size</label>
              <input
                type="text"
                placeholder="e.g. 500 g"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-bold focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-bold focus:border-emerald-500 focus:outline-none"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Suggested MRP (₹)</label>
              <input
                type="number"
                value={suggestedMrp}
                onChange={(e) => setSuggestedMrp(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono font-bold focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Notes for Admin</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-medium focus:border-emerald-500 focus:outline-none text-xs"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg transition-transform active:scale-95 cursor-pointer"
          >
            Submit for Admin Review &amp; Approval
          </button>
        </form>
      </div>
    </div>
  );
};
