'use client';

import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  Camera,
  UploadCloud,
  CheckCircle2,
  Trash2,
  Loader2,
  HelpCircle,
  Package,
  Calendar,
  Layers
} from 'lucide-react';
import { Order, OrderItem, OrderIssueType } from '@/types';
import { showToast } from '@/components/ui/Toast';

interface CustomerComplaintModalProps {
  order: Order;
  onClose: () => void;
  onSubmitted: () => void;
}

const ISSUE_TYPES: Array<{ id: OrderIssueType; label: string; icon: string }> = [
  { id: 'DAMAGED', label: 'Product is damaged', icon: '📦' },
  { id: 'EXPIRED', label: 'Product is expired', icon: '⏳' },
  { id: 'WRONG_PRODUCT', label: 'Wrong product received', icon: '🔄' },
  { id: 'MISSING_PRODUCT', label: 'Product is missing', icon: '❓' },
  { id: 'WRONG_QUANTITY', label: 'Quantity is incorrect', icon: '⚖️' },
  { id: 'QUALITY_ISSUE', label: 'Product quality issue', icon: '⚠️' },
  { id: 'OTHER', label: 'Other issue', icon: '📝' },
];

export function CustomerComplaintModal({ order, onClose, onSubmitted }: CustomerComplaintModalProps) {
  const [selectedItemId, setSelectedItemId] = useState<string>(order.items?.[0]?.id || 'all');
  const [selectedIssueType, setSelectedIssueType] = useState<OrderIssueType>('DAMAGED');
  const [description, setDescription] = useState('');
  const [requestedResolution, setRequestedResolution] = useState<'REFUND' | 'REPLACEMENT' | 'STORE_CREDIT'>('REFUND');
  const [photos, setPhotos] = useState<string[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedItem = order.items?.find((i) => i.id === selectedItemId);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (photos.length + files.length > 5) {
      showToast('Maximum 5 photos allowed', 'error');
      return;
    }

    setIsUploadingPhoto(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 5 * 1024 * 1024) {
        showToast(`File ${file.name} exceeds 5 MB`, 'error');
        continue;
      }

      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        try {
          const res = await fetch('/api/upload/evidence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileData: base64,
              fileName: file.name,
              mimeType: file.type || 'image/jpeg',
            }),
          });
          const data = await res.json();
          if (data.success && data.url) {
            setPhotos((prev) => [...prev, data.url]);
          }
        } catch {
          // Fallback to local data URI
          setPhotos((prev) => [...prev, base64]);
        }
      };
      reader.readAsDataURL(file);
    }
    setIsUploadingPhoto(false);
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      showToast('Please describe the problem with your order', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: order.orderNumber,
          customerId: order.customerId,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          orderItemId: selectedItem?.id || undefined,
          productId: selectedItem?.productId || undefined,
          productName: selectedItem?.product?.name || 'Complete Order / Multiple Items',
          variantName: selectedItem?.variantName || undefined,
          issueType: selectedIssueType,
          description: description.trim(),
          photos,
          customerRequestedResolution: requestedResolution,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast('Complaint submitted successfully! Our support team is reviewing it.', 'success');
        onSubmitted();
        onClose();
      } else {
        showToast(data.error || 'Failed to submit complaint', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error submitting complaint', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-slideUp">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Report a Problem</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Order #{order.orderNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-300 active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* 1. Select Product */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
              Select Item
            </label>
            <div className="space-y-2">
              {order.items?.map((item) => (
                <label
                  key={item.id}
                  onClick={() => setSelectedItemId(item.id)}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedItemId === item.id
                      ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-500'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold text-xs">
                      {item.quantity}x
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {item.product?.name}
                      </p>
                      {item.variantName && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">{item.variantName}</p>
                      )}
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="selectedProduct"
                    checked={selectedItemId === item.id}
                    onChange={() => setSelectedItemId(item.id)}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* 2. Select Issue Type */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
              What is the issue?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ISSUE_TYPES.map((issue) => (
                <button
                  key={issue.id}
                  type="button"
                  onClick={() => setSelectedIssueType(issue.id)}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                    selectedIssueType === issue.id
                      ? 'border-emerald-600 bg-emerald-50/70 text-emerald-900 font-bold dark:bg-emerald-950/30 dark:border-emerald-500 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="text-lg">{issue.icon}</span>
                  <span className="text-xs">{issue.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Tell us more
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue clearly (e.g. Milk bottle cap was broken upon delivery)..."
              rows={3}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* 4. Photo Upload */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Upload Photos (Max 5)
              </label>
              <span className="text-xs text-slate-400">{photos.length}/5 uploaded</span>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {photos.map((url, idx) => (
                <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 group">
                  <img src={url} alt={`evidence-${idx}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(idx)}
                    className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-5 h-5 text-red-400" />
                  </button>
                </div>
              ))}

              {photos.length < 5 && (
                <label className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400 hover:border-emerald-500 hover:text-emerald-600 cursor-pointer transition-colors bg-slate-50 dark:bg-slate-800/40">
                  <Camera className="w-6 h-6 mb-1" />
                  <span className="text-[10px] font-bold">+ Add</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* 5. Preferred Resolution */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
              Preferred Resolution
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'REFUND', label: 'Refund to Original Payment', desc: 'Fast refund' },
                { id: 'REPLACEMENT', label: 'Replacement Product', desc: 'Get item redelivered' },
              ].map((res) => (
                <button
                  key={res.id}
                  type="button"
                  onClick={() => setRequestedResolution(res.id as any)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    requestedResolution === res.id
                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-500'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{res.label}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{res.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 active:scale-95"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || isUploadingPhoto}
            className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-xs font-bold text-white shadow-md flex items-center justify-center gap-2 disabled:opacity-75"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Submitting…</span>
              </>
            ) : (
              <span>Submit Complaint</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
