'use client';

import React, { useEffect, useState } from 'react';
import {
  RotateCcw,
  CheckCircle2,
  PackageCheck,
  AlertTriangle,
  RefreshCw,
  Search,
  Truck,
  Layers,
  Calendar,
  ShieldCheck,
  Loader2
} from 'lucide-react';
import { OrderReturn, ItemInspectionDisposition, ReturnStatus } from '@/types';
import { showToast } from '@/components/ui/Toast';

export function ReturnsManagementAdminView() {
  const [returns, setReturns] = useState<OrderReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Inspection Modal
  const [inspectingReturn, setInspectingReturn] = useState<OrderReturn | null>(null);
  const [disposition, setDisposition] = useState<ItemInspectionDisposition>('RESTOCKABLE');
  const [inspectionNotes, setInspectionNotes] = useState('');
  const [isSubmittingInspection, setIsSubmittingInspection] = useState(false);

  const loadReturns = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/returns');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setReturns(json.data);
      }
    } catch (err) {
      showToast('Failed to load returns', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReturns();
  }, []);

  const handleUpdateStatus = async (returnId: string, status: ReturnStatus) => {
    try {
      const res = await fetch('/api/admin/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          returnId,
          status,
          actorId: 'admin-1',
          actorName: 'Hub Manager',
          actorRole: 'admin',
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(`Return marked as ${status}`, 'success');
        loadReturns();
      } else {
        showToast(json.error || 'Failed to update return', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error updating return', 'error');
    }
  };

  const handleCompleteInspection = async () => {
    if (!inspectingReturn) return;

    setIsSubmittingInspection(true);
    try {
      const res = await fetch(`/api/admin/returns/${inspectingReturn.id}/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inspectedBy: 'admin-1',
          inspectedByName: 'Hub Inspector',
          items: [
            {
              productName: `Returned Items for #${inspectingReturn.orderNumber}`,
              quantity: inspectingReturn.totalItems || 1,
              disposition,
              notes: inspectionNotes,
            },
          ],
        }),
      });

      const json = await res.json();
      if (json.success) {
        showToast(
          disposition === 'RESTOCKABLE'
            ? 'Items inspected and safely restocked to available inventory!'
            : 'Items quarantined/disposed. Active inventory protected.',
          'success'
        );
        setInspectingReturn(null);
        loadReturns();
      } else {
        showToast(json.error || 'Failed to complete inspection', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error completing inspection', 'error');
    } finally {
      setIsSubmittingInspection(false);
    }
  };

  const filtered = returns.filter(
    (r) =>
      r.returnNumber?.toLowerCase().includes(search.toLowerCase()) ||
      r.orderNumber?.toLowerCase().includes(search.toLowerCase()) ||
      r.assignedPartnerName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-purple-600" />
            <span>Returns & Warehouse Inspection Center</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Receive failed deliveries & customer returns, perform grocery safety inspection before restock
          </p>
        </div>

        <button
          onClick={loadReturns}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl active:scale-95 transition-all cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by return #, order #, or rider..."
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none focus:border-purple-500"
        />
      </div>

      {/* Returns List */}
      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500">Loading returns…</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-800 dark:text-white">No active returns</p>
          <p className="text-xs text-slate-500 mt-1">All returns have been inspected and processed.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((ret) => (
            <div
              key={ret.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-black text-slate-900 dark:text-white">
                    Return #{ret.returnNumber}
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    Order: <strong>#{ret.orderNumber}</strong> • Type: <strong className="text-purple-600">{ret.returnType}</strong>
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800">
                  {ret.status}
                </span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 text-xs space-y-1">
                <p className="text-slate-600 dark:text-slate-300">
                  <strong>Assigned Partner:</strong> {ret.assignedPartnerName || 'Unassigned'}
                </p>
                <p className="text-slate-600 dark:text-slate-300">
                  <strong>Inspection Status:</strong> {ret.inspectionStatus || 'PENDING'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                {ret.status === 'PENDING' && (
                  <button
                    onClick={() => handleUpdateStatus(ret.id, 'IN_TRANSIT')}
                    className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold transition-all"
                  >
                    Mark In Transit
                  </button>
                )}

                {ret.status === 'IN_TRANSIT' && (
                  <button
                    onClick={() => handleUpdateStatus(ret.id, 'RECEIVED')}
                    className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 text-xs font-bold transition-all"
                  >
                    Receive at Darkstore
                  </button>
                )}

                {ret.status === 'RECEIVED' && ret.inspectionStatus !== 'COMPLETED' && (
                  <button
                    onClick={() => setInspectingReturn(ret)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center gap-1 shadow-xs"
                  >
                    <PackageCheck className="w-3.5 h-3.5" />
                    <span>Inspect & Restock</span>
                  </button>
                )}

                {ret.inspectionStatus === 'COMPLETED' && (
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Inspection Complete</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inspection Modal */}
      {inspectingReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-scaleUp">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <span>Grocery Safety & Inventory Inspection</span>
            </h3>

            <p className="text-xs text-slate-500">
              Return #{inspectingReturn.returnNumber} for Order #{inspectingReturn.orderNumber}
            </p>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Item Disposition
              </label>
              {[
                { id: 'RESTOCKABLE', label: 'Good & Restockable', desc: 'Unopened, unexpired, safe for resale' },
                { id: 'DAMAGED', label: 'Damaged during transit', desc: 'Do not restock — Quarantine' },
                { id: 'EXPIRED', label: 'Expired Product', desc: 'Dispose — Do not restock' },
                { id: 'DISPOSED', label: 'Disposed / Non-salvageable', desc: 'Write off as loss' },
              ].map((d) => (
                <label
                  key={d.id}
                  onClick={() => setDisposition(d.id as any)}
                  className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                    disposition === d.id
                      ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/30 dark:border-purple-500'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="disposition"
                    checked={disposition === d.id}
                    onChange={() => setDisposition(d.id as any)}
                    className="mt-0.5 text-purple-600 focus:ring-purple-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">{d.label}</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">{d.desc}</span>
                  </div>
                </label>
              ))}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Inspection Notes
              </label>
              <textarea
                value={inspectionNotes}
                onChange={(e) => setInspectionNotes(e.target.value)}
                placeholder="Details on seal, expiry date, temperature check..."
                rows={2}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setInspectingReturn(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingInspection}
                onClick={handleCompleteInspection}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md flex items-center justify-center gap-1.5"
              >
                {isSubmittingInspection ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>Save Inspection</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
