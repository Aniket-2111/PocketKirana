'use client';

import React, { useState } from 'react';
import { DeliveryPartner, PartnerDocument } from '@/types';
import {
  ShieldCheck,
  FileText,
  UploadCloud,
  CheckCircle2,
  Clock,
  XCircle,
  X,
  CreditCard,
  Bike,
  User,
  Phone,
  Sparkles
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

interface PartnerOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  partner: DeliveryPartner;
  onSubmitDoc: (partnerId: string, doc: Omit<PartnerDocument, 'id' | 'submittedAt'>) => void;
}

export const PartnerOnboardingModal: React.FC<PartnerOnboardingModalProps> = ({
  isOpen,
  onClose,
  partner,
  onSubmitDoc,
}) => {
  const [docType, setDocType] = useState<'aadhaar' | 'pan' | 'driving_license' | 'vehicle_rc' | 'bank_passbook'>('driving_license');
  const [docNumber, setDocNumber] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docNumber.trim()) {
      showToast('Please enter the document registration number', 'error');
      return;
    }

    onSubmitDoc(partner.id, {
      type: docType,
      documentNumber: docNumber,
      status: 'verified',
    });

    showToast('Document submitted successfully! Verified by Admin.', 'success');
    setDocNumber('');
  };

  const docs = partner.documents || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-end sm:items-center justify-center p-0 sm:p-4 text-white">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 space-y-5 max-h-[90vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base">Partner Verification &amp; KYC</h3>
              <p className="text-xs text-slate-400">Admin-verified onboarding documents</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Verification Status Badge */}
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
            <div>
              <strong className="text-sm font-black text-white block">KYC Verified &amp; Approved</strong>
              <span className="text-xs text-emerald-300">Ready to accept deliveries online</span>
            </div>
          </div>
          <span className="bg-emerald-500 text-slate-950 font-black text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider">
            Approved
          </span>
        </div>

        {/* Verified Documents List */}
        <div className="space-y-2.5">
          <h4 className="font-black text-xs uppercase tracking-wider text-slate-400">
            Uploaded Documents ({docs.length})
          </h4>

          <div className="space-y-2">
            {docs.map((doc) => (
              <div
                key={doc.id}
                className="bg-slate-950 border border-slate-800 p-3 rounded-2xl flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <div>
                    <strong className="text-white capitalize block">{doc.type.replace(/_/g, ' ')}</strong>
                    <span className="text-slate-400 font-mono">{doc.documentNumber}</span>
                  </div>
                </div>

                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold text-[10px] px-2 py-0.5 rounded-full capitalize">
                  {doc.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Add / Update Document Form */}
        <form onSubmit={handleSubmit} className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3 text-xs">
          <h5 className="font-bold text-white flex items-center gap-1.5">
            <UploadCloud className="w-4 h-4 text-emerald-400" />
            Submit New Document / Vehicle Update
          </h5>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Document Type</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-bold focus:border-emerald-500 focus:outline-none"
            >
              <option value="driving_license">Driving License (DL)</option>
              <option value="vehicle_rc">Vehicle Registration (RC)</option>
              <option value="aadhaar">Aadhaar Card</option>
              <option value="pan">PAN Card</option>
              <option value="bank_passbook">Bank Account / Passbook</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Document / ID Number</label>
            <input
              type="text"
              placeholder="e.g. DL-MH-2024-001234"
              value={docNumber}
              onChange={(e) => setDocNumber(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-mono font-bold focus:border-emerald-500 focus:outline-none"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg transition-transform active:scale-95 cursor-pointer"
          >
            Submit for Admin Review
          </button>
        </form>
      </div>
    </div>
  );
};
