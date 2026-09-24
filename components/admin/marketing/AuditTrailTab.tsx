'use client';

import React from 'react';
import { ShieldCheck, Clock, User, ArrowRight } from 'lucide-react';

export interface PromotionAuditRecord {
  id: string;
  entityType: 'OFFER' | 'COUPON' | 'CAMPAIGN' | 'LOYALTY_RULE';
  entityName: string;
  actorName: string;
  actorRole: string;
  action: 'CREATE' | 'UPDATE' | 'PAUSE' | 'RESUME' | 'CANCEL' | 'EXPIRE' | 'DELETE';
  changeSummary: string;
  timestamp: string;
}

export const MOCK_PROMOTION_AUDIT_LOGS: PromotionAuditRecord[] = [
  {
    id: 'audit-1',
    entityType: 'OFFER',
    entityName: 'Holi Free Biscuit Pack Above ₹500',
    actorName: 'Aniket Yadav',
    actorRole: 'Admin',
    action: 'CREATE',
    changeSummary: 'Published Holi festival offer with minCart: ₹500 and free item: Parle Hide & Seek.',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'audit-2',
    entityType: 'COUPON',
    entityName: 'WELCOME100',
    actorName: 'Aniket Yadav',
    actorRole: 'Admin',
    action: 'UPDATE',
    changeSummary: 'Updated minimum order value from ₹399 to ₹499.',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'audit-3',
    entityType: 'LOYALTY_RULE',
    entityName: '10th Order Milestone: 10% OFF',
    actorName: 'Aniket Yadav',
    actorRole: 'Admin',
    action: 'CREATE',
    changeSummary: 'Created 10th order completed loyalty rule with 10% OFF (Max ₹200).',
    timestamp: new Date(Date.now() - 172800000).toISOString(),
  },
];

export function AuditTrailTab() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <span>Promotions &amp; Offers Audit Trail</span>
        </h2>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          Immutable ledger of all offer creations, edits, status toggles, and coupon modifications.
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="divide-y divide-slate-100">
          {MOCK_PROMOTION_AUDIT_LOGS.map((log) => (
            <div key={log.id} className="p-5 flex items-start justify-between gap-4 hover:bg-slate-50 transition-colors text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                    log.action === 'CREATE' ? 'bg-emerald-100 text-emerald-800' :
                    log.action === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                    'bg-slate-100 text-slate-800'
                  }`}>
                    {log.action} {log.entityType}
                  </span>
                  <span className="font-black text-slate-900">{log.entityName}</span>
                </div>
                <p className="text-slate-600 font-medium">{log.changeSummary}</p>
                <span className="text-[11px] text-slate-400 font-medium block">
                  Modified by <strong>{log.actorName}</strong> ({log.actorRole})
                </span>
              </div>

              <span className="text-[11px] text-slate-400 font-mono shrink-0">
                {new Date(log.timestamp).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
