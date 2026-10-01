'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  PromotionOffer,
  OfferType,
  OfferStatus,
  StackingRule,
  FestivalName,
  TierConfig,
  DEFAULT_ACTIVE_OFFERS,
} from '@/lib/promotionsEngine';
import { useAppStore } from '@/lib/store';
import { showToast } from '@/components/ui/Toast';
import {
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ShoppingBag,
  Tag,
  Gift,
  Truck,
  Percent,
  Layers,
  Calendar,
  Clock,
  Eye,
  Sliders,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Boxes,
} from 'lucide-react';

interface CreateOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialOffer?: PromotionOffer | null;
  onSave: (offer: PromotionOffer) => void;
}

const FESTIVAL_LIST: FestivalName[] = [
  'Holi',
  'Diwali',
  'Dussehra',
  'Ganesh Chaturthi',
  'Navratri',
  'Raksha Bandhan',
  'Christmas',
  'New Year',
  'Eid',
  'Independence Day',
  'Republic Day',
  'Makar Sankranti',
  'Onam',
  'Pongal',
  'Easter',
  'Akshaya Tritiya',
  'Custom',
];

export function CreateOfferModal({
  isOpen,
  onClose,
  initialOffer,
  onSave,
}: CreateOfferModalProps) {
  const { products, categories } = useAppStore();

  const [formData, setFormData] = useState<Partial<PromotionOffer>>(() => {
    if (initialOffer) return { ...initialOffer };
    return {
      id: `off-${Date.now()}`,
      name: '',
      internalName: '',
      customerTitle: '',
      description: '',
      bannerImage: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80',
      offerType: 'PERCENTAGE',
      status: 'ACTIVE',
      priority: 1,
      stackingRule: 'ALLOW',
      minCartValue: 499,
      discountValue: 15,
      maxDiscount: 100,
      buyQuantity: 1,
      rewardQuantity: 1,
      startDate: new Date().toISOString().split('T')[0] + 'T00:00:00.000Z',
      endDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0] + 'T23:59:59.000Z',
      fallbackAction: 'REMOVE_REWARD',
    };
  });

  const [customFestivalName, setCustomFestivalName] = useState('');
  const [activeStep, setActiveStep] = useState<'BUILDER' | 'PREVIEW' | 'VALIDATION'>('BUILDER');

  useEffect(() => {
    if (isOpen) {
      if (initialOffer) {
        setFormData({ ...initialOffer });
      } else {
        setFormData({
          id: `off-${Date.now()}`,
          name: '',
          internalName: '',
          customerTitle: '',
          description: '',
          bannerImage: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80',
          offerType: 'PERCENTAGE',
          status: 'ACTIVE',
          priority: 1,
          stackingRule: 'ALLOW',
          minCartValue: 499,
          discountValue: 15,
          maxDiscount: 100,
          buyQuantity: 1,
          rewardQuantity: 1,
          startDate: new Date().toISOString().split('T')[0] + 'T00:00:00.000Z',
          endDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0] + 'T23:59:59.000Z',
          fallbackAction: 'REMOVE_REWARD',
        });
      }
      setActiveStep('BUILDER');
    }
  }, [isOpen, initialOffer]);

  // Real-time pre-publish validation checks
  const validationResults = useMemo(() => {
    const checks: Array<{ label: string; passed: boolean; message: string }> = [];

    // 1. Title & Names
    const hasTitles = !!(formData.name?.trim() && formData.customerTitle?.trim());
    checks.push({
      label: 'Offer & Customer Titles',
      passed: hasTitles,
      message: hasTitles ? 'Valid offer and customer-facing titles' : 'Offer name and customer title are required.',
    });

    // 2. Dates
    const start = new Date(formData.startDate || '');
    const end = new Date(formData.endDate || '');
    const validDates = !isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start;
    checks.push({
      label: 'Validity Period',
      passed: validDates,
      message: validDates ? `Valid range: ${start.toLocaleDateString()} to ${end.toLocaleDateString()}` : 'End date must be after start date.',
    });

    // 3. Discount / Reward Value
    let validReward = true;
    let rewardMsg = 'Reward configuration is valid.';
    if (formData.offerType === 'PERCENTAGE' || formData.offerType === 'FIXED') {
      if (!formData.discountValue || formData.discountValue <= 0) {
        validReward = false;
        rewardMsg = 'Discount value must be greater than zero.';
      }
    } else if (formData.offerType === 'FREE_PRODUCT_ABOVE_X') {
      if (!formData.rewardProductId) {
        validReward = false;
        rewardMsg = 'Please select a reward free product.';
      } else {
        const prod = products.find((p) => p.id === formData.rewardProductId);
        if (!prod || (prod.stock ?? 0) <= 0) {
          rewardMsg = 'Warning: Selected reward product has 0 inventory stock.';
        }
      }
    } else if (formData.offerType === 'BOGO' || formData.offerType === 'BUY_X_GET_Y') {
      if (!formData.buyProductId) {
        validReward = false;
        rewardMsg = 'Please select an eligible buy product.';
      }
    }

    checks.push({
      label: 'Reward & Condition Rules',
      passed: validReward,
      message: rewardMsg,
    });

    // 4. Stacking Rule
    checks.push({
      label: 'Stacking Policy',
      passed: !!formData.stackingRule,
      message: `Stacking policy configured: ${formData.stackingRule || 'ALLOW'}`,
    });

    const isAllPassed = checks.every((c) => c.passed);
    return { checks, isAllPassed };
  }, [formData, products]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validationResults.isAllPassed) {
      showToast('Please resolve validation errors before publishing.', 'error');
      setActiveStep('VALIDATION');
      return;
    }

    const offerToSave: PromotionOffer = {
      ...formData,
      id: formData.id || `off-${Date.now()}`,
      name: formData.name || 'Special Offer',
      customerTitle: formData.customerTitle || formData.name || 'Special Offer',
      offerType: formData.offerType || 'PERCENTAGE',
      status: formData.status || 'ACTIVE',
      priority: Number(formData.priority) || 1,
      stackingRule: formData.stackingRule || 'ALLOW',
      startDate: formData.startDate || new Date().toISOString(),
      endDate: formData.endDate || new Date(Date.now() + 30 * 86400000).toISOString(),
    } as PromotionOffer;

    onSave(offerToSave);
    showToast(`Offer "${offerToSave.customerTitle}" published successfully!`, 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">
                {initialOffer ? 'Edit Promotion Offer' : 'Create New Promotion / Offer'}
              </h2>
              <p className="text-xs text-slate-400">
                Visual Rule Builder: WHEN ➔ CONDITION ➔ THEN ➔ REWARD
              </p>
            </div>
          </div>

          {/* Stepper Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveStep('BUILDER')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeStep === 'BUILDER'
                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Rule Builder
            </button>
            <button
              type="button"
              onClick={() => setActiveStep('PREVIEW')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeStep === 'PREVIEW'
                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Live Preview
            </button>
            <button
              type="button"
              onClick={() => setActiveStep('VALIDATION')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeStep === 'VALIDATION'
                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
                  : validationResults.isAllPassed
                  ? 'text-emerald-400 hover:text-emerald-300'
                  : 'text-amber-400 hover:text-amber-300'
              }`}
            >
              {validationResults.isAllPassed ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              )}
              Validation
            </button>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeStep === 'BUILDER' && (
            <form id="offer-form" onSubmit={handleSave} className="space-y-6">
              
              {/* 1. Basic Metadata */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-4">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">
                  1. Offer Identity & Festival Targeting
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Offer Name (Internal Admin) *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Holi Free Biscuit Pack Above ₹500"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl p-3 font-medium text-slate-900 focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Customer-Facing Title *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 🎨 Holi Special: Free Biscuit Pack above ₹500"
                      value={formData.customerTitle || ''}
                      onChange={(e) => setFormData({ ...formData, customerTitle: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl p-3 font-medium text-slate-900 focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Festival Campaign (Optional)
                    </label>
                    <select
                      value={formData.festivalName || ''}
                      onChange={(e) => setFormData({ ...formData, festivalName: e.target.value as FestivalName })}
                      className="w-full bg-white border border-slate-200 rounded-xl p-3 font-medium text-slate-900 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">-- No Festival (General Campaign) --</option>
                      {FESTIVAL_LIST.map((fest) => (
                        <option key={fest} value={fest}>{fest}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Banner / Image URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://images.unsplash.com/..."
                      value={formData.bannerImage || ''}
                      onChange={(e) => setFormData({ ...formData, bannerImage: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl p-3 font-medium text-slate-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Visual Rule Builder: WHEN ➔ CONDITION ➔ THEN ➔ REWARD */}
              <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-200 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-emerald-600" />
                    2. Visual Rule Composer (WHEN ➔ CONDITION ➔ THEN ➔ REWARD)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="font-bold text-slate-800 block mb-1">
                      Offer Type / Rule Engine *
                    </label>
                    <select
                      value={formData.offerType}
                      onChange={(e) => setFormData({ ...formData, offerType: e.target.value as OfferType })}
                      className="w-full bg-white border border-emerald-300 rounded-xl p-3 font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="PERCENTAGE">Percentage Discount (% OFF)</option>
                      <option value="FIXED">Fixed Amount Discount (₹ OFF)</option>
                      <option value="BOGO">Buy 1 Get 1 Free (BOGO)</option>
                      <option value="BUY_X_GET_Y">Buy X Get Y (Cross-Product Bundle)</option>
                      <option value="FREE_PRODUCT_ABOVE_X">Free Product Above Order Value</option>
                      <option value="TIERED_CART">Tiered Order Value Savings (₹500/₹999/₹1499)</option>
                      <option value="FREE_DELIVERY">Free Delivery Offer</option>
                      <option value="CATEGORY_DISCOUNT">Category-Specific Discount</option>
                      <option value="PRODUCT_DISCOUNT">Direct Product Discount</option>
                      <option value="FIRST_ORDER">First Order Exclusive Discount</option>
                      <option value="WIN_BACK">Win-Back Inactive Customer Offer</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-800 block mb-1">
                      Minimum Cart Subtotal Threshold (₹)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 499"
                      value={formData.minCartValue ?? ''}
                      onChange={(e) => setFormData({ ...formData, minCartValue: Number(e.target.value) })}
                      className="w-full bg-white border border-emerald-300 rounded-xl p-3 font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Dynamic Fields Based on Type */}
                  {(formData.offerType === 'PERCENTAGE' || formData.offerType === 'CATEGORY_DISCOUNT') && (
                    <>
                      <div>
                        <label className="font-bold text-slate-800 block mb-1">
                          Discount Percentage (%) *
                        </label>
                        <input
                          type="number"
                          placeholder="e.g. 15"
                          value={formData.discountValue ?? ''}
                          onChange={(e) => setFormData({ ...formData, discountValue: Number(e.target.value) })}
                          className="w-full bg-white border border-emerald-300 rounded-xl p-3 font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-800 block mb-1">
                          Maximum Discount Cap (₹)
                        </label>
                        <input
                          type="number"
                          placeholder="e.g. 150"
                          value={formData.maxDiscount ?? ''}
                          onChange={(e) => setFormData({ ...formData, maxDiscount: Number(e.target.value) })}
                          className="w-full bg-white border border-emerald-300 rounded-xl p-3 font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </>
                  )}

                  {formData.offerType === 'FIXED' && (
                    <div>
                      <label className="font-bold text-slate-800 block mb-1">
                        Flat Discount Amount (₹) *
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 100"
                        value={formData.discountValue ?? ''}
                        onChange={(e) => setFormData({ ...formData, discountValue: Number(e.target.value) })}
                        className="w-full bg-white border border-emerald-300 rounded-xl p-3 font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                        required
                      />
                    </div>
                  )}

                  {formData.offerType === 'CATEGORY_DISCOUNT' && (
                    <div>
                      <label className="font-bold text-slate-800 block mb-1">
                        Applicable Category *
                      </label>
                      <select
                        value={formData.categoryId || ''}
                        onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                        className="w-full bg-white border border-emerald-300 rounded-xl p-3 font-medium text-slate-900 focus:outline-none focus:border-emerald-500"
                        required
                      >
                        <option value="">-- Select Category --</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {(formData.offerType === 'BOGO' || formData.offerType === 'BUY_X_GET_Y' || formData.offerType === 'PRODUCT_DISCOUNT') && (
                    <>
                      <div>
                        <label className="font-bold text-slate-800 block mb-1">
                          Eligible Buy Product *
                        </label>
                        <select
                          value={formData.buyProductId || ''}
                          onChange={(e) => setFormData({ ...formData, buyProductId: e.target.value })}
                          className="w-full bg-white border border-emerald-300 rounded-xl p-3 font-medium text-slate-900 focus:outline-none focus:border-emerald-500"
                          required
                        >
                          <option value="">-- Select Product --</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>{p.name} (₹{p.sellingPrice})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="font-bold text-slate-800 block mb-1">
                          Buy Quantity
                        </label>
                        <input
                          type="number"
                          value={formData.buyQuantity || 1}
                          onChange={(e) => setFormData({ ...formData, buyQuantity: Number(e.target.value) })}
                          className="w-full bg-white border border-emerald-300 rounded-xl p-3 font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </>
                  )}

                  {formData.offerType === 'FREE_PRODUCT_ABOVE_X' && (
                    <>
                      <div>
                        <label className="font-bold text-slate-800 block mb-1">
                          Free Gift Product *
                        </label>
                        <select
                          value={formData.rewardProductId || ''}
                          onChange={(e) => {
                            const p = products.find((prod) => prod.id === e.target.value);
                            setFormData({
                              ...formData,
                              rewardProductId: e.target.value,
                              rewardProductName: p?.name,
                            });
                          }}
                          className="w-full bg-white border border-emerald-300 rounded-xl p-3 font-medium text-slate-900 focus:outline-none focus:border-emerald-500"
                          required
                        >
                          <option value="">-- Select Free Gift Item --</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} (Stock: {p.stock ?? 50})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="font-bold text-slate-800 block mb-1">
                          Out-of-Stock Fallback Action
                        </label>
                        <select
                          value={formData.fallbackAction || 'REMOVE_REWARD'}
                          onChange={(e) => setFormData({ ...formData, fallbackAction: e.target.value as any })}
                          className="w-full bg-white border border-emerald-300 rounded-xl p-3 font-medium text-slate-900 focus:outline-none focus:border-emerald-500"
                        >
                          <option value="REMOVE_REWARD">Gracefully Remove Free Gift</option>
                          <option value="ALTERNATE_PRODUCT">Offer Alternate Free Product</option>
                          <option value="DISABLE_CAMPAIGN">Temporarily Disable Campaign</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* 3. Stacking & Priority Controls */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-4">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">
                  3. Stacking Policy, Priority & Schedule
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Offer Stacking Rule
                    </label>
                    <select
                      value={formData.stackingRule || 'ALLOW'}
                      onChange={(e) => setFormData({ ...formData, stackingRule: e.target.value as StackingRule })}
                      className="w-full bg-white border border-slate-200 rounded-xl p-3 font-medium text-slate-900 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="ALLOW">ALLOW (Can combine with coupons)</option>
                      <option value="DENY">DENY (Exclusive offer, highest discount only)</option>
                      <option value="BEST_DISCOUNT">BEST_DISCOUNT (Auto-select highest value)</option>
                      <option value="PRIORITY_FIRST">PRIORITY_FIRST (Evaluate by priority index)</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Priority (1 = Highest)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={formData.priority || 1}
                      onChange={(e) => setFormData({ ...formData, priority: Number(e.target.value) })}
                      className="w-full bg-white border border-slate-200 rounded-xl p-3 font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Status
                    </label>
                    <select
                      value={formData.status || 'ACTIVE'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as OfferStatus })}
                      className="w-full bg-white border border-slate-200 rounded-xl p-3 font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="ACTIVE">ACTIVE (Live in Store)</option>
                      <option value="SCHEDULED">SCHEDULED (Upcoming)</option>
                      <option value="PAUSED">PAUSED (Temporarily On Hold)</option>
                      <option value="DRAFT">DRAFT</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Start Date & Time *
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.startDate ? formData.startDate.slice(0, 16) : ''}
                      onChange={(e) => setFormData({ ...formData, startDate: new Date(e.target.value).toISOString() })}
                      className="w-full bg-white border border-slate-200 rounded-xl p-3 font-medium text-slate-900 focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      End Date & Time *
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.endDate ? formData.endDate.slice(0, 16) : ''}
                      onChange={(e) => setFormData({ ...formData, endDate: new Date(e.target.value).toISOString() })}
                      className="w-full bg-white border border-slate-200 rounded-xl p-3 font-medium text-slate-900 focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>
                </div>
              </div>

            </form>
          )}

          {activeStep === 'PREVIEW' && (
            <div className="space-y-6">
              <div className="text-center max-w-md mx-auto space-y-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600 block">
                  Customer App & Web Live Preview
                </span>
                <p className="text-xs text-slate-500">
                  This is how the interactive promotional card will appear in the customer feed and cart drawer.
                </p>
              </div>

              {/* Customer Offer Card Mockup */}
              <div className="max-w-md mx-auto bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white p-6 rounded-3xl shadow-xl border border-emerald-500/30 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
                
                <div className="flex items-center justify-between mb-4">
                  <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase px-2.5 py-1 rounded-full border border-emerald-500/30">
                    {formData.festivalName ? `🎉 ${formData.festivalName} Special` : '🔥 Limited Deal'}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Min Order: ₹{formData.minCartValue || 0}
                  </span>
                </div>

                <h3 className="text-lg font-black text-white tracking-tight">
                  {formData.customerTitle || 'Special Promotion Offer'}
                </h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  {formData.description || 'Exclusive savings valid on your next PocketKirana order.'}
                </p>

                {/* Reward Callout */}
                <div className="mt-4 p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Gift className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-white block">
                        {formData.offerType === 'FREE_PRODUCT_ABOVE_X'
                          ? `Free ${formData.rewardProductName || 'Gift Pack'}`
                          : formData.offerType === 'PERCENTAGE'
                          ? `${formData.discountValue}% Instant OFF`
                          : formData.offerType === 'FIXED'
                          ? `₹${formData.discountValue} Flat OFF`
                          : 'Special Reward'}
                      </span>
                      <span className="text-[10px] text-emerald-300">
                        {formData.stackingRule === 'ALLOW' ? 'Stackable with coupons' : 'Exclusive single discount'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="bg-emerald-500 text-slate-950 px-3.5 py-1.5 rounded-xl font-black text-xs shadow-md"
                  >
                    SHOP NOW
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeStep === 'VALIDATION' && (
            <div className="space-y-4 max-w-xl mx-auto">
              <div className="text-center space-y-1">
                <h3 className="font-black text-slate-900 text-base">
                  Pre-Publish Offer Quality Audit
                </h3>
                <p className="text-xs text-slate-500">
                  Every condition is verified against live inventory and catalog integrity rules.
                </p>
              </div>

              <div className="space-y-2.5">
                {validationResults.checks.map((c, i) => (
                  <div
                    key={i}
                    className={`p-4 rounded-2xl border flex items-start gap-3 transition-all ${
                      c.passed
                        ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                        : 'bg-amber-50/60 border-amber-200 text-amber-900'
                    }`}
                  >
                    {c.passed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className="font-bold text-xs block">{c.label}</span>
                      <span className="text-[11px] opacity-90">{c.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="bg-slate-50 p-5 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {activeStep !== 'BUILDER' && (
              <button
                type="button"
                onClick={() => setActiveStep('BUILDER')}
                className="px-4 py-2.5 bg-slate-200 text-slate-800 font-bold rounded-xl text-xs hover:bg-slate-300 transition-colors"
              >
                Back to Builder
              </button>
            )}

            {activeStep === 'BUILDER' && (
              <button
                type="button"
                onClick={() => setActiveStep('PREVIEW')}
                className="px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl text-xs hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5"
              >
                <span>Preview & Verify</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="submit"
              form="offer-form"
              onClick={handleSave}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs shadow-md transition-all active:scale-95 inline-flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{initialOffer ? 'Save Changes' : 'Publish Offer'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
