'use client';

import React, { useState, useEffect } from 'react';
import { PickingTask, PickingItem } from '@/types';
import {
  Scan,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Package,
  Layers,
  ArrowRight,
  Sparkles,
  HelpCircle,
  X,
  Shuffle,
  ShieldAlert,
  ChevronRight
} from 'lucide-react';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { showToast } from '@/components/ui/Toast';

interface SmartPickingWorkflowProps {
  task: PickingTask;
  onScanItem: (taskId: string, productId: string, scannedBarcode: string) => { success: boolean; message: string; isComplete: boolean; isWrongItem?: boolean };
  onMarkOutOfStock: (taskId: string, productId: string, reason: string, substituteProductId?: string) => void;
  onCompletePicking: (taskId: string) => void;
}

export const SmartPickingWorkflow: React.FC<SmartPickingWorkflowProps> = ({
  task,
  onScanItem,
  onMarkOutOfStock,
  onCompletePicking,
}) => {
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [outOfStockModalOpen, setOutOfStockModalOpen] = useState(false);
  const [outOfStockReason, setOutOfStockReason] = useState('Empty shelf');
  const [selectedSubstitute, setSelectedSubstitute] = useState<any | null>(null);

  // Stopwatch timer
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const items = task.items || [];
  const currentItem = items[activeItemIndex] || items[0];

  const allItemsPicked = items.every((i) => i.status === 'picked' || i.status === 'substituted');

  // Auto-advance to next pending/incomplete item whenever items or activeItemIndex update
  useEffect(() => {
    if (!items || items.length === 0) return;
    const current = items[activeItemIndex];
    if (!current || current.status === 'picked' || current.status === 'substituted' || (current.quantityPicked >= current.quantityRequired && current.quantityRequired > 0)) {
      const nextPendingIdx = items.findIndex(
        (i) => i.status !== 'picked' && i.status !== 'substituted' && i.quantityPicked < i.quantityRequired
      );
      if (nextPendingIdx !== -1 && nextPendingIdx !== activeItemIndex) {
        setActiveItemIndex(nextPendingIdx);
      }
    }
  }, [items, activeItemIndex]);

  const handleScanResult = (scannedCode: string) => {
    if (!currentItem) return;

    const res = onScanItem(task.id, currentItem.productId, scannedCode);
    if (res.success) {
      showToast(res.message, 'success');
      setScannerOpen(false);
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleConfirmOutOfStock = () => {
    if (!currentItem) return;

    onMarkOutOfStock(
      task.id,
      currentItem.productId,
      outOfStockReason,
      selectedSubstitute ? selectedSubstitute.productId : undefined
    );

    showToast(
      selectedSubstitute
        ? `Substituted with ${selectedSubstitute.productName}`
        : `${currentItem.productName} marked Out of Stock`,
      'info'
    );

    setOutOfStockModalOpen(false);
    setSelectedSubstitute(null);
  };

  return (
    <div className="space-y-4 text-slate-900">
      {/* ── TOP STICKY STATUS & TIMER BAR ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Order #{task.orderNumber} • {task.priority} Priority
            </span>
            <strong className="text-xs font-black text-emerald-700 font-mono">
              {task.pickedItemsCount || 0} / {task.totalItemsCount} Items Picked
            </strong>
          </div>
        </div>

        {/* Live Pick Timer */}
        <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-mono font-black text-amber-800 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          <span>{formatTimer(secondsElapsed)}</span>
        </div>
      </div>

      {/* ── ALL ITEMS PICKED VICTORY / PACKING TRANSITION ── */}
      {allItemsPicked ? (
        <div className="bg-gradient-to-b from-emerald-50 to-white border border-emerald-300 rounded-3xl p-6 text-center space-y-4 shadow-md animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-md shadow-emerald-600/30">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <span className="text-xs font-black text-emerald-700 uppercase tracking-widest block">
              Order Picking Complete!
            </span>
            <h3 className="text-xl font-black text-slate-900 mt-0.5">All {task.totalItemsCount} Items Picked</h3>
            <p className="text-xs text-slate-500 mt-1">
              Pick duration: <strong className="font-mono text-emerald-700">{formatTimer(secondsElapsed)}</strong>
            </p>
          </div>

          <button
            onClick={() => onCompletePicking(task.id)}
            className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
          >
            <span>PROCEED TO HANDOVER &amp; DISPATCH</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      ) : (
        /* ── CURRENT ACTIVE TARGET PRODUCT TO PICK ── */
        <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-sm">
          
          {/* Target Product Badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">
                Current Product ({activeItemIndex + 1}/{items.length})
              </span>
            </div>
          </div>

          {/* Product Detail Card */}
          <div className="flex items-start gap-3.5 bg-slate-50 border border-slate-200 p-4 rounded-2xl">
            <img
              src={currentItem?.imageUrl}
              alt={currentItem?.productName}
              className="w-20 h-20 rounded-2xl object-cover bg-white border border-slate-200 shrink-0 shadow-xs"
            />
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                SKU: {currentItem?.sku}
              </span>
              <h4 className="font-black text-sm text-slate-900 truncate">{currentItem?.productName}</h4>
              <span className="text-xs text-slate-500 font-bold block mt-0.5">{currentItem?.unit}</span>

              {/* Barcode details */}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded-md font-mono text-emerald-800 font-bold">
                  UPC: {currentItem?.upc}
                </span>
              </div>
            </div>
          </div>

          {/* Pick Quantity Stepper & Quick Pick Controls */}
          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-bold">Quantity Required:</span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black text-emerald-700 font-mono">
                  {currentItem?.quantityPicked} / {currentItem?.quantityRequired}
                </span>
                <span className="text-xs text-slate-500 font-bold">Units</span>
              </div>
            </div>

            {/* Manual Stepper & Mark Picked Controls */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200">
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-xs">
                <button
                  type="button"
                  onClick={() => {
                    if (!currentItem) return;
                    if (currentItem.quantityPicked > 0) {
                      onScanItem(task.id, currentItem.productId, currentItem.barcode || currentItem.upc || '');
                    }
                  }}
                  disabled={!currentItem || currentItem.quantityPicked <= 0}
                  className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-900 font-black text-base flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
                  title="Decrease Picked Quantity"
                >
                  -
                </button>
                <span className="w-10 text-center font-mono font-black text-emerald-700 text-sm">
                  {currentItem?.quantityPicked || 0}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (!currentItem) return;
                    onScanItem(task.id, currentItem.productId, currentItem.barcode || currentItem.upc || '');
                  }}
                  className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-900 font-black text-base flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
                  title="Increase Picked Quantity"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!currentItem) return;
                  // Instantly pick required units
                  const remaining = currentItem.quantityRequired - currentItem.quantityPicked;
                  for (let i = 0; i < Math.max(1, remaining); i++) {
                    onScanItem(task.id, currentItem.productId, currentItem.barcode || currentItem.upc || '');
                  }
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>Mark Item Picked</span>
              </button>
            </div>
          </div>

          {/* Action Buttons: Out of Stock & Camera Barcode Scan */}
          <div className="grid grid-cols-3 gap-2.5 pt-1">
            <button
              onClick={() => setOutOfStockModalOpen(true)}
              className="col-span-1 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-black text-xs flex flex-col items-center justify-center gap-1 transition-transform active:scale-95 cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Out of Stock</span>
            </button>

            <button
              onClick={() => setScannerOpen(true)}
              className="col-span-2 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
            >
              <Scan className="w-5 h-5 text-white" />
              <span>CAMERA SCAN</span>
            </button>
          </div>
        </div>
      )}

      {/* ── ORDER ITEMS LIST ── */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <h4 className="font-black text-sm text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-600" />
            Order Items ({items.length} Items)
          </h4>
        </div>

        <div className="space-y-2 divide-y divide-slate-100">
          {items.map((item, idx) => {
            const isCurrent = idx === activeItemIndex;
            const isDone = item.status === 'picked' || item.status === 'substituted';
            const isOos = item.status === 'out_of_stock';

            return (
              <div
                key={item.id}
                onClick={() => setActiveItemIndex(idx)}
                className={`pt-2.5 first:pt-0 flex items-center justify-between text-xs p-2.5 rounded-2xl transition-colors cursor-pointer ${
                  isCurrent
                    ? 'bg-emerald-50 border border-emerald-200'
                    : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                      isDone
                        ? 'bg-emerald-600 text-white'
                        : isOos
                        ? 'bg-rose-500 text-white'
                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}
                  >
                    {isDone ? '✓' : isOos ? '✕' : idx + 1}
                  </div>

                  <div>
                    <strong className="text-slate-900 block font-bold truncate max-w-[180px] sm:max-w-[260px]">
                      {item.productName}
                    </strong>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      <span>{item.unit}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-mono font-black text-slate-900 text-xs block">
                    {item.quantityPicked}/{item.quantityRequired}
                  </span>
                  <span className="text-[10px] text-slate-400 uppercase font-bold">
                    {item.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── BARCODE SCANNER MODAL ── */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScanResult}
        title="Scan Product Barcode"
        expectedItemName={currentItem?.productName}
        expectedBarcode={currentItem?.barcode}
        quantityRequired={currentItem?.quantityRequired}
        quantityPicked={currentItem?.quantityPicked}
        unit={currentItem?.unit}
        quickSampleBarcodes={[
          { label: `Scan Match (${currentItem?.barcode})`, code: currentItem?.barcode || '' },
          { label: 'Wrong Barcode (8909999999999)', code: '8909999999999' },
          { label: 'Bin: ' + (currentItem?.storageLocation?.displayCode || 'A-01-A-01'), code: currentItem?.storageLocation?.barcode || '' },
        ]}
      />

      {/* ── OUT OF STOCK & SUBSTITUTION MODAL ── */}
      {outOfStockModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 text-slate-900">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-black text-sm text-amber-700 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Report Out of Stock
              </h4>
              <button
                onClick={() => setOutOfStockModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                Item: <strong className="text-slate-900">{currentItem?.productName}</strong>
              </p>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Reason</label>
                <select
                  value={outOfStockReason}
                  onChange={(e) => setOutOfStockReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold focus:border-emerald-600 focus:outline-none"
                >
                  <option value="Empty shelf">Empty shelf</option>
                  <option value="Damaged">Damaged product on rack</option>
                  <option value="Inventory mismatch">Inventory mismatch</option>
                  <option value="Barcode problem">Barcode unreadable</option>
                  <option value="Other">Other reason</option>
                </select>
              </div>

              {/* Optional Substitution Suggestion */}
              {currentItem?.substituteProduct && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 space-y-2">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block flex items-center gap-1">
                    <Shuffle className="w-3 h-3" />
                    Recommended Substitute
                  </span>
                  <div className="flex items-center justify-between">
                    <div>
                      <strong className="text-slate-900 block font-bold">{currentItem.substituteProduct.productName}</strong>
                      <span className="text-slate-500">Price: ₹{currentItem.substituteProduct.price}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedSubstitute(currentItem.substituteProduct)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
                        selectedSubstitute
                          ? 'bg-emerald-600 text-white font-black'
                          : 'bg-white text-slate-700 border border-slate-200'
                      }`}
                    >
                      {selectedSubstitute ? 'Selected ✓' : 'Select'}
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={handleConfirmOutOfStock}
                className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs shadow-md transition-transform active:scale-95 cursor-pointer"
              >
                Confirm &amp; Proceed to Next Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
