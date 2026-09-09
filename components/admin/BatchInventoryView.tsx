'use client';

import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Plus,
  Calendar,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Package,
  ArrowDownToLine,
  Filter,
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';
import { useAppStore } from '@/lib/store';

export function BatchInventoryView() {
  const { products } = useAppStore();
  const [batches, setBatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');

  // Inward Modal
  const [showInwardModal, setShowInwardModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id || '');
  const [batchNumber, setBatchNumber] = useState('');
  const [mfgDate, setMfgDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [noExpiry, setNoExpiry] = useState(false);
  const [mrpReceipt, setMrpReceipt] = useState('');
  const [receivedQty, setReceivedQty] = useState('');
  const [notes, setNotes] = useState('');
  const [isInwarding, setIsInwarding] = useState(false);

  useEffect(() => {
    loadBatches();
  }, [statusFilter]);

  async function loadBatches() {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/inventory/batches?status=${statusFilter}`);
      if (res.ok) {
        const json = await res.json();
        setBatches(json.data || []);
      }
    } catch (err) {
      console.warn('Error fetching batches from API:', err);
    } finally {
      setIsLoading(false);
    }
  }

  const handleInwardBatch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProductId || !receivedQty || Number(receivedQty) <= 0) {
      showToast('Please select a product and valid quantity', 'error');
      return;
    }

    setIsInwarding(true);

    try {
      const selectedProduct = products.find((p) => p.id === selectedProductId);
      const res = await fetch('/api/inventory/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouse_id: 'wh_store-1',
          variant_id: selectedProductId,
          batch_number: batchNumber || `B-${Date.now().toString().slice(-6)}`,
          manufacture_date: mfgDate || null,
          expiry_date: noExpiry ? null : (expiryDate || null),
          mrp_at_receipt: Number(mrpReceipt) || (selectedProduct?.mrp || 0),
          received_qty: Number(receivedQty),
          notes: notes || `Stock inward for ${selectedProduct?.name}`,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        showToast('Stock batch inwarded and ledger updated!', 'success');
        setShowInwardModal(false);
        setBatchNumber('');
        setExpiryDate('');
        setReceivedQty('');
        loadBatches();
      } else {
        showToast(data.error || 'Failed to inward batch', 'error');
      }
    } catch (err: any) {
      showToast('Error inwarding stock: ' + err.message, 'error');
    } finally {
      setIsInwarding(false);
    }
  };

  const filteredBatches = batches.filter(
    (b) =>
      b.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.batch_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Boxes className="w-5 h-5 text-emerald-600" />
            <span>Batch Inventory & FEFO Allocations</span>
          </h2>
          <p className="text-xs text-slate-500">
            Physical stock inwarding, lot tracking, and First-Expiry-First-Out picking queue
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadBatches}
            className="p-2 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl transition-colors shadow-2xs"
            title="Refresh Batches"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowInwardModal(true)}
            className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5"
          >
            <ArrowDownToLine className="w-4 h-4" />
            <span>Inward New Batch</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search by product, batch number, SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl py-2 pl-8 pr-3 focus:bg-white focus:outline-none"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
        </div>

        <div className="flex items-center gap-2 text-xs font-bold">
          <span className="text-slate-500">Status:</span>
          {(['ACTIVE', 'ALL', 'CONSUMED', 'EXPIRED'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg transition-all border ${
                statusFilter === st
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Batches Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-black tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Product & SKU</th>
                <th className="py-3 px-4">Batch Number</th>
                <th className="py-3 px-4">Expiry Date</th>
                <th className="py-3 px-4">Warehouse</th>
                <th className="py-3 px-4 text-right">Available</th>
                <th className="py-3 px-4 text-right">Reserved</th>
                <th className="py-3 px-4 text-center">FEFO Priority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
                    Loading PostgreSQL inventory batches...
                  </td>
                </tr>
              ) : filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No active batches found matching criteria. Click &quot;Inward New Batch&quot; to stock up.
                  </td>
                </tr>
              ) : (
                filteredBatches.map((b, idx) => (
                  <tr key={b.id || idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <strong className="text-slate-900 block font-bold">{b.product_name}</strong>
                      <span className="text-[10px] text-slate-500 font-mono">{b.sku}</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                      {b.batch_number || `BATCH-#${idx + 1}`}
                    </td>
                    <td className="py-3.5 px-4">
                      {b.expiry_date ? (
                        <div className="flex items-center gap-1.5 text-slate-800">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{new Date(b.expiry_date).toLocaleDateString()}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">No Expiry (Perennial)</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{b.warehouse_name || 'Main Warehouse'}</td>
                    <td className="py-3.5 px-4 text-right font-black text-slate-900 text-sm">
                      {b.available_qty || 0}
                    </td>
                    <td className="py-3.5 px-4 text-right text-amber-700 font-bold">
                      {b.reserved_qty || 0}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold uppercase">
                        Active Pool
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inward Modal */}
      {showInwardModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <ArrowDownToLine className="w-5 h-5 text-emerald-600" />
                <span>Inward Inventory Batch</span>
              </h3>
              <button onClick={() => setShowInwardModal(false)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>

            <form onSubmit={handleInwardBatch} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Product</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Batch Number</label>
                  <input
                    type="text"
                    placeholder="e.g. TATA-2026-AUG-1"
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Received Quantity</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 50"
                    value={receivedQty}
                    onChange={(e) => setReceivedQty(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    <span>Expiry Date (FEFO Engine)</span>
                  </label>
                  <label className="flex items-center gap-1 text-[11px] font-medium text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={noExpiry}
                      onChange={(e) => setNoExpiry(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600"
                    />
                    <span>No Expiry</span>
                  </label>
                </div>

                {!noExpiry && (
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900"
                  />
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Notes / Inward Reference</label>
                <input
                  type="text"
                  placeholder="PO #8492 from Primary Distributor"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInwardModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isInwarding}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-black text-white font-bold transition-all shadow-md"
                >
                  {isInwarding ? 'Receiving...' : 'Inward Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
