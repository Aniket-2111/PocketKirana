'use client';

import React, { useState, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import {
  HomepageLayoutConfig,
  HomepageSectionConfig,
  HomepageSectionType,
  CustomerPersona,
  SectionLayoutStyle,
} from '@/types/homepageCms';
import { DynamicHomepageRenderer } from '@/components/customer/DynamicHomepageRenderer';
import { showToast } from '@/components/ui/Toast';
import {
  Sparkles,
  Layers,
  Eye,
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Smartphone,
  Monitor,
  CheckCircle2,
  Calendar,
  Save,
  RotateCcw,
  Settings2,
  Edit3,
  X,
  Palette,
  Clock,
  Gift,
  Flame,
  Users,
  Search,
  Check,
} from 'lucide-react';

const SECTION_TYPE_OPTIONS: { type: HomepageSectionType; label: string; icon: string; desc: string }[] = [
  { type: 'Hero', label: 'Hero Banner', icon: '🖼️', desc: 'Full-width top promotional visual with CTA' },
  { type: 'ShopByCategory', label: 'Shop By Category', icon: '🛒', desc: 'Circular category aisles' },
  { type: 'BuyAgain', label: 'Buy Again (Reorder)', icon: '🔄', desc: '1-tap instant reorder for customer staples' },
  { type: 'FlashSale', label: 'Flash Sale Deals', icon: '⚡', desc: 'Countdown deals with deep discounts' },
  { type: 'FrequentlyBoughtTogether', label: 'Frequently Bought Together', icon: '✨', desc: 'Curated 3-item value bundle with 1-tap add' },
  { type: 'RecommendedForYou', label: 'Recommended For You', icon: '❤️', desc: 'Multi-signal personalized algorithmic picks' },
  { type: 'FreeGift', label: 'Free Gift Milestone', icon: '🎁', desc: 'Spend ₹500+ dynamic unlocked gift progress' },
  { type: 'BecauseYouBought', label: 'Because You Bought', icon: '🍲', desc: 'Complementary cross-sell discovery' },
  { type: 'PopularProducts', label: 'Popular & Trending', icon: '⭐', desc: 'Highest rated neighborhood favorites' },
  { type: 'LoyaltyProgress', label: 'Loyalty Rewards Club', icon: '🏆', desc: 'Milestone progress towards ₹50 OFF reward' },
  { type: 'BrandCollections', label: 'Brand Collections', icon: '🏢', desc: 'Amul, Tata, Fortune, Aashirvaad logos' },
  { type: 'DailyEssentials', label: 'Daily Essentials', icon: '🥛', desc: 'Dairy, Bakery, Veg & Atta essentials' },
  { type: 'OfferBanner', label: 'Coupon / Promo Strip', icon: '🏷️', desc: 'Special discount code banner' },
];

export const HomepageStudioTab: React.FC = () => {
  const {
    activeHomepageLayout,
    homepageLayouts,
    festivalTemplates,
    products,
    categories,
    brands,
    saveHomepageSection,
    reorderHomepageSections,
    deleteHomepageSection,
    duplicateHomepageSection,
    publishHomepageLayout,
    applyFestivalTemplateToHomepage,
    resetHomepageLayoutToDefault,
  } = useAppStore();

  const [previewDevice, setPreviewDevice] = useState<'DESKTOP' | 'MOBILE'>('DESKTOP');
  const [previewPersona, setPreviewPersona] = useState<CustomerPersona>('ALL');
  const [editingSection, setEditingSection] = useState<HomepageSectionConfig | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  const sections = useMemo(
    () => [...(activeHomepageLayout?.sections || [])].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0)),
    [activeHomepageLayout]
  );

  // Move section UP
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newSections = [...sections];
    const temp = newSections[index];
    newSections[index] = newSections[index - 1];
    newSections[index - 1] = temp;
    reorderHomepageSections(newSections.map((s) => s.id));
    showToast('Section moved up', 'info');
  };

  // Move section DOWN
  const handleMoveDown = (index: number) => {
    if (index === sections.length - 1) return;
    const newSections = [...sections];
    const temp = newSections[index];
    newSections[index] = newSections[index + 1];
    newSections[index + 1] = temp;
    reorderHomepageSections(newSections.map((s) => s.id));
    showToast('Section moved down', 'info');
  };

  // Toggle active status
  const handleToggleActive = (section: HomepageSectionConfig) => {
    saveHomepageSection({ ...section, isActive: !section.isActive });
    showToast(`${section.title} ${section.isActive ? 'disabled' : 'enabled'}`, 'info');
  };

  // Duplicate section
  const handleDuplicate = (sectionId: string) => {
    const dup = duplicateHomepageSection(sectionId);
    if (dup) {
      showToast(`Duplicated ${dup.title}`, 'success');
    }
  };

  // Delete section
  const handleDelete = (sectionId: string) => {
    deleteHomepageSection(sectionId);
    showToast('Section removed', 'info');
  };

  // Publish layout
  const handlePublish = () => {
    const res = publishHomepageLayout();
    if (res.success) {
      showToast(res.message, 'success');
    }
  };

  // Apply template
  const handleSelectTemplate = (templateId: string) => {
    const res = applyFestivalTemplateToHomepage(templateId);
    if (res.success) {
      setIsTemplateModalOpen(false);
      showToast(res.message, 'success');
    }
  };

  // Create new section
  const handleCreateNewSection = (type: HomepageSectionType) => {
    const option = SECTION_TYPE_OPTIONS.find((o) => o.type === type);
    const newSec: HomepageSectionConfig = {
      id: `sec-${Date.now()}`,
      type,
      title: option?.label || 'New Section',
      subtitle: option?.desc,
      badge: 'FEATURED',
      layoutStyle: 'carousel',
      displayOrder: sections.length + 1,
      targetPersona: 'ALL',
      isActive: true,
      maxItems: 8,
    };
    saveHomepageSection(newSec);
    setIsAddModalOpen(false);
    setEditingSection(newSec);
    showToast(`Added ${newSec.title} section!`, 'success');
  };

  return (
    <div className="space-y-6">
      
      {/* ── TOP ACTION BAR & CONTROLS ── */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-[#0B8F5A] flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>Homepage Studio CMS</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300">
                  Version {activeHomepageLayout?.version || 1} • {activeHomepageLayout?.status || 'PUBLISHED'}
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Visually customize sections, reorder blocks, apply 20+ festival presets &amp; test personalized personas
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Apply Festival Template */}
          <button
            onClick={() => setIsTemplateModalOpen(true)}
            className="px-3.5 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Palette className="w-4 h-4 text-amber-700" />
            <span>Apply Festival Template</span>
          </button>

          {/* Add Section */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Section</span>
          </button>

          {/* Reset to Default */}
          <button
            onClick={() => {
              if (confirm('Reset homepage layout back to default master sections?')) {
                resetHomepageLayoutToDefault();
                showToast('Reset homepage to default layout', 'info');
              }
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
            title="Reset layout"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Publish Live */}
          <button
            onClick={handlePublish}
            className="px-4 py-2 rounded-xl bg-[#0B8F5A] hover:bg-[#075C3C] text-white font-extrabold text-xs shadow-md active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Publish Live</span>
          </button>
        </div>
      </div>

      {/* ── MAIN STUDIO GRID: LEFT SECTION BUILDER | RIGHT LIVE SIMULATOR ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ── LEFT: REORDERABLE CMS SECTIONS (5 Cols) ── */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              Homepage Layout Blocks ({sections.length})
            </span>
            <span className="text-[11px] text-slate-400 font-semibold">Top to Bottom Order</span>
          </div>

          <div className="space-y-2.5 max-h-[800px] overflow-y-auto pr-1">
            {sections.map((section, idx) => (
              <div
                key={section.id}
                className={`p-3.5 rounded-2xl border transition-all ${
                  section.isActive
                    ? 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-2xs'
                    : 'bg-slate-100/70 dark:bg-slate-900/40 border-dashed border-slate-300 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        {section.title}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-200/60">
                          {section.type}
                        </span>
                        {section.targetPersona !== 'ALL' && (
                          <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.2 rounded border border-purple-200/60">
                            {section.targetPersona}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Move Up */}
                    <button
                      onClick={() => handleMoveUp(idx)}
                      disabled={idx === 0}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 disabled:opacity-30 rounded-lg cursor-pointer"
                      title="Move Up"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    {/* Move Down */}
                    <button
                      onClick={() => handleMoveDown(idx)}
                      disabled={idx === sections.length - 1}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 disabled:opacity-30 rounded-lg cursor-pointer"
                      title="Move Down"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    {/* Toggle Active */}
                    <button
                      onClick={() => handleToggleActive(section)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-black cursor-pointer ${
                        section.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {section.isActive ? 'ACTIVE' : 'OFF'}
                    </button>
                    {/* Edit */}
                    <button
                      onClick={() => setEditingSection(section)}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg cursor-pointer"
                      title="Edit Section"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    {/* Duplicate */}
                    <button
                      onClick={() => handleDuplicate(section.id)}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 rounded-lg cursor-pointer"
                      title="Duplicate"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(section.id)}
                      className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT: LIVE SIMULATOR & PERSONA PREVIEW (7 Cols) ── */}
        <div className="lg:col-span-7 bg-slate-50 dark:bg-slate-950 p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-inner space-y-4">
          
          {/* Simulator Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Preview Device:</span>
              <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                <button
                  onClick={() => setPreviewDevice('DESKTOP')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    previewDevice === 'DESKTOP' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Desktop</span>
                </button>
                <button
                  onClick={() => setPreviewDevice('MOBILE')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    previewDevice === 'MOBILE' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Mobile</span>
                </button>
              </div>
            </div>

            {/* Persona Switcher */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Persona:</span>
              <select
                value={previewPersona}
                onChange={(e) => setPreviewPersona(e.target.value as CustomerPersona)}
                className="text-xs font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                <option value="ALL">All Customers (Default)</option>
                <option value="NEW_CUSTOMER">New Customer (First Order)</option>
                <option value="RETURNING_CUSTOMER">Returning Customer</option>
                <option value="FREQUENT_BUYER">Frequent Buyer (5+ Orders)</option>
                <option value="CART_ABANDONER">Cart Abandoner</option>
                <option value="LOYALTY_VIP">Loyalty VIP (10+ Orders)</option>
              </select>
            </div>
          </div>

          {/* Live Simulated Viewport */}
          <div className="flex justify-center w-full">
            <div
              className={`transition-all duration-300 ${
                previewDevice === 'MOBILE'
                  ? 'w-[385px] max-w-full bg-white dark:bg-slate-900 rounded-[38px] p-3 shadow-2xl border-8 border-slate-800'
                  : 'w-full bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-800'
              }`}
            >
              {previewDevice === 'MOBILE' && (
                <div className="w-32 h-4 bg-slate-800 rounded-full mx-auto mb-3" />
              )}

              <div className="max-h-[720px] overflow-y-auto pr-1">
                <DynamicHomepageRenderer previewPersona={previewPersona} />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── MODAL: EDIT SECTION MODAL ── */}
      {editingSection && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-black text-sm text-slate-900 dark:text-white">
                Edit Section: {editingSection.type}
              </h3>
              <button
                onClick={() => setEditingSection(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Title</label>
                <input
                  type="text"
                  value={editingSection.title}
                  onChange={(e) => setEditingSection({ ...editingSection, title: e.target.value })}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Subtitle</label>
                <input
                  type="text"
                  value={editingSection.subtitle || ''}
                  onChange={(e) => setEditingSection({ ...editingSection, subtitle: e.target.value })}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Badge Text</label>
                  <input
                    type="text"
                    value={editingSection.badge || ''}
                    onChange={(e) => setEditingSection({ ...editingSection, badge: e.target.value })}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2 font-bold uppercase focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Target Persona</label>
                  <select
                    value={editingSection.targetPersona}
                    onChange={(e) =>
                      setEditingSection({ ...editingSection, targetPersona: e.target.value as CustomerPersona })
                    }
                    className="w-full border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2 font-bold focus:outline-none"
                  >
                    <option value="ALL">All Customers</option>
                    <option value="NEW_CUSTOMER">New Customers Only</option>
                    <option value="RETURNING_CUSTOMER">Returning Customers</option>
                    <option value="FREQUENT_BUYER">Frequent Buyers</option>
                    <option value="CART_ABANDONER">Cart Abandoners</option>
                    <option value="LOYALTY_VIP">Loyalty VIPs</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">CTA Button Text</label>
                  <input
                    type="text"
                    value={editingSection.ctaText || ''}
                    placeholder="e.g. Shop Now, Explore All"
                    onChange={(e) => setEditingSection({ ...editingSection, ctaText: e.target.value })}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">CTA Link (Choose Preset or Custom)</label>
                  <select
                    value={
                      ['/categories', '/', '/cart', '/orders', '/offers', '/wallet'].includes(editingSection.ctaLink || '') ||
                      (categories || []).some((c) => `/categories?categoryId=${c.id}` === editingSection.ctaLink || `/category/${c.slug || c.id}` === editingSection.ctaLink) ||
                      (brands || []).some((b) => `/brand/${b.slug || b.id}` === editingSection.ctaLink)
                        ? (editingSection.ctaLink || '/categories')
                        : 'CUSTOM'
                    }
                    onChange={(e) => {
                      if (e.target.value !== 'CUSTOM') {
                        setEditingSection({ ...editingSection, ctaLink: e.target.value });
                      }
                    }}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
                  >
                    <optgroup label="Main App Pages">
                      <option value="/categories">📦 All Categories / Catalog (/categories)</option>
                      <option value="/">🏠 Customer Homepage (/)</option>
                      <option value="/offers">🏷️ Deals &amp; Offers (/offers)</option>
                      <option value="/cart">🛒 Shopping Cart (/cart)</option>
                      <option value="/orders">📋 My Orders (/orders)</option>
                      <option value="/wallet">💰 Wallet &amp; Rewards (/wallet)</option>
                    </optgroup>

                    {categories && categories.length > 0 && (
                      <optgroup label="Categories">
                        {categories.map((cat) => (
                          <option key={cat.id} value={`/categories?categoryId=${cat.id}`}>
                            📂 {cat.name} (/categories?categoryId={cat.id})
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {brands && brands.length > 0 && (
                      <optgroup label="Brand Showcases">
                        {brands.map((b) => (
                          <option key={b.id} value={`/brand/${b.slug || b.id}`}>
                            🏢 {b.name} (/brand/{b.slug || b.id})
                          </option>
                        ))}
                      </optgroup>
                    )}

                    <optgroup label="Custom Link">
                      <option value="CUSTOM">✏️ Custom URL or Path...</option>
                    </optgroup>
                  </select>
                  <input
                    type="text"
                    placeholder="e.g. /categories, /offers, or /campaign/diwali"
                    value={editingSection.ctaLink || ''}
                    onChange={(e) => setEditingSection({ ...editingSection, ctaLink: e.target.value })}
                    className="w-full mt-1.5 text-[11px] font-mono border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl px-2.5 py-1.5 focus:outline-none text-slate-700 dark:text-slate-300"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setEditingSection(null)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  saveHomepageSection(editingSection);
                  setEditingSection(null);
                  showToast('Section changes saved!', 'success');
                }}
                className="px-4 py-2 rounded-xl bg-[#0B8F5A] hover:bg-[#075C3C] text-white font-black text-xs shadow-sm cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD SECTION PICKER ── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white">Add Homepage Section</h3>
                <p className="text-xs text-slate-500">Choose a high-converting block to add to your homepage</p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 max-h-[420px] overflow-y-auto pr-1">
              {SECTION_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => handleCreateNewSection(opt.type)}
                  className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 bg-slate-50 dark:bg-slate-800/60 hover:bg-emerald-50/50 text-left transition-all cursor-pointer group"
                >
                  <span className="text-xl block mb-1">{opt.icon}</span>
                  <h4 className="font-black text-xs text-slate-900 dark:text-white group-hover:text-emerald-700">
                    {opt.label}
                  </h4>
                  <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: FESTIVAL TEMPLATES (20+ PRESETS) ── */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  <span>20+ Ready-Made Indian Festival &amp; Sale Templates</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Instantly transform your homepage for any festive celebration in 1 click
                </p>
              </div>
              <button
                onClick={() => setIsTemplateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[460px] overflow-y-auto pr-1">
              {(festivalTemplates || []).map((tpl) => (
                <div
                  key={tpl.id}
                  className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 shadow-2xs hover:shadow-md hover:border-emerald-500 transition-all flex flex-col justify-between gap-2.5"
                >
                  <div>
                    <div className="w-full h-20 rounded-xl overflow-hidden mb-2 bg-slate-100 relative">
                      <img
                        src={tpl.previewThumbnail}
                        alt={tpl.name}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-1.5 left-1.5 text-[9px] font-black px-1.5 py-0.5 rounded bg-black/60 text-white backdrop-blur-xs">
                        {tpl.festivalKey}
                      </span>
                    </div>
                    <h4 className="font-black text-xs text-slate-900 dark:text-white truncate">
                      {tpl.name}
                    </h4>
                    <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">{tpl.description}</p>
                  </div>

                  <button
                    onClick={() => handleSelectTemplate(tpl.id)}
                    className="w-full py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] shadow-2xs transition-all cursor-pointer"
                  >
                    Apply Template
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
