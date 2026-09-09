'use client';

import React, { useState, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { Category, Product } from '@/types';
import { showToast } from '@/components/ui/Toast';
import {
  Layers,
  Plus,
  Edit,
  Trash2,
  ChevronDown,
  ChevronRight,
  MoveRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  AlertTriangle,
  FolderPlus,
  Image as ImageIcon,
  Link as LinkIcon,
  Tag,
  ExternalLink,
  Sparkles,
  HelpCircle,
  Eye,
  EyeOff,
  Filter,
  RefreshCw,
} from 'lucide-react';

const PRESET_CATEGORY_IMAGES = [
  { label: 'Fruits & Veg', url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=200&q=80' },
  { label: 'Oil & Ghee', url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=200&q=80' },
  { label: 'Dairy & Milk', url: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=200&q=80' },
  { label: 'Staples & Atta', url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=200&q=80' },
  { label: 'Snacks & Munchies', url: 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?auto=format&fit=crop&w=200&q=80' },
  { label: 'Beverages & Tea', url: 'https://images.unsplash.com/photo-1527960471264-932f39eb5846?auto=format&fit=crop&w=200&q=80' },
  { label: 'Personal Care', url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=200&q=80' },
  { label: 'Household', url: 'https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?auto=format&fit=crop&w=200&q=80' },
  { label: 'Baby Care', url: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=200&q=80' },
  { label: 'Bakery & Bread', url: 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?auto=format&fit=crop&w=200&q=80' },
  { label: 'Meat & Fish', url: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=200&q=80' },
  { label: 'Eggs', url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=200&q=80' },
];

export const CategoryManagementView: React.FC = () => {
  const {
    categories,
    products,
    addCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
    moveSubcategory,
    toggleCategoryStatus,
  } = useAppStore();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // Modals state
  const [categoryModal, setCategoryModal] = useState<{
    isOpen: boolean;
    mode: 'add' | 'edit';
    category?: Category;
    parentId?: string | null;
  }>({ isOpen: false, mode: 'add' });

  const [moveModal, setMoveModal] = useState<{
    isOpen: boolean;
    subcategory?: Category;
  }>({ isOpen: false });

  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    category?: Category;
  }>({ isOpen: false });

  // Separate top-level categories and subcategories
  const topCategories = useMemo(() => {
    return categories
      .filter((c) => !c.parentId)
      .sort((a, b) => (a.displayOrder || a.sortOrder || 0) - (b.displayOrder || b.sortOrder || 0));
  }, [categories]);

  const subcategoriesMap = useMemo(() => {
    const map: Record<string, Category[]> = {};
    categories.forEach((c) => {
      if (c.parentId) {
        if (!map[c.parentId]) map[c.parentId] = [];
        map[c.parentId].push(c);
      }
    });
    Object.keys(map).forEach((key) => {
      map[key].sort((a, b) => (a.displayOrder || a.sortOrder || 0) - (b.displayOrder || b.sortOrder || 0));
    });
    return map;
  }, [categories]);

  // Filtered categories
  const filteredTopCategories = useMemo(() => {
    return topCategories.filter((cat) => {
      const q = searchQuery.toLowerCase().trim();
      const subs = subcategoriesMap[cat.id] || [];
      const matchSearch =
        !q ||
        cat.name.toLowerCase().includes(q) ||
        cat.slug.toLowerCase().includes(q) ||
        (cat.description || '').toLowerCase().includes(q) ||
        subs.some((s) => s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q));

      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' ? cat.isActive !== false : cat.isActive === false);

      return matchSearch && matchStatus;
    });
  }, [topCategories, subcategoriesMap, searchQuery, statusFilter]);

  // Product counts calculation
  const getProductCount = (categoryId: string) => {
    return products.filter((p) => p.categoryId === categoryId || p.subcategoryId === categoryId).length;
  };

  // Toggle expansion
  const toggleExpand = (catId: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    topCategories.forEach((c) => (all[c.id] = true));
    setExpandedCategories(all);
  };

  const collapseAll = () => {
    setExpandedCategories({});
  };

  // Reorder Top Categories
  const handleMoveCategory = async (catId: string, direction: 'up' | 'down') => {
    const index = topCategories.findIndex((c) => c.id === catId);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= topCategories.length) return;

    const newOrder = [...topCategories];
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;

    const orderedIds = newOrder.map((c) => c.id);
    await reorderCategories(orderedIds, null);
    showToast('Category reordered successfully', 'success');
  };

  // Reorder Subcategories under a parent
  const handleMoveSubcategory = async (parentId: string, subId: string, direction: 'up' | 'down') => {
    const subs = subcategoriesMap[parentId] || [];
    const index = subs.findIndex((s) => s.id === subId);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= subs.length) return;

    const newOrder = [...subs];
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;

    const orderedIds = newOrder.map((s) => s.id);
    await reorderCategories(orderedIds, parentId);
    showToast('Subcategory reordered successfully', 'success');
  };

  const totalSubcategoriesCount = Object.values(subcategoriesMap).reduce((acc, list) => acc + list.length, 0);

  return (
    <div className="space-y-6">
      {/* ── TOP STATS BAR ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Top Categories</p>
              <h3 className="text-xl font-black text-slate-900">{topCategories.length}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Subcategories</p>
              <h3 className="text-xl font-black text-slate-900">{totalSubcategoriesCount}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Catalog Products</p>
              <h3 className="text-xl font-black text-slate-900">{products.length}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Status</p>
              <h3 className="text-xl font-black text-slate-900">
                {categories.filter((c) => c.isActive !== false).length} / {categories.length}
              </h3>
            </div>
          </div>
        </div>
      </div>

      {/* ── HEADER & ACTIONS ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-600" />
              Category &amp; Subcategory Management
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Organize your store hierarchy. Changes here instantly update the customer website, navigation, and product filters in real-time.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => setCategoryModal({ isOpen: true, mode: 'add', parentId: null })}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-2xs flex items-center gap-2 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Category</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (topCategories.length === 0) {
                  showToast('Please create a category first', 'warning');
                  return;
                }
                setCategoryModal({ isOpen: true, mode: 'add', parentId: topCategories[0]?.id });
              }}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-2xs flex items-center gap-2 shrink-0"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Add Subcategory</span>
            </button>
          </div>
        </div>

        {/* ── SEARCH & FILTER CONTROLS ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search category or subcategory..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:bg-white text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-1 text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  statusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  statusFilter === 'active' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('inactive')}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  statusFilter === 'inactive' ? 'bg-slate-800 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Inactive
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={expandAll}
                className="text-[11px] font-bold text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Expand All
              </button>
              <span className="text-slate-300">•</span>
              <button
                type="button"
                onClick={collapseAll}
                className="text-[11px] font-bold text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Collapse All
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── CATEGORY TREE LIST ── */}
      {filteredTopCategories.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 text-slate-400 mx-auto flex items-center justify-center font-bold">
            <Layers className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No categories found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery
              ? `No categories match your search "${searchQuery}". Try clearing filters.`
              : 'Start by creating your first store category to organize products.'}
          </p>
          <button
            type="button"
            onClick={() => setCategoryModal({ isOpen: true, mode: 'add', parentId: null })}
            className="bg-emerald-600 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-2xs inline-flex items-center gap-2 mt-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Category</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTopCategories.map((cat, catIndex) => {
            const isExpanded = Boolean(expandedCategories[cat.id]);
            const subcategories = subcategoriesMap[cat.id] || [];
            const catProductCount = getProductCount(cat.id);

            return (
              <div
                key={cat.id}
                className={`bg-white border transition-all rounded-2xl overflow-hidden shadow-2xs ${
                  cat.isActive === false ? 'opacity-70 border-slate-200 bg-slate-50/50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* ── TOP CATEGORY ROW ── */}
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Left: Thumbnail & Name */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => toggleExpand(cat.id)}
                      className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                      title={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-slate-600" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      )}
                    </button>

                    <div className="relative w-12 h-12 rounded-xl border border-slate-200 bg-slate-50 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                      <img
                        src={cat.image || PRESET_CATEGORY_IMAGES[0].url}
                        alt={cat.name}
                        className="w-full h-full object-contain rounded-lg"
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-black text-sm text-slate-900 truncate">{cat.name}</h4>
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                          /category/{cat.slug}
                        </span>
                        {cat.isActive === false && (
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                            Inactive
                          </span>
                        )}
                      </div>

                      {cat.description && (
                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{cat.description}</p>
                      )}

                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-[10px] font-extrabold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                          {subcategories.length} Subcategories
                        </span>
                        <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          {catProductCount} Products
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">
                          Order: #{cat.displayOrder || cat.sortOrder || catIndex + 1}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    {/* Add Subcategory under this parent */}
                    <button
                      type="button"
                      onClick={() => setCategoryModal({ isOpen: true, mode: 'add', parentId: cat.id })}
                      className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 font-bold text-xs rounded-xl border border-purple-200 transition-colors flex items-center gap-1.5 shadow-2xs"
                      title="Add Subcategory under this category"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span className="hidden md:inline">Add Sub</span>
                    </button>

                    {/* Move Up/Down */}
                    <button
                      type="button"
                      onClick={() => handleMoveCategory(cat.id, 'up')}
                      disabled={catIndex === 0}
                      className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveCategory(cat.id, 'down')}
                      disabled={catIndex === topCategories.length - 1}
                      className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    {/* Toggle Active Status */}
                    <button
                      type="button"
                      onClick={() => {
                        toggleCategoryStatus(cat.id);
                        showToast(`Category "${cat.name}" is now ${cat.isActive !== false ? 'Inactive' : 'Active'}`, 'info');
                      }}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        cat.isActive !== false
                          ? 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                          : 'text-slate-400 bg-slate-100 border-slate-200 hover:text-slate-700'
                      }`}
                      title={cat.isActive !== false ? 'Deactivate Category' : 'Activate Category'}
                    >
                      {cat.isActive !== false ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>

                    {/* Edit */}
                    <button
                      type="button"
                      onClick={() => setCategoryModal({ isOpen: true, mode: 'edit', category: cat, parentId: null })}
                      className="p-1.5 text-slate-600 hover:text-black hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                      title="Edit Category"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>

                    {/* Safe Delete */}
                    <button
                      type="button"
                      onClick={() => setDeleteModal({ isOpen: true, category: cat })}
                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-slate-200 transition-colors"
                      title="Delete Category"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* ── SUBCATEGORIES TREE SECTION ── */}
                {isExpanded && (
                  <div className="bg-slate-50/80 border-t border-slate-200 p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FolderPlus className="w-4 h-4 text-purple-600" />
                        <h5 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">
                          Subcategories under &ldquo;{cat.name}&rdquo; ({subcategories.length})
                        </h5>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCategoryModal({ isOpen: true, mode: 'add', parentId: cat.id })}
                        className="text-xs font-bold text-purple-700 hover:text-purple-900 flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Subcategory</span>
                      </button>
                    </div>

                    {subcategories.length === 0 ? (
                      <div className="bg-white border border-dashed border-slate-200 rounded-xl p-6 text-center">
                        <p className="text-xs text-slate-500">No subcategories created yet under this category.</p>
                        <button
                          type="button"
                          onClick={() => setCategoryModal({ isOpen: true, mode: 'add', parentId: cat.id })}
                          className="mt-2 text-xs font-bold text-emerald-700 hover:underline"
                        >
                          + Create first subcategory
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {subcategories.map((sub, subIndex) => {
                          const subProductCount = getProductCount(sub.id);
                          return (
                            <div
                              key={sub.id}
                              className={`bg-white border rounded-xl p-3.5 transition-all flex flex-col justify-between gap-3 shadow-2xs ${
                                sub.isActive === false ? 'opacity-60 border-slate-200' : 'border-slate-200 hover:border-purple-300'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-lg border border-slate-100 bg-slate-50 p-1 flex items-center justify-center shrink-0">
                                  <img
                                    src={sub.image || cat.image || PRESET_CATEGORY_IMAGES[0].url}
                                    alt={sub.name}
                                    className="w-full h-full object-contain rounded-md"
                                  />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-1">
                                    <h6 className="font-extrabold text-xs text-slate-900 truncate">{sub.name}</h6>
                                    {sub.isActive === false && (
                                      <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-full">
                                        Off
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] font-mono text-slate-400 block truncate">
                                    /{sub.slug}
                                  </span>
                                  {sub.description && (
                                    <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{sub.description}</p>
                                  )}
                                  <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full inline-block mt-1.5">
                                    {subProductCount} Products
                                  </span>
                                </div>
                              </div>

                              {/* Subcategory Action Controls */}
                              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleMoveSubcategory(cat.id, sub.id, 'up')}
                                    disabled={subIndex === 0}
                                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 hover:bg-slate-100 rounded"
                                    title="Move Up"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveSubcategory(cat.id, sub.id, 'down')}
                                    disabled={subIndex === subcategories.length - 1}
                                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 hover:bg-slate-100 rounded"
                                    title="Move Down"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  {/* Move to another parent category */}
                                  <button
                                    type="button"
                                    onClick={() => setMoveModal({ isOpen: true, subcategory: sub })}
                                    className="p-1 text-slate-600 hover:text-purple-700 hover:bg-purple-50 rounded-md border border-slate-200 transition-colors"
                                    title="Move to another Parent Category"
                                  >
                                    <MoveRight className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Edit Subcategory */}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCategoryModal({
                                        isOpen: true,
                                        mode: 'edit',
                                        category: sub,
                                        parentId: cat.id,
                                      })
                                    }
                                    className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md border border-slate-200 transition-colors"
                                    title="Edit Subcategory"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Delete Subcategory */}
                                  <button
                                    type="button"
                                    onClick={() => setDeleteModal({ isOpen: true, category: sub })}
                                    className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md border border-slate-200 transition-colors"
                                    title="Delete Subcategory"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── ADD / EDIT CATEGORY & SUBCATEGORY MODAL ── */}
      {categoryModal.isOpen && (
        <CategoryFormModal
          mode={categoryModal.mode}
          category={categoryModal.category}
          initialParentId={categoryModal.parentId}
          topCategories={topCategories}
          onClose={() => setCategoryModal({ isOpen: false, mode: 'add' })}
          onSave={(data) => {
            if (categoryModal.mode === 'add') {
              addCategory(data);
              showToast(
                `${data.parentId ? 'Subcategory' : 'Category'} "${data.name}" created successfully!`,
                'success'
              );
            } else if (categoryModal.category) {
              updateCategory(categoryModal.category.id, data);
              showToast(
                `${data.parentId ? 'Subcategory' : 'Category'} "${data.name}" updated successfully!`,
                'success'
              );
            }
            setCategoryModal({ isOpen: false, mode: 'add' });
          }}
        />
      )}

      {/* ── MOVE SUBCATEGORY MODAL ── */}
      {moveModal.isOpen && moveModal.subcategory && (
        <MoveSubcategoryModal
          subcategory={moveModal.subcategory}
          topCategories={topCategories}
          onClose={() => setMoveModal({ isOpen: false })}
          onMove={async (subId, newParentId) => {
            const success = await moveSubcategory(subId, newParentId);
            if (success) {
              showToast('Subcategory moved successfully!', 'success');
            } else {
              showToast('Failed to move subcategory', 'error');
            }
            setMoveModal({ isOpen: false });
          }}
        />
      )}

      {/* ── SAFE DELETE CONFIRMATION MODAL ── */}
      {deleteModal.isOpen && deleteModal.category && (
        <SafeDeleteModal
          category={deleteModal.category}
          topCategories={topCategories}
          subcategoriesMap={subcategoriesMap}
          products={products}
          onClose={() => setDeleteModal({ isOpen: false })}
          onConfirm={(id, reassignments) => {
            deleteCategory(id, reassignments);
            showToast(`Category "${deleteModal.category?.name}" deleted successfully!`, 'info');
            setDeleteModal({ isOpen: false });
          }}
        />
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   CATEGORY FORM MODAL (ADD & EDIT)
   ═══════════════════════════════════════════════════════════════════════ */
interface CategoryFormModalProps {
  mode: 'add' | 'edit';
  category?: Category;
  initialParentId?: string | null;
  topCategories: Category[];
  onClose: () => void;
  onSave: (data: Omit<Category, 'id'> & { id?: string }) => void;
}

const CategoryFormModal: React.FC<CategoryFormModalProps> = ({
  mode,
  category,
  initialParentId,
  topCategories,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(category?.name || '');
  const [slug, setSlug] = useState(category?.slug || '');
  const [parentId, setParentId] = useState<string | null>(
    category?.parentId !== undefined ? category.parentId : (initialParentId || null)
  );
  const [image, setImage] = useState(category?.image || PRESET_CATEGORY_IMAGES[0].url);
  const [description, setDescription] = useState(category?.description || '');
  const [displayOrder, setDisplayOrder] = useState<number>(
    category?.displayOrder || category?.sortOrder || 1
  );
  const [isActive, setIsActive] = useState<boolean>(category?.isActive !== undefined ? category.isActive : true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isSubcategory = Boolean(parentId);

  // Auto-generate slug from name if adding
  const handleNameChange = (val: string) => {
    setName(val);
    if (mode === 'add' || !slug) {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, '')
      );
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!slug.trim()) {
      newErrors.slug = 'Slug is required';
    }
    if (isSubcategory && !parentId) {
      newErrors.parentId = 'Parent category is required for subcategories';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave({
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      parentId: parentId || null,
      image: image.trim() || PRESET_CATEGORY_IMAGES[0].url,
      description: description.trim(),
      sortOrder: Number(displayOrder) || 1,
      displayOrder: Number(displayOrder) || 1,
      isActive,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-150 my-8">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              {isSubcategory ? <FolderPlus className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                {mode === 'add'
                  ? isSubcategory
                    ? 'Add New Subcategory'
                    : 'Add New Category'
                  : isSubcategory
                  ? 'Edit Subcategory'
                  : 'Edit Category'}
              </h3>
              <p className="text-xs text-slate-500">
                {isSubcategory
                  ? 'Organize products under a parent category'
                  : 'Create a top-level catalog category'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-sm"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Parent Category Selection (if subcategory or selectable) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Category Type / Parent
            </label>
            <select
              value={parentId || ''}
              onChange={(e) => setParentId(e.target.value ? e.target.value : null)}
              className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
            >
              <option value="">📁 Top-Level Category (No Parent)</option>
              {topCategories
                .filter((c) => c.id !== category?.id)
                .map((parent) => (
                  <option key={parent.id} value={parent.id}>
                    ↳ Subcategory under: {parent.name}
                  </option>
                ))}
            </select>
            {errors.parentId && <p className="text-[11px] font-bold text-rose-600 mt-1">{errors.parentId}</p>}
          </div>

          {/* Name & Slug */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isSubcategory ? 'Subcategory Name' : 'Category Name'} *
              </label>
              <input
                type="text"
                placeholder="e.g. Cooking Oil, Fresh Vegetables"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
              />
              {errors.name && <p className="text-[11px] font-bold text-rose-600 mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                URL Slug *
              </label>
              <input
                type="text"
                placeholder="e.g. cooking-oil"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
              />
              {errors.slug && <p className="text-[11px] font-bold text-rose-600 mt-1">{errors.slug}</p>}
            </div>
          </div>

          {/* Image URL & Preset Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Category Image URL
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="https://images.unsplash.com/..."
                value={image}
                onChange={(e) => setImage(e.target.value)}
                className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
              />
              {image && (
                <div className="w-9 h-9 rounded-lg border border-slate-200 p-0.5 bg-white shrink-0 flex items-center justify-center">
                  <img src={image} alt="Preview" className="w-full h-full object-contain rounded" />
                </div>
              )}
            </div>

            {/* Quick Image Presets */}
            <div className="mt-2">
              <span className="text-[10px] font-bold text-slate-400 block mb-1">Quick Presets:</span>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar scrollbar-none">
                {PRESET_CATEGORY_IMAGES.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setImage(preset.url)}
                    className={`text-[10px] font-bold px-2 py-1 rounded-lg border shrink-0 transition-all ${
                      image === preset.url
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Short description displayed on category pages..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
            />
          </div>

          {/* Display Order & Active Status */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Display Order
              </label>
              <input
                type="number"
                min="1"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10) || 1)}
                className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Status
              </label>
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={`w-full text-xs font-bold py-2 px-3 rounded-xl border transition-all flex items-center justify-center gap-2 ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}
              >
                {isActive ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-slate-400" />}
                <span>{isActive ? 'Active on Store' : 'Hidden / Inactive'}</span>
              </button>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-2xs transition-all"
            >
              {mode === 'add' ? 'Create Category' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   MOVE SUBCATEGORY MODAL
   ═══════════════════════════════════════════════════════════════════════ */
interface MoveSubcategoryModalProps {
  subcategory: Category;
  topCategories: Category[];
  onClose: () => void;
  onMove: (subcategoryId: string, newParentCategoryId: string) => void;
}

const MoveSubcategoryModal: React.FC<MoveSubcategoryModalProps> = ({
  subcategory,
  topCategories,
  onClose,
  onMove,
}) => {
  const currentParent = topCategories.find((c) => c.id === subcategory.parentId);
  const availableParents = topCategories.filter((c) => c.id !== subcategory.parentId);
  const [selectedParentId, setSelectedParentId] = useState(availableParents[0]?.id || '');

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
            <MoveRight className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900">Move Subcategory</h3>
            <p className="text-xs text-slate-500">Reassign parent category in database</p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-semibold">Subcategory:</span>
            <span className="font-extrabold text-slate-900">{subcategory.name}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-semibold">Current Parent:</span>
            <span className="font-bold text-slate-700">{currentParent?.name || 'None'}</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Select New Parent Category:
          </label>
          <select
            value={selectedParentId}
            onChange={(e) => setSelectedParentId(e.target.value)}
            className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-purple-500 shadow-2xs"
          >
            {availableParents.map((parent) => (
              <option key={parent.id} value={parent.id}>
                {parent.name}
              </option>
            ))}
          </select>
        </div>

        <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 flex items-start gap-2 text-xs text-purple-900">
          <AlertCircle className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            All products currently mapped to <strong>{subcategory.name}</strong> will also update their category association to the selected new parent.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selectedParentId}
            onClick={() => onMove(subcategory.id, selectedParentId)}
            className="px-5 py-2 text-xs font-bold bg-purple-700 hover:bg-purple-800 disabled:bg-slate-200 text-white rounded-xl shadow-2xs transition-all flex items-center gap-1.5"
          >
            <MoveRight className="w-3.5 h-3.5" />
            <span>Confirm Move</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   SAFE DELETE CATEGORY & SUBCATEGORY MODAL
   ═══════════════════════════════════════════════════════════════════════ */
interface SafeDeleteModalProps {
  category: Category;
  topCategories: Category[];
  subcategoriesMap: Record<string, Category[]>;
  products: Product[];
  onClose: () => void;
  onConfirm: (id: string, options?: { reassignCategoryId?: string; reassignSubcategoryId?: string }) => void;
}

const SafeDeleteModal: React.FC<SafeDeleteModalProps> = ({
  category,
  topCategories,
  subcategoriesMap,
  products,
  onClose,
  onConfirm,
}) => {
  const isTopLevel = !category.parentId;
  const attachedSubcategories = subcategoriesMap[category.id] || [];
  const attachedProducts = products.filter(
    (p) => p.categoryId === category.id || p.subcategoryId === category.id
  );

  const fallbackCategories = topCategories.filter((c) => c.id !== category.id);
  const [reassignCategoryId, setReassignCategoryId] = useState(fallbackCategories[0]?.id || '');

  const hasDependencies = attachedSubcategories.length > 0 || attachedProducts.length > 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900">
              Delete {isTopLevel ? 'Category' : 'Subcategory'}?
            </h3>
            <p className="text-xs text-slate-500">Safely handle attached catalog records</p>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs text-slate-700">
            Are you sure you want to delete <strong>&ldquo;{category.name}&rdquo;</strong>?
          </p>

          {hasDependencies ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>Existing Relationships Found:</span>
              </div>
              <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside">
                {attachedSubcategories.length > 0 && (
                  <li>
                    <strong>{attachedSubcategories.length}</strong> subcategories attached
                  </li>
                )}
                {attachedProducts.length > 0 && (
                  <li>
                    <strong>{attachedProducts.length}</strong> catalog products attached
                  </li>
                )}
              </ul>

              {fallbackCategories.length > 0 && (
                <div className="pt-2 border-t border-amber-200/60">
                  <label className="block text-[11px] font-bold text-amber-950 mb-1">
                    Reassign products &amp; subcategories to:
                  </label>
                  <select
                    value={reassignCategoryId}
                    onChange={(e) => setReassignCategoryId(e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-amber-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-amber-500"
                  >
                    {fallbackCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-800">
              ✓ No products or subcategories are linked to this item. Safe to delete immediately.
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(category.id, { reassignCategoryId })}
            className="px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-2xs transition-all flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Confirm Deletion</span>
          </button>
        </div>
      </div>
    </div>
  );
};
