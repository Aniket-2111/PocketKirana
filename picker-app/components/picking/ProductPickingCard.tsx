'use client';

import React, { useState, useEffect } from 'react';
import { PickingItem } from '@/types';
import { useAppStore } from '@/lib/store';
import { SlideToConfirm } from '../SlideToConfirm';
import { triggerHaptic, playSuccessSound, playErrorSound, playCompleteSound } from '../../lib/pickerFeedback';
import {
  detectMeasurementType,
  detectWeightUnit,
  formatQuantity,
  formatQuantityNumber,
  normalizeDecimal,
  isQuantityComplete,
  calculateRemaining,
  validatePickedInput,
} from '@/lib/measurementUtils';
import {
  Package,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Minus,
  Plus,
  ChevronDown,
  ChevronUp,
  X,
  Scale,
  Sparkles,
  Layers,
  AlertCircle
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

interface ProductPickingCardProps {
  item: PickingItem;
  itemIndex: number;
  totalItems: number;
  onPickConfirmed: (productId: string, quantityPicked: number) => Promise<void> | void;
  isSaving?: boolean;
}

export const ProductPickingCard: React.FC<ProductPickingCardProps> = ({
  item,
  itemIndex,
  totalItems,
  onPickConfirmed,
  isSaving = false,
}) => {
  const measurementType = detectMeasurementType(item);
  const weightUnit = detectWeightUnit(item);

  const [pickedQty, setPickedQty] = useState<number>(() => {
    return normalizeDecimal(item.quantityPicked || 0, 3);
  });
  const [weightInputText, setWeightInputText] = useState<string>(() => {
    return formatQuantityNumber(item.quantityPicked || 0, measurementType);
  });
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showMoreDetails, setShowMoreDetails] = useState(false);

  // Sync state if item changes
  useEffect(() => {
    const initQty = normalizeDecimal(item.quantityPicked || 0, 3);
    setPickedQty(initQty);
    setWeightInputText(formatQuantityNumber(initQty, measurementType));
    setValidationError(null);
  }, [item.productId, item.quantityPicked, measurementType]);

  const { products } = useAppStore();
  const matchedProduct = (products || []).find((p) => p.id === item.productId || p.slug === item.productId);
  const displayPrice = item.price ?? (item as any).sellingPrice ?? (item as any).unitPrice ?? matchedProduct?.sellingPrice ?? matchedProduct?.price;
  const displayUnit = item.unit || matchedProduct?.unit || (measurementType === 'WEIGHT' ? '1 kg' : '1 unit');

  const orderedQty = normalizeDecimal(item.quantityRequired || 1, 3);
  const remainingQty = calculateRemaining(orderedQty, pickedQty, measurementType);
  const isComplete = isQuantityComplete(pickedQty, orderedQty, measurementType);

  // ── UNIT CONTROLS ──
  const handleUnitIncrement = () => {
    const next = pickedQty + 1;
    const validation = validatePickedInput(next, orderedQty, measurementType);
    if (!validation.valid) {
      showToast(validation.error || 'Cannot exceed ordered quantity', 'info');
      setValidationError(validation.error || null);
      triggerHaptic('warning');
      return;
    }
    setValidationError(null);
    setPickedQty(next);
    triggerHaptic('light');
  };

  const handleUnitDecrement = () => {
    if (pickedQty > 0) {
      const next = pickedQty - 1;
      setValidationError(null);
      setPickedQty(next);
      triggerHaptic('light');
    }
  };

  // ── WEIGHT CONTROLS ──
  const handleWeightChange = (rawValue: string) => {
    setWeightInputText(rawValue);
    if (rawValue.trim() === '') {
      setPickedQty(0);
      setValidationError(null);
      return;
    }

    const parsed = parseFloat(rawValue);
    if (isNaN(parsed) || parsed < 0) {
      setValidationError('Please enter a valid positive weight.');
      return;
    }

    const validation = validatePickedInput(parsed, orderedQty, measurementType);
    if (!validation.valid) {
      setValidationError(validation.error || null);
      triggerHaptic('warning');
    } else {
      setValidationError(null);
      setPickedQty(validation.normalizedValue);
      triggerHaptic('light');
    }
  };

  const handlePickExactWeight = () => {
    setPickedQty(orderedQty);
    setWeightInputText(formatQuantityNumber(orderedQty, 'WEIGHT'));
    setValidationError(null);
    playSuccessSound();
    triggerHaptic('success');
    showToast(`✓ Filled exact required weight (${orderedQty.toFixed(3)} ${weightUnit.toLowerCase()})`, 'success');
  };

  const handleAddPresetWeight = (delta: number) => {
    const target = normalizeDecimal(pickedQty + delta, 3);
    const validation = validatePickedInput(target, orderedQty, measurementType);
    if (!validation.valid) {
      showToast(validation.error || 'Cannot exceed ordered quantity', 'info');
      setValidationError(validation.error || null);
      triggerHaptic('warning');
      return;
    }
    setValidationError(null);
    setPickedQty(target);
    setWeightInputText(target.toFixed(3));
    triggerHaptic('light');
  };

  // ── CONFIRM PICK ──
  const handleSlidePickConfirm = async () => {
    if (!isComplete) {
      showToast(`Pick the remaining ${formatQuantity(remainingQty, measurementType, weightUnit)} before confirming.`, 'error');
      triggerHaptic('error');
      return;
    }

    await onPickConfirmed(item.productId, pickedQty);
  };

  return (
    <div className="bg-white border-2 border-slate-200 rounded-3xl overflow-hidden shadow-md space-y-4">
      
      {/* ── STEP & TYPE BANNER ── */}
      <div className="bg-emerald-700 text-white px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-800/80 px-2.5 py-1 rounded-md border border-emerald-600/50">
            {measurementType === 'WEIGHT' ? '⚖️ LOOSE WEIGHT' : '📦 PACKAGED UNIT'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold bg-emerald-900/90 px-3 py-1 rounded-full border border-emerald-600/40">
            {itemIndex + 1} / {totalItems}
          </span>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-5">
        {/* ── PRODUCT IMAGE & DETAILS ── */}
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center p-2 shrink-0 shadow-xs relative overflow-hidden">
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.productName}
                className="w-full h-full object-contain rounded-xl"
              />
            ) : (
              <Package className="w-12 h-12 text-slate-300" />
            )}
            {isComplete && (
              <div className="absolute inset-0 bg-emerald-600/85 backdrop-blur-xs flex items-center justify-center text-white font-black text-xs uppercase tracking-wider">
                ✓ Picked Full
              </div>
            )}
          </div>

          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                {displayUnit}
              </span>
              <span className="text-[10px] font-mono text-slate-400 font-bold">
                SKU: {item.sku || 'SKU-001'}
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-snug">
              <span>{item.productName}</span>
              {displayUnit && !item.productName.toLowerCase().includes(displayUnit.toLowerCase()) && (
                <span> ({displayUnit})</span>
              )}
              {displayPrice !== undefined && displayPrice !== null && (
                <span> • ₹{displayPrice}</span>
              )}
            </h2>

            <div className="flex items-center gap-3 text-xs text-slate-500 font-medium justify-center sm:justify-start flex-wrap">
              <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                ● Dark Store Active
              </span>
              <span>•</span>
              <button
                onClick={() => setShowMoreDetails(!showMoreDetails)}
                className="text-emerald-700 hover:text-emerald-800 font-bold underline cursor-pointer"
              >
                {showMoreDetails ? 'Hide details' : 'View details'}
              </button>
            </div>
          </div>
        </div>

        {/* Expandable Details */}
        {showMoreDetails && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-2 animate-in fade-in duration-150">
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500">Measurement Type:</span>
              <span className="font-bold text-slate-900">{measurementType === 'WEIGHT' ? 'Weight-Based (Loose)' : 'Unit Count (Packaged)'}</span>
            </div>
            {displayPrice !== undefined && displayPrice !== null && (
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Price:</span>
                <span className="font-bold font-mono text-slate-900">₹{displayPrice}</span>
              </div>
            )}
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Product Identifier:</span>
              <span className="font-mono font-bold text-slate-800">{item.productId}</span>
            </div>
          </div>
        )}

        {/* ── REQUIRED / PICKED / REMAINING METRIC TRIO ── */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
          {/* REQUIRED */}
          <div className="bg-slate-100 border border-slate-200 p-3.5 rounded-2xl">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
              REQUIRED
            </span>
            <strong className="text-lg sm:text-2xl font-black text-slate-900 font-mono mt-0.5 block">
              {formatQuantity(orderedQty, measurementType, weightUnit)}
            </strong>
          </div>

          {/* PICKED */}
          <div className={`p-3.5 rounded-2xl border transition-colors ${
            isComplete
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-slate-100 border-slate-200 text-slate-900'
          }`}>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
              PICKED
            </span>
            <strong className="text-lg sm:text-2xl font-black font-mono mt-0.5 block text-emerald-700">
              {formatQuantity(pickedQty, measurementType, weightUnit)}
            </strong>
          </div>

          {/* REMAINING */}
          <div className={`p-3.5 rounded-2xl border transition-colors ${
            isComplete
              ? 'bg-emerald-600 border-emerald-700 text-white'
              : 'bg-amber-50 border-amber-300 text-amber-900'
          }`}>
            <span className={`text-[10px] font-black uppercase tracking-wider block ${
              isComplete ? 'text-emerald-100' : 'text-amber-700'
            }`}>
              REMAINING
            </span>
            <strong className="text-lg sm:text-2xl font-black font-mono mt-0.5 block">
              {formatQuantity(remainingQty, measurementType, weightUnit)}
            </strong>
          </div>
        </div>

        {/* Status Callout Banner */}
        {isComplete ? (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 font-black">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>✓ READY TO CONFIRM</span>
            </span>
            <span className="text-[11px] text-emerald-700 font-mono">
              All {formatQuantity(orderedQty, measurementType, weightUnit)} picked
            </span>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-2 rounded-2xl text-xs font-medium flex items-center justify-between">
            <span>
              ❌ <strong>{formatQuantity(remainingQty, measurementType, weightUnit)} remaining</strong>
            </span>
            <span className="text-[10px] uppercase font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
              Incomplete
            </span>
          </div>
        )}

        {/* Validation Error Banner */}
        {validationError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in shake duration-200">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* ── PICKING CONTROLS BASED ON MEASUREMENT TYPE ── */}
        {measurementType === 'UNIT' ? (
          /* TYPE A: COUNTABLE / PACKAGED PRODUCTS */
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-black text-slate-800 block">Pick Packaged Units</span>
                <span className="text-[10px] text-slate-500">Tap buttons to match physical pick count</span>
              </div>
              <span className="text-xs font-mono text-slate-500 font-bold">
                Max: {orderedQty} units
              </span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-2xl p-1 shadow-2xs">
                <button
                  onClick={handleUnitDecrement}
                  disabled={pickedQty <= 0}
                  className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center text-slate-800 transition-colors cursor-pointer active:scale-90"
                  title="Decrease count"
                >
                  <Minus className="w-5 h-5" />
                </button>

                <span className="w-16 text-center text-2xl font-black font-mono text-slate-900">
                  {pickedQty}
                </span>

                <button
                  onClick={handleUnitIncrement}
                  disabled={pickedQty >= orderedQty}
                  className="w-11 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-30 disabled:pointer-events-none text-white flex items-center justify-center transition-colors cursor-pointer active:scale-90"
                  title="Increase count"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              <button
                onClick={() => {
                  setPickedQty(orderedQty);
                  setValidationError(null);
                  playSuccessSound();
                  triggerHaptic('success');
                }}
                className="py-3 px-4 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-colors cursor-pointer"
              >
                Pick All ({orderedQty})
              </button>
            </div>
          </div>
        ) : (
          /* TYPE B: LOOSE / WEIGHT-BASED PRODUCTS */
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-black text-slate-800 block">Manual Picked Weight Entry</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono font-bold">
                Max: {orderedQty.toFixed(3)} {weightUnit.toLowerCase()}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Decimal Input */}
              <div className="relative flex-1">
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  max={orderedQty}
                  value={weightInputText}
                  onChange={(e) => handleWeightChange(e.target.value)}
                  placeholder="e.g. 2.500"
                  className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-2xl font-mono text-xl sm:text-2xl font-black text-slate-900 text-center focus:border-emerald-600 focus:outline-hidden"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold font-mono text-xs uppercase text-slate-400">
                  {weightUnit}
                </span>
              </div>

              {/* Exact Quick Button */}
              <button
                type="button"
                onClick={handlePickExactWeight}
                className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-2xl shadow-xs transition-transform active:scale-95 cursor-pointer whitespace-nowrap"
              >
                Exact ({orderedQty.toFixed(3)} {weightUnit.toLowerCase()})
              </button>
            </div>

            {/* Quick Weight Adjuster Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-0.5 text-xs">
              <span className="text-[10px] text-slate-400 uppercase font-black shrink-0">Quick Add:</span>
              {[0.250, 0.500, 1.000].map((delta) => (
                <button
                  key={delta}
                  type="button"
                  onClick={() => handleAddPresetWeight(delta)}
                  disabled={pickedQty + delta > orderedQty + 0.0001}
                  className="px-2.5 py-1 rounded-xl bg-white hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none border border-slate-200 text-slate-700 font-bold text-[11px] font-mono shrink-0 transition-colors cursor-pointer shadow-2xs"
                >
                  +{delta.toFixed(3)} {weightUnit.toLowerCase()}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setPickedQty(0);
                  setWeightInputText('0.000');
                  setValidationError(null);
                }}
                className="px-2.5 py-1 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[11px] font-mono shrink-0 cursor-pointer ml-auto"
              >
                Reset (0)
              </button>
            </div>
          </div>
        )}

        {/* ── SLIDE TO MARK PICKED ── */}
        <div className="pt-2">
          {isComplete ? (
            <SlideToConfirm
              label="Slide to Mark Picked"
              completedLabel="✓ Item Picked! Advancing..."
              variant="success"
              isLoading={isSaving}
              onConfirm={handleSlidePickConfirm}
            />
          ) : (
            <div className="bg-slate-100 border border-slate-200 rounded-2xl p-4 text-center space-y-1">
              <span className="text-xs font-black text-slate-500 uppercase tracking-wider block">
                Slider Inactive
              </span>
              <p className="text-xs text-slate-600 font-medium">
                Pick the remaining <strong>{formatQuantity(remainingQty, measurementType, weightUnit)}</strong> to enable slide confirmation.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
