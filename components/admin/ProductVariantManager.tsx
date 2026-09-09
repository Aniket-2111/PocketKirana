'use client';

import React, { useState, useEffect } from 'react';
import { ProductVariant } from '@/types';
import { showToast } from '@/components/ui/Toast';
import { useAppStore } from '@/lib/store';
import {
  Plus,
  Edit2,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  AlertCircle,
  Package,
  Layers,
  Sparkles,
  X,
  Star,
  RefreshCw,
} from 'lucide-react';

const COMMON_UNITS = [
  { label: 'g (Grams)', value: 'g' },
  { label: 'kg (Kilograms)', value: 'kg' },
  { label: 'mg (Milligrams)', value: 'mg' },
  { label: 'ml (Milliliters)', value: 'ml' },
  { label: 'L (Liters)', value: 'L' },
  { label: 'piece (Pcs)', value: 'piece' },
  { label: 'pack (Packs)', value: 'pack' },
  { label: 'box (Boxes)', value: 'box' },
  { label: 'dozen (Dozens)', value: 'dozen' },
  { label: 'custom (Custom Unit)', value: 'custom' },
];

interface ProductVariantManagerProps {
  productId: string;
  productName: string;
  initialVariants?: ProductVariant[];
  onVariantsUpdated?: (variants: ProductVariant[]) => void;
}

