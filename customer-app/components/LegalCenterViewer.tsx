'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import CustomerShell from './CustomerShell';
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
  ExternalLink,
  ArrowLeft
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

const ICON_MAP: Record<string, React.ReactNode> = {
  Building2: <Building2 className="w-4 h-4" />,
  FileText: <FileText className="w-4 h-4" />,
  ShieldCheck: <ShieldCheck className="w-4 h-4" />,
  Cookie: <Cookie className="w-4 h-4" />,
  RotateCcw: <RotateCcw className="w-4 h-4" />,
  Truck: <Truck className="w-4 h-4" />,
  HelpCircle: <HelpCircle className="w-4 h-4" />,
  CreditCard: <CreditCard className="w-4 h-4" />,
  CheckCircle2: <CheckCircle2 className="w-4 h-4" />,
};

interface LegalCenterViewerProps {
  initialSlug?: string;
  isStandalone?: boolean;
}

export default function LegalCenterViewer({ initialSlug = 'disclosures', isStandalone = false }: LegalCenterViewerProps) {
  const router = useRouter();
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
    <CustomerShell title="Legal & Policies" showBack backUrl="/profile">
      <div className="space-y-4 animate-in fade-in duration-200 pb-24 max-w-md mx-auto">
        
        {/* ══ HERO BANNER (Brand Green & Cream Palette) ══ */}
        <div className="relative pt-6 pb-6 px-4 rounded-3xl overflow-hidden text-center bg-gradient-to-b from-[#006E2F] via-[#004D21] to-[#003B19] border border-[#acf847]/20 shadow-lg text-white">
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 flex items-center justify-center mx-auto mb-3 shadow-inner">
            <Shield className="w-6 h-6 text-[#acf847]" />
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">
            Legal &amp; Compliance Center
          </h1>
          <p className="text-xs text-emerald-100/80 mt-1 font-medium max-w-xs mx-auto">
            Transparency, statutory food licensing &amp; customer protections
          </p>
          <div className="mt-2.5 flex items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1 bg-[#acf847]/20 text-[#acf847] text-[10px] font-black px-2.5 py-0.5 rounded-full border border-[#acf847]/30">
              FSSAI: 21526070001778
            </span>
            <span className="inline-flex items-center gap-1 bg-white/15 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">
              Maule Kirana Store
            </span>
          </div>
        </div>

        {/* ══ POLICY SELECTOR HORIZONTAL TABS ══ */}
        <div className="space-y-2">
          <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 px-1 flex items-center justify-between">
            <span>Select Policy or Document</span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
              9 Policies
            </span>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-x">
            {LEGAL_DOCUMENTS.map((doc) => {
              const isSelected = doc.slug === activeSlug;
              return (
                <button
                  key={doc.id}
                  onClick={() => {
                    setActiveSlug(doc.slug);
                    setSearchQuery('');
                  }}
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-black shrink-0 transition-all cursor-pointer snap-start ${
                    isSelected
                      ? 'bg-[#006E2F] text-white shadow-md shadow-[#006E2F]/20 scale-102'
                      : 'bg-white text-slate-700 border border-slate-200 hover:border-emerald-300'
                  }`}
                >
                  <span className={isSelected ? 'text-[#acf847]' : 'text-slate-500'}>
                    {ICON_MAP[doc.icon] || <FileText className="w-4 h-4" />}
                  </span>
                  <span>{doc.title.split('—')[0].replace('Policy', '').trim()}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ══ SEARCH IN ACTIVE POLICY ══ */}
        <div className="relative">
          <div className="flex items-center gap-2 bg-white border border-slate-200 focus-within:border-[#006E2F] rounded-2xl px-3.5 py-2.5 shadow-xs transition-all">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder={`Search in ${currentDoc.title}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 text-xs font-medium text-slate-900 placeholder-slate-400 bg-transparent focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs text-slate-400 hover:text-slate-600 font-bold px-1"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* ══ ACTIVE DOCUMENT CARD ══ */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-5 shadow-xs">
          {/* Document Header */}
          <div className="border-b border-slate-100 pb-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-block bg-[#FFF8F0] border border-[#FFE0B2] text-[#E88B00] text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                {currentDoc.badge}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleShare}
                  className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-[#006E2F] flex items-center justify-center transition-colors cursor-pointer"
                  title="Share Link"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handlePrint}
                  className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-[#006E2F] flex items-center justify-center transition-colors cursor-pointer"
                  title="Print Document"
                >
                  <Printer className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <h2 className="text-lg font-black text-slate-900 tracking-tight leading-snug">
              {currentDoc.title}
            </h2>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              {currentDoc.subtitle}
            </p>
            <div className="text-[10px] font-bold text-slate-400 pt-1">
              Effective Date: {currentDoc.effectiveDate} · Single Seller Store Model
            </div>
          </div>

          {/* Document Summary Box */}
          <div className="bg-[#FFF8F0] border border-[#FFE0B2]/60 rounded-2xl p-3.5 text-xs text-slate-700 font-medium leading-relaxed">
            <strong className="text-slate-900 block font-black mb-0.5">Overview Summary:</strong>
            {currentDoc.summary}
          </div>

          {/* Sections */}
          <div className="space-y-4 divide-y divide-slate-100">
            {filteredSections.map((sec, idx) => (
              <div
                key={idx}
                className={`pt-4 first:pt-0 space-y-2 ${
                  sec.important
                    ? 'bg-emerald-50/60 -mx-3 px-3 py-3 rounded-2xl border border-emerald-200/50'
                    : ''
                }`}
              >
                <h3 className="text-xs font-black text-slate-900 flex items-center gap-2">
                  {sec.important && <CheckCircle2 className="w-4 h-4 text-[#006E2F] shrink-0" />}
                  <span>{sec.heading}</span>
                </h3>
                <div className="space-y-1.5 text-xs text-slate-600 font-medium leading-relaxed">
                  {sec.content.map((p, pIdx) => (
                    <p key={pIdx} className="flex items-start gap-2">
                      <span className="text-emerald-700 font-bold mt-0.5">•</span>
                      <span className="flex-1">{p}</span>
                    </p>
                  ))}
                </div>
              </div>
            ))}

            {filteredSections.length === 0 && (
              <div className="py-8 text-center text-slate-400 space-y-2">
                <Search className="w-6 h-6 mx-auto text-slate-300" />
                <p className="text-xs font-bold">No clauses matching "{searchQuery}"</p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-[#006E2F] font-black underline cursor-pointer"
                >
                  Clear Search
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ══ GRIEVANCE & SUPPORT CONTACT CARD ══ */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-3 shadow-xs">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-[#006E2F]" />
            <span>Questions or Grievances?</span>
          </h3>
          <p className="text-xs text-slate-600 font-medium leading-relaxed">
            Our Grievance Officer and customer support team are available daily for any order, refund, or data queries.
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
            <a
              href="mailto:support@pocketkirana.in"
              className="bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 p-3 rounded-2xl flex flex-col items-center text-center gap-1 transition-colors cursor-pointer"
            >
              <span className="font-black text-slate-900">Email Support</span>
              <span className="text-[10px] text-slate-500 font-medium truncate w-full">support@pocketkirana.in</span>
            </a>
            <a
              href="tel:+918698893348"
              className="bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 p-3 rounded-2xl flex flex-col items-center text-center gap-1 transition-colors cursor-pointer"
            >
              <span className="font-black text-slate-900">Call Support</span>
              <span className="text-[10px] text-slate-500 font-medium">+91 86988 93348</span>
            </a>
          </div>
        </div>

        {/* ══ ALL POLICIES DIRECT LINKS LIST ══ */}
        <div className="space-y-2 pt-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 px-1">
            All Legal Policies
          </h3>
          <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden shadow-xs">
            {LEGAL_DOCUMENTS.map((doc) => (
              <button
                key={doc.slug}
                onClick={() => {
                  setActiveSlug(doc.slug);
                  setSearchQuery('');
                  if (typeof window !== 'undefined') {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
                className={`w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer ${
                  doc.slug === activeSlug ? 'bg-emerald-50/50' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    doc.slug === activeSlug
                      ? 'bg-[#006E2F] text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {ICON_MAP[doc.icon] || <FileText className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900">{doc.title}</div>
                    <div className="text-[10px] text-slate-500 font-medium truncate max-w-[200px]">
                      {doc.subtitle}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            ))}
          </div>
        </div>

        {/* ══ BRAND FOOTER ══ */}
        <div className="text-center pt-4 pb-2 space-y-1">
          <div className="text-xs font-black text-slate-400">
            Pocket Kirana · Maule Kirana Store
          </div>
          <div className="text-[10px] text-slate-400 font-medium">
            FSSAI 21526070001778 · Neral, Maharashtra 410101
          </div>
        </div>

      </div>
    </CustomerShell>
  );
}
