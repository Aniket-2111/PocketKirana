'use client';

import React, { useState } from 'react';
import {
  PromotionOffer,
  CouponRule,
  LoyaltyMilestoneRule,
  DEFAULT_ACTIVE_OFFERS,
  DEFAULT_COUPONS,
  DEFAULT_LOYALTY_RULES,
  OfferStatus,
} from '@/lib/promotionsEngine';
import { MarketingDashboardTab } from './MarketingDashboardTab';
import { HomepageStudioTab } from './HomepageStudioTab';
import { OffersManagerTab } from './OffersManagerTab';
import { CreateOfferModal } from './CreateOfferModal';
import { CouponsManagerTab } from './CouponsManagerTab';
import { FestivalOffersTab } from './FestivalOffersTab';
import { BogoOffersTab } from './BogoOffersTab';
import { FreeGiftsTab } from './FreeGiftsTab';
import { LoyaltyMilestonesTab } from './LoyaltyMilestonesTab';
import { MarketingAnalyticsTab } from './MarketingAnalyticsTab';
import { AuditTrailTab } from './AuditTrailTab';
import { showToast } from '@/components/ui/Toast';
import {
  LayoutDashboard,
  SlidersHorizontal,
  Tag,
  Gift,
  Boxes,
  Sparkles,
  Award,
  BarChart3,
  ShieldCheck,
  Plus,
  Percent,
} from 'lucide-react';

export type MarketingSubTab =
  | 'homepage-studio'
  | 'dashboard'
  | 'offers'
  | 'coupons'
  | 'festivals'
  | 'bogo'
  | 'free_gifts'
  | 'loyalty'
  | 'analytics'
  | 'audit';

