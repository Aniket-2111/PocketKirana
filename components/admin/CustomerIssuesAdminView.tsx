'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  IndianRupee,
  RotateCcw,
  RefreshCw,
  Search,
  Camera,
  Layers,
  MessageSquare,
  Package,
  Calendar,
  Loader2,
  ShieldCheck,
  Eye
} from 'lucide-react';
import { OrderIssueReport, OrderIssueStatus } from '@/types';
import { showToast } from '@/components/ui/Toast';

export function CustomerIssuesAdminView() {
  const [issues, setIssues] = useState<OrderIssueReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [selectedIssue, setSelectedIssue] = useState<OrderIssueReport | null>(null);

  // Action Modals
  const [actionType, setActionType] = useState<'REFUND' | 'REPLACEMENT' | 'REJECT' | null>(null);
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [actionNotes, setActionNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const loadIssues = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/issues');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setIssues(json.data);
      }
    } catch (err) {
      showToast('Failed to load customer complaints', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIssues();
  }, []);

  const filtered = issues.filter((i) => {
    const matchesStatus = statusFilter === 'ALL' || i.status === statusFilter;
    const matchesSearch =
      i.ticketNumber?.toLowerCase().includes(search.toLowerCase()) ||
      i.orderNumber?.toLowerCase().includes(search.toLowerCase()) ||
      i.customerName?.toLowerCase().includes(search.toLowerCase()) ||
      i.productName?.toLowerCase().includes(search.toLowerCase()) ||
      i.description?.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleResolveAction = async () => {
    if (!selectedIssue || !actionType) return;

    setIsProcessing(true);
    const apiAction =
      actionType === 'REFUND'
        ? 'APPROVE_REFUND'
        : actionType === 'REPLACEMENT'
        ? 'APPROVE_REPLACEMENT'
        : 'REJECT';

    try {
      const res = await fetch('/api/admin/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueId: selectedIssue.id,
          adminId: 'admin-1',
          adminName: 'Super Admin',
          action: apiAction,
          refundAmount: actionType === 'REFUND' ? refundAmount : undefined,
          adminNotes: actionNotes,
          rejectionReason: actionType === 'REJECT' ? actionNotes : undefined,
        }),
      });

      const json = await res.json();
      if (json.success) {
        showToast(
          actionType === 'REFUND'
            ? 'Refund approved successfully!'
            : actionType === 'REPLACEMENT'
            ? 'Replacement order created!'
            : 'Complaint rejected with response.',
          'success'
        );
        setActionType(null);
        setSelectedIssue(null);
        loadIssues();
      } else {
        showToast(json.error || 'Failed to update complaint', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error processing request', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-600" />
            <span>Customer Complaints & Product Issues</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Review photo evidence, approve refunds / replacements, or resolve order discrepancies
          </p>
        </div>

        <button
          onClick={loadIssues}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl active:scale-95 transition-all cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex flex-wrap gap-1.5 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl text-xs font-bold">
          {['ALL', 'OPEN', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REFUND_PENDING', 'REPLACEMENT_PENDING'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === st
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {st.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ticket #, order #, product, or customer..."
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Issues Table / Cards */}
      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500">Loading customer complaints…</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-800 dark:text-white">No complaints found</p>
          <p className="text-xs text-slate-500 mt-1">There are no complaints matching your active filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((issue) => (
            <div
              key={issue.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-black text-slate-900 dark:text-white">
                      Ticket #{issue.ticketNumber}
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      Order: <strong>#{issue.orderNumber}</strong> • {issue.customerName || 'Customer'}
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                    {issue.status}
                  </span>
                </div>

                {/* Product & Issue Banner */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 text-xs space-y-1">
                  <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{issue.productName}</span>
                    {issue.variantName && <span className="text-slate-400">({issue.variantName})</span>}
                  </p>
                  <p className="text-slate-600 dark:text-slate-300">
                    <strong className="text-amber-600">Issue:</strong> {issue.issueType.replace(/_/g, ' ')}
                  </p>
                  <p className="text-slate-700 dark:text-slate-300 italic pt-0.5">"{issue.description}"</p>
                </div>

                {/* Photo Gallery Thumbnails */}
                {issue.photos && issue.photos.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Customer Photo Evidence ({issue.photos.length})
                    </span>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {issue.photos.map((img, idx) => (
                        <a key={idx} href={img} target="_blank" rel="noreferrer" className="shrink-0 w-14 h-14 rounded-lg overflow-hidden border border-slate-200 hover:opacity-80">
                          <img src={img} alt="evidence" className="w-full h-full object-cover" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIssue(issue);
                    setActionType('REJECT');
                    setActionNotes('');
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 text-rose-700 text-xs font-bold transition-all"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIssue(issue);
                    setActionType('REPLACEMENT');
                    setActionNotes('');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 text-xs font-bold transition-all flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Replace</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIssue(issue);
                    setActionType('REFUND');
                    setRefundAmount(issue.refundAmount || 100);
                    setActionNotes('');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center gap-1 shadow-xs"
                >
                  <IndianRupee className="w-3.5 h-3.5" />
                  <span>Approve Refund</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Modal */}
      {actionType && selectedIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-scaleUp">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {actionType === 'REFUND'
                ? 'Approve Customer Refund'
                : actionType === 'REPLACEMENT'
                ? 'Approve Product Replacement'
                : 'Reject Complaint Request'}
            </h3>

            <p className="text-xs text-slate-500">
              Ticket #{selectedIssue.ticketNumber} • Order #{selectedIssue.orderNumber} ({selectedIssue.productName})
            </p>

            {actionType === 'REFUND' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Refund Amount (₹)
                </label>
                <input
                  type="number"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-mono font-bold outline-none focus:border-emerald-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Admin Response Notes
              </label>
              <textarea
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="Message for the customer regarding this resolution..."
                rows={3}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setActionType(null);
                  setSelectedIssue(null);
                }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleResolveAction}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-white shadow-md flex items-center justify-center gap-1.5 ${
                  actionType === 'REJECT' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>Confirm Resolution</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
