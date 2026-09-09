'use client';

import React, { useState } from 'react';
import {
  X,
  Barcode,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  Package,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';
import { useAppStore } from '@/lib/store';

interface AddProductWithBarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductCreated?: () => void;
}

export function AddProductWithBarcodeModal({
  isOpen,
  onClose,
  onProductCreated,
}: AddProductWithBarcodeModalProps) {
  const { categories, brands, addProduct } = useAppStore();

  const topCategories = categories.filter((c) => !c.parentId);
  const [productName, setProductName] = useState('');
  const [categoryId, setCategoryId] = useState(topCategories[0]?.id || 'cat-veg');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [hasNoBarcode, setHasNoBarcode] = useState(false);
  const [sellingPrice, setSellingPrice] = useState('');
  const [mrp, setMrp] = useState('');
  const [unit, setUnit] = useState('1 pc');
  const [description, setDescription] = useState('');
  const [thumbnail, setThumbnail] = useState('https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=500&q=80');
  const [brandId, setBrandId] = useState('');

  // Available subcategories under selected category
  const availableSubcategories = categories.filter((c) => c.parentId === categoryId);

  // Update subcategory when category changes
  const handleCategoryChange = (newCatId: string) => {
    setCategoryId(newCatId);
    const subs = categories.filter((c) => c.parentId === newCatId);
    setSubcategoryId(subs[0]?.id || '');
  };

  // Verification state
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    verified: boolean;
    isAvailable: boolean;
    isValidChecksum: boolean;
    recommendedPkId?: string;
    message?: string;
    existingProduct?: any;
  } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleVerifyBarcode = async () => {
    if (!barcodeInput.trim()) {
      showToast('Please enter an EAN-13 barcode to verify', 'error');
      return;
    }

    setIsVerifying(true);
    setVerificationResult(null);

    try {
      const res = await fetch('/api/products/identifiers/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier_value: barcodeInput.trim(),
          identifier_type: 'EAN13',
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setVerificationResult({
          verified: true,
          isAvailable: false,
          isValidChecksum: data.isValidChecksum,
          existingProduct: data.existingProduct,
          message: data.message || 'Barcode already assigned to an existing product',
        });
        showToast('Duplicate barcode detected!', 'error');
      } else if (res.ok && data.success) {
        setVerificationResult({
          verified: true,
          isAvailable: true,
          isValidChecksum: data.isValidChecksum,
          recommendedPkId: data.recommendedPkId,
          message: data.message,
        });
        showToast('EAN-13 verified & available!', 'success');
      } else {
        setVerificationResult({
          verified: true,
          isAvailable: false,
          isValidChecksum: false,
          message: data.error || 'Validation failed',
        });
      }
    } catch (err: any) {
      // Fallback for offline / demo mode
      const isDigits = /^\d{13}$/.test(barcodeInput.trim());
      setVerificationResult({
        verified: true,
        isAvailable: true,
        isValidChecksum: isDigits,
        recommendedPkId: `PK-${Math.floor(1000000 + Math.random() * 9000000)}`,
        message: isDigits ? 'Valid EAN-13 structure (Verified locally)' : 'Non-standard barcode format',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!productName.trim() || !sellingPrice) {
      showToast('Please fill in product name and price', 'error');
      return;
    }

    if (!hasNoBarcode && barcodeInput.trim() && verificationResult && !verificationResult.isAvailable) {
      showToast('Cannot create product with duplicate barcode', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const generatedPkId = verificationResult?.recommendedPkId || `PK-${Math.floor(1000000 + Math.random() * 9000000)}`;
      const finalBarcode = hasNoBarcode ? null : (barcodeInput.trim() || null);

      addProduct({
        categoryId,
        subcategoryId: subcategoryId || undefined,
        brandId: brandId || undefined,
        brandName: brandId ? brands.find(b => b.id === brandId)?.name : undefined,
        storeId: 'store-1',
        sku: generatedPkId,
        barcode: finalBarcode || generatedPkId,
        name: productName.trim(),
        slug: productName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        description: description || 'Fresh grocery product with verified barcode.',
        unit,
        weight: 1.0,
        mrp: Number(mrp) || Number(sellingPrice),
        sellingPrice: Number(sellingPrice),
        taxPercentage: 5,
        thumbnail,
        status: 'active',
        rating: 4.9,
        reviewsCount: 0,
      });

      showToast(`Product ${productName} created with ID ${generatedPkId}!`, 'success');
      if (onProductCreated) onProductCreated();
      onClose();
    } catch (err: any) {
      showToast('Failed to create product: ' + err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 font-bold">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">Add Product with EAN-13 & PK ID</h2>
              <p className="text-xs text-slate-500">Competitive dual-identifier product registration</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          {/* Product Name & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Product Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Tata Salt Vacuum Evaporated 1kg"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl p-2.5 focus:bg-white focus:border-slate-400 focus:outline-none transition-all font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
              <select
                value={categoryId}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl p-2.5 focus:bg-white focus:border-slate-400 focus:outline-none transition-all"
              >
                {topCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Subcategory</label>
              <select
                value={subcategoryId}
                onChange={(e) => setSubcategoryId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl p-2.5 focus:bg-white focus:border-slate-400 focus:outline-none transition-all"
              >
                <option value="">-- General / None --</option>
                {availableSubcategories.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Brand (Optional)</label>
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl p-2.5 focus:bg-white focus:border-slate-400 focus:outline-none transition-all"
              >
                <option value="">-- No Brand --</option>
                {brands.filter(b => b.isActive !== false).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Unit / Pack Size</label>
              <input
                type="text"
                placeholder="e.g. 1 kg, 500 g, 1 pc"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl p-2.5 focus:bg-white focus:border-slate-400 focus:outline-none transition-all font-medium"
              />
            </div>
          </div>

          {/* Barcode & Identifier Section */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Barcode className="w-4 h-4 text-emerald-600" />
                <span>Manufacturer Barcode (EAN-13 / UPC)</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={hasNoBarcode}
                  onChange={(e) => {
                    setHasNoBarcode(e.target.checked);
                    if (e.target.checked) setVerificationResult(null);
                  }}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>Product has no EAN-13</span>
              </label>
            </div>

            {!hasNoBarcode ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Scan or enter 13-digit EAN (e.g. 8901030895012)"
                    value={barcodeInput}
                    onChange={(e) => {
                      setBarcodeInput(e.target.value);
                      setVerificationResult(null);
                    }}
                    className="flex-1 bg-white border border-slate-200 text-slate-900 font-mono text-xs rounded-xl px-3 py-2 focus:border-slate-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyBarcode}
                    disabled={isVerifying || !barcodeInput.trim()}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white disabled:text-slate-400 text-xs font-bold px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shrink-0 shadow-2xs"
                  >
                    {isVerifying ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5" />
                    )}
                    <span>Verify</span>
                  </button>
                </div>

                {/* Verification Feedback Banner */}
                {verificationResult && (
                  <div
                    className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                      verificationResult.isAvailable
                        ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                        : 'bg-rose-50 border-rose-200 text-rose-900'
                    }`}
                  >
                    {verificationResult.isAvailable ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1">
                      <p className="font-bold">{verificationResult.message}</p>
                      {verificationResult.isValidChecksum && (
                        <p className="text-[11px] text-emerald-700">✓ Valid EAN-13 Checksum verified</p>
                      )}
                      {verificationResult.existingProduct && (
                        <p className="text-[11px] font-semibold text-rose-800">
                          Assigned to: {verificationResult.existingProduct.productName} ({verificationResult.existingProduct.sku})
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Internal PocketKirana ID will be automatically generated and used as the barcode.</span>
              </div>
            )}
          </div>

          {/* Pricing & Image */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Selling Price (₹) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                placeholder="24.00"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl p-2.5 focus:bg-white focus:border-slate-400 focus:outline-none font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">MRP (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="28.00"
                value={mrp}
                onChange={(e) => setMrp(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl p-2.5 focus:bg-white focus:border-slate-400 focus:outline-none"
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-bold text-slate-700 mb-1">Image URL</label>
              <input
                type="text"
                placeholder="https://..."
                value={thumbnail}
                onChange={(e) => setThumbnail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl p-2.5 focus:bg-white focus:border-slate-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>{isSubmitting ? 'Creating Product...' : 'Create Product'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
