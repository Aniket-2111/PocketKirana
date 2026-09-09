'use client';

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Clock,
  Trash2,
  CheckCircle2,
  Calendar,
  RefreshCw,
  TrendingDown,
  ShieldAlert,
  Flame,
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

export function ExpiryCenterView() {
  const [filter, setFilter] = useState<'all' | 'expired' | '3d' | '7d' | '30d'>('all');
  const [items, setItems] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    expired: 0,
    expiringIn3Days: 0,
    expiringIn7Days: 0,
    expiringIn30Days: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Write-off disposal modal
  const [selectedBatch, setSelectedBatch] = useState<any | null>(null);
  const [disposeQty, setDisposeQty] = useState('');
  const [disposeReason, setDisposeReason] = useState<'EXPIRED' | 'DAMAGED' | 'QUALITY_FAIL'>('EXPIRED');
  const [disposeNotes, setDisposeNotes] = useState('');
  const [isDisposing, setIsDisposing] = useState(false);

  useEffect(() => {
    loadExpiryData();
  }, [filter]);

  async function loadExpiryData() {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/inventory/expiry?filter=${filter}`);
      if (res.ok) {
        const json = await res.json();
        setItems(json.data || []);
        if (json.summary) {
          setSummary(json.summary);
        }
      }
    } catch (err) {
      console.warn('Error loading expiry data:', err);
    } finally {
      setIsLoading(false);
    }
  }

  const handleDisposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch || !disposeQty || Number(disposeQty) <= 0) {
      showToast('Please enter a valid quantity to write off', 'error');
      return;
    }

    setIsDisposing(true);
    try {
      const res = await fetch('/api/inventory/expiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_id: selectedBatch.batch_id,
          quantity: Number(disposeQty),
          reason: disposeReason,
          notes: disposeNotes || `Disposal for batch ${selectedBatch.batch_number}`,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`Stock write-off recorded and ledger updated!`, 'success');
        setSelectedBatch(null);
        setDisposeQty('');
        loadExpiryData();
      } else {
        showToast(data.error || 'Failed to record disposal', 'error');
      }
    } catch (err: any) {
      showToast('Error processing disposal: ' + err.message, 'error');
    } finally {
      setIsDisposing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            <span>Expiry Center & Freshness Management</span>
          </h2>
          <p className="text-xs text-slate-500">
            Proactive shelf-life tracking, clearance alerts, and damaged stock write-offs
          </p>
        </div>

        <button
          onClick={loadExpiryData}
          className="p-2 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl transition-colors shadow-2xs self-start"
          title="Refresh Expiry Queue"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div
          onClick={() => setFilter('expired')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filter === 'expired'
              ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-500/20 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-800">Expired</span>
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          </div>
          <span className="text-2xl font-black text-rose-950 mt-1 block">{summary.expired}</span>
          <span className="text-[11px] text-rose-700 font-medium">Immediate disposal required</span>
        </div>

        <div
          onClick={() => setFilter('3d')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filter === '3d'
              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500/20 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">Expires in ≤3 Days</span>
            <Flame className="w-4 h-4 text-amber-600" />
          </div>
          <span className="text-2xl font-black text-amber-950 mt-1 block">{summary.expiringIn3Days}</span>
          <span className="text-[11px] text-amber-700 font-medium">Flash clearance candidate</span>
        </div>

        <div
          onClick={() => setFilter('7d')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filter === '7d'
              ? 'bg-yellow-50 border-yellow-300 ring-2 ring-yellow-500/20 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-yellow-800">Expires in ≤7 Days</span>
            <AlertTriangle className="w-4 h-4 text-yellow-600" />
          </div>
          <span className="text-2xl font-black text-yellow-950 mt-1 block">{summary.expiringIn7Days}</span>
          <span className="text-[11px] text-yellow-700 font-medium">FEFO priority picking</span>
        </div>

        <div
          onClick={() => setFilter('30d')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filter === '30d'
              ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">Expires in ≤30 Days</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-2xl font-black text-emerald-950 mt-1 block">{summary.expiringIn30Days}</span>
          <span className="text-[11px] text-emerald-700 font-medium">Normal runway</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 text-xs font-bold bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
        <span className="text-slate-500 pl-2">Filter View:</span>
        {(['all', 'expired', '3d', '7d', '30d'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg transition-all border ${
              filter === f
                ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            {f === 'all' ? 'All Tracked Batches' : f.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Expiry Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-black tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">Batch Number</th>
                <th className="py-3 px-4">Expiry Date</th>
                <th className="py-3 px-4">Days Left</th>
                <th className="py-3 px-4 text-right">In Stock</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
                    Loading Expiry Center data...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No batches match the selected expiry filter.
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => {
                  const daysLeft = item.days_until_expiry ?? 0;
                  const isPast = daysLeft < 0;

                  return (
                    <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <strong className="text-slate-900 block font-bold">{item.product_name}</strong>
                        <span className="text-[10px] text-slate-500 font-mono">{item.sku}</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                        {item.batch_number || `BATCH-${idx + 1}`}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">
                        {new Date(item.expiry_date).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            isPast
                              ? 'bg-rose-100 text-rose-800'
                              : daysLeft <= 3
                              ? 'bg-amber-100 text-amber-800'
                              : daysLeft <= 7
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isPast ? `Expired (${Math.abs(daysLeft)}d ago)` : `${daysLeft} days left`}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-slate-900 text-sm">
                        {item.available_qty || item.current_quantity || 0}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedBatch(item);
                            setDisposeQty(String(item.available_qty || item.current_quantity || 1));
                          }}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 shadow-2xs"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Write-Off</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Disposal Modal */}
      {selectedBatch && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-600" />
                <span>Write-Off Stock Disposal</span>
              </h3>
              <button onClick={() => setSelectedBatch(null)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>

            <form onSubmit={handleDisposal} className="space-y-3.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[11px] text-slate-500 block">Target Product:</span>
                <strong className="text-slate-900 block text-sm">{selectedBatch.product_name}</strong>
                <span className="text-[10px] text-slate-500 font-mono">
                  Batch: {selectedBatch.batch_number} (Available: {selectedBatch.available_qty || selectedBatch.current_quantity})
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Disposal Reason</label>
                <select
                  value={disposeReason}
                  onChange={(e) => setDisposeReason(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium"
                >
                  <option value="EXPIRED">Expired Past Shelf Life</option>
                  <option value="DAMAGED">Damaged / Broken Packaging</option>
                  <option value="QUALITY_FAIL">Quality Check Failed</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Quantity to Dispose</label>
                <input
                  type="number"
                  required
                  min="1"
                  max={selectedBatch.available_qty || selectedBatch.current_quantity || 1000}
                  value={disposeQty}
                  onChange={(e) => setDisposeQty(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Notes / Reason Details</label>
                <input
                  type="text"
                  placeholder="e.g. Expired batch disposed per SOP-104"
                  value={disposeNotes}
                  onChange={(e) => setDisposeNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedBatch(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDisposing}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-all shadow-md"
                >
                  {isDisposing ? 'Writing Off...' : 'Confirm Write-Off'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
