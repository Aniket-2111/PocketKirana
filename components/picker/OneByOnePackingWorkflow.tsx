'use client';

import React, { useState, useEffect } from 'react';
import { PickingTask, PickingItem } from '@/types';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  Package,
  Layers,
  ShieldCheck,
  Bike,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  Check,
  Barcode,
  Sparkles
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

interface OneByOnePackingWorkflowProps {
  task: PickingTask;
  onPackProductDone?: (taskId: string, productId: string) => Promise<boolean> | boolean;
  onCompleteOrderPacked: (taskId: string, bagsCount: number, bagTypes: string[]) => void;
  onReturnToQueue?: () => void;
  onClose?: () => void;
}

export const OneByOnePackingWorkflow: React.FC<OneByOnePackingWorkflowProps> = ({
  task,
  onPackProductDone,
  onCompleteOrderPacked,
  onReturnToQueue,
}) => {
  const items = task.items || [];

  // Local storage persistence key per order
  const storageKey = `pk_packing_progress_${task.id || task.orderNumber}`;

  // State to track packed item IDs
  const [packedItemIds, setPackedItemIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (_) {}
    }
    // Default to items already marked picked/packed
    return items
      .filter((i) => i.status === 'picked' || i.status === 'substituted' || i.quantityPicked >= i.quantityRequired)
      .map((i) => i.productId);
  });

  // Active product index
  const [activeProductIndex, setActiveProductIndex] = useState<number>(() => {
    const firstUnpacked = items.findIndex((i) => !packedItemIds.includes(i.productId));
    return firstUnpacked !== -1 ? firstUnpacked : Math.max(0, items.length - 1);
  });

  // Workflow stages: 'PACKING' | 'RECHECK' | 'PACKED_COMPLETE'
  const [stage, setStage] = useState<'PACKING' | 'RECHECK' | 'PACKED_COMPLETE'>(() => {
    if (
      task.status === 'packed' ||
      (task.status as string) === 'ready' ||
      task.status === 'handed_over' ||
      (task.status as string) === 'WAITING_FOR_DELIVERY' ||
      (task.status as string) === 'OUT_FOR_DELIVERY'
    ) {
      return 'PACKED_COMPLETE';
    }
    const allPacked = items.length > 0 && items.every((i) => packedItemIds.includes(i.productId));
    return allPacked ? 'RECHECK' : 'PACKING';
  });

  // Mandatory Recheck Checkbox
  const [recheckConfirmed, setRecheckConfirmed] = useState(false);

  // Final Confirmation Modal Open state
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Network Save Error state
  const [networkError, setNetworkError] = useState<string | null>(null);

  // Barcode scanner verification state
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [barcodeMatch, setBarcodeMatch] = useState<boolean | null>(null);

  // Timer
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

  // Sync state to localStorage whenever packedItemIds updates
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, JSON.stringify(packedItemIds));
      } catch (_) {}
    }
  }, [packedItemIds, storageKey]);

  // Total quantity counts
  const totalQuantityRequired = items.reduce((sum, i) => sum + i.quantityRequired, 0);
  const totalQuantityPacked = items.reduce(
    (sum, i) => sum + (packedItemIds.includes(i.productId) ? i.quantityRequired : i.quantityPicked || 0),
    0
  );

  const packedProductsCount = packedItemIds.length;
  const totalProductsCount = items.length;

  const currentItem = items[activeProductIndex] || items[0];
  const isCurrentPacked = currentItem ? packedItemIds.includes(currentItem.productId) : false;

  const handleBarcodeScanCheck = (val: string) => {
    setScannedBarcode(val);
    const clean = val.trim();
    if (!clean || !currentItem) {
      setBarcodeMatch(null);
      return;
    }
    const isMatch =
      clean === currentItem.barcode ||
      clean === currentItem.upc ||
      clean === currentItem.sku ||
      clean === currentItem.productId ||
      clean.toLowerCase() === currentItem.productName.toLowerCase();

    setBarcodeMatch(isMatch);
    if (isMatch) {
      showToast(`✓ Barcode verified for ${currentItem.productName}`, 'success');
    }
  };

  // Handle clicking "DONE" for active product
  const handleProductDone = async () => {
    if (!currentItem) return;

    setNetworkError(null);
    const prodId = currentItem.productId;

    try {
      if (onPackProductDone) {
        const ok = await onPackProductDone(task.id, prodId);
        if (ok === false) {
          setNetworkError("Unable to save packing progress. Please try again.");
          showToast("Unable to save packing progress. Please try again.", "error");
          return;
        }
      }

      // Update packed IDs
      const updatedPacked = Array.from(new Set([...packedItemIds, prodId]));
      setPackedItemIds(updatedPacked);

      showToast(`✓ Packed: ${currentItem.productName}`, 'success');

      // Check if all products are now packed
      if (updatedPacked.length >= items.length) {
        setStage('RECHECK');
      } else {
        // Automatically move to the NEXT unpacked product
        const nextUnpackedIdx = items.findIndex((i) => !updatedPacked.includes(i.productId));
        if (nextUnpackedIdx !== -1) {
          setActiveProductIndex(nextUnpackedIdx);
        }
      }
    } catch (err: any) {
      setNetworkError("Unable to save packing progress. Please try again.");
      showToast("Unable to save packing progress. Please try again.", "error");
    }
  };

  // Handle Unpacking / Re-opening a product if pressed accidentally
  const handleUnpackProduct = (productId: string) => {
    const updatedPacked = packedItemIds.filter((id) => id !== productId);
    setPackedItemIds(updatedPacked);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, JSON.stringify(updatedPacked));
      } catch (_) {}
    }
    const idx = items.findIndex((i) => i.productId === productId);
    if (idx !== -1) {
      setActiveProductIndex(idx);
    }
    if (stage === 'RECHECK') {
      setStage('PACKING');
    }
    showToast('Product reopened for repacking', 'info');
  };

  // Handle final "ORDER PACKED" confirmation
  const handleFinalOrderPacked = () => {
    if (!recheckConfirmed) {
      showToast('Please confirm that you have rechecked all packed products and quantities.', 'error');
      return;
    }
    setShowConfirmModal(true);
  };

  const handleConfirmFinalPacking = () => {
    try {
      setShowConfirmModal(false);
      onCompleteOrderPacked(task.id, 1, ['Standard Grocery Bag']);
      setStage('PACKED_COMPLETE');
      showToast('🎉 Order Packed! Transferred to Delivery Queue.', 'success');

      // Clear local packing progress cache
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem(storageKey);
        } catch (_) {}
      }
    } catch (err: any) {
      showToast('Failed to complete order packing. Please try again.', 'error');
    }
  };

  return (
    <div className="space-y-5 text-slate-900 font-sans">
      
      {/* ── TOP HEADER / TIMER BAR ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-sm">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
              Order #{task.orderNumber} • {task.storeName || 'PocketKirana Store'}
            </span>
            <strong className="text-xs font-black text-emerald-700 font-mono">
              {packedProductsCount} / {totalProductsCount} Products Packed ({totalQuantityPacked}/{totalQuantityRequired} Items)
            </strong>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-mono font-black text-amber-800 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          <span>{formatTimer(secondsElapsed)}</span>
        </div>
      </div>

      {/* ── NETWORK ERROR NOTICE ── */}
      {networkError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-bold">{networkError}</span>
          </div>
          <button
            onClick={handleProductDone}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-[11px] flex items-center gap-1 cursor-pointer transition-transform active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* ── STAGE 1: ONE-BY-ONE PACKING VIEW ── */}
      {stage === 'PACKING' && (
        <>
          {/* Progress Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-emerald-800 uppercase tracking-wider block">
                PACKING ORDER
              </span>
              <span className="text-xs font-mono font-black text-slate-900">
                {packedProductsCount} / {totalProductsCount} PRODUCTS PACKED
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-0.5">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300 shadow-xs"
                style={{ width: `${totalProductsCount > 0 ? (packedProductsCount / totalProductsCount) * 100 : 0}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
              <span>Items: {totalQuantityPacked} / {totalQuantityRequired} packed</span>
              <span>Current Product: <strong className="text-slate-900">{currentItem?.productName}</strong></span>
            </div>
          </div>

          {/* ACTIVE PRODUCT CARD */}
          {currentItem && (
            <div className="bg-white border-2 border-emerald-500 rounded-3xl p-6 space-y-5 shadow-md relative overflow-hidden">
              
              {/* Product Index Badge */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs font-black text-emerald-700 uppercase tracking-widest bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                  PRODUCT {activeProductIndex + 1} OF {totalProductsCount}
                </span>
                {isCurrentPacked && (
                  <span className="bg-emerald-600 text-white font-black text-[10px] px-2.5 py-0.5 rounded-full uppercase">
                    ✓ PACKED
                  </span>
                )}
              </div>

              {/* Product Info */}
              <div className="flex items-center gap-4">
                {currentItem.imageUrl ? (
                  <img
                    src={currentItem.imageUrl}
                    alt={currentItem.productName}
                    className="w-24 h-24 rounded-2xl object-cover bg-slate-50 border border-slate-200 shrink-0 shadow-xs"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0 font-black text-2xl">
                    {currentItem.productName.slice(0, 2).toUpperCase()}
                  </div>
                )}

                <div className="flex-1 min-w-0 space-y-1">
                  <h3 className="font-black text-lg text-slate-900 leading-snug">
                    {currentItem.productName}
                  </h3>
                  <p className="text-xs text-slate-500 font-bold">
                    Unit / Size: <span className="text-slate-900 font-mono">{currentItem.unit}</span>
                  </p>
                  <div className="text-xs font-bold text-slate-400">
                    SKU: <span className="font-mono">{currentItem.sku}</span>
                  </div>
                </div>
              </div>

              {/* Exact Quantity to Pack & FEFO Indicator */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50/80 border border-emerald-200 p-3.5 rounded-2xl flex flex-col justify-between">
                  <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block">
                    QUANTITY TO PACK
                  </span>
                  <strong className="text-2xl font-black text-emerald-800 font-mono mt-1">
                    {currentItem.quantityRequired} units
                  </strong>
                </div>

                <div className="bg-amber-50/80 border border-amber-200 p-3.5 rounded-2xl flex flex-col justify-between">
                  <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider block flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    <span>FEFO BATCH</span>
                  </span>
                  <span className="text-xs font-bold text-amber-900 mt-1">
                    Earliest Expiry Batch
                  </span>
                </div>
              </div>

              {/* Primary Action Button: DONE */}
              <button
                type="button"
                onClick={handleProductDone}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-black text-base rounded-2xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer uppercase tracking-wider"
              >
                <CheckCircle2 className="w-6 h-6" />
                <span>DONE</span>
              </button>
            </div>
          )}

          {/* COMPLETE PRODUCT LIST WITH STATUS INDICATORS */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h4 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" />
                Order Products List ({items.length} Products)
              </h4>
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => {
                const isPacked = packedItemIds.includes(item.productId);
                const isCurrent = idx === activeProductIndex;

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (isPacked) {
                        handleUnpackProduct(item.productId);
                      } else if (idx <= activeProductIndex) {
                        setActiveProductIndex(idx);
                      } else {
                        showToast('Please pack current product first.', 'info');
                      }
                    }}
                    className={`flex items-center justify-between text-xs p-3 rounded-2xl border transition-colors cursor-pointer ${
                      isCurrent
                        ? 'bg-emerald-50/80 border-emerald-300 shadow-xs'
                        : isPacked
                        ? 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                        : 'bg-white border-slate-200 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Status Icons: ✓ = Packed, ● = Currently packing, ○ = Not packed yet */}
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                          isPacked
                            ? 'bg-emerald-600 text-white'
                            : isCurrent
                            ? 'bg-emerald-100 text-emerald-800 border-2 border-emerald-600 animate-pulse'
                            : 'bg-slate-100 text-slate-400 border border-slate-300'
                        }`}
                      >
                        {isPacked ? '✓' : isCurrent ? '●' : '○'}
                      </div>

                      <div>
                        <strong className={`block font-bold text-sm ${isPacked ? 'text-slate-600 line-through' : 'text-slate-900'}`}>
                          {item.productName}
                        </strong>
                        <span className="text-[11px] text-slate-500 font-bold block">{item.unit}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-black text-slate-900 text-sm block">
                        Qty: {item.quantityRequired}
                      </span>
                      <span className={`text-[10px] font-black uppercase tracking-wider ${isPacked ? 'text-emerald-700' : 'text-slate-400'}`}>
                        {isPacked ? '✓ Packed' : isCurrent ? '● Currently Packing' : '○ Pending'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── STAGE 2: MANDATORY RECHECK SCREEN ── */}
      {stage === 'RECHECK' && (
        <div className="space-y-5 animate-in zoom-in-95 duration-200">
          
          {/* All Items Packed Announcement Card */}
          <div className="bg-gradient-to-b from-emerald-50 to-white border-2 border-emerald-500 rounded-3xl p-6 text-center space-y-4 shadow-lg">
            <div className="w-16 h-16 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-md shadow-emerald-600/30">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <span className="text-xs font-black text-emerald-800 uppercase tracking-widest block">
                ✓ ALL PRODUCTS PACKED
              </span>
              <h2 className="text-xl font-black text-slate-900 mt-1">
                {totalProductsCount} / {totalProductsCount} Products Packed
              </h2>
              <p className="text-xs text-slate-600 mt-1 font-bold">
                Total Items Packed: <strong className="font-mono text-emerald-800">{totalQuantityPacked} / {totalQuantityRequired}</strong>
              </p>
            </div>

            {/* Recheck Instruction Banner */}
            <div className="bg-white border border-emerald-200 p-4 rounded-2xl text-left space-y-2 text-xs">
              <strong className="font-black text-emerald-900 block uppercase tracking-wider">
                BEFORE COMPLETING THE ORDER
              </strong>
              <p className="text-slate-600">Please physically recheck every packed product. Make sure:</p>
              <ul className="space-y-1 font-bold text-slate-800 pl-1">
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Correct products selected</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Correct quantities packed</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> All products physically in bag</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> No product missing or damaged</li>
              </ul>
            </div>
          </div>

          {/* RECHECK PRODUCTS REVIEW LIST */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h4 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" />
                Recheck Packed Items Summary ({items.length} Products)
              </h4>
            </div>

            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between text-xs p-3 rounded-2xl bg-emerald-50/50 border border-emerald-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                      ✓
                    </div>
                    <div>
                      <strong className="block font-bold text-slate-900 text-sm">
                        {item.productName}
                      </strong>
                      <span className="text-[11px] text-slate-500 font-bold block">{item.unit}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-mono font-black text-emerald-900 text-sm block">
                      Qty: {item.quantityRequired}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUnpackProduct(item.productId)}
                      className="text-[10px] font-bold text-slate-500 hover:text-slate-900 underline cursor-pointer"
                    >
                      Reopen Item
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* STRONG REMINDER & MANDATORY CHECKBOX BOX */}
          <div className="bg-amber-50 border-2 border-amber-400 rounded-3xl p-5 space-y-4 shadow-sm text-slate-900">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-black text-sm text-amber-900 uppercase tracking-wider">
                  ⚠ RECHECK BEFORE PACKING COMPLETE
                </h4>
                <p className="text-xs text-amber-800 font-bold mt-1">
                  "Please physically recheck all packed products and quantities before completing this order."
                </p>
              </div>
            </div>

            {/* Mandatory Checkbox */}
            <label className="flex items-center gap-3 bg-white p-3.5 rounded-2xl border border-amber-300 cursor-pointer shadow-xs hover:border-amber-500 transition-colors">
              <input
                type="checkbox"
                checked={recheckConfirmed}
                onChange={(e) => setRecheckConfirmed(e.target.checked)}
                className="w-5 h-5 accent-emerald-600 rounded cursor-pointer"
              />
              <span className="text-xs font-black text-slate-900">
                I have rechecked all packed products and quantities.
              </span>
            </label>
          </div>

          {/* FINAL ORDER PACKED BUTTON */}
          <button
            type="button"
            onClick={handleFinalOrderPacked}
            disabled={!recheckConfirmed}
            className={`w-full py-4 rounded-2xl font-black text-base shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer ${
              recheckConfirmed
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30 active:scale-[0.98]'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
            }`}
          >
            <ShieldCheck className="w-6 h-6" />
            <span>ORDER PACKED</span>
          </button>
        </div>
      )}

      {/* ── CONFIRMATION MODAL BEFORE ORDER PACKED ── */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full space-y-5 shadow-2xl animate-in zoom-in-95 duration-200 text-slate-900">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-xs">
                <Package className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-black text-slate-900">Complete Packing?</h3>
              <p className="text-xs text-slate-500 font-bold">
                Please confirm that you have:
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-xs space-y-2 font-bold text-slate-700">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Packed every product ({totalProductsCount} products)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Checked every quantity ({totalQuantityRequired} items)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Rechecked the packed order</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs cursor-pointer transition-colors"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={handleConfirmFinalPacking}
                className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/30 cursor-pointer transition-transform active:scale-95"
              >
                CONFIRM PACKED
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STAGE 3: ORDER PACKED & SENT TO DELIVERY QUEUE (NO QR) ── */}
      {stage === 'PACKED_COMPLETE' && (
        <div className="bg-white border-2 border-emerald-500 rounded-3xl p-6 space-y-5 shadow-xl text-center animate-in zoom-in-95 duration-200 text-slate-900">
          
          <div className="w-20 h-20 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-600/30">
            <Check className="w-12 h-12 stroke-[3]" />
          </div>

          <div>
            <span className="text-xs font-black text-emerald-800 uppercase tracking-widest block bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full w-fit mx-auto">
              ✓ ORDER PACKED &amp; TRANSFERRED
            </span>
            <h2 className="text-2xl font-black text-slate-900 mt-2">
              Order #{task.orderNumber}
            </h2>
            <p className="text-xs text-slate-600 font-bold mt-1 max-w-xs mx-auto">
              All products packed and rechecked. Order has been automatically added to the <strong className="text-emerald-800">Central Delivery Queue</strong>.
            </p>
          </div>

          {/* Delivery Queue Banner */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-left space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <Bike className="w-5 h-5 text-emerald-700 shrink-0" />
              <strong className="font-black text-emerald-900 text-sm">
                Delivery Queue Updated in Real-Time
              </strong>
            </div>
            <p className="text-slate-600 font-bold">
              Eligible online Delivery Partners have been notified. The next available partner will accept and pick up Order #{task.orderNumber}.
            </p>
          </div>

          {/* Action button: Return to Picker Queue */}
          <button
            type="button"
            onClick={onReturnToQueue}
            className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer uppercase tracking-wider"
          >
            <span>RETURN TO PICKER QUEUE</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};
