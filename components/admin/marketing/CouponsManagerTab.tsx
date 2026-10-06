'use client';

import React, { useState } from 'react';
import { CouponRule, TierConfig } from '@/lib/promotionsEngine';
import { showToast } from '@/components/ui/Toast';
import {
  Tag,
  Plus,
  Search,
  Copy,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Percent,
  X,
  Sliders,
  Check,
} from 'lucide-react';

interface CouponsManagerTabProps {
  coupons: CouponRule[];
  onAddCoupon: (coupon: CouponRule) => void;
  onDeleteCoupon: (id: string) => void;
  onToggleCouponStatus: (id: string, active: boolean) => void;
}

export function CouponsManagerTab({
  coupons,
  onAddCoupon,
  onDeleteCoupon,
  onToggleCouponStatus,
}: CouponsManagerTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<CouponRule>>({
    code: '',
    type: 'FIXED',
    value: 100,
    minimumOrder: 499,
    maxDiscount: 100,
    usageLimit: 5000,
    perCustomerLimit: 1,
    isFirstOrderOnly: false,
    startDate: new Date().toISOString().split('T')[0] + 'T00:00:00.000Z',
    endDate: new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0] + 'T23:59:59.000Z',
    isActive: true,
  });

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    showToast(`Coupon code ${code} copied!`, 'success');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleSaveCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code?.trim()) {
      showToast('Coupon code is required.', 'error');
      return;
    }

    const cleanCode = formData.code.trim().toUpperCase();
    if (coupons.some((c) => c.code.toUpperCase() === cleanCode)) {
      showToast(`Coupon code "${cleanCode}" already exists.`, 'error');
      return;
    }

    const newCoupon: CouponRule = {
      id: `c-${cleanCode.toLowerCase()}-${Date.now()}`,
      code: cleanCode,
      type: formData.type || 'FIXED',
      value: Number(formData.value) || 0,
      minimumOrder: Number(formData.minimumOrder) || 0,
      maxDiscount: formData.maxDiscount ? Number(formData.maxDiscount) : undefined,
      usageLimit: Number(formData.usageLimit) || 1000,
      perCustomerLimit: Number(formData.perCustomerLimit) || 1,
      usedCount: 0,
      isFirstOrderOnly: !!formData.isFirstOrderOnly,
      startDate: formData.startDate || new Date().toISOString(),
      endDate: formData.endDate || new Date(Date.now() + 60 * 86400000).toISOString(),
      isActive: true,
    };

    onAddCoupon(newCoupon);
    showToast(`Coupon ${cleanCode} created successfully!`, 'success');
    setShowCreateModal(false);
    setFormData({
      code: '',
      type: 'FIXED',
      value: 100,
      minimumOrder: 499,
      maxDiscount: 100,
      usageLimit: 5000,
      perCustomerLimit: 1,
      isFirstOrderOnly: false,
      startDate: new Date().toISOString().split('T')[0] + 'T00:00:00.000Z',
      endDate: new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0] + 'T23:59:59.000Z',
      isActive: true,
    });
  };

  const filteredCoupons = coupons.filter((c) => {
    if (searchTerm.trim()) {
      return c.code.toLowerCase().includes(searchTerm.toLowerCase());
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* ── HEADER TOOLBAR ── */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Tag className="w-5 h-5 text-emerald-600" />
            <span>Coupon Codes &amp; Vouchers</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Configure unique promo codes with per-customer redemption caps and first-order restrictions.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-5 py-3 rounded-2xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Create Coupon</span>
        </button>
      </div>

      {/* ── SEARCH BAR ── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search coupon code (e.g. WELCOME100)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* ── COUPONS GRID ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCoupons.map((coupon) => (
          <div
            key={coupon.id}
            className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4 hover:border-emerald-300 transition-all flex flex-col justify-between"
          >
            <div>
              {/* Top Code Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-sm text-slate-950 bg-slate-100 border border-dashed border-slate-300 px-3 py-1 rounded-xl tracking-wider">
                    {coupon.code}
                  </span>
                  <button
                    onClick={() => handleCopy(coupon.code)}
                    className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                    title="Copy code"
                  >
                    {copiedCode === coupon.code ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                  coupon.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                }`}>
                  {coupon.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Discount Details */}
              <div className="mt-3 space-y-1">
                <h4 className="font-black text-slate-900 text-base">
                  {coupon.type === 'PERCENTAGE' ? `${coupon.value}% OFF` : `₹${coupon.value} FLAT OFF`}
                </h4>
                <p className="text-xs text-slate-500">
                  Min Cart: <span className="font-bold text-slate-700">₹{coupon.minimumOrder}</span>
                  {coupon.maxDiscount && (
                    <span> • Max Discount: <span className="font-bold text-slate-700">₹{coupon.maxDiscount}</span></span>
                  )}
                </p>
              </div>

              {/* Limits & First-Order tags */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {coupon.isFirstOrderOnly && (
                  <span className="text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md">
                    First Order Only
                  </span>
                )}
                <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                  Limit: {coupon.perCustomerLimit || 1}/user
                </span>
                <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                  Used: {coupon.usedCount || 0} times
                </span>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-400 font-medium">
                Valid till {new Date(coupon.endDate).toLocaleDateString()}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onToggleCouponStatus(coupon.id, !coupon.isActive)}
                  className="px-2.5 py-1 rounded-lg font-bold text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                >
                  {coupon.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => onDeleteCoupon(coupon.id)}
                  className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── CREATE COUPON MODAL ── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-slate-900 text-base">Create Coupon Voucher</h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCoupon} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Coupon Code *</label>
                <input
                  type="text"
                  placeholder="e.g. FESTIVE50"
                  value={formData.code || ''}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-500 uppercase"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Discount Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="FIXED">Flat (₹)</option>
                    <option value="PERCENTAGE">Percentage (%)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Discount Value *</label>
                  <input
                    type="number"
                    placeholder="e.g. 100"
                    value={formData.value ?? ''}
                    onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Minimum Order (₹) *</label>
                  <input
                    type="number"
                    placeholder="e.g. 499"
                    value={formData.minimumOrder ?? ''}
                    onChange={(e) => setFormData({ ...formData, minimumOrder: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Max Discount Cap (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 150"
                    value={formData.maxDiscount ?? ''}
                    onChange={(e) => setFormData({ ...formData, maxDiscount: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Per-Customer Limit</label>
                  <input
                    type="number"
                    value={formData.perCustomerLimit || 1}
                    onChange={(e) => setFormData({ ...formData, perCustomerLimit: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Total Campaign Cap</label>
                  <input
                    type="number"
                    value={formData.usageLimit || 1000}
                    onChange={(e) => setFormData({ ...formData, usageLimit: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer p-2 bg-slate-50 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  checked={!!formData.isFirstOrderOnly}
                  onChange={(e) => setFormData({ ...formData, isFirstOrderOnly: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span className="font-bold text-slate-700 text-xs">First Order Customers Only</span>
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-black shadow-sm"
                >
                  Save Coupon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
