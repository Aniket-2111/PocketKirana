'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Banner } from '@/types';
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
  ArrowRight,
  X,
  Layout,
  Sliders,
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

export function BannerManagementView() {
  const { banners, addBanner, updateBanner, deleteBanner, toggleBannerStatus } = useAppStore();

  const [activeFilter, setActiveFilter] = useState<'all' | 'promo_dual' | 'hero'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Banner>>({
    title: '',
    subtitle: '',
    image: '',
    redirectUrl: '',
    tag: '',
    badge: '',
    buttonText: 'SHOP NOW',
    placement: 'promo_dual',
    active: true,
  });

  const handleOpenAddModal = (presetPlacement: 'hero' | 'promo_dual' = 'promo_dual') => {
    setEditingBanner(null);
    setFormData({
      title: '',
      subtitle: '',
      image: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=600&q=80',
      redirectUrl: '/category/fruits-vegetables',
      tag: presetPlacement === 'promo_dual' ? '100% NATURAL' : 'TOP DEALS',
      badge: presetPlacement === 'promo_dual' ? '100% NATURAL' : 'TOP DEALS',
      buttonText: 'SHOP NOW',
      placement: presetPlacement,
      active: true,
    });
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
    });
    setShowModal(true);
  };

  const handleSaveBanner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title?.trim() || !formData.image?.trim()) {
      showToast('Please fill in banner title and image URL', 'error');
      return;
    }

    if (editingBanner) {
      updateBanner(editingBanner.id, {
        title: formData.title,
        subtitle: formData.subtitle,
        image: formData.image,
        redirectUrl: formData.redirectUrl || '/categories',
        tag: formData.tag || formData.badge,
        badge: formData.badge || formData.tag,
        buttonText: formData.buttonText || 'SHOP NOW',
        placement: formData.placement || 'promo_dual',
        active: formData.active !== false,
        bgColor: formData.bgColor,
      });
      showToast(`Banner "${formData.title}" updated successfully!`, 'success');
    } else {
      addBanner({
        title: formData.title,
        subtitle: formData.subtitle,
        image: formData.image,
        redirectUrl: formData.redirectUrl || '/categories',
        tag: formData.tag || formData.badge,
        badge: formData.badge || formData.tag,
        buttonText: formData.buttonText || 'SHOP NOW',
        placement: formData.placement || 'promo_dual',
        active: formData.active !== false,
        bgColor: formData.bgColor,
      });
      showToast(`New banner created successfully!`, 'success');
    }

    setShowModal(false);
  };

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Are you sure you want to delete banner "${title}"?`)) {
      deleteBanner(id);
      showToast(`Banner deleted`, 'info');
    }
  };

  // Filtered banners
  const filteredBanners = (banners || []).filter((b) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'promo_dual') {
      return b.placement === 'promo_dual' || b.id.startsWith('promo-');
    }
    if (activeFilter === 'hero') {
      return b.placement === 'hero' || (!b.placement && !b.id.startsWith('promo-'));
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* ── HEADER & ACTIONS ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-emerald-600" />
            <span>Promotional Banners &amp; Marketing</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Manage Mid-Page Promotional Banners, Hero Carousel Slides, and Homepage CTAs
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleOpenAddModal('promo_dual')}
            className="bg-[#E65100] hover:bg-[#D84315] text-white text-xs font-black px-4 py-2.5 rounded-2xl flex items-center gap-2 transition-all shadow-2xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Mid Promo Banner</span>
          </button>

          <button
            onClick={() => handleOpenAddModal('hero')}
            className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-black px-4 py-2.5 rounded-2xl flex items-center gap-2 transition-all shadow-2xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Hero Slide</span>
          </button>
        </div>
      </div>

      {/* ── FILTER PILLS ── */}
      <div className="flex items-center gap-2 bg-slate-100/80 p-1.5 rounded-2xl w-fit border border-slate-200/80 text-xs font-bold">
        <button
          onClick={() => setActiveFilter('all')}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
            activeFilter === 'all'
              ? 'bg-white text-slate-900 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          All Banners ({banners.length})
        </button>
        <button
          onClick={() => setActiveFilter('promo_dual')}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
            activeFilter === 'promo_dual'
              ? 'bg-[#E65100] text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Mid-Page Dual Promo Banners
        </button>
        <button
          onClick={() => setActiveFilter('hero')}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
            activeFilter === 'hero'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Hero Slideshow Banners
        </button>
      </div>

      {/* ── BANNERS GRID ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredBanners.map((b) => {
          const isDualPromo = b.placement === 'promo_dual' || b.id.startsWith('promo-');
          return (
            <div
              key={b.id}
              className={`bg-white rounded-3xl border ${
                b.active ? 'border-slate-200/80' : 'border-slate-200/50 opacity-60'
              } p-5 space-y-4 shadow-2xs transition-all flex flex-col justify-between`}
            >
              {/* Top Meta Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md ${
                      isDualPromo
                        ? 'bg-amber-100 text-amber-900 border border-amber-200'
                        : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                    }`}
                  >
                    {isDualPromo ? 'Mid-Page Dual Promo' : 'Top Hero Carousel'}
                  </span>
                  {b.badge && (
                    <span className="bg-[#E65100] text-white text-[9px] font-black uppercase px-2 py-0.5 rounded">
                      {b.badge}
                    </span>
                  )}
                </div>

                {/* Active Toggle Switch */}
                <button
                  onClick={() => toggleBannerStatus(b.id)}
                  className={`text-xs px-3 py-1 rounded-full font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                    b.active
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                      : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {b.active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  <span>{b.active ? 'Active' : 'Hidden'}</span>
                </button>
              </div>

              {/* Banner Live Visual Preview */}
              <div className="relative rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 flex items-center justify-between p-4 min-h-[140px]">
                <div className="space-y-1.5 max-w-[65%]">
                  <h4 className="font-black text-sm text-slate-900 leading-snug">{b.title}</h4>
                  {b.subtitle && (
                    <p className="text-xs text-slate-500 line-clamp-2">{b.subtitle}</p>
                  )}
                  <div className="pt-1 flex items-center gap-2">
                    <span className="text-[10px] font-black text-[#0B8F5A] uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded">
                      {b.buttonText || 'SHOP NOW'} &rarr;
                    </span>
                    <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                      {b.redirectUrl}
                    </span>
                  </div>
                </div>

                <div className="w-20 h-20 rounded-xl overflow-hidden border border-slate-200 bg-white shrink-0">
                  <img src={b.image} alt={b.title} className="w-full h-full object-cover" />
                </div>
              </div>

              {/* Actions Row */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <span className="text-slate-400 font-mono text-[11px] truncate max-w-[160px]">
                  ID: {b.id}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEditModal(b)}
                    className="p-2 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer flex items-center gap-1 font-bold text-xs"
                    title="Edit Banner"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleDelete(b.id, b.title)}
                    className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer flex items-center gap-1 font-bold text-xs"
                    title="Delete Banner"
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

      {/* ── CREATE / EDIT BANNER MODAL ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {editingBanner ? 'Edit Promotional Banner' : 'Create New Promotional Banner'}
                </h3>
                <p className="text-xs text-slate-500">
                  Configure live marketing banner displayed on customer homepage
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveBanner} className="space-y-4 text-xs font-bold">
              {/* Placement Selector */}
              <div>
                <label className="block text-slate-700 mb-1.5">Banner Placement Location</label>
                <select
                  value={formData.placement}
                  onChange={(e) =>
                    setFormData({ ...formData, placement: e.target.value as any })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-600"
                >
                  <option value="promo_dual">Mid-Page Dual Promo Banner (Home 2-Column)</option>
                  <option value="hero">Top Hero Carousel Slider (Full-Width Home)</option>
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-slate-700 mb-1.5">Banner Main Heading / Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Quality & Freshness Guaranteed"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              {/* Subtitle / Description */}
              <div>
                <label className="block text-slate-700 mb-1.5">Subtitle / Description</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Freshly picked seasonal fruits and daily staples sourced from certified farms."
                  value={formData.subtitle}
                  onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
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
                  onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              {/* Badge / Tag & Button Text */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 mb-1.5">Badge / Tag Text</label>
                  <input
                    type="text"
                    placeholder="e.g. 100% NATURAL"
                    value={formData.badge}
                    onChange={(e) =>
                      setFormData({ ...formData, badge: e.target.value, tag: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 mb-1.5">CTA Button Label</label>
                  <input
                    type="text"
                    placeholder="e.g. SHOP NOW"
                    value={formData.buttonText}
                    onChange={(e) => setFormData({ ...formData, buttonText: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Destination URL */}
              <div>
                <label className="block text-slate-700 mb-1.5">Destination Link (Click Action)</label>
                <input
                  type="text"
                  placeholder="e.g. /category/fruits-vegetables or /brand/amul"
                  value={formData.redirectUrl}
                  onChange={(e) => setFormData({ ...formData, redirectUrl: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              {/* Status */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="bannerActiveCheckbox"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="bannerActiveCheckbox" className="text-slate-800 cursor-pointer">
                  Active (Show on customer homepage)
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#0B8F5A] hover:bg-[#075C3C] text-white font-black px-6 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
                >
                  {editingBanner ? 'Save Changes' : 'Create Banner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
