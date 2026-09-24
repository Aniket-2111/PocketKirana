'use client';

import React, { useState } from 'react';
import { LoyaltyMilestoneRule } from '@/lib/promotionsEngine';
import { showToast } from '@/components/ui/Toast';
import {
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  Percent,
  Sliders,
  Award,
  ShieldCheck,
} from 'lucide-react';

interface LoyaltyMilestonesTabProps {
  loyaltyRules: LoyaltyMilestoneRule[];
  onAddRule: (rule: LoyaltyMilestoneRule) => void;
  onDeleteRule: (id: string) => void;
  onToggleRuleStatus: (id: string, active: boolean) => void;
}

export function LoyaltyMilestonesTab({
  loyaltyRules,
  onAddRule,
  onDeleteRule,
  onToggleRuleStatus,
}: LoyaltyMilestonesTabProps) {
  const [showModal, setShowModal] = useState(false);

  const [orderCount, setOrderCount] = useState(10);
  const [rewardType, setRewardType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
  const [rewardValue, setRewardValue] = useState(10);
  const [maxDiscount, setMaxDiscount] = useState(200);
  const [minOrder, setMinOrder] = useState(499);
  const [name, setName] = useState('');

  const handleSaveRule = (e: React.FormEvent) => {
    e.preventDefault();
    const ruleName = name.trim() || `${orderCount}th Completed Order Milestone Reward`;

    const newRule: LoyaltyMilestoneRule = {
      id: `loyalty-${orderCount}-${Date.now()}`,
      name: ruleName,
      description: `Complete ${orderCount} successful orders and unlock ${rewardType === 'PERCENTAGE' ? `${rewardValue}% OFF` : `₹${rewardValue} OFF`} on your next order.`,
      requiredCompletedOrders: Number(orderCount),
      rewardType,
      rewardValue: Number(rewardValue),
      maxDiscount: maxDiscount ? Number(maxDiscount) : undefined,
      minOrderValue: Number(minOrder) || 0,
      validityDays: 30,
      isActive: true,
    };

    onAddRule(newRule);
    showToast(`Loyalty Milestone for ${orderCount} orders created!`, 'success');
    setShowModal(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* ── HEADER ── */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-600" />
            <span>Order Milestone &amp; Customer Loyalty Rules</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Configure automated rewards triggered when customers complete specific milestones (e.g. 5th order ₹50 OFF, 10th order 10% OFF).
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-5 py-3 rounded-2xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Milestone Rule</span>
        </button>
      </div>

      {/* ── RULES LIST ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loyaltyRules.map((rule) => (
          <div
            key={rule.id}
            className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs flex flex-col justify-between space-y-4 hover:border-emerald-300 transition-all"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {rule.requiredCompletedOrders}th Completed Order
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  rule.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  {rule.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <h4 className="font-black text-slate-900 text-sm">{rule.name}</h4>
              <p className="text-xs text-slate-500 leading-relaxed">{rule.description}</p>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Reward:</span>
                  <strong className="text-slate-900">
                    {rule.rewardType === 'PERCENTAGE' ? `${rule.rewardValue}% OFF` : `₹${rule.rewardValue} OFF`}
                  </strong>
                </div>
                {rule.maxDiscount && (
                  <div className="flex justify-between">
                    <span>Max Discount:</span>
                    <strong className="text-slate-900">₹{rule.maxDiscount}</strong>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Min Cart Value:</span>
                  <strong className="text-slate-900">₹{rule.minOrderValue}</strong>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => onToggleRuleStatus(rule.id, !rule.isActive)}
                className="text-[11px] font-bold text-slate-600 hover:text-slate-900"
              >
                {rule.isActive ? 'Deactivate' : 'Activate'}
              </button>
              <button
                onClick={() => onDeleteRule(rule.id)}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── CREATE MODAL ── */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="font-black text-slate-900 text-base">Create Order Milestone Rule</h3>
            <form onSubmit={handleSaveRule} className="space-y-4 text-xs">
              
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Required Completed Orders Count *
                </label>
                <input
                  type="number"
                  placeholder="e.g. 10"
                  value={orderCount}
                  onChange={(e) => setOrderCount(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Reward Type</label>
                  <select
                    value={rewardType}
                    onChange={(e) => setRewardType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="PERCENTAGE">Percentage (% OFF)</option>
                    <option value="FIXED">Flat (₹ OFF)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Reward Value *</label>
                  <input
                    type="number"
                    value={rewardValue}
                    onChange={(e) => setRewardValue(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Max Discount Cap (₹)</label>
                  <input
                    type="number"
                    value={maxDiscount}
                    onChange={(e) => setMaxDiscount(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Min Order Value (₹)</label>
                  <input
                    type="number"
                    value={minOrder}
                    onChange={(e) => setMinOrder(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
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
                  Save Milestone Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
