'use client';

import React, { useState } from 'react';
import { PromotionOffer } from '@/lib/promotionsEngine';
import { useAppStore } from '@/lib/store';
import { showToast } from '@/components/ui/Toast';
import {
  Gift,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ShoppingBag,
  Sliders,
  Boxes,
} from 'lucide-react';

interface FreeGiftsTabProps {
  offers: PromotionOffer[];
  onAddOffer: (offer: PromotionOffer) => void;
  onDeleteOffer: (id: string) => void;
}

export function FreeGiftsTab({ offers, onAddOffer, onDeleteOffer }: FreeGiftsTabProps) {
  const { products } = useAppStore();
  const [showModal, setShowModal] = useState(false);

  const [minCart, setMinCart] = useState(500);
  const [rewardProdId, setRewardProdId] = useState(products[0]?.id || '');
  const [rewardQty, setRewardQty] = useState(1);
  const [fallbackAction, setFallbackAction] = useState<'REMOVE_REWARD' | 'ALTERNATE_PRODUCT' | 'DISABLE_CAMPAIGN'>('REMOVE_REWARD');
  const [alternateProdId, setAlternateProdId] = useState('');

  const freeGiftOffers = offers.filter((o) => o.offerType === 'FREE_PRODUCT_ABOVE_X');

  const handleCreateFreeGift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rewardProdId) {
      showToast('Please select a free reward product.', 'error');
      return;
    }

    const rewardProd = products.find((p) => p.id === rewardProdId);
    const title = `Shop above ₹${minCart} & Get Free ${rewardProd?.name || 'Gift Pack'}`;

    const newOffer: PromotionOffer = {
      id: `gift-${Date.now()}`,
      name: title,
      customerTitle: `🎁 ${title}`,
      description: `Automatically unlocked when cart value reaches ₹${minCart}.`,
      offerType: 'FREE_PRODUCT_ABOVE_X',
      status: 'ACTIVE',
      priority: 1,
      stackingRule: 'ALLOW',
      minCartValue: Number(minCart),
      rewardProductId: rewardProdId,
      rewardProductName: rewardProd?.name,
      rewardQuantity: Number(rewardQty) || 1,
      fallbackAction,
      alternateProductId: alternateProdId || undefined,
      requiresInventory: true,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 60 * 86400000).toISOString(),
    };

    onAddOffer(newOffer);
    showToast('Free gift threshold offer created successfully!', 'success');
    setShowModal(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* ── HEADER ── */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Gift className="w-5 h-5 text-emerald-600" />
            <span>Free Product Above Order Value Offers</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Automatically inject free gift items into customer carts when order value thresholds are reached. Real-time inventory aware with graceful fallback.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-5 py-3 rounded-2xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Create Free Gift Tier</span>
        </button>
      </div>

      {/* ── GIFTS GRID ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {freeGiftOffers.map((off) => {
          const rewardProd = products.find((p) => p.id === off.rewardProductId);
          const currentStock = rewardProd?.stock ?? 45;
          const isStockLow = currentStock <= 5;

          return (
            <div
              key={off.id}
              className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs flex flex-col justify-between space-y-4 hover:border-emerald-300 transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Threshold: ₹{off.minCartValue}+
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      isStockLow ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                    }`}>
                      Stock: {currentStock} units
                    </span>
                  </div>
                </div>

                <h4 className="font-black text-slate-900 text-sm">{off.customerTitle}</h4>
                <p className="text-xs text-slate-500 leading-relaxed">{off.description}</p>

                <div className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-100 flex items-center gap-2.5">
                  <Gift className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold text-xs text-emerald-950 block">
                      {off.rewardQuantity || 1}x {off.rewardProductName || 'Gift Item'}
                    </span>
                    <span className="text-[10px] text-emerald-700">
                      Fallback: {off.fallbackAction === 'REMOVE_REWARD' ? 'Auto-remove if out of stock' : 'Alternate product'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-medium">Auto-adds to cart</span>
                <button
                  onClick={() => onDeleteOffer(off.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── CREATE MODAL ── */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="font-black text-slate-900 text-base">Create Free Gift Tier Offer</h3>
            <form onSubmit={handleCreateFreeGift} className="space-y-4 text-xs">
              
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Cart Subtotal Threshold (₹) *
                </label>
                <input
                  type="number"
                  placeholder="e.g. 500"
                  value={minCart}
                  onChange={(e) => setMinCart(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Free Product Reward *
                </label>
                <select
                  value={rewardProdId}
                  onChange={(e) => setRewardProdId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium text-slate-900 focus:outline-none focus:border-emerald-500"
                  required
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Stock: {p.stock ?? 50})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Out-of-Stock Fallback Strategy
                </label>
                <select
                  value={fallbackAction}
                  onChange={(e) => setFallbackAction(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium text-slate-900 focus:outline-none focus:border-emerald-500"
                >
                  <option value="REMOVE_REWARD">Gracefully Remove Reward (Never allow negative stock)</option>
                  <option value="ALTERNATE_PRODUCT">Offer Alternate Product</option>
                  <option value="DISABLE_CAMPAIGN">Disable Campaign</option>
                </select>
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
                  Save Free Gift Tier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