export const ProductVariantManager: React.FC<ProductVariantManagerProps> = ({
  productId,
  productName,
  initialVariants = [],
  onVariantsUpdated,
}) => {
  const [variants, setVariants] = useState<ProductVariant[]>(initialVariants);
  const [isLoading, setIsLoading] = useState(false);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);

  // Form Fields
  const [quantityValue, setQuantityValue] = useState<string>('500');
  const [quantityUnit, setQuantityUnit] = useState<string>('g');
  const [customUnit, setCustomUnit] = useState<string>('');
  const [variantName, setVariantName] = useState<string>('500 g');
  const [sellingPrice, setSellingPrice] = useState<string>('');
  const [mrp, setMrp] = useState<string>('');
  const [stockQuantity, setStockQuantity] = useState<string>('20');
  const [lowStockThreshold, setLowStockThreshold] = useState<string>('5');
  const [sku, setSku] = useState<string>('');
  const [barcode, setBarcode] = useState<string>('');
  const [isDefault, setIsDefault] = useState<boolean>(false);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-generate variant label preview when value or unit changes
  const effectiveUnit = quantityUnit === 'custom' ? customUnit.trim() || 'unit' : quantityUnit;

  const handleValueOrUnitChange = (val: string, u: string, customU: string) => {
    setQuantityValue(val);
    setQuantityUnit(u);
    setCustomUnit(customU);

    const actualU = u === 'custom' ? (customU.trim() || '') : u;
    if (val && actualU) {
      setVariantName(`${val} ${actualU}`);
    } else if (val) {
      setVariantName(`${val}`);
    }
  };

  const loadVariants = async () => {
    if (!productId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/products/${productId}/variants`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.variants)) {
        setVariants(data.variants);
        if (onVariantsUpdated) onVariantsUpdated(data.variants);
        // Sync with Zustand store
        try {
          const { updateProduct } = useAppStore.getState();
          if (updateProduct) {
            updateProduct(productId, { variants: data.variants });
          }
        } catch (_) {}
      }
    } catch (err) {
      console.warn('Could not load variants:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (productId) {
      loadVariants();
    }
  }, [productId]);

  // Open Add Modal
  const handleOpenAddModal = () => {
    setEditingVariant(null);
    setQuantityValue('500');
    setQuantityUnit('g');
    setCustomUnit('');
    setVariantName('500 g');
    setSellingPrice('');
    setMrp('');
    setStockQuantity('20');
    setLowStockThreshold('5');
    setSku('');
    setBarcode('');
    setIsDefault(variants.length === 0);
    setIsActive(true);
    setShowModal(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (variant: ProductVariant) => {
    setEditingVariant(variant);
    setQuantityValue(variant.quantityValue !== undefined ? String(variant.quantityValue) : '');
    const isStandardUnit = COMMON_UNITS.some((u) => u.value === variant.quantityUnit);
    if (isStandardUnit) {
      setQuantityUnit(variant.quantityUnit || 'kg');
      setCustomUnit('');
    } else {
      setQuantityUnit('custom');
      setCustomUnit(variant.quantityUnit || '');
    }
    setVariantName(variant.variantName);
    setSellingPrice(String(variant.sellingPrice));
    setMrp(String(variant.mrp));
    setStockQuantity(String(variant.stockQuantity || variant.stock || 0));
    setLowStockThreshold(String(variant.lowStockThreshold || 5));
    setSku(variant.sku || '');
    setBarcode(variant.barcode || '');
    setIsDefault(Boolean(variant.isDefault));
    setIsActive(Boolean(variant.isActive));
    setShowModal(true);
  };

  // Open Duplicate Helper
  const handleDuplicateVariant = (variant: ProductVariant) => {
    setEditingVariant(null);
    setQuantityValue(variant.quantityValue !== undefined ? String(variant.quantityValue) : '');
    setQuantityUnit(variant.quantityUnit || 'kg');
    setCustomUnit('');
    setVariantName(`${variant.variantName} (Copy)`);
    setSellingPrice(String(variant.sellingPrice));
    setMrp(String(variant.mrp));
    setStockQuantity(String(variant.stockQuantity || variant.stock || 20));
    setLowStockThreshold(String(variant.lowStockThreshold || 5));
    setSku('');
    setBarcode('');
    setIsDefault(false);
    setIsActive(true);
    setShowModal(true);
  };

  // Save Variant (Create or Update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!variantName.trim()) {
      showToast('Variant name/size is required', 'error');
      return;
    }

    if (!sellingPrice || Number(sellingPrice) < 0) {
      showToast('Please enter a valid selling price', 'error');
      return;
    }

    const priceNum = Number(sellingPrice);
    const mrpNum = mrp ? Number(mrp) : priceNum;

    if (mrpNum < 0) {
      showToast('MRP cannot be negative', 'error');
      return;
    }

    setIsSubmitting(true);

    const payload = {
      productName,
      variantName: variantName.trim(),
      quantityValue: quantityValue ? Number(quantityValue) : undefined,
      quantityUnit: effectiveUnit,
      sellingPrice: priceNum,
      mrp: mrpNum,
      stockQuantity: Number(stockQuantity) || 0,
      lowStockThreshold: Number(lowStockThreshold) || 5,
      sku: sku.trim() || undefined,
      barcode: barcode.trim() || undefined,
      isDefault,
      isActive,
    };

    try {
      if (editingVariant) {
        // PUT update
        const res = await fetch(`/api/products/${productId}/variants/${editingVariant.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showToast(`Variant "${variantName}" updated!`, 'success');
          setShowModal(false);
          await loadVariants();
        } else {
          showToast(data.error || 'Failed to update variant', 'error');
        }
      } else {
        // POST create
        const res = await fetch(`/api/products/${productId}/variants`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showToast(`Variant "${variantName}" created!`, 'success');
          setShowModal(false);
          await loadVariants();
        } else {
          showToast(data.error || 'Failed to create variant', 'error');
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Error saving variant', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete / Archive Variant
  const handleDeleteVariant = async (variant: ProductVariant) => {
    if (variants.length <= 1) {
      showToast('A product must have at least one variant.', 'error');
      return;
    }

    if (!confirm(`Are you sure you want to delete/archive "${variant.variantName}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/products/${productId}/variants/${variant.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || 'Variant removed', 'success');
        await loadVariants();
      } else {
        showToast(data.error || 'Failed to remove variant', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error deleting variant', 'error');
    }
  };

  // Toggle Variant Status
  const handleToggleStatus = async (variant: ProductVariant) => {
    try {
      const res = await fetch(`/api/products/${productId}/variants/${variant.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !variant.isActive }),
      });
      if (res.ok) {
        showToast(`Variant "${variant.variantName}" ${!variant.isActive ? 'activated' : 'deactivated'}`, 'info');
        await loadVariants();
      }
    } catch (_) {}
  };

  // Set Default Variant
  const handleSetDefault = async (variant: ProductVariant) => {
    if (variant.isDefault) return;
    try {
      const res = await fetch(`/api/products/${productId}/variants/${variant.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });
      if (res.ok) {
        showToast(`Default variant set to "${variant.variantName}"`, 'success');
        await loadVariants();
      }
    } catch (_) {}
  };

  // Reorder Variant Up / Down
  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= variants.length) return;

    const newVariants = [...variants];
    const temp = newVariants[index];
    newVariants[index] = newVariants[targetIndex];
    newVariants[targetIndex] = temp;

    // Assign new display orders
    const items = newVariants.map((v, idx) => ({
      id: v.id,
      displayOrder: idx + 1,
    }));

    setVariants(newVariants);

    try {
      const res = await fetch(`/api/products/${productId}/variants/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (res.ok) {
        showToast('Variant order updated', 'success');
      }
    } catch (_) {
      await loadVariants();
    }
  };

  return (
    <div className="space-y-4 pt-2">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
        <div>
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-600" />
            <span>Variants / Sizes / Weights ({variants.length})</span>
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Configure all available sizes, weights, flexible pricing & stock for {productName}.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAddModal}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-2xs flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Add Variant / Size</span>
        </button>
      </div>

      {/* Variants Table */}
      {variants.length === 0 ? (
        <div className="border border-dashed border-slate-200 rounded-2xl p-8 text-center space-y-2 bg-white">
          <Package className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-xs font-bold text-slate-700">No variants defined yet</p>
          <p className="text-[11px] text-slate-400">Click &ldquo;Add Variant / Size&rdquo; to add available sizes.</p>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-black text-[10px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-3.5">Order</th>
                <th className="py-3 px-3.5">Size / Weight</th>
                <th className="py-3 px-3.5">Selling Price</th>
                <th className="py-3 px-3.5">MRP</th>
                <th className="py-3 px-3.5">Stock</th>
                <th className="py-3 px-3.5">Status</th>
                <th className="py-3 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {variants.map((v, idx) => {
                const stock = v.stockQuantity !== undefined ? v.stockQuantity : v.stock || 0;
                const isLow = stock > 0 && stock <= (v.lowStockThreshold || 5);
                const isOut = stock === 0;

                return (
                  <tr
                    key={v.id}
                    className={`hover:bg-slate-50/60 transition-colors ${!v.isActive ? 'opacity-50 bg-slate-50/40' : ''}`}
                  >
                    {/* Order Controls */}
                    <td className="py-3 px-3.5">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveOrder(idx, 'up')}
                          className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-20 hover:bg-slate-100 rounded"
                          title="Move Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === variants.length - 1}
                          onClick={() => handleMoveOrder(idx, 'down')}
                          className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-20 hover:bg-slate-100 rounded"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* Size / Weight */}
                    <td className="py-3 px-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 text-xs">
                          {v.variantName}
                        </span>
                        {v.isDefault && (
                          <span className="bg-amber-100 text-amber-900 font-extrabold text-[9px] px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                            <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                            Default
                          </span>
                        )}
                      </div>
                      {v.sku && (
                        <span className="text-[10px] text-slate-400 font-mono block">
                          SKU: {v.sku}
                        </span>
                      )}
                    </td>

                    {/* Selling Price */}
                    <td className="py-3 px-3.5">
                      <span className="font-black text-slate-900 text-sm">
                        ₹{v.sellingPrice}
                      </span>
                    </td>

                    {/* MRP & Discount */}
                    <td className="py-3 px-3.5">
                      <span className="text-slate-400 line-through text-xs font-semibold">
                        ₹{v.mrp}
                      </span>
                      {v.mrp > v.sellingPrice && (
                        <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded ml-1.5 border border-emerald-100">
                          {Math.round(((v.mrp - v.sellingPrice) / v.mrp) * 100)}% OFF
                        </span>
                      )}
                    </td>

                    {/* Stock */}
                    <td className="py-3 px-3.5">
                      {isOut ? (
                        <span className="text-[10px] font-black uppercase text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                          Out of Stock (0)
                        </span>
                      ) : isLow ? (
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                          Only {stock} left
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-emerald-800">
                          {stock} in stock
                        </span>
                      )}
                    </td>

                    {/* Active Status */}
                    <td className="py-3 px-3.5">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(v)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors ${
                          v.isActive
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {v.isActive ? 'Active' : 'Disabled'}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {!v.isDefault && v.isActive && (
                          <button
                            type="button"
                            onClick={() => handleSetDefault(v)}
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg border border-slate-200 transition-colors"
                            title="Set as Default Variant"
                          >
                            <Star className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDuplicateVariant(v)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                          title="Duplicate Variant"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(v)}
                          className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg border border-slate-200 transition-colors"
                          title="Edit Variant"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteVariant(v)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 transition-colors"
                          title="Delete / Archive Variant"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── ADD / EDIT VARIANT MODAL ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-sm">
                    {editingVariant ? 'Edit Product Variant' : 'Add New Variant / Size'}
                  </h4>
                  <p className="text-[11px] text-slate-500">{productName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              {/* Row 1: Quantity Value & Unit Selector */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 mb-1 block">
                    Quantity / Numeric Value *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="e.g. 500, 1, 1.5, 6"
                    value={quantityValue}
                    onChange={(e) =>
                      handleValueOrUnitChange(e.target.value, quantityUnit, customUnit)
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-emerald-600"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 mb-1 block">
                    Unit Type *
                  </label>
                  <select
                    value={quantityUnit}
                    onChange={(e) =>
                      handleValueOrUnitChange(quantityValue, e.target.value, customUnit)
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-emerald-600"
                  >
                    {COMMON_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Custom Unit Field if selected */}
              {quantityUnit === 'custom' && (
                <div>
                  <label className="text-[11px] font-bold text-slate-700 mb-1 block">
                    Custom Unit Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. bunch, tray, pouch, bundle"
                    value={customUnit}
                    onChange={(e) =>
                      handleValueOrUnitChange(quantityValue, 'custom', e.target.value)
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-emerald-600"
                    required
                  />
                </div>
              )}

              {/* Variant Display Name Preview */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Display Label on Customer Store *</span>
                  <span className="text-[10px] text-emerald-600 font-normal">Auto-formatted</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 500 g, 1 kg, 6 pieces"
                  value={variantName}
                  onChange={(e) => setVariantName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-emerald-600"
                  required
                />
              </div>

              {/* Row 2: Selling Price & MRP */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 mb-1 block">
                    Selling Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 85.00"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-black text-sm focus:bg-white focus:outline-none focus:border-emerald-600"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 mb-1 block">
                    MRP (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 100.00"
                    value={mrp}
                    onChange={(e) => setMrp(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-emerald-600"
                    required
                  />
                </div>
              </div>

              {/* Row 3: Stock Quantity & Low Stock Alert */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 mb-1 block">
                    Available Stock (Units) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="20"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-emerald-600"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 mb-1 block">
                    Low Stock Threshold
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="5"
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Row 4: SKU & Barcode (Optional) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 mb-1 block">
                    SKU (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Auto-generated if blank"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-mono text-xs focus:bg-white focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 mb-1 block">
                    Barcode (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="EAN-13 / UPC"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-mono text-xs focus:bg-white focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Toggles: Is Default & Is Active */}
              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    Pre-select as Default Variant
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    Active for Customer Purchase
                  </span>
                </label>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{editingVariant ? 'Save Changes' : 'Create Variant'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
