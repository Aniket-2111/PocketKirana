'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { Banner, BannerPlatform, BannerDestinationType, BannerStatus } from '@/types';
import {
  Image as ImageIcon,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  ExternalLink,
  Layers,
  Sparkles,
  X,
  Sliders,
  Globe,
  Smartphone,
  Calendar,
  Clock,
  Tag,
  Monitor,
  ChevronDown,
  Zap,
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

type PlacementFilter = 'all' | 'promo_dual' | 'hero';

const PLATFORM_OPTIONS: { value: BannerPlatform; label: string; icon: React.ReactNode }[] = [
  { value: 'WEB_AND_APP', label: 'Website + App', icon: <Layers className="w-3.5 h-3.5" /> },
  { value: 'WEB', label: 'Website Only', icon: <Monitor className="w-3.5 h-3.5" /> },
  { value: 'APP', label: 'App Only', icon: <Smartphone className="w-3.5 h-3.5" /> },
];

const DESTINATION_OPTIONS: { value: BannerDestinationType; label: string }[] = [
  { value: 'CATEGORY', label: 'Category Page' },
  { value: 'BRAND', label: 'Brand Page' },
  { value: 'PRODUCT', label: 'Product Page' },
  { value: 'OFFER', label: 'Offer / Promo Page' },
  { value: 'CAMPAIGN', label: 'Campaign Landing' },
  { value: 'URL', label: 'Custom URL' },
  { value: 'NO_ACTION', label: 'No Action' },
];

const STATUS_BADGE: Record<string, { color: string; label: string }> = {
  LIVE:       { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', label: '● LIVE' },
  SCHEDULED:  { color: 'bg-blue-100 text-blue-800 border-blue-200',          label: '⏰ SCHEDULED' },
  PAUSED:     { color: 'bg-amber-100 text-amber-800 border-amber-200',       label: '⏸ PAUSED' },
  EXPIRED:    { color: 'bg-rose-100 text-rose-700 border-rose-200',          label: '✕ EXPIRED' },
  DRAFT:      { color: 'bg-slate-100 text-slate-600 border-slate-200',       label: '✎ DRAFT' },
};

function getComputedStatus(banner: Banner): BannerStatus {
  if (banner.status === 'DRAFT') return 'DRAFT';
  if (banner.status === 'PAUSED' || !banner.active) return 'PAUSED';
  const now = Date.now();
  if (banner.startDate && now < new Date(banner.startDate).getTime()) return 'SCHEDULED';
  if (banner.endDate && now > new Date(banner.endDate).getTime()) return 'EXPIRED';
  return 'LIVE';
}

const defaultFormData = (): Partial<Banner> => ({
  title: '',
  subtitle: '',
  image: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=600&q=80',
  redirectUrl: '/category/fruits-vegetables',
  tag: '',
  badge: '',
  buttonText: 'SHOP NOW',
  placement: 'promo_dual',
  active: true,
  platform: 'WEB_AND_APP',
  status: 'LIVE',
  destinationType: 'CATEGORY',
  destinationId: '',
  startDate: '',
  endDate: '',
  priority: 1,
});

export function BannerManagementView() {
  const { banners, addBanner, updateBanner, deleteBanner, toggleBannerStatus, categories, brands } =
    useAppStore();

  const [activeFilter, setActiveFilter] = useState<PlacementFilter>('all');
  const [platformFilter, setPlatformFilter] = useState<'all' | BannerPlatform>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [formData, setFormData] = useState<Partial<Banner>>(defaultFormData());
  const [isSaving, setIsSaving] = useState(false);

  const fd = (patch: Partial<Banner>) => setFormData((prev) => ({ ...prev, ...patch }));

  const handleOpenAddModal = (presetPlacement: 'hero' | 'promo_dual' = 'promo_dual') => {
    setEditingBanner(null);
    setFormData({ ...defaultFormData(), placement: presetPlacement });
    setShowModal(true);
  };

  const handleOpenEditModal = (banner: Banner) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title,
      subtitle: banner.subtitle || '',
      image: banner.image,
      redirectUrl: banner.redirectUrl,
      tag: banner.tag || '',
      badge: banner.badge || banner.tag || '',
      buttonText: banner.buttonText || 'SHOP NOW',
      placement: banner.placement || (banner.id.startsWith('promo-') ? 'promo_dual' : 'hero'),
      active: banner.active,
      bgColor: banner.bgColor || '',
      platform: banner.platform || 'WEB_AND_APP',
      status: banner.status || 'LIVE',
      destinationType: banner.destinationType || 'CATEGORY',
      destinationId: banner.destinationId || '',
      startDate: banner.startDate || '',
      endDate: banner.endDate || '',
      priority: banner.priority ?? 1,
    });
    setShowModal(true);
  };

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title?.trim() || !formData.image?.trim()) {
      showToast('Please fill in banner title and image URL', 'error');
      return;
    }
    setIsSaving(true);

    const bannerPayload: Partial<Banner> = {
      title: formData.title,
      subtitle: formData.subtitle,
      image: formData.image,
      redirectUrl: formData.redirectUrl || '/categories',
      tag: formData.tag || formData.badge,
      badge: formData.badge || formData.tag,
      buttonText: formData.buttonText || 'SHOP NOW',
      placement: formData.placement || 'promo_dual',
      active: formData.status !== 'PAUSED' && formData.status !== 'DRAFT',
      bgColor: formData.bgColor,
      platform: formData.platform || 'WEB_AND_APP',
      status: formData.status || 'LIVE',
      destinationType: formData.destinationType || 'CATEGORY',
      destinationId: formData.destinationId || '',
      startDate: formData.startDate || undefined,
      endDate: formData.endDate || undefined,
      priority: Number(formData.priority) || 1,
    };

    try {
      // POST to canonical API
      await fetch('/api/content/banners', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-pk-role': 'admin',
          'x-pk-uid': 'admin_user',
        },
        body: JSON.stringify(editingBanner ? { ...bannerPayload, id: editingBanner.id } : bannerPayload),
      });
    } catch (_) {}

    if (editingBanner) {
      updateBanner(editingBanner.id, bannerPayload);
      showToast(`Banner "${formData.title}" updated successfully!`, 'success');
    } else {
      addBanner(bannerPayload as any);
      showToast('New banner created successfully!', 'success');
    }

    setIsSaving(false);
    setShowModal(false);
  };

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Are you sure you want to delete banner "${title}"?`)) {
      deleteBanner(id);
      showToast('Banner deleted', 'info');
    }
  };

  // Filtered banners
  const filteredBanners = (banners || []).filter((b) => {
    if (activeFilter !== 'all') {
      const isDual = b.placement === 'promo_dual' || b.id.startsWith('promo-');
      if (activeFilter === 'promo_dual' && !isDual) return false;
      if (activeFilter === 'hero' && isDual) return false;
    }
    if (platformFilter !== 'all') {
      const p = b.platform || 'WEB_AND_APP';
      if (p !== platformFilter && p !== 'WEB_AND_APP') return false;
    }
    return true;
  });

  // Get destination display name
  const getDestinationLabel = (banner: Banner) => {
    const dt = banner.destinationType || 'URL';
    const did = banner.destinationId;
    if (dt === 'CATEGORY' && did) {
      const cat = (categories || []).find((c) => c.id === did || c.slug === did);
      return cat ? `→ ${cat.name}` : `→ Category`;
    }
    if (dt === 'BRAND' && did) {
      const brand = (brands || []).find((b) => b.id === did || b.slug === did);
      return brand ? `→ ${brand.name}` : `→ Brand`;
    }
    if (dt === 'URL') return banner.redirectUrl ? `→ ${banner.redirectUrl}` : '';
    return dt ? `→ ${dt}` : '';
  };

  return (
    <div className="space-y-6">
      {/* ── HEADER & ACTIONS ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-emerald-600" />
            <span>Multi-Platform Banner Manager</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Schedule, target, and preview banners for Website, Customer App, or both
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleOpenAddModal('promo_dual')}
            className="bg-[#E65100] hover:bg-[#D84315] text-white text-xs font-black px-4 py-2.5 rounded-2xl flex items-center gap-2 transition-all shadow-2xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Promo Banner</span>
          </button>
          <button
            onClick={() => handleOpenAddModal('hero')}
            className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-black px-4 py-2.5 rounded-2xl flex items-center gap-2 transition-all shadow-2xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Hero Slide</span>
          </button>
        </div>
      </div>

      {/* ── FILTERS ROW ── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {/* Placement filter */}
        <div className="flex items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl w-fit border border-slate-200/80 text-xs font-bold">
          {(['all', 'promo_dual', 'hero'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeFilter === f
                  ? f === 'all' ? 'bg-white text-slate-900 shadow-2xs'
                    : f === 'promo_dual' ? 'bg-[#E65100] text-white shadow-2xs'
                    : 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {f === 'all' ? `All (${banners?.length ?? 0})` : f === 'promo_dual' ? 'Mid Promo' : 'Hero Slides'}
            </button>
          ))}
        </div>

        {/* Platform filter */}
        <div className="flex items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl w-fit border border-slate-200/80 text-xs font-bold">
          {(['all', 'WEB', 'APP', 'WEB_AND_APP'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPlatformFilter(p)}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                platformFilter === p
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {p === 'WEB' ? <Monitor className="w-3 h-3" /> : p === 'APP' ? <Smartphone className="w-3 h-3" /> : p === 'WEB_AND_APP' ? <Layers className="w-3 h-3" /> : null}
              {p === 'all' ? 'All Platforms' : p === 'WEB_AND_APP' ? 'Web+App' : p}
            </button>
          ))}
        </div>
      </div>

      {/* ── BANNERS GRID ── */}
      {filteredBanners.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200">
          <ImageIcon className="w-12 h-12 mb-3 opacity-30" />
          <p className="font-bold">No banners match this filter</p>
          <p className="text-xs mt-1">Create a new banner above</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredBanners.map((b) => {
            const computedStatus = getComputedStatus(b);
            const statusBadge = STATUS_BADGE[computedStatus] || STATUS_BADGE['DRAFT'];
            const isDualPromo = b.placement === 'promo_dual' || b.id.startsWith('promo-');
            const platform = b.platform || 'WEB_AND_APP';
            return (
              <div
                key={b.id}
                className={`bg-white rounded-3xl border ${
                  computedStatus === 'LIVE' ? 'border-emerald-200' :
                  computedStatus === 'SCHEDULED' ? 'border-blue-200' :
                  'border-slate-200/60 opacity-70'
                } p-5 space-y-3 shadow-2xs transition-all flex flex-col justify-between`}
              >
                {/* Meta Header */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${
                      isDualPromo ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}>
                      {isDualPromo ? 'Mid-Page Promo' : 'Hero Carousel'}
                    </span>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${statusBadge.color}`}>
                      {statusBadge.label}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1 border border-slate-200 px-2 py-0.5 rounded-md">
                      {platform === 'WEB' ? <><Monitor className="w-3 h-3" /> Web</> :
                       platform === 'APP' ? <><Smartphone className="w-3 h-3" /> App</> :
                       <><Layers className="w-3 h-3" /> Web+App</>}
                    </span>
                  </div>
                  <button
                    onClick={() => toggleBannerStatus(b.id)}
                    className={`text-xs px-3 py-1 rounded-full font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                      b.active
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                        : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    {b.active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    <span>{b.active ? 'Live' : 'Hidden'}</span>
                  </button>
                </div>

                {/* Banner Preview */}
                <div className="relative rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 flex items-center justify-between p-4 min-h-[130px]"
                  style={b.bgColor ? { background: b.bgColor } : {}}>
                  <div className="space-y-1 max-w-[65%]">
                    <h4 className="font-black text-sm text-slate-900 leading-snug line-clamp-2">{b.title}</h4>
                    {b.subtitle && (
                      <p className="text-xs text-slate-500 line-clamp-1">{b.subtitle}</p>
                    )}
                    <div className="pt-1 flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black text-[#0B8F5A] uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded">
                        {b.buttonText || 'SHOP NOW'} →
                      </span>
                      <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                        {getDestinationLabel(b)}
                      </span>
                    </div>
                  </div>
                  <div className="w-20 h-20 rounded-xl overflow-hidden border border-slate-200 bg-white shrink-0">
                    <img src={b.image} alt={b.title} className="w-full h-full object-cover" />
                  </div>
                </div>

                {/* Schedule info */}
                {(b.startDate || b.endDate || b.priority) && (
                  <div className="flex items-center gap-3 text-[10px] text-slate-400 font-medium">
                    {b.startDate && (
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />
                        {new Date(b.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                    {b.endDate && (
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />
                        till {new Date(b.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                    {b.priority !== undefined && (
                      <span className="flex items-center gap-1"><Zap className="w-3 h-3" />P{b.priority}</span>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <span className="text-slate-400 font-mono text-[11px] truncate max-w-[150px]">
                    {b.id}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEditModal(b)}
                      className="p-2 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer flex items-center gap-1 font-bold text-xs"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(b.id, b.title)}
                      className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer flex items-center gap-1 font-bold text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── CREATE / EDIT BANNER MODAL ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {editingBanner ? 'Edit Promotional Banner' : 'Create New Banner'}
                </h3>
                <p className="text-xs text-slate-500">Configure platform, schedule, and destination</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBanner} className="space-y-4 text-xs font-bold">

              {/* Platform + Placement (2-col) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 mb-1.5">
                    <Layers className="w-3 h-3 inline mr-1" />Platform
                  </label>
                  <select
                    value={formData.platform}
                    onChange={(e) => fd({ platform: e.target.value as BannerPlatform })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-600"
                  >
                    {PLATFORM_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 mb-1.5">
                    <Monitor className="w-3 h-3 inline mr-1" />Placement
                  </label>
                  <select
                    value={formData.placement}
                    onChange={(e) => fd({ placement: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-600"
                  >
                    <option value="promo_dual">Mid-Page Dual Promo</option>
                    <option value="hero">Top Hero Carousel</option>
                    <option value="in_feed">In-Feed Banner</option>
                    <option value="popup">Popup Overlay</option>
                  </select>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-slate-700 mb-1.5">Banner Heading / Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Quality & Freshness Guaranteed"
                  value={formData.title}
                  onChange={(e) => fd({ title: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              {/* Subtitle */}
              <div>
                <label className="block text-slate-700 mb-1.5">Subtitle / Description</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Freshly picked seasonal fruits from certified farms."
                  value={formData.subtitle}
                  onChange={(e) => fd({ subtitle: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              {/* Image URL */}
              <div>
                <label className="block text-slate-700 mb-1.5">Image URL *</label>
                <input
                  type="url"
                  required
                  placeholder="https://images.unsplash.com/..."
                  value={formData.image}
                  onChange={(e) => fd({ image: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-600"
                />
                {formData.image && (
                  <div className="mt-2 w-full h-20 rounded-xl overflow-hidden border border-slate-100">
                    <img src={formData.image} alt="preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              {/* Badge + CTA Button */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 mb-1.5">Badge / Tag Text</label>
                  <input
                    type="text"
                    placeholder="e.g. 100% NATURAL"
                    value={formData.badge}
                    onChange={(e) => fd({ badge: e.target.value, tag: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 mb-1.5">CTA Button Label</label>
                  <input
                    type="text"
                    placeholder="SHOP NOW"
                    value={formData.buttonText}
                    onChange={(e) => fd({ buttonText: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Destination Type + ID */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 mb-1.5">
                    <ExternalLink className="w-3 h-3 inline mr-1" />Destination Type
                  </label>
                  <select
                    value={formData.destinationType}
                    onChange={(e) => fd({ destinationType: e.target.value as BannerDestinationType })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-600"
                  >
                    {DESTINATION_OPTIONS.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 mb-1.5">Destination ID / URL</label>
                  {formData.destinationType === 'CATEGORY' ? (
                    <select
                      value={formData.destinationId}
                      onChange={(e) => fd({ destinationId: e.target.value, redirectUrl: `/category/${e.target.value}` })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-600"
                    >
                      <option value="">-- Select Category --</option>
                      {(categories || []).filter((c) => c.isActive).map((c) => (
                        <option key={c.id} value={c.slug}>{c.name}</option>
                      ))}
                    </select>
                  ) : formData.destinationType === 'BRAND' ? (
                    <select
                      value={formData.destinationId}
                      onChange={(e) => fd({ destinationId: e.target.value, redirectUrl: `/brand/${e.target.value}` })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-600"
                    >
                      <option value="">-- Select Brand --</option>
                      {(brands || []).filter((b) => b.isActive).map((b) => (
                        <option key={b.id} value={b.slug}>{b.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder={formData.destinationType === 'URL' ? 'https://...' : 'ID / slug'}
                      value={formData.destinationId || formData.redirectUrl || ''}
                      onChange={(e) => fd({ destinationId: e.target.value, redirectUrl: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-600"
                    />
                  )}
                </div>
              </div>

              {/* Status + Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 mb-1.5">
                    <Sparkles className="w-3 h-3 inline mr-1" />Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => fd({ status: e.target.value as BannerStatus, active: e.target.value === 'LIVE' })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-600"
                  >
                    <option value="LIVE">● LIVE (Active)</option>
                    <option value="SCHEDULED">⏰ SCHEDULED</option>
                    <option value="PAUSED">⏸ PAUSED</option>
                    <option value="DRAFT">✎ DRAFT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 mb-1.5">
                    <Zap className="w-3 h-3 inline mr-1" />Priority (1 = highest)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={formData.priority ?? 1}
                    onChange={(e) => fd({ priority: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Start + End Date scheduling */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 mb-1.5">
                    <Calendar className="w-3 h-3 inline mr-1" />Start Date (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.startDate ? formData.startDate.slice(0, 16) : ''}
                    onChange={(e) => fd({ startDate: e.target.value ? new Date(e.target.value).toISOString() : '' })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 mb-1.5">
                    <Clock className="w-3 h-3 inline mr-1" />End Date (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.endDate ? formData.endDate.slice(0, 16) : ''}
                    onChange={(e) => fd({ endDate: e.target.value ? new Date(e.target.value).toISOString() : '' })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Dual Preview */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2">
                <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Live Preview</p>
                <div className="grid grid-cols-2 gap-3">
                  {/* Web Preview */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <div className="bg-slate-800 text-white text-[9px] px-2 py-1 font-bold flex items-center gap-1">
                      <Monitor className="w-3 h-3" /> Website Preview
                    </div>
                    <div className="relative flex items-center justify-between p-3 bg-gradient-to-br from-slate-50 to-slate-100 min-h-[90px]">
                      <div className="space-y-1 max-w-[60%]">
                        <p className="font-black text-[11px] text-slate-900 leading-tight line-clamp-2">
                          {formData.title || 'Banner Title'}
                        </p>
                        {formData.subtitle && (
                          <p className="text-[10px] text-slate-500 line-clamp-1">{formData.subtitle}</p>
                        )}
                        <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                          {formData.buttonText || 'SHOP NOW'} →
                        </span>
                      </div>
                      {formData.image && (
                        <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-slate-200">
                          <img src={formData.image} alt="preview" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  </div>
                  {/* App Preview */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <div className="bg-emerald-800 text-white text-[9px] px-2 py-1 font-bold flex items-center gap-1">
                      <Smartphone className="w-3 h-3" /> App Preview
                    </div>
                    <div className="relative flex items-center justify-between p-3 bg-gradient-to-br from-emerald-50 to-teal-50 min-h-[90px]">
                      <div className="space-y-1 max-w-[60%]">
                        <p className="font-black text-[11px] text-slate-900 leading-tight line-clamp-2">
                          {formData.title || 'Banner Title'}
                        </p>
                        {formData.badge && (
                          <span className="text-[9px] font-black bg-[#E65100] text-white px-1.5 py-0.5 rounded">
                            {formData.badge}
                          </span>
                        )}
                        <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                          {formData.buttonText || 'SHOP NOW'} →
                        </span>
                      </div>
                      {formData.image && (
                        <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-emerald-200">
                          <img src={formData.image} alt="preview" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-[#0B8F5A] hover:bg-[#075C3C] text-white font-black px-6 py-2.5 rounded-xl shadow-md transition-all cursor-pointer text-xs disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : editingBanner ? 'Save Changes' : 'Publish Banner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
