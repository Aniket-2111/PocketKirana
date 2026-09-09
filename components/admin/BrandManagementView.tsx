'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { Brand, Category } from '@/types';
import { showToast } from '@/components/ui/Toast';
import {
  Plus,
  Search,
  Filter,
  Layers,
  Edit2,
  Trash2,
  Eye,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  AlertCircle,
  Package,
  Building2,
  Globe,
  Tag,
  X,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  ImageIcon,
} from 'lucide-react';

export function BrandManagementView() {
  const {
    brands,
    categories,
    products,
    setBrands,
    addBrand,
    updateBrand,
    deleteBrand,
    toggleBrandStatus,
    reorderBrands,
    fetchBrands,
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);

  // Modal States
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [selectedBrandForDetails, setSelectedBrandForDetails] = useState<Brand | null>(null);
  const [deleteModalBrand, setDeleteModalBrand] = useState<{ brand: Brand; productCount: number } | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState<string>('');

  // Form Fields
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedSubcategoryIds, setSelectedSubcategoryIds] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [displayOrder, setDisplayOrder] = useState<number>(0);
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [seoKeywords, setSeoKeywords] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch latest brands on mount
  useEffect(() => {
    setIsLoading(true);
    fetchBrands().finally(() => setIsLoading(false));
  }, []);

  // Top level categories and subcategories
  const topCategories = useMemo(() => categories.filter((c) => !c.parentId), [categories]);
  const subcategories = useMemo(() => categories.filter((c) => c.parentId), [categories]);

  // Filtered subcategories available for selected categories
  const availableSubcategoriesForSelectedCats = useMemo(() => {
    return subcategories.filter((s) => s.parentId && selectedCategoryIds.includes(s.parentId));
  }, [subcategories, selectedCategoryIds]);

  // Filtered Brands list
  const filteredBrands = useMemo(() => {
    return brands
      .filter((b) => {
        const matchesSearch =
          b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          b.slug.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'active' && b.isActive !== false) ||
          (statusFilter === 'inactive' && b.isActive === false);
        const matchesCat =
          categoryFilter === 'all' ||
          (b.categoryIds && b.categoryIds.includes(categoryFilter)) ||
          products.some((p) => p.brandId === b.id && (p.categoryId === categoryFilter || p.subcategoryId === categoryFilter));
        return matchesSearch && matchesStatus && matchesCat;
      })
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  }, [brands, searchQuery, statusFilter, categoryFilter, products]);

  // Overall statistics
  const stats = useMemo(() => {
    const total = brands.length;
    const active = brands.filter((b) => b.isActive !== false).length;
    const inactive = total - active;
    const brandedProducts = products.filter((p) => p.brandId).length;
    return { total, active, inactive, brandedProducts };
  }, [brands, products]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingBrand(null);
    setName('');
    setSlug('');
    setDescription('');
    setLogoUrl('');
    setBannerUrl('');
    setSelectedCategoryIds([]);
    setSelectedSubcategoryIds([]);
    setIsActive(true);
    setDisplayOrder(brands.length + 1);
    setSeoTitle('');
    setSeoDescription('');
    setSeoKeywords('');
    setShowAddEditModal(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (brand: Brand) => {
    setEditingBrand(brand);
    setName(brand.name);
    setSlug(brand.slug);
    setDescription(brand.description || '');
    setLogoUrl(brand.logoUrl || brand.logo || '');
    setBannerUrl(brand.bannerUrl || brand.banner || '');
    setSelectedCategoryIds(brand.categoryIds || []);
    setSelectedSubcategoryIds(brand.subcategoryIds || []);
    setIsActive(brand.isActive !== false);
    setDisplayOrder(brand.displayOrder || 0);
    setSeoTitle(brand.seoTitle || '');
    setSeoDescription(brand.seoDescription || '');
    setSeoKeywords(brand.seoKeywords || '');
    setShowAddEditModal(true);
  };

  // Auto-format slug when name changes
  const handleNameChange = (val: string) => {
    setName(val);
    if (!editingBrand) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''));
    }
  };

  // Toggle Category Checkbox in Modal
  const handleToggleCategory = (catId: string) => {
    setSelectedCategoryIds((prev) => {
      const exists = prev.includes(catId);
      if (exists) {
        // Remove category & its dependent subcategories
        const newCatIds = prev.filter((id) => id !== catId);
        setSelectedSubcategoryIds((subPrev) => {
          const removedSubs = subcategories.filter((s) => s.parentId === catId).map((s) => s.id);
          return subPrev.filter((id) => !removedSubs.includes(id));
        });
        return newCatIds;
      } else {
        return [...prev, catId];
      }
    });
  };

  // Toggle Subcategory Checkbox in Modal
  const handleToggleSubcategory = (subId: string) => {
    setSelectedSubcategoryIds((prev) =>
      prev.includes(subId) ? prev.filter((id) => id !== subId) : [...prev, subId]
    );
  };

  // Handle Submit (Create or Update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Brand name is required', 'error');
      return;
    }

    setIsSubmitting(true);

    const payload = {
      name: name.trim(),
      slug: slug.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      description: description.trim(),
      logoUrl: logoUrl.trim() || undefined,
      bannerUrl: bannerUrl.trim() || undefined,
      categoryIds: selectedCategoryIds,
      subcategoryIds: selectedSubcategoryIds,
      isActive,
      displayOrder: Number(displayOrder) || 0,
      seoTitle: seoTitle.trim() || `${name.trim()} Products Online | PocketKirana`,
      seoDescription: seoDescription.trim() || `Buy authentic ${name.trim()} products at PocketKirana.`,
      seoKeywords: seoKeywords.trim() || `${name.trim()}, grocery, pocketkirana`,
    };

    try {
      if (editingBrand) {
        await updateBrand(editingBrand.id, payload);
        showToast(`Brand "${payload.name}" updated successfully!`, 'success');
      } else {
        const created = await addBrand(payload);
        if (created) {
          showToast(`Brand "${payload.name}" created successfully!`, 'success');
        }
      }
      setShowAddEditModal(false);
      await fetchBrands();
    } catch (err: any) {
      showToast(err.message || 'Failed to save brand', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete / Archive Click
  const handleDeleteClick = (brand: Brand) => {
    const brandProducts = products.filter((p) => p.brandId === brand.id);
    const count = brand.productCount || brandProducts.length;

    if (count > 0) {
      setDeleteModalBrand({ brand, productCount: count });
      setReassignTargetId(brands.find((b) => b.id !== brand.id)?.id || '');
    } else {
      if (confirm(`Are you sure you want to delete brand "${brand.name}"?`)) {
        deleteBrand(brand.id).then((res) => {
          if (res.success) {
            showToast(`Brand "${brand.name}" deleted`, 'success');
          } else {
            showToast(res.error || 'Failed to delete brand', 'error');
          }
        });
      }
    }
  };

  // Safe Reassign / Deactivate Confirm
  const handleSafeDeleteConfirm = async (action: 'reassign' | 'deactivate') => {
    if (!deleteModalBrand) return;
    const { brand } = deleteModalBrand;

    if (action === 'deactivate') {
      const res = await deleteBrand(brand.id, { forceDeactivate: true });
      if (res.success) {
        showToast(`Brand "${brand.name}" deactivated safely. Products preserved.`, 'info');
      }
    } else if (action === 'reassign') {
      if (!reassignTargetId) {
        showToast('Please select a target brand for product reassignment', 'error');
        return;
      }
      const res = await deleteBrand(brand.id, { reassignBrandId: reassignTargetId });
      if (res.success) {
        showToast(`Products reassigned and brand "${brand.name}" removed`, 'success');
      }
    }
    setDeleteModalBrand(null);
    await fetchBrands();
  };

  // Move Order Up / Down
  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= filteredBrands.length) return;

    const newOrderedList = [...filteredBrands];
    const temp = newOrderedList[index];
    newOrderedList[index] = newOrderedList[targetIndex];
    newOrderedList[targetIndex] = temp;

    const orderedIds = newOrderedList.map((b) => b.id);
    await reorderBrands(orderedIds);
    showToast('Brand order updated', 'success');
  };

  return (
    <div className="space-y-6">
      {/* ── TOP STATS BAR ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Total Brands
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-slate-900">{stats.total}</span>
            <Building2 className="w-5 h-5 text-slate-400" />
          </div>
        </div>

        <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 shadow-2xs">
          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
            Active Brands
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-emerald-950">{stats.active}</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Inactive Brands
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-slate-700">{stats.inactive}</span>
            <AlertCircle className="w-5 h-5 text-slate-400" />
          </div>
        </div>

        <div className="bg-indigo-50/60 border border-indigo-200/80 rounded-2xl p-4 shadow-2xs">
          <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider block">
            Branded Products
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-indigo-950">{stats.brandedProducts}</span>
            <Package className="w-5 h-5 text-indigo-600" />
          </div>
        </div>
      </div>

      {/* ── SEARCH & ACTION CONTROLS ── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search brands by name or slug..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-emerald-600"
          />
        </div>

        {/* Filters & Add Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-600"
          >
            <option value="all">All Categories</option>
            {topCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-600"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>

          {/* Add Brand Button */}
          <button
            onClick={handleOpenCreateModal}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Brand</span>
          </button>
        </div>
      </div>

      {/* ── BRANDS TABLE ── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
        {filteredBrands.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
            <h4 className="font-black text-slate-800 text-base">No Brands Found</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery || categoryFilter !== 'all' || statusFilter !== 'all'
                ? 'Try adjusting your search or filters to find what you are looking for.'
                : 'Click "+ Add Brand" to create your first dynamic brand.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-black text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Order</th>
                  <th className="py-3.5 px-4">Brand</th>
                  <th className="py-3.5 px-4">Assigned Categories</th>
                  <th className="py-3.5 px-4">Products</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBrands.map((brand, idx) => {
                  const brandProducts = products.filter((p) => p.brandId === brand.id);
                  const pCount = brand.productCount !== undefined ? brand.productCount : brandProducts.length;
                  const activePCount =
                    brand.activeProductCount !== undefined
                      ? brand.activeProductCount
                      : brandProducts.filter((p) => p.status === 'active').length;

                  // Find assigned category names
                  const assignedCatNames = (brand.categoryIds || [])
                    .map((catId) => categories.find((c) => c.id === catId)?.name)
                    .filter(Boolean);

                  return (
                    <tr
                      key={brand.id}
                      className={`hover:bg-slate-50/60 transition-colors ${
                        brand.isActive === false ? 'opacity-60 bg-slate-50/30' : ''
                      }`}
                    >
                      {/* Order Controls */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveOrder(idx, 'up')}
                            className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-20 hover:bg-slate-100 rounded"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === filteredBrands.length - 1}
                            onClick={() => handleMoveOrder(idx, 'down')}
                            className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-20 hover:bg-slate-100 rounded"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Brand Logo & Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center p-1 shrink-0">
                            {brand.logoUrl || brand.logo ? (
                              <img
                                src={brand.logoUrl || brand.logo}
                                alt={brand.name}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <span className="font-black text-slate-400 text-xs uppercase">
                                {brand.name.slice(0, 2)}
                              </span>
                            )}
                          </div>
                          <div>
                            <span className="font-extrabold text-slate-900 block text-xs">
                              {brand.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              /brand/{brand.slug}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Assigned Categories */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {assignedCatNames.length > 0 ? (
                            assignedCatNames.slice(0, 2).map((catName, cIdx) => (
                              <span
                                key={cIdx}
                                className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-md truncate max-w-[130px]"
                              >
                                {catName}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 text-[11px] italic">No categories</span>
                          )}
                          {assignedCatNames.length > 2 && (
                            <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                              +{assignedCatNames.length - 2}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Products Count */}
                      <td className="py-3.5 px-4">
                        <span className="font-extrabold text-slate-900 text-xs">
                          {pCount} Products
                        </span>
                        {pCount > 0 && (
                          <span className="text-[10px] text-emerald-700 block font-semibold">
                            {activePCount} Active
                          </span>
                        )}
                      </td>

                      {/* Status Toggle */}
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => toggleBrandStatus(brand.id)}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all ${
                            brand.isActive !== false
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {brand.isActive !== false ? 'Active' : 'Inactive'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Details / Drawer */}
                          <button
                            type="button"
                            onClick={() => setSelectedBrandForDetails(brand)}
                            className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg border border-slate-200 transition-colors"
                            title="View Brand Details & Products"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit Brand */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(brand)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                            title="Edit Brand"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Brand */}
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(brand)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 transition-colors"
                            title="Delete / Archive Brand"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── ADD / EDIT BRAND MODAL ── */}
      {showAddEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-sm">
                    {editingBrand ? 'Edit Brand' : 'Add New Brand'}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Dynamic brand registration & category mapping
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddEditModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Row 1: Brand Name & Slug */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 mb-1 block">
                    Brand Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Fortune, Amul, Lay's"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-emerald-600"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 mb-1 block">
                    URL Slug *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. fortune, amul, lays"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-mono text-xs focus:bg-white focus:outline-none focus:border-emerald-600"
                    required
                  />
                </div>
              </div>

              {/* Row 2: Brand Logo & Banner URL */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 mb-1 block">
                    Brand Logo Image URL
                  </label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-600"
                  />
                  {logoUrl && (
                    <div className="mt-1.5 w-12 h-12 rounded-lg border border-slate-200 bg-white p-1 overflow-hidden">
                      <img src={logoUrl} alt="Logo preview" className="w-full h-full object-contain" />
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 mb-1 block">
                    Brand Hero Banner URL
                  </label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={bannerUrl}
                    onChange={(e) => setBannerUrl(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-600"
                  />
                  {bannerUrl && (
                    <div className="mt-1.5 h-12 rounded-lg border border-slate-200 bg-white overflow-hidden">
                      <img src={bannerUrl} alt="Banner preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>

              {/* Brand Description */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 mb-1 block">
                  Description & Story
                </label>
                <textarea
                  rows={2}
                  placeholder="Short brand overview displayed on the brand landing page..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-600 resize-none"
                />
              </div>

              {/* Category Assignment Section */}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <label className="text-[11px] font-bold text-slate-800 block">
                  Assign to Categories (Multi-select)
                </label>
                <p className="text-[10px] text-slate-500">
                  Select which categories this brand belongs to:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-1 bg-slate-50/50 rounded-xl border border-slate-200/60">
                  {topCategories.map((cat) => {
                    const isChecked = selectedCategoryIds.includes(cat.id);
                    return (
                      <label
                        key={cat.id}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-[11px] font-bold cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleCategory(cat.id)}
                          className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                        />
                        <span className="truncate">{cat.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Subcategory Assignment Section (if categories selected) */}
              {availableSubcategoriesForSelectedCats.length > 0 && (
                <div className="space-y-2 border-t border-slate-100 pt-2">
                  <label className="text-[11px] font-bold text-slate-800 block">
                    Assign to Specific Subcategories (Optional)
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto p-1 bg-slate-50/50 rounded-xl border border-slate-200/60">
                    {availableSubcategoriesForSelectedCats.map((sub) => {
                      const isChecked = selectedSubcategoryIds.includes(sub.id);
                      return (
                        <label
                          key={sub.id}
                          className={`flex items-center gap-2 p-1.5 rounded-lg border text-[10px] font-medium cursor-pointer transition-colors ${
                            isChecked
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleSubcategory(sub.id)}
                            className="rounded text-emerald-600 focus:ring-emerald-500 w-3 h-3"
                          />
                          <span className="truncate">{sub.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Status & Display Order */}
              <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 mb-1 block">
                    Display Order
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    <span className="text-xs font-bold text-slate-800">
                      Active for Customer Store
                    </span>
                  </label>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddEditModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{editingBrand ? 'Save Changes' : 'Create Brand'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── BRAND DETAILS & PRODUCTS DRAWER ── */}
      {selectedBrandForDetails && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-end">
          <div className="bg-white w-full max-w-lg h-full shadow-2xl p-6 space-y-5 overflow-y-auto animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 p-1 flex items-center justify-center overflow-hidden">
                  {selectedBrandForDetails.logoUrl || selectedBrandForDetails.logo ? (
                    <img
                      src={selectedBrandForDetails.logoUrl || selectedBrandForDetails.logo}
                      alt={selectedBrandForDetails.name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="font-black text-slate-400 uppercase">
                      {selectedBrandForDetails.name.slice(0, 2)}
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    {selectedBrandForDetails.name}
                  </h3>
                  <a
                    href={`/brand/${selectedBrandForDetails.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-emerald-700 hover:underline flex items-center gap-1 font-bold"
                  >
                    <span>/brand/{selectedBrandForDetails.slug}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
              <button
                onClick={() => setSelectedBrandForDetails(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Banner Preview */}
            {selectedBrandForDetails.bannerUrl && (
              <div className="h-28 rounded-2xl overflow-hidden border border-slate-200">
                <img
                  src={selectedBrandForDetails.bannerUrl}
                  alt="Banner"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Description */}
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Brand Story
              </span>
              <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                {selectedBrandForDetails.description || 'No brand description provided.'}
              </p>
            </div>

            {/* Assigned Categories List */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Assigned Categories
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(selectedBrandForDetails.categoryIds || []).map((cId) => {
                  const c = categories.find((cat) => cat.id === cId);
                  return (
                    <span
                      key={cId}
                      className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg text-xs font-bold"
                    >
                      {c?.name || cId}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Products Under this Brand */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Products Under Brand ({products.filter((p) => p.brandId === selectedBrandForDetails.id).length})
              </span>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {products
                  .filter((p) => p.brandId === selectedBrandForDetails.id)
                  .map((prod) => (
                    <div
                      key={prod.id}
                      className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200/60"
                    >
                      <div className="flex items-center gap-2.5">
                        <img
                          src={prod.thumbnail}
                          alt={prod.name}
                          className="w-8 h-8 rounded-lg object-contain bg-white border border-slate-200 p-0.5"
                        />
                        <div>
                          <span className="font-bold text-slate-900 text-xs block">{prod.name}</span>
                          <span className="text-[10px] text-slate-500">₹{prod.sellingPrice} • {prod.unit}</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                        {prod.status}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
              <button
                onClick={() => {
                  const b = selectedBrandForDetails;
                  setSelectedBrandForDetails(null);
                  handleOpenEditModal(b);
                }}
                className="flex-1 bg-slate-900 text-white text-xs font-bold py-2.5 rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Brand</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SAFE DELETE / REASSIGN MODAL ── */}
      {deleteModalBrand && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-black text-slate-900 text-base">
                  Cannot Delete Brand Directly
                </h4>
                <p className="text-xs text-slate-500">
                  Brand has active product relationships
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl text-xs text-amber-900 space-y-1">
              <p className="font-bold">
                &ldquo;{deleteModalBrand.brand.name}&rdquo; is linked to {deleteModalBrand.productCount} products.
              </p>
              <p className="text-[11px] text-amber-800">
                To prevent broken catalog links and preserve order history, please choose a safe option:
              </p>
            </div>

            {/* Reassign Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 block">
                Option A: Reassign Products to Another Brand
              </label>
              <select
                value={reassignTargetId}
                onChange={(e) => setReassignTargetId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600"
              >
                <option value="">-- Select Target Brand --</option>
                {brands
                  .filter((b) => b.id !== deleteModalBrand.brand.id)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                disabled={!reassignTargetId}
                onClick={() => handleSafeDeleteConfirm('reassign')}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-xl transition-colors disabled:opacity-40"
              >
                Reassign Products &amp; Delete Brand
              </button>

              <button
                type="button"
                onClick={() => handleSafeDeleteConfirm('deactivate')}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs py-2.5 rounded-xl transition-colors"
              >
                Deactivate Brand Instead (Preserves Products)
              </button>

              <button
                type="button"
                onClick={() => setDeleteModalBrand(null)}
                className="w-full border border-slate-200 text-slate-600 font-bold text-xs py-2 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
