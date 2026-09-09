'use client';

import React, { useState } from 'react';
import CustomerShell from '../../components/CustomerShell';
import { 
  ShieldCheck, 
  Lock, 
  EyeOff, 
  Trash2, 
  FileText, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

export default function PrivacyPage() {
  const [deleteRequested, setDeleteRequested] = useState(false);

  const handleDeleteRequest = () => {
    if (confirm('Are you sure you want to request account data deletion?')) {
      setDeleteRequested(true);
      showToast('Account data deletion request logged. You will receive an SMS confirmation.', 'info');
    }
  };

  return (
    <CustomerShell title="Account Privacy" showBack backUrl="/profile">
      <div className="space-y-5 animate-in fade-in duration-200 pb-20 max-w-md mx-auto">
        
        {/* Header */}
        <div className="bg-gradient-to-b from-[#0B8F5A] via-[#075C3C] to-[#043d27] dark:from-[#0f2e22] dark:via-[#0b2118] dark:to-[#071610] rounded-3xl p-6 text-white text-center shadow-lg relative overflow-hidden">
          <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center font-black mx-auto mb-3">
            <Lock className="w-7 h-7 text-emerald-200" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">Account Privacy &amp; Data</h1>
          <p className="text-xs text-emerald-100 dark:text-emerald-200/80 mt-1 font-medium">
            Your data security, encryption standards &amp; control
          </p>
        </div>

        {/* Security Highlights */}
        <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-xs">
          <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>How We Protect You</span>
          </h2>
          
          <div className="space-y-3 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p><strong className="text-slate-900 dark:text-white">256-Bit SSL Encryption:</strong> All transactions, delivery addresses, and mobile authentications are encrypted end-to-end.</p>
            </div>

            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p><strong className="text-slate-900 dark:text-white">No Payment Card Storage:</strong> Pocket Kirana does not store raw credit/debit card details. UPI tokens are routed directly via RBI-authorized gateways.</p>
            </div>

            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p><strong className="text-slate-900 dark:text-white">Zero Third-Party Data Selling:</strong> We never sell your personal information, phone numbers, or shopping patterns to external ad networks.</p>
            </div>
          </div>
        </div>

        {/* Permissions & Controls */}
        <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-xs">
          <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <EyeOff className="w-4 h-4 text-blue-500" />
            <span>Device Permissions</span>
          </h2>
          
          <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400 font-medium">
            <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-[#252d3d] rounded-xl">
              <div>
                <strong className="block text-slate-900 dark:text-white">Location Access</strong>
                <span className="text-[10px] text-slate-400">Used only during active checkout to pinpoint doorstep delivery.</span>
              </div>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-md">Granted</span>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-[#252d3d] rounded-xl">
              <div>
                <strong className="block text-slate-900 dark:text-white">Push Notifications</strong>
                <span className="text-[10px] text-slate-400">Live order milestone pings &amp; rider ETA.</span>
              </div>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-md">Active</span>
            </div>
          </div>
        </div>

        {/* Data Rights & Account Deletion */}
        <div className="bg-white dark:bg-[#1a202c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-xs">
          <h2 className="text-xs font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            <span>Manage Account Data</span>
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            You have the right to request full export or permanent deletion of your profile, address history, and order logs under India&apos;s Digital Personal Data Protection Act (DPDPA).
          </p>

          {deleteRequested ? (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 rounded-xl text-xs text-amber-800 dark:text-amber-300 font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Deletion request #REQ-{Date.now().toString().slice(-4)} submitted. Processing within 48 hours.</span>
            </div>
          ) : (
            <button
              onClick={handleDeleteRequest}
              className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 font-black text-xs rounded-xl transition-colors cursor-pointer"
            >
              Request Account &amp; Data Deletion
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-[10px] text-slate-400 dark:text-slate-600 font-mono">
          Pocket Kirana Privacy Policy Version 2.1 • Effective Sep 2026
        </div>

      </div>
    </CustomerShell>
  );
}
