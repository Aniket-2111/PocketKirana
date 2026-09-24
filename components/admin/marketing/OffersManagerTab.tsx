'use client';

import React, { useState } from 'react';
import { PromotionOffer, OfferType, OfferStatus } from '@/lib/promotionsEngine';
import { showToast } from '@/components/ui/Toast';
import {
  Plus,
  Search,
  Filter,
  Edit2,
  Copy,
  Trash2,
  Play,
  Pause,
  XCircle,
  Eye,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Tag,
  Gift,
  Truck,
} from 'lucide-react';

interface OffersManagerTabProps {
  offers: PromotionOffer[];
  onOpenCreateModal: () => void;
  onEditOffer: (offer: PromotionOffer) => void;
  onDuplicateOffer: (offer: PromotionOffer) => void;
  onToggleOfferStatus: (id: string, newStatus: OfferStatus) => void;
  onDeleteOffer: (id: string) => void;
}

export function OffersManagerTab({
  offers,
  onOpenCreateModal,
  onEditOffer,
  onDuplicateOffer,
  onToggleOfferStatus,
  onDeleteOffer,
}: OffersManagerTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | OfferStatus>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | OfferType>('ALL');

  const filteredOffers = offers.filter((off) => {
    if (statusFilter !== 'ALL' && off.status !== statusFilter) return false;
    if (typeFilter !== 'ALL' && off.offerType !== typeFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        off.name.toLowerCase().includes(q) ||
        off.customerTitle.toLowerCase().includes(q) ||
        off.offerType.toLowerCase().includes(q)
      );
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
            <span>Offers &amp; Promotion Rules</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Manage percentage discounts, BOGO sets, free product thresholds, and customer-specific deals.
          </p>
        </div>

        <button
          onClick={onOpenCreateModal}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-5 py-3 rounded-2xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Create Offer</span>
        </button>
      </div>

      {/* ── FILTERS & SEARCH ── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search offers by title, type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active (Live)</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="PAUSED">Paused</option>
            <option value="DRAFT">Draft</option>
            <option value="EXPIRED">Expired</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Types</option>
            <option value="PERCENTAGE">Percentage (%)</option>
            <option value="FIXED">Flat (₹)</option>
            <option value="BOGO">BOGO / Bundle</option>
            <option value="FREE_PRODUCT_ABOVE_X">Free Product</option>
            <option value="TIERED_CART">Tiered Cart</option>
            <option value="FREE_DELIVERY">Free Delivery</option>
            <option value="CATEGORY_DISCOUNT">Category Discount</option>
            <option value="PRODUCT_DISCOUNT">Product Discount</option>
            <option value="FIRST_ORDER">First Order</option>
          </select>
        </div>
      </div>

      {/* ── OFFERS TABLE ── */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-black text-[10px] border-b border-slate-200">
              <tr>
                <th className="p-4">Offer Title &amp; Details</th>
                <th className="p-4">Type</th>
                <th className="p-4">Min. Cart</th>
                <th className="p-4">Stacking &amp; Priority</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredOffers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    No offers found matching the filters.
                  </td>
                </tr>
              ) : (
                filteredOffers.map((off) => (
                  <tr key={off.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <div className="space-y-0.5">
                        <span className="font-bold text-slate-900 text-xs block">
                          {off.customerTitle}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {off.name} • {new Date(off.startDate).toLocaleDateString()} - {new Date(off.endDate).toLocaleDateString()}
                        </span>
                      </div>
                    </td>

                    <td className="p-4">
                      <span className="bg-slate-100 text-slate-800 text-[10px] font-bold px-2 py-1 rounded-md uppercase">
                        {off.offerType.replace(/_/g, ' ')}
                      </span>
                    </td>

                    <td className="p-4 font-bold text-slate-900">
                      ₹{off.minCartValue || 0}
                    </td>

                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          off.stackingRule === 'ALLOW'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}>
                          {off.stackingRule}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold">
                          #{off.priority}
                        </span>
                      </div>
                    </td>

                    <td className="p-4">
                      <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                        off.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : off.status === 'SCHEDULED'
                          ? 'bg-blue-100 text-blue-800'
                          : off.status === 'PAUSED'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {off.status}
                      </span>
                    </td>

                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Pause / Resume Button */}
                        <button
                          onClick={() => onToggleOfferStatus(off.id, off.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE')}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                          title={off.status === 'ACTIVE' ? 'Pause Offer' : 'Resume Offer'}
                        >
                          {off.status === 'ACTIVE' ? (
                            <Pause className="w-4 h-4 text-amber-600" />
                          ) : (
                            <Play className="w-4 h-4 text-emerald-600" />
                          )}
                        </button>

                        {/* Edit Button */}
                        <button
                          onClick={() => onEditOffer(off)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit Offer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Duplicate Button */}
                        <button
                          onClick={() => onDuplicateOffer(off)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Duplicate Offer"
                        >
                          <Copy className="w-4 h-4" />
                        </button>

                        {/* Delete Draft Button */}
                        <button
                          onClick={() => onDeleteOffer(off.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
