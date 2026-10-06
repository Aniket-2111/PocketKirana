'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import PickerShell from '../../../components/PickerShell';
import { SlideToConfirm } from '../../../components/SlideToConfirm';
import { useAppStore } from '@/lib/store';
import { triggerHaptic, playCompleteSound } from '../../../lib/pickerFeedback';
import {
  detectMeasurementType,
  detectWeightUnit,
  formatQuantity,
  formatQuantityNumber,
  normalizeDecimal,
} from '@/lib/measurementUtils';
import {
  ArrowLeft,
  Boxes,
  Package,
  Plus,
  Minus,
  CheckCircle2,
  Calendar,
  Layers,
  MapPin,
  History,
  AlertCircle,
  Tag,
  ShieldCheck,
  Scale,
  Zap,
  TrendingUp
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';
import { apiFetch } from '@/lib/apiClient';
import { Product } from '@/types';

export default function InventoryDetailClient() {
  const router = useRouter();
  const params = useParams();
  const productId = decodeURIComponent((params?.id as string) || '');
  const { products: storeProducts, pickers, activePickerId } = useAppStore();

  const picker = pickers.find((p) => p.id === activePickerId) || pickers[0];

  const product: Product | undefined = useMemo(() => {
    return (storeProducts || []).find((p) => p.id === productId || p.slug === productId);
  }, [productId, storeProducts]);

  const measurementType = detectMeasurementType(product);
  const weightUnit = detectWeightUnit(product);

  // Stock values
  const [currentStock, setCurrentStock] = useState<number>(() => {
    if (product?.stock !== undefined) return normalizeDecimal(product.stock, 3);
    return measurementType === 'WEIGHT' ? 63.5 : 63;
  });
  const [reservedStock, setReservedStock] = useState<number>(() => {
    return measurementType === 'WEIGHT' ? 3.5 : 8;
  });

  const [quantityToAdd, setQuantityToAdd] = useState<number>(() => {
    return measurementType === 'WEIGHT' ? 10.25 : 10;
  });
  const [manualInputText, setManualInputText] = useState<string>(() => {
    return measurementType === 'WEIGHT' ? '10.250' : '10';
  });
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');

  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastUpdatedMessage, setLastUpdatedMessage] = useState<string | null>(null);

  // Local transaction history for this item
  const [history, setHistory] = useState([
    {
      id: 'tx-init-1',
      date: 'Today 15:32',
      qty: measurementType === 'WEIGHT' ? 10.25 : 10,
      prev: measurementType === 'WEIGHT' ? 53.25 : 53,
      curr: measurementType === 'WEIGHT' ? 63.5 : 63,
      type: 'STOCK_RECEIPT',
      by: 'Picker Rahul',
      batch: 'BAT-2026-SEP',
    },
    {
      id: 'tx-init-2',
      date: 'Yesterday 11:20',
      qty: measurementType === 'WEIGHT' ? 25.0 : 25,
      prev: measurementType === 'WEIGHT' ? 28.25 : 28,
      curr: measurementType === 'WEIGHT' ? 53.25 : 53,
      type: 'STOCK_RECEIPT',
      by: 'Store Admin',
    },
  ]);

  useEffect(() => {
    if (product?.stock !== undefined) {
      setCurrentStock(normalizeDecimal(product.stock, 3));
    }
  }, [product]);

  const availableStock = Math.max(0, normalizeDecimal(currentStock - reservedStock, 3));
  const newStockPreview = normalizeDecimal(currentStock + quantityToAdd, 3);

  // Manual & Stepper Handlers for Quantity
  const handleQuantityInputChange = (val: string) => {
    setManualInputText(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed > 0) {
      setQuantityToAdd(measurementType === 'WEIGHT' ? normalizeDecimal(parsed, 3) : Math.floor(parsed));
    } else {
      setQuantityToAdd(0);
    }
  };

  const handleUnitIncrement = (step = 1) => {
    const next = (quantityToAdd || 0) + step;
    setQuantityToAdd(next);
    setManualInputText(String(next));
    triggerHaptic('light');
  };

  const handleUnitDecrement = (step = 1) => {
    const next = Math.max(1, (quantityToAdd || 0) - step);
    setQuantityToAdd(next);
    setManualInputText(String(next));
    triggerHaptic('light');
  };

  const handleQuickAddUnit = (amt: number) => {
    const next = (quantityToAdd || 0) + amt;
    setQuantityToAdd(next);
    setManualInputText(String(next));
    triggerHaptic('medium');
  };

  const handleQuickAddWeight = (delta: number) => {
    const next = normalizeDecimal(quantityToAdd + delta, 3);
    setQuantityToAdd(next);
    setManualInputText(next.toFixed(3));
    triggerHaptic('medium');
  };

  const handleConfirmStockAddition = async () => {
    if (quantityToAdd <= 0) {
      showToast('Please enter a valid stock quantity greater than 0', 'error');
      return;
    }

    setIsSubmitting(true);
    const idempotencyKey = `tx_${productId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    try {
      // Call transactional stock receipt API with decimal support
      const res = await apiFetch('/api/inventory/stock-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product?.id || productId,
          storeId: picker?.storeId || 'store-001',
          quantity: quantityToAdd,
          batchNumber: batchNumber || undefined,
          expiryDate: expiryDate || undefined,
          notes: notes || undefined,
          pickerId: picker?.id || 'picker-001',
          idempotencyKey,
        }),
      });

      const data = await res.json();

      if (data.success) {
        const prev = currentStock;
        const finalStock = data.data?.newStock !== undefined ? normalizeDecimal(data.data.newStock, 3) : normalizeDecimal(prev + quantityToAdd, 3);
        setCurrentStock(finalStock);

        // Record in history
        setHistory((prevH) => [
          {
            id: idempotencyKey,
            date: 'Just Now',
            qty: quantityToAdd,
            prev,
            curr: finalStock,
            type: 'STOCK_RECEIPT',
            by: picker?.name || 'Picker Staff',
            batch: batchNumber || undefined,
          },
          ...prevH,
        ]);

        const prevFmt = formatQuantity(prev, measurementType, weightUnit);
        const finalFmt = formatQuantity(finalStock, measurementType, weightUnit);
        setLastUpdatedMessage(`✓ STOCK UPDATED: ${prevFmt} → ${finalFmt}`);
        showToast(`Stock updated! +${formatQuantity(quantityToAdd, measurementType, weightUnit)} added.`, 'success');
        playCompleteSound();
        triggerHaptic('success');
        setShowAddStockModal(false);

        // Reset inputs
        const defaultNext = measurementType === 'WEIGHT' ? 10.25 : 10;
        setQuantityToAdd(defaultNext);
        setManualInputText(measurementType === 'WEIGHT' ? '10.250' : '10');
        setBatchNumber('');
        setExpiryDate('');
        setNotes('');
      } else {
        throw new Error(data.error || 'Failed to update stock');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update stock on server', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!product && !productId) {
    return (
      <PickerShell>
        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-3 text-slate-900">
          <Package className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="font-bold text-sm text-slate-800">Product Not Found</h3>
          <button
            onClick={() => router.push('/inventory')}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer"
          >
            Back to Inventory Search
          </button>
        </div>
      </PickerShell>
    );
  }

  const displayName = product?.name || productId.replace(/-/g, ' ').toUpperCase();
  const displayBrand = product?.brandId ? product.brandId.replace('brand-', '').toUpperCase() : 'POCKETKIRANA';
  const displaySku = product?.sku || `SKU-${productId.slice(0, 8).toUpperCase()}`;
  const displayImage = product?.thumbnail || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80';

  return (
    <PickerShell>
      <div className="space-y-6 text-slate-900 pb-12 animate-in fade-in duration-200">
        
        {/* ── TOP NAV BAR ── */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => router.push('/inventory')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Inventory Search</span>
          </button>

          <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">
            Store: {picker.storeName || 'PocketKirana Neral Hub'}
          </span>
        </div>

        {/* Success Alert Banner if updated */}
        {lastUpdatedMessage && (
          <div className="bg-emerald-600 text-white p-4 rounded-2xl flex items-center justify-between text-xs font-bold shadow-md shadow-emerald-900/20 animate-in zoom-in-95">
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-200" />
              <span>{lastUpdatedMessage}</span>
            </span>
            <button onClick={() => setLastUpdatedMessage(null)} className="text-emerald-200 hover:text-white">
              ✕
            </button>
          </div>
        )}

        {/* ── PRODUCT DETAILS CARD ── */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 space-y-5 shadow-xs">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-slate-50 border border-slate-200 p-2 flex items-center justify-center shrink-0">
              <img
                src={displayImage}
                alt={displayName}
                className="w-full h-full object-contain rounded-xl"
              />
            </div>

            <div className="space-y-1.5 min-w-0 text-center sm:text-left flex-1">
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md inline-block">
                  {displayBrand}
                </span>
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  {measurementType === 'WEIGHT' ? '⚖️ Loose Weight' : '📦 Packaged Unit'}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-snug">
                {displayName}
              </h1>
              <div className="flex items-center gap-3 text-xs text-slate-500 font-medium justify-center sm:justify-start flex-wrap">
                <span>Unit: <strong className="text-slate-800">{product?.unit || (measurementType === 'WEIGHT' ? 'Loose' : '1 unit')}</strong></span>
                <span>•</span>
                <span>SKU: <strong className="font-mono text-slate-800">{displaySku}</strong></span>
              </div>
            </div>
          </div>

          {/* Stock Status Bar */}
          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl flex items-center justify-between pt-2">
            <div>
              <span className="text-[10px] font-black uppercase text-slate-400 block">Stock Status</span>
              <strong className="text-sm font-black text-emerald-700 block">
                ● In Stock &amp; Active
              </strong>
            </div>
            <span className="text-xs font-mono font-bold bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs">
              Selling: ₹{product?.sellingPrice || 62}
            </span>
          </div>

          {/* ── INVENTORY METRICS BREAKDOWN ── */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3 text-center pt-1">
            {/* Current Stock */}
            <div className="bg-slate-100 border border-slate-200 p-3.5 rounded-2xl">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                Current Stock
              </span>
              <strong className="text-lg sm:text-2xl font-black text-slate-900 font-mono mt-0.5 block">
                {formatQuantity(currentStock, measurementType, weightUnit)}
              </strong>
              <span className="text-[9px] text-slate-400 font-bold block mt-0.5">Physical Quantity</span>
            </div>

            {/* Available to Sell */}
            <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">
                Available
              </span>
              <strong className="text-lg sm:text-2xl font-black text-emerald-700 font-mono mt-0.5 block">
                {formatQuantity(availableStock, measurementType, weightUnit)}
              </strong>
              <span className="text-[9px] text-emerald-600 font-bold block mt-0.5">Unreserved</span>
            </div>

            {/* Reserved Stock */}
            <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 block">
                Reserved
              </span>
              <strong className="text-lg sm:text-2xl font-black text-amber-900 font-mono mt-0.5 block">
                {formatQuantity(reservedStock, measurementType, weightUnit)}
              </strong>
              <span className="text-[9px] text-amber-600 font-bold block mt-0.5">In Live Orders</span>
            </div>
          </div>

          {/* ── ADD STOCK BUTTON ── */}
          <div className="pt-2">
            <button
              onClick={() => {
                const initVal = measurementType === 'WEIGHT' ? 10.25 : 10;
                setQuantityToAdd(initVal);
                setManualInputText(measurementType === 'WEIGHT' ? '10.250' : '10');
                setShowAddStockModal(true);
              }}
              className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-900/20 transition-all active:scale-95 cursor-pointer uppercase tracking-wider"
            >
              <Plus className="w-5 h-5 stroke-[3]" />
              <span>+ ADD INVENTORY STOCK</span>
            </button>
          </div>
        </div>

        {/* ── RECENT PRODUCT LEDGER HISTORY ── */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-600" />
              <span>Stock Ledger History</span>
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">Auditable</span>
          </div>

          <div className="space-y-2">
            {history.map((tx) => (
              <div
                key={tx.id}
                className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-400 font-bold">{tx.date}</span>
                    <span className="text-[9px] font-black text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded-md">
                      +{formatQuantity(tx.qty, measurementType, weightUnit)}
                    </span>
                    {tx.batch && (
                      <span className="text-[9px] font-mono bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-md">
                        {tx.batch}
                      </span>
                    )}
                  </div>
                  <span className="text-slate-500 block text-[11px] mt-0.5">
                    Stock: <strong className="font-mono text-slate-700">{formatQuantity(tx.prev, measurementType, weightUnit)}</strong> →{' '}
                    <strong className="font-mono text-emerald-700 font-black">{formatQuantity(tx.curr, measurementType, weightUnit)}</strong> • By {tx.by}
                  </span>
                </div>

                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                  ✓
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── ADD STOCK MODAL (WITH LIVE CALCULATION & SLIDE TO CONFIRM) ── */}
      {showAddStockModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Boxes className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-sm text-slate-900 uppercase">Receive Inbound Stock</h3>
              </div>
              <button
                onClick={() => setShowAddStockModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Product Summary */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-emerald-700 font-black uppercase tracking-wider block">
                  {displayBrand}
                </span>
                <span className="text-[9px] font-bold text-slate-500">
                  {measurementType === 'WEIGHT' ? '⚖️ Loose Weight' : '📦 Packaged Units'}
                </span>
              </div>
              <strong className="text-sm font-black text-slate-900 block truncate">
                {displayName}
              </strong>
              <span className="text-xs text-slate-500 block">
                Current Stock: <strong className="font-mono text-slate-800">{formatQuantity(currentStock, measurementType, weightUnit)}</strong>
              </span>
            </div>

            {/* Quantity Controls tailored to measurement type */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 block">
                  Quantity to Add ({measurementType === 'WEIGHT' ? weightUnit : 'Units'}):
                </label>
                <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                  Type Manually / Stepper
                </span>
              </div>

              {measurementType === 'UNIT' ? (
                /* UNIT CONTROLS WITH MANUAL INPUT */
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between bg-slate-50 border-2 border-slate-200 focus-within:border-emerald-500 focus-within:bg-white rounded-2xl p-1.5 transition-all shadow-inner">
                    <button
                      type="button"
                      onClick={() => handleUnitDecrement(1)}
                      className="w-12 h-12 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800 transition-transform active:scale-90 cursor-pointer shadow-xs"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-5 h-5" />
                    </button>

                    <div className="flex-1 text-center px-2">
                      <input
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={manualInputText}
                        onChange={(e) => handleQuantityInputChange(e.target.value.replace(/\D/g, ''))}
                        onBlur={() => {
                          if (!manualInputText || parseInt(manualInputText) <= 0) {
                            setManualInputText('1');
                            setQuantityToAdd(1);
                          }
                        }}
                        placeholder="Enter quantity"
                        className="w-full text-center font-black font-mono text-3xl text-slate-900 bg-transparent focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                        Units (Tap to type)
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleUnitIncrement(1)}
                      className="w-12 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-transform active:scale-90 cursor-pointer shadow-sm"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Quick Add Preset Buttons */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pt-0.5 pb-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">Quick:</span>
                    {[5, 10, 20, 50, 100].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handleQuickAddUnit(amt)}
                        className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 border border-slate-200/80 text-slate-700 text-xs font-black font-mono shrink-0 transition-colors cursor-pointer"
                      >
                        +{amt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* WEIGHT CONTROLS WITH MANUAL INPUT */
                <div className="space-y-2.5">
                  <div className="relative">
                    <input
                      type="number"
                      step="0.001"
                      min="0.001"
                      value={manualInputText}
                      onChange={(e) => handleQuantityInputChange(e.target.value)}
                      placeholder="e.g. 10.250"
                      className="w-full px-4 py-3 bg-white border-2 border-slate-300 focus:border-emerald-600 rounded-2xl font-mono text-2xl font-black text-slate-900 text-center focus:outline-hidden"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold font-mono text-xs uppercase text-slate-400">
                      {weightUnit}
                    </span>
                  </div>

                  {/* Quick Add Pills for Weight */}
                  <div className="flex items-center gap-2 overflow-x-auto pt-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">Quick:</span>
                    {[1, 5, 10, 25, 50].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handleQuickAddWeight(amt)}
                        className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold font-mono shrink-0 transition-colors cursor-pointer"
                      >
                        +{amt} {weightUnit.toLowerCase()}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── LIVE CALCULATION PREVIEW ── */}
            <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-4 text-center space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">
                Authoritative Stock Calculation Preview
              </span>
              <div className="flex items-center justify-center gap-1.5 sm:gap-2 text-sm sm:text-base font-black font-mono text-slate-900 flex-wrap">
                <span>{formatQuantity(currentStock, measurementType, weightUnit)}</span>
                <span className="text-emerald-600">+</span>
                <span className="text-emerald-700">{formatQuantity(quantityToAdd, measurementType, weightUnit)}</span>
                <span>=</span>
                <span className="text-emerald-800 font-extrabold underline decoration-emerald-500">
                  {formatQuantity(newStockPreview, measurementType, weightUnit)}
                </span>
              </div>
            </div>

            {/* Optional Batch & Expiry Management */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-600 block">Batch Number (Opt):</label>
                <input
                  type="text"
                  placeholder="e.g. BATCH-09"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600 block">Expiry Date (Opt):</label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs"
                />
              </div>
            </div>

            {/* ── SLIDE TO CONFIRM STOCK ADDITION ── */}
            <div className="pt-2">
              <SlideToConfirm
                label={`Slide to Add ${formatQuantity(quantityToAdd, measurementType, weightUnit).toUpperCase()}`}
                completedLabel="✓ Adding Stock..."
                variant="success"
                isLoading={isSubmitting}
                onConfirm={handleConfirmStockAddition}
              />
            </div>
          </div>
        </div>
      )}

    </PickerShell>
  );
}
