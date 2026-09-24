'use client';

import React, { useState } from 'react';
import { PromotionOffer } from '@/lib/promotionsEngine';
import { useAppStore } from '@/lib/store';
import { showToast } from '@/components/ui/Toast';
import {
  Boxes,
  Plus,
  Trash2,
  CheckCircle2,
  Sparkles,
  ShoppingBag,
  ArrowRight,
  Gift,
} from 'lucide-react';

interface BogoOffersTabProps {
  offers: PromotionOffer[];
  onAddOffer: (offer: PromotionOffer) => void;
  onDeleteOffer: (id: string) => void;
}

export function BogoOffersTab({ offers, onAddOffer, onDeleteOffer }: BogoOffersTabProps) {
  const { products } = useAppStore();
  const [showModal, setShowModal] = useState(false);

  const [buyProdId, setBuyProdId] = useState(products[0]?.id || '');
  const [buyQty, setBuyQty] = useState(1);
  const [rewardProdId, setRewardProdId] = useState(products[0]?.id || '');
  const [rewardQty, setRewardQty] = useState(1);
  const [maxReps, setMaxReps] = useState(3);
  const [customTitle, setCustomTitle] = useState('');

  const bogoOffers = offers.filter((o) => o.offerType === 'BOGO' || o.offerType === 'BUY_X_GET_Y');

  const handleCreateBogo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyProdId || !rewardProdId) {
      showToast('Please select buy and reward products.', 'error');
      return;
    }

    const buyProd = products.find((p) => p.id === buyProdId);
    const rewardProd = products.find((p) => p.id === rewardProdId);

    const isSameProd = buyProdId === rewardProdId;
    const title = customTitle.trim() || (isSameProd
      ? `Buy ${buyQty} Get ${rewardQty} Free on ${buyProd?.name || 'Item'}`
      : `Buy ${buyQty} ${buyProd?.name} & Get ${rewardQty} ${rewardProd?.name} FREE`);

    const newOffer: PromotionOffer = {
      id: `bogo-${Date.now()}`,
      name: title,
      customerTitle: `🔥 ${title}`,
      description: `Add ${buyQty} units to cart and automatically get ${rewardQty} free!`,
      offerType: isSameProd ? 'BOGO' : 'BUY_X_GET_Y',
      status: 'ACTIVE',
      priority: 2,
      stackingRule: 'ALLOW',
      buyProductId: buyProdId,
      buyQuantity: Number(buyQty),
      rewardProductId: rewardProdId,
      rewardProductName: rewardProd?.name,
      rewardQuantity: Number(rewardQty),
      maxRepetitions: Number(maxReps) || 3,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 60 * 86400000).toISOString(),
    };

    onAddOffer(newOffer);
    showToast('BOGO bundle offer created successfully!', 'success');
    setShowModal(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* ── HEADER ── */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Boxes className="w-5 h-5 text-emerald-600" />
            <span>Buy 1 Get 1 &amp; Bundle Deals (BOGO / Buy X Get Y)</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Configure same-item Buy 1 Get 1 Free sets or cross-category bundles (e.g. Buy 2 Maggi Get 1 Milk Free).
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-5 py-3 rounded-2xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Create BOGO Offer</span>
        </button>
      </div>

      {/* ── BOGO OFFERS GRID ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {bogoOffers.length === 0 ? (
          <div className="col-span-full bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <Boxes className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">No active BOGO bundles</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Create your first Buy 1 Get 1 or Buy 2 Get 1 cross-product bundle offer.
            </p>
          </div>
        ) : (
          bogoOffers.map((off) => (
            <div
              key={off.id}
              className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs flex flex-col justify-between space-y-4 hover:border-emerald-300 transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    {off.offerType === 'BOGO' ? 'Same Item BOGO' : 'Cross-Product Bundle'}
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">Max Reps: {off.maxRepetitions || 3}x</span>
                </div>

                <h4 className="font-black text-slate-900 text-sm">{off.customerTitle}</h4>
                <p className="text-xs text-slate-500 leading-relaxed">{off.description}</p>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Buy Qty: {off.buyQuantity || 1}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-emerald-700">Free Qty: {off.rewardQuantity || 1}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-medium">Priority #{off.priority}</span>
                <button
                  onClick={() => onDeleteOffer(off.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── CREATE BOGO MODAL ── */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="font-black text-slate-900 text-base">Create BOGO / Buy X Get Y Offer</h3>
            <form onSubmit={handleCreateBogo} className="space-y-4 text-xs">
              
              <div>
                <label className="font-bold text-slate-700 block mb-1">Eligible Buy Product *</label>
                <select
                  value={buyProdId}
                  onChange={(e) => setBuyProdId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium text-slate-900 focus:outline-none focus:border-emerald-500"
                  required
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} (₹{p.sellingPrice})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Buy Quantity</label>
                  <input
                    type="number"
                    min={1}
                    value={buyQty}
                    onChange={(e) => setBuyQty(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Free Quantity</label>
                  <input
                    type="number"
                    min={1}
                    value={rewardQty}
                    onChange={(e) => setRewardQty(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Reward Product (Free Item) *</label>
                <select
                  value={rewardProdId}
                  onChange={(e) => setRewardProdId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium text-slate-900 focus:outline-none focus:border-emerald-500"
                  required
                >
                  <option value={buyProdId}>-- Same Product (Classic BOGO) --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} (₹{p.sellingPrice})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Maximum Repetitions per Order</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={maxReps}
                  onChange={(e) => setMaxReps(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-black shadow-sm"
                >
                  Save BOGO Offer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