export function MarketingManagementView() {
  const [activeSubTab, setActiveSubTab] = useState<MarketingSubTab>('dashboard');

  // Master local state with persistence in memory / store
  const [offers, setOffers] = useState<PromotionOffer[]>(DEFAULT_ACTIVE_OFFERS);
  const [coupons, setCoupons] = useState<CouponRule[]>(DEFAULT_COUPONS);
  const [loyaltyRules, setLoyaltyRules] = useState<LoyaltyMilestoneRule[]>(DEFAULT_LOYALTY_RULES);

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingOffer, setEditingOffer] = useState<PromotionOffer | null>(null);

  // Offer Actions — wired to /api/content/offers for persistence
  const handleSaveOffer = async (offer: PromotionOffer) => {
    // Update local state immediately (optimistic)
    setOffers((prev) => {
      const idx = prev.findIndex((o) => o.id === offer.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = offer;
        return next;
      }
      return [offer, ...prev];
    });
    setEditingOffer(null);

    // Persist to backend
    try {
      await fetch('/api/content/offers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-pk-role': 'admin',
          'x-pk-uid': 'admin_user',
        },
        body: JSON.stringify(offer),
      });
    } catch (err) {
      console.error('[MarketingMgmt] Failed to persist offer:', err);
    }
  };

  const handleDuplicateOffer = async (offer: PromotionOffer) => {
    const duplicated: PromotionOffer = {
      ...offer,
      id: `off-${Date.now()}`,
      name: `${offer.name} (Copy)`,
      customerTitle: `${offer.customerTitle} (Copy)`,
      status: 'DRAFT',
    };
    setOffers((prev) => [duplicated, ...prev]);
    showToast(`Duplicated "${offer.name}" as draft.`, 'info');
    try {
      await fetch('/api/content/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-pk-role': 'admin', 'x-pk-uid': 'admin_user' },
        body: JSON.stringify(duplicated),
      });
    } catch (_) {}
  };

  const handleToggleOfferStatus = async (id: string, newStatus: OfferStatus) => {
    setOffers((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: newStatus } : o))
    );
    showToast(`Offer status updated to ${newStatus}.`, 'info');
    try {
      await fetch(`/api/content/offers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-pk-role': 'admin', 'x-pk-uid': 'admin_user' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (_) {}
  };

  const handleDeleteOffer = async (id: string) => {
    if (confirm('Are you sure you want to delete this offer?')) {
      setOffers((prev) => prev.filter((o) => o.id !== id));
      showToast('Offer deleted.', 'info');
      try {
        await fetch(`/api/content/offers/${id}`, {
          method: 'DELETE',
          headers: { 'x-pk-role': 'admin', 'x-pk-uid': 'admin_user' },
        });
      } catch (_) {}
    }
  };

  // Coupon Actions
  const handleAddCoupon = (newCoupon: CouponRule) => {
    setCoupons((prev) => [newCoupon, ...prev]);
  };

  const handleDeleteCoupon = (id: string) => {
    if (confirm('Are you sure you want to delete this coupon?')) {
      setCoupons((prev) => prev.filter((c) => c.id !== id));
      showToast('Coupon deleted.', 'info');
    }
  };

  const handleToggleCouponStatus = (id: string, active: boolean) => {
    setCoupons((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isActive: active } : c))
    );
    showToast(`Coupon status updated.`, 'info');
  };

  // Loyalty Actions
  const handleAddLoyaltyRule = (newRule: LoyaltyMilestoneRule) => {
    setLoyaltyRules((prev) => [newRule, ...prev]);
  };

  const handleDeleteLoyaltyRule = (id: string) => {
    if (confirm('Are you sure you want to delete this milestone rule?')) {
      setLoyaltyRules((prev) => prev.filter((r) => r.id !== id));
      showToast('Milestone rule deleted.', 'info');
    }
  };

  const handleToggleLoyaltyRule = (id: string, active: boolean) => {
    setLoyaltyRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isActive: active } : r))
    );
    showToast('Milestone rule updated.', 'info');
  };

  const handleLaunchFestivalPreset = async (preset: any) => {
    const newOffer: PromotionOffer = {
      id: `off-fest-${preset.name.toLowerCase()}-${Date.now()}`,
      name: `${preset.name} Festival Campaign`,
      customerTitle: preset.title,
      description: preset.description,
      bannerImage: preset.bannerImage,
      offerType: preset.discountType,
      status: 'ACTIVE',
      priority: 1,
      stackingRule: 'ALLOW',
      minCartValue: preset.minCartValue,
      discountValue: preset.discountValue,
      festivalName: preset.name,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + (preset.defaultDurationDays || 7) * 86400000).toISOString(),
    };

    setOffers((prev) => [newOffer, ...prev]);
    setActiveSubTab('offers');
    showToast(`"${preset.name}" festival campaign launched!`, 'success');
    try {
      await fetch('/api/content/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-pk-role': 'admin', 'x-pk-uid': 'admin_user' },
        body: JSON.stringify(newOffer),
      });
    } catch (_) {}
  };

  const subTabNav = [
    { id: 'homepage-studio', label: 'Homepage Studio', icon: SlidersHorizontal },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'offers', label: 'Offers', icon: Tag, count: offers.length },
    { id: 'coupons', label: 'Coupons', icon: Percent, count: coupons.length },
    { id: 'festivals', label: 'Festival Campaigns', icon: Sparkles },
    { id: 'bogo', label: 'Buy X Get Y', icon: Boxes },
    { id: 'free_gifts', label: 'Free Product Offers', icon: Gift },
    { id: 'loyalty', label: 'Order Milestone Loyalty', icon: Award, count: loyaltyRules.length },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'audit', label: 'Audit Trail', icon: ShieldCheck },
  ];

  return (
    <div className="space-y-6">
      
      {/* ── SUB-TAB NAVIGATION BAR ── */}
      <div className="bg-white p-2 rounded-3xl border border-slate-200 shadow-2xs overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          {subTabNav.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as MarketingSubTab)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                      isActive ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── ACTIVE SUB-TAB CONTENT ── */}
      {activeSubTab === 'homepage-studio' && (
        <HomepageStudioTab />
      )}

      {activeSubTab === 'dashboard' && (
        <MarketingDashboardTab
          offers={offers}
          coupons={coupons}
          loyaltyRules={loyaltyRules}
          onOpenCreateOffer={() => {
            setEditingOffer(null);
            setShowCreateModal(true);
          }}
          onSelectSubTab={(tabId) => setActiveSubTab(tabId as MarketingSubTab)}
        />
      )}

      {activeSubTab === 'offers' && (
        <OffersManagerTab
          offers={offers}
          onOpenCreateModal={() => {
            setEditingOffer(null);
            setShowCreateModal(true);
          }}
          onEditOffer={(off) => {
            setEditingOffer(off);
            setShowCreateModal(true);
          }}
          onDuplicateOffer={handleDuplicateOffer}
          onToggleOfferStatus={handleToggleOfferStatus}
          onDeleteOffer={handleDeleteOffer}
        />
      )}

      {activeSubTab === 'coupons' && (
        <CouponsManagerTab
          coupons={coupons}
          onAddCoupon={handleAddCoupon}
          onDeleteCoupon={handleDeleteCoupon}
          onToggleCouponStatus={handleToggleCouponStatus}
        />
      )}

      {activeSubTab === 'festivals' && (
        <FestivalOffersTab
          onLaunchPreset={handleLaunchFestivalPreset}
          activeOffers={offers}
        />
      )}

      {activeSubTab === 'bogo' && (
        <BogoOffersTab
          offers={offers}
          onAddOffer={handleSaveOffer}
          onDeleteOffer={handleDeleteOffer}
        />
      )}

      {activeSubTab === 'free_gifts' && (
        <FreeGiftsTab
          offers={offers}
          onAddOffer={handleSaveOffer}
          onDeleteOffer={handleDeleteOffer}
        />
      )}

      {activeSubTab === 'loyalty' && (
        <LoyaltyMilestonesTab
          loyaltyRules={loyaltyRules}
          onAddRule={handleAddLoyaltyRule}
          onDeleteRule={handleDeleteLoyaltyRule}
          onToggleRuleStatus={handleToggleLoyaltyRule}
        />
      )}

      {activeSubTab === 'analytics' && (
        <MarketingAnalyticsTab />
      )}

      {activeSubTab === 'audit' && (
        <AuditTrailTab />
      )}

      {/* ── CREATE / EDIT OFFER MODAL ── */}
      <CreateOfferModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setEditingOffer(null);
        }}
        initialOffer={editingOffer}
        onSave={handleSaveOffer}
      />

    </div>
  );
}
