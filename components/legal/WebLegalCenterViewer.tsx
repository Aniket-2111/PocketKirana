'use client';

import React, { useState, useMemo } from 'react';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { LEGAL_DOCUMENTS, LegalDocument } from '@/lib/legalData';
import {
  Building2,
  FileText,
  ShieldCheck,
  Cookie,
  RotateCcw,
  Truck,
  HelpCircle,
  CreditCard,
  CheckCircle2,
  Search,
  ChevronRight,
  Share2,
  Printer,
  Shield,
  Phone,
  Mail
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

const ICON_MAP: Record<string, React.ReactNode> = {
  Building2: <Building2 className="w-5 h-5" />,
  FileText: <FileText className="w-5 h-5" />,
  ShieldCheck: <ShieldCheck className="w-5 h-5" />,
  Cookie: <Cookie className="w-5 h-5" />,
  RotateCcw: <RotateCcw className="w-5 h-5" />,
  Truck: <Truck className="w-5 h-5" />,
  HelpCircle: <HelpCircle className="w-5 h-5" />,
  CreditCard: <CreditCard className="w-5 h-5" />,
  CheckCircle2: <CheckCircle2 className="w-5 h-5" />,
};

interface WebLegalCenterViewerProps {
  initialSlug?: string;
}

export default function WebLegalCenterViewer({ initialSlug = 'disclosures' }: WebLegalCenterViewerProps) {
  const [activeSlug, setActiveSlug] = useState(initialSlug);
  const [searchQuery, setSearchQuery] = useState('');

  const currentDoc: LegalDocument = useMemo(() => {
    return LEGAL_DOCUMENTS.find((d) => d.slug === activeSlug) || LEGAL_DOCUMENTS[0];
  }, [activeSlug]);

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return currentDoc.sections;
    const q = searchQuery.toLowerCase();
    return currentDoc.sections.filter(
      (s) =>
        s.heading.toLowerCase().includes(q) ||
        s.content.some((c) => c.toLowerCase().includes(q))
    );
  }, [currentDoc, searchQuery]);

  const handleShare = () => {
    const url = typeof window !== 'undefined' ? window.location.href : 'https://pocketkirana.in/legal';
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: `${currentDoc.title} — Pocket Kirana`,
        text: currentDoc.summary,
        url,
      }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url);
      showToast('Policy link copied to clipboard!', 'success');
    }
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <>
      <RoleSwitcher />
      <CustomerLayout>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 font-sans">
          <Breadcrumb
            items={[
              { label: 'Home', href: '/' },
              { label: 'Legal & Policies', href: '/legal' },
              { label: currentDoc.title },
            ]}
          />

          {/* ══ HERO HEADER BANNER ══ */}
          <div className="relative rounded-3xl p-8 sm:p-10 overflow-hidden text-white bg-gradient-to-r from-[#004D21] via-[#006E2F] to-[#003B19] shadow-xl border border-[#acf847]/20">
            <div className="relative z-10 max-w-3xl space-y-3">
              <div className="inline-flex items-center gap-2 bg-[#acf847]/20 text-[#acf847] text-xs font-black px-3.5 py-1 rounded-full border border-[#acf847]/30">
                <Shield className="w-3.5 h-3.5" />
                <span>Statutory Compliance &amp; Consumer Disclosures</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
                Pocket Kirana Legal &amp; Compliance Center
              </h1>
              <p className="text-sm sm:text-base text-emerald-100 font-medium leading-relaxed">
                Maule Kirana Store operator identity, FSSAI registration (21526070001778), DPDP data privacy standards, and consumer protection policies.
              </p>
            </div>
          </div>

          {/* ══ MAIN TWO-COLUMN LAYOUT ══ */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* LEFT SIDEBAR: POLICIES NAVIGATION LIST */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs sticky top-24 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                    Policy Documents
                  </h2>
                  <span className="text-xs font-black text-[#006E2F] bg-emerald-50 px-2 py-0.5 rounded-full">
                    9 Active
                  </span>
                </div>

                <nav className="space-y-1.5">
                  {LEGAL_DOCUMENTS.map((doc) => {
                    const isSelected = doc.slug === activeSlug;
                    return (
                      <button
                        key={doc.id}
                        onClick={() => {
                          setActiveSlug(doc.slug);
                          setSearchQuery('');
                        }}
                        className={`w-full p-3.5 rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#006E2F] text-white shadow-md shadow-[#006E2F]/20 scale-101'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-2 rounded-xl shrink-0 ${
                            isSelected ? 'bg-white/20 text-[#acf847]' : 'bg-white text-slate-500 shadow-xs'
                          }`}>
                            {ICON_MAP[doc.icon] || <FileText className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-black truncate">{doc.title}</div>
                            <div className={`text-[11px] truncate ${isSelected ? 'text-emerald-100' : 'text-slate-500'}`}>
                              {doc.badge}
                            </div>
                          </div>
                        </div>
                        <ChevronRight className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                      </button>
                    );
                  })}
                </nav>

                {/* Grievance Quick Box */}
                <div className="bg-[#FFF8F0] border border-[#FFE0B2] rounded-2xl p-4 text-xs space-y-2">
                  <div className="font-black text-slate-900 flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-[#E88B00]" />
                    <span>Grievance Officer</span>
                  </div>
                  <p className="text-slate-600">Aniket Yadav · Lead Operations</p>
                  <p className="text-slate-600 font-mono text-[11px]">support@pocketkirana.in</p>
                  <p className="text-slate-600 font-mono text-[11px]">+91 86988 93348</p>
                </div>
              </div>
            </div>

            {/* RIGHT CONTENT: ACTIVE POLICY VIEWER */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Search in Policy */}
              <div className="relative">
                <div className="flex items-center gap-3 bg-white border border-slate-200 focus-within:border-[#006E2F] rounded-2xl px-4 py-3 shadow-xs transition-all">
                  <Search className="w-5 h-5 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    placeholder={`Search within ${currentDoc.title}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 text-sm font-medium text-slate-900 placeholder-slate-400 bg-transparent focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="text-xs text-slate-400 hover:text-slate-600 font-bold px-1.5"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Policy Container */}
              <article className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
                
                {/* Header */}
                <div className="border-b border-slate-100 pb-6 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="inline-block bg-[#FFF8F0] border border-[#FFE0B2] text-[#E88B00] text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
                      {currentDoc.badge}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleShare}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-[#006E2F] text-xs font-bold transition-colors cursor-pointer border border-slate-200"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Share</span>
                      </button>
                      <button
                        onClick={handlePrint}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-[#006E2F] text-xs font-bold transition-colors cursor-pointer border border-slate-200"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print</span>
                      </button>
                    </div>
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    {currentDoc.title}
                  </h2>
                  <p className="text-sm text-slate-600 font-medium leading-relaxed">
                    {currentDoc.subtitle}
                  </p>
                  <div className="text-xs font-bold text-slate-400">
                    Effective Date: {currentDoc.effectiveDate} · Single Store Fulfillment Model · Maule Kirana Store
                  </div>
                </div>

                {/* Summary Box */}
                <div className="bg-[#FFF8F0] border border-[#FFE0B2]/60 rounded-2xl p-4 text-sm text-slate-700 font-medium leading-relaxed">
                  <strong className="text-slate-900 block font-black mb-1">Executive Summary:</strong>
                  {currentDoc.summary}
                </div>

                {/* Sections List */}
                <div className="space-y-6 divide-y divide-slate-100">
                  {filteredSections.map((sec, idx) => (
                    <div
                      key={idx}
                      className={`pt-6 first:pt-0 space-y-3 ${
                        sec.important
                          ? 'bg-emerald-50/70 -mx-4 sm:-mx-6 px-4 sm:px-6 py-5 rounded-2xl border border-emerald-200/60'
                          : ''
                      }`}
                    >
                      <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                        {sec.important && <CheckCircle2 className="w-5 h-5 text-[#006E2F] shrink-0" />}
                        <span>{sec.heading}</span>
                      </h3>
                      <div className="space-y-2 text-sm text-slate-600 font-medium leading-relaxed">
                        {sec.content.map((p, pIdx) => (
                          <p key={pIdx} className="flex items-start gap-2.5">
                            <span className="text-emerald-700 font-bold mt-0.5">•</span>
                            <span className="flex-1">{p}</span>
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}

                  {filteredSections.length === 0 && (
                    <div className="py-12 text-center text-slate-400 space-y-2">
                      <Search className="w-8 h-8 mx-auto text-slate-300" />
                      <p className="text-sm font-bold">No clauses matching "{searchQuery}"</p>
                      <button
                        onClick={() => setSearchQuery('')}
                        className="text-xs text-[#006E2F] font-black underline cursor-pointer"
                      >
                        Reset Search
                      </button>
                    </div>
                  )}
                </div>

              </article>
            </div>

          </div>
        </div>
      </CustomerLayout>
    </>
  );
}
