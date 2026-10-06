'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Package,
  RotateCcw,
  IndianRupee,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { OrderIssueReport, OrderIssueStatus } from '@/types';

interface CustomerComplaintTrackerProps {
  orderId: string;
}

const STATUS_CONFIG: Record<OrderIssueStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  OPEN: {
    label: 'Submitted — Under Review',
    color: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
    icon: <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
  },
  UNDER_REVIEW: {
    label: 'Under Review by Support',
    color: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
    icon: <Clock className="w-4 h-4 text-amber-600 animate-spin" />
  },
  APPROVED: {
    label: 'Complaint Approved',
    color: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />
  },
  REJECTED: {
    label: 'Request Rejected',
    color: 'text-rose-700 dark:text-rose-300',
    bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800',
    icon: <XCircle className="w-4 h-4 text-rose-600" />
  },
  REFUND_PENDING: {
    label: 'Refund Processing',
    color: 'text-blue-700 dark:text-blue-300',
    bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800',
    icon: <IndianRupee className="w-4 h-4 text-blue-600" />
  },
  REFUNDED: {
    label: 'Refund Completed',
    color: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />
  },
  REPLACEMENT_PENDING: {
    label: 'Replacement Order Created',
    color: 'text-purple-700 dark:text-purple-300',
    bg: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800',
    icon: <RotateCcw className="w-4 h-4 text-purple-600" />
  },
  REPLACED: {
    label: 'Replacement Delivered',
    color: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />
  },
  RESOLVED: {
    label: 'Resolved',
    color: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
    icon: <ShieldCheck className="w-4 h-4 text-emerald-600" />
  }
};

export function CustomerComplaintTracker({ orderId }: CustomerComplaintTrackerProps) {
  const [issues, setIssues] = useState<OrderIssueReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadIssues() {
      try {
        const res = await fetch(`/api/orders/${orderId}/issues`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setIssues(json.data);
        }
      } catch (err) {
        console.warn('Failed to load issues for order', err);
      } finally {
        setLoading(false);
      }
    }
    loadIssues();
  }, [orderId]);

  if (loading || issues.length === 0) return null;

  return (
    <div className="mt-4 space-y-3">
      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Reported Issues & Complaints ({issues.length})
      </h4>
      {issues.map((issue) => {
        const cfg = STATUS_CONFIG[issue.status] || STATUS_CONFIG.OPEN;
        return (
          <div
            key={issue.id}
            className={`p-4 rounded-2xl border ${cfg.bg} transition-all`}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                {cfg.icon}
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  Ticket #{issue.ticketNumber}
                </span>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${cfg.color}`}>
                {cfg.label}
              </span>
            </div>

            <div className="text-xs space-y-1 text-slate-700 dark:text-slate-300">
              <p>
                <span className="font-semibold text-slate-500 dark:text-slate-400">Item:</span>{' '}
                {issue.productName}
              </p>
              <p>
                <span className="font-semibold text-slate-500 dark:text-slate-400">Issue:</span>{' '}
                <span className="font-medium capitalize">{issue.issueType.toLowerCase().replace(/_/g, ' ')}</span>
              </p>
              <p className="text-slate-600 dark:text-slate-300 italic bg-white/60 dark:bg-black/20 p-2 rounded-lg mt-1">
                "{issue.description}"
              </p>

              {issue.adminNotes && (
                <div className="mt-2 p-2.5 bg-amber-100/60 dark:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-800 text-[11px]">
                  <p className="font-bold text-amber-900 dark:text-amber-200">Support Response:</p>
                  <p className="text-amber-800 dark:text-amber-300 mt-0.5">{issue.adminNotes}</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
