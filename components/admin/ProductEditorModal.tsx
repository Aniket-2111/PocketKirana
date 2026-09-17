'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  UploadCloud,
  Image as ImageIcon,
  Plus,
  Trash2,
  Check,
  Star,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Package,
  Layers,
  Tag,
  ShieldCheck,
  Eye,
  EyeOff,
  Sliders,
  DollarSign,
  Info,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ShoppingBag,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  LayoutGrid,
  ListPlus,
  FolderPlus,
  FileText,
  Activity,
  HeartHandshake,
} from 'lucide-react';
import { Product, Category, Brand, ProductSection, ProductAttribute, ProductPublishStatus } from '@/types';
import { uploadProductImageFS } from '@/lib/firebaseStorage';
import { showToast } from '@/components/ui/Toast';
import { normalizeProductSections, getDefaultProductSections } from '@/lib/productSectionUtils';

interface ProductEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null; // If provided, Edit mode; if null/undefined, Add mode
  categories: Category[];
  brands?: Brand[];
  onSave: (productData: Partial<Product>) => void;
}

export function ProductEditorModal({
  isOpen,
  onClose,
  product,
  categories,
  brands = [],
  onSave,
}: ProductEditorModalProps) {
  const isEdit = !!product;

  // Active top-level Tab
  const [activeTab, setActiveTab] = useState<'basic' | 'images' | 'sections' | 'preview'>('basic');

  // Core Basic Info
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [mrp, setMrp] = useState('');
  const [unit, setUnit] = useState('1 kg');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [status, setStatus] = useState<'active' | 'out_of_stock' | 'discontinued'>('active');
  const [publishStatus, setPublishStatus] = useState<ProductPublishStatus>('PUBLISHED');
  const [stock, setStock] = useState('100');
  const [description, setDescription] = useState('');

  // Dynamic Sections State
  const [sections, setSections] = useState<ProductSection[]>([]);
  const [activeSectionId, setActiveSectionId] = useState<string>('');

  // Multi-Image Gallery Studio
  const [images, setImages] = useState<string[]>([]);
  const [thumbnail, setThumbnail] = useState<string>('');
  const [maxDisplayImages, setMaxDisplayImages] = useState<number>(0);
  const [isLimitEnabled, setIsLimitEnabled] = useState<boolean>(false);
  const [customLimit, setCustomLimit] = useState<number>(4);

  // Upload state
  const [urlInput, setUrlInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live Preview Gallery state
  const [previewImgIndex, setPreviewImgIndex] = useState(0);
  const [previewAccordionState, setPreviewAccordionState] = useState<Record<string, boolean>>({});

  // Populate state on open or product change
  useEffect(() => {
    if (product) {
      setName(product.name || '');
      setCategoryId(product.categoryId || categories[0]?.id || 'cat-veg');
      setBrandId(product.brandId || '');
      setSellingPrice(product.sellingPrice !== undefined ? String(product.sellingPrice) : '');
      setMrp(product.mrp !== undefined ? String(product.mrp) : '');
      setUnit(product.unit || '1 kg');
      setSku(product.sku || `SKU-${Date.now().toString().slice(-6)}`);
      setBarcode(product.barcode || product.ean || '');
      setStatus(product.status || 'active');
      setPublishStatus(product.publishStatus || 'PUBLISHED');
      setStock(product.stock !== undefined ? String(product.stock) : '100');
      setDescription(product.description || '');

      // Load dynamic sections
      const normalized = normalizeProductSections(product);
      setSections(normalized);
      if (normalized.length > 0) {
        setActiveSectionId(normalized[0].id);
        const initialOpen: Record<string, boolean> = {};
        normalized.forEach((s) => {
          initialOpen[s.id] = s.defaultExpanded !== false;
        });
        setPreviewAccordionState(initialOpen);
      }

      // Build images list
      const initialImages: string[] = [];
      if (product.thumbnail) initialImages.push(product.thumbnail);
      if (product.image && !initialImages.includes(product.image)) initialImages.push(product.image);
      if (product.images && product.images.length > 0) {
        product.images.forEach((img) => {
          if (img && !initialImages.includes(img)) initialImages.push(img);
        });
      }
      const finalImages = initialImages.length > 0 ? initialImages : [
        'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
      ];
      setImages(finalImages);
      setThumbnail(product.thumbnail || product.image || finalImages[0]);

      if (product.maxDisplayImages && product.maxDisplayImages > 0) {
        setIsLimitEnabled(true);
        setCustomLimit(product.maxDisplayImages);
        setMaxDisplayImages(product.maxDisplayImages);
      } else {
        setIsLimitEnabled(false);
        setMaxDisplayImages(0);
      }
    } else {
      // Reset for new product
      setName('');
      setCategoryId(categories[0]?.id || 'cat-veg');
      setBrandId(brands[0]?.id || '');
      setSellingPrice('120');
      setMrp('140');
      setUnit('1 kg');
      setSku(`SKU-${Date.now().toString().slice(-6)}`);
      setBarcode(`${Date.now().toString().slice(-12)}`);
      setStatus('active');
      setPublishStatus('PUBLISHED');
      setStock('100');
      setDescription('');

      const defaultSecs = getDefaultProductSections();
      setSections(defaultSecs);
      if (defaultSecs.length > 0) {
        setActiveSectionId(defaultSecs[0].id);
      }

      setImages([
        'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
      ]);
      setThumbnail('https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80');
      setIsLimitEnabled(false);
      setMaxDisplayImages(0);
    }
  }, [product, categories, brands, isOpen]);

  if (!isOpen) return null;

  // ── Section Actions ──
  const handleAddCustomSection = () => {
    const newSecId = `sec-custom-${Date.now()}`;
    const newSection: ProductSection = {
      id: newSecId,
      productId: product?.id,
      title: 'New Custom Section',
      displayOrder: sections.length + 1,
      isVisible: true,
      defaultExpanded: false,
      attributes: [
        {
          id: `attr-${Date.now()}-1`,
          sectionId: newSecId,
          label: 'Field Name',
          value: 'Sample Value',
          unit: '',
          displayOrder: 1,
          isVisible: true,
        },
      ],
    };
    setSections([...sections, newSection]);
    setActiveSectionId(newSecId);
    showToast('Custom section added!', 'success');
  };

  const handleUpdateSectionTitle = (secId: string, newTitle: string) => {
    setSections(sections.map((s) => (s.id === secId ? { ...s, title: newTitle } : s)));
  };

  const handleToggleSectionVisibility = (secId: string) => {
    setSections(sections.map((s) => (s.id === secId ? { ...s, isVisible: !s.isVisible } : s)));
  };

  const handleToggleSectionDefaultExpanded = (secId: string) => {
    setSections(sections.map((s) => (s.id === secId ? { ...s, defaultExpanded: !s.defaultExpanded } : s)));
  };

  const handleMoveSection = (secId: string, direction: 'up' | 'down') => {
    const idx = sections.findIndex((s) => s.id === secId);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === sections.length - 1) return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const reordered = [...sections];
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(targetIdx, 0, moved);

    // Re-assign displayOrder
    const updated = reordered.map((s, i) => ({ ...s, displayOrder: i + 1 }));
    setSections(updated);
  };

  const handleDeleteSection = (secId: string) => {
    if (sections.length <= 1) {
      showToast('You must keep at least one section.', 'error');
      return;
    }
    const filtered = sections.filter((s) => s.id !== secId).map((s, i) => ({ ...s, displayOrder: i + 1 }));
    setSections(filtered);
    if (activeSectionId === secId) {
      setActiveSectionId(filtered[0]?.id || '');
    }
    showToast('Section removed', 'info');
  };

  // ── Attribute Actions ──
  const handleAddAttribute = (secId: string) => {
    setSections(
      sections.map((s) => {
        if (s.id !== secId) return s;
        const newAttr: ProductAttribute = {
          id: `attr-${Date.now()}-${(s.attributes || []).length + 1}`,
          sectionId: secId,
          label: 'New Field',
          value: '',
          unit: '',
          displayOrder: (s.attributes || []).length + 1,
          isVisible: true,
        };
        return {
          ...s,
          attributes: [...(s.attributes || []), newAttr],
        };
      })
    );
  };

  const handleUpdateAttribute = (
    secId: string,
    attrId: string,
    updates: Partial<ProductAttribute>
  ) => {
    setSections(
      sections.map((s) => {
        if (s.id !== secId) return s;
        return {
          ...s,
          attributes: (s.attributes || []).map((a) => (a.id === attrId ? { ...a, ...updates } : a)),
        };
      })
    );
  };

  const handleToggleAttributeVisibility = (secId: string, attrId: string) => {
    setSections(
      sections.map((s) => {
        if (s.id !== secId) return s;
        return {
          ...s,
          attributes: (s.attributes || []).map((a) => (a.id === attrId ? { ...a, isVisible: !a.isVisible } : a)),
        };
      })
    );
  };

  const handleMoveAttribute = (secId: string, attrId: string, direction: 'up' | 'down') => {
    setSections(
      sections.map((s) => {
        if (s.id !== secId) return s;
        const attrs = [...(s.attributes || [])];
        const idx = attrs.findIndex((a) => a.id === attrId);
        if (idx === -1) return s;
        if (direction === 'up' && idx === 0) return s;
        if (direction === 'down' && idx === attrs.length - 1) return s;

        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        const [moved] = attrs.splice(idx, 1);
        attrs.splice(targetIdx, 0, moved);

        return {
          ...s,
          attributes: attrs.map((a, i) => ({ ...a, displayOrder: i + 1 })),
        };
      })
    );
  };

  const handleDeleteAttribute = (secId: string, attrId: string) => {
    setSections(
      sections.map((s) => {
        if (s.id !== secId) return s;
        return {
          ...s,
          attributes: (s.attributes || []).filter((a) => a.id !== attrId).map((a, i) => ({ ...a, displayOrder: i + 1 })),
        };
      })
    );
  };

  // ── Image Actions ──
  const handleAddImageUrl = () => {
    if (!urlInput.trim()) return;
    if (images.includes(urlInput.trim())) {
      showToast('Image URL already added', 'info');
      return;
    }
    const updated = [...images, urlInput.trim()];
    setImages(updated);
    if (!thumbnail) setThumbnail(urlInput.trim());
    setUrlInput('');
    showToast('Photo added to gallery', 'success');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(`Uploading 1 of ${files.length}...`);

    const uploadedUrls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(`Uploading ${i + 1} of ${files.length}...`);
      try {
        const url = await uploadProductImageFS(file, `products/${Date.now()}_${file.name}`);
        if (url) {
          uploadedUrls.push(url);
        } else {
          const fallbackUrl = URL.createObjectURL(file);
          uploadedUrls.push(fallbackUrl);
        }
      } catch (err: any) {
        console.warn('Storage fallback using local preview URL', err);
        const fallbackUrl = URL.createObjectURL(file);
        uploadedUrls.push(fallbackUrl);
      }
    }

    const updated = [...images, ...uploadedUrls];
    setImages(updated);
    if (!thumbnail && updated.length > 0) setThumbnail(updated[0]);
    setIsUploading(false);
    setUploadProgress('');
    showToast(`Uploaded ${uploadedUrls.length} image(s)!`, 'success');
  };

  const handleDeleteImage = (imgUrl: string) => {
    if (images.length <= 1) {
      showToast('Product must retain at least one image', 'error');
      return;
    }
    const updated = images.filter((img) => img !== imgUrl);
    setImages(updated);
    if (thumbnail === imgUrl) {
      setThumbnail(updated[0] || '');
    }
    showToast('Image removed', 'info');
  };

  const handleSetPrimary = (imgUrl: string) => {
    setThumbnail(imgUrl);
    showToast('Set as primary cover photo', 'success');
  };

  const handleMoveImage = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === images.length - 1) return;
    const target = direction === 'up' ? index - 1 : index + 1;
    const reordered = [...images];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved);
    setImages(reordered);
  };

  // ── Final Save / Publish ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showToast('Product name is required', 'error');
      return;
    }

    const sPrice = parseFloat(sellingPrice) || 0;
    const mPrice = parseFloat(mrp) || sPrice;

    if (sPrice <= 0) {
      showToast('Selling Price must be greater than 0', 'error');
      return;
    }

    const activeBrand = brands.find((b) => b.id === brandId);
    const primaryImg = thumbnail || images[0] || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80';

    const payload: Partial<Product> = {
      id: product?.id || `prod-${Date.now()}`,
      name: name.trim(),
      slug: product?.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      categoryId: categoryId || categories[0]?.id || 'cat-veg',
      brandId: brandId || undefined,
      brandName: activeBrand?.name || product?.brandName || '',
      sellingPrice: sPrice,
      mrp: mPrice,
      price: sPrice,
      unit: unit.trim() || '1 kg',
      sku: sku.trim() || `SKU-${Date.now().toString().slice(-6)}`,
      barcode: barcode.trim(),
      status,
      publishStatus,
      stock: parseInt(stock, 10) || 100,
      description: description.trim(),
      thumbnail: primaryImg,
      image: primaryImg,
      images,
      maxDisplayImages: isLimitEnabled ? customLimit : 0,
      sections,
    };

    // Save locally via store handler
    onSave(payload);

    // Call Versioned REST API in background to persist normalized DB & cache
    try {
      const endpoint = isEdit ? `/api/v1/products/${payload.id}` : `/api/v1/products`;
      const method = isEdit ? 'PUT' : 'POST';
      await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-pk-role': 'admin',
          'x-pk-uid': 'admin_1',
        },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.warn('API sync warning:', e);
    }

    showToast(isEdit ? 'Product specifications updated & published!' : 'New product created & published!', 'success');
    onClose();
  };

  const currentActiveSection = sections.find((s) => s.id === activeSectionId) || sections[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl max-h-[94vh] bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden">
        
        {/* ── HEADER BAR ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#3B0764] text-white flex items-center justify-center shadow-md shadow-purple-900/20">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900 leading-tight">
                {isEdit ? 'Edit Product & Dynamic Details' : 'Add New Product (Dynamic Studio)'}
              </h2>
              <p className="text-xs text-gray-500 font-medium">
                Unified specifications builder for Web, Customer APK, and Store Operations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Publish Status Badge */}
            <select
              value={publishStatus}
              onChange={(e) => setPublishStatus(e.target.value as ProductPublishStatus)}
              className={`text-xs font-black px-3 py-1.5 rounded-full border outline-none cursor-pointer ${
                publishStatus === 'PUBLISHED'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : publishStatus === 'PREVIEW'
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-slate-100 text-slate-700 border-slate-300'
              }`}
            >
              <option value="PUBLISHED">🟢 PUBLISHED (Live)</option>
              <option value="PREVIEW">🟡 PREVIEW (Draft Mode)</option>
              <option value="DRAFT">⚪ DRAFT (Hidden)</option>
            </select>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-gray-200/80 hover:bg-gray-300 text-gray-600 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── NAVIGATION TABS ── */}
        <div className="flex items-center gap-2 px-6 py-2.5 border-b border-gray-100 bg-white shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('basic')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'basic'
                ? 'bg-[#3B0764] text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>1. Basic Info &amp; Pricing</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('images')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'images'
                ? 'bg-[#3B0764] text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>2. Product Images ({images.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sections')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'sections'
                ? 'bg-[#3B0764] text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>3. Dynamic Sections ({sections.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'preview'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>4. Customer App Preview</span>
          </button>
        </div>

        {/* ── MODAL CONTENT BODY ── */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/40">
          <form id="product-editor-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* ── TAB 1: BASIC INFORMATION & PRICING ── */}
            {activeTab === 'basic' && (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-3xl border border-gray-200/80 shadow-xs space-y-4">
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                    <Tag className="w-4 h-4 text-purple-700" />
                    Product Identity
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Product Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Aashirvaad Superior MP Chakki Atta (5kg)"
                        className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:bg-white focus:border-purple-600 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Category</label>
                      <select
                        value={categoryId}
                        onChange={(e) => setCategoryId(e.target.value)}
                        className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:bg-white focus:border-purple-600 outline-none"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Brand</label>
                      <select
                        value={brandId}
                        onChange={(e) => setBrandId(e.target.value)}
                        className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:bg-white focus:border-purple-600 outline-none"
                      >
                        <option value="">-- Direct Farm / Unbranded --</option>
                        {brands.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Unit / Packaging Weight</label>
                      <input
                        type="text"
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        placeholder="e.g. 1 kg, 500 g, 1 L"
                        className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:bg-white focus:border-purple-600 outline-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Barcode / EAN-13</label>
                      <input
                        type="text"
                        value={barcode}
                        onChange={(e) => setBarcode(e.target.value)}
                        placeholder="e.g. 8901030384721"
                        className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:bg-white focus:border-purple-600 outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Pricing & Stock Card */}
                <div className="bg-white p-6 rounded-3xl border border-gray-200/80 shadow-xs space-y-4">
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    Pricing &amp; Inventory
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Selling Price (₹) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        required
                        value={sellingPrice}
                        onChange={(e) => setSellingPrice(e.target.value)}
                        placeholder="120"
                        className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-black text-emerald-800 focus:bg-white focus:border-emerald-600 outline-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">MRP (₹)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={mrp}
                        onChange={(e) => setMrp(e.target.value)}
                        placeholder="140"
                        className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-700 focus:bg-white focus:border-purple-600 outline-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Stock Quantity</label>
                      <input
                        type="number"
                        value={stock}
                        onChange={(e) => setStock(e.target.value)}
                        placeholder="100"
                        className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:bg-white focus:border-purple-600 outline-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Stock Status</label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as any)}
                        className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:bg-white focus:border-purple-600 outline-none"
                      >
                        <option value="active">Active (In Stock)</option>
                        <option value="out_of_stock">Out of Stock</option>
                        <option value="discontinued">Discontinued</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Short Description</label>
                    <textarea
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Brief overview of product features and origin..."
                      className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-gray-900 focus:bg-white focus:border-purple-600 outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 2: PRODUCT IMAGES STUDIO ── */}
            {activeTab === 'images' && (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-3xl border border-gray-200/80 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-purple-700" />
                        Multi-Photo Gallery Studio
                      </h3>
                      <p className="text-xs text-gray-500 font-medium mt-0.5">
                        Upload or paste direct image URLs. Set cover photo and customer app photo limits.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                      >
                        <UploadCloud className="w-4 h-4" />
                        <span>{isUploading ? uploadProgress || 'Uploading...' : 'Upload Photos'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Add URL input */}
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="Or paste direct image URL (https://...)..."
                      className="flex-1 bg-slate-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-gray-900 focus:bg-white focus:border-purple-600 outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddImageUrl}
                      className="bg-[#3B0764] hover:bg-purple-900 text-white font-black text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer"
                    >
                      Add URL
                    </button>
                  </div>

                  {/* Display Limit Settings */}
                  <div className="p-4 bg-purple-50/50 border border-purple-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        id="limit-photos-check"
                        checked={isLimitEnabled}
                        onChange={(e) => setIsLimitEnabled(e.target.checked)}
                        className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                      />
                      <label htmlFor="limit-photos-check" className="text-xs font-bold text-purple-950 cursor-pointer">
                        Limit photos displayed to customers (Show top N images)
                      </label>
                    </div>

                    {isLimitEnabled && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-600">Show max:</span>
                        <input
                          type="number"
                          min={1}
                          max={images.length || 10}
                          value={customLimit}
                          onChange={(e) => setCustomLimit(parseInt(e.target.value, 10) || 1)}
                          className="w-16 bg-white border border-purple-300 rounded-lg px-2 py-1 text-xs font-black text-center font-mono outline-none"
                        />
                        <span className="text-xs font-medium text-gray-500">photos</span>
                      </div>
                    )}
                  </div>

                  {/* Images Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 pt-2">
                    {images.map((imgUrl, idx) => {
                      const isPrimary = thumbnail === imgUrl || (!thumbnail && idx === 0);
                      return (
                        <div
                          key={`editor-img-${idx}`}
                          className={`relative group bg-white rounded-2xl border-2 overflow-hidden shadow-xs flex flex-col items-center justify-between p-2 transition-all ${
                            isPrimary ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-gray-200'
                          }`}
                        >
                          <div className="w-full h-24 flex items-center justify-center overflow-hidden rounded-xl bg-slate-50">
                            <img src={imgUrl} alt={`Photo ${idx + 1}`} className="max-h-full max-w-full object-contain" />
                          </div>

                          {isPrimary && (
                            <span className="absolute top-2 left-2 bg-emerald-600 text-white font-black text-[9px] px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1">
                              <Star className="w-2.5 h-2.5 fill-current" /> Cover
                            </span>
                          )}

                          <div className="w-full pt-2 flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveImage(idx, 'up')}
                                className="w-6 h-6 rounded-md bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 disabled:opacity-30"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === images.length - 1}
                                onClick={() => handleMoveImage(idx, 'down')}
                                className="w-6 h-6 rounded-md bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 disabled:opacity-30"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            </div>

                            <div className="flex items-center gap-1">
                              {!isPrimary && (
                                <button
                                  type="button"
                                  onClick={() => handleSetPrimary(imgUrl)}
                                  title="Set as cover"
                                  className="w-6 h-6 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 flex items-center justify-center"
                                >
                                  <Star className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteImage(imgUrl)}
                                title="Delete image"
                                className="w-6 h-6 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 3: DYNAMIC SECTIONS & SPECIFICATIONS BUILDER ── */}
            {activeTab === 'sections' && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Left Sidebar: Section List */}
                <div className="md:col-span-4 space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-black text-gray-500 uppercase tracking-wider">
                      Product Sections
                    </span>
                    <button
                      type="button"
                      onClick={handleAddCustomSection}
                      className="bg-[#3B0764] hover:bg-purple-900 text-white font-black text-[11px] px-3 py-1.5 rounded-xl shadow-2xs flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Custom Section</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {sections.map((sec, idx) => {
                      const isActive = sec.id === activeSectionId;
                      return (
                        <div
                          key={sec.id}
                          onClick={() => setActiveSectionId(sec.id)}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                            isActive
                              ? 'bg-purple-50/80 border-purple-500 shadow-xs ring-1 ring-purple-200'
                              : 'bg-white border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-black flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="text-xs font-black text-gray-900 truncate">
                              {sec.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleToggleSectionVisibility(sec.id)}
                              title={sec.isVisible ? 'Visible to customers' : 'Hidden from customers'}
                              className={`p-1 rounded-md text-xs ${
                                sec.isVisible ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'
                              }`}
                            >
                              {sec.isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                            </button>

                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveSection(sec.id, 'up')}
                              className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              disabled={idx === sections.length - 1}
                              onClick={() => handleMoveSection(sec.id, 'down')}
                              className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteSection(sec.id)}
                              className="p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-md"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right Panel: Active Section Fields Editor */}
                <div className="md:col-span-8 bg-white p-6 rounded-3xl border border-gray-200 shadow-xs space-y-5">
                  {currentActiveSection ? (
                    <>
                      {/* Section Header Controls */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
                        <div className="flex-1">
                          <label className="block text-[10px] font-bold text-gray-500 uppercase">Section Title</label>
                          <input
                            type="text"
                            value={currentActiveSection.title}
                            onChange={(e) => handleUpdateSectionTitle(currentActiveSection.id, e.target.value)}
                            className="text-base font-black text-gray-900 border-b border-transparent focus:border-purple-600 outline-none w-full bg-transparent"
                          />
                        </div>

                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={currentActiveSection.defaultExpanded}
                              onChange={() => handleToggleSectionDefaultExpanded(currentActiveSection.id)}
                              className="rounded border-gray-300 text-purple-600"
                            />
                            <span>Expanded by default</span>
                          </label>

                          <button
                            type="button"
                            onClick={() => handleAddAttribute(currentActiveSection.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-3.5 py-1.5 rounded-xl shadow-2xs flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Field</span>
                          </button>
                        </div>
                      </div>

                      {/* Fields Table / Rows */}
                      <div className="space-y-3">
                        {(currentActiveSection.attributes || []).map((attr, aIdx) => (
                          <div
                            key={attr.id}
                            className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center gap-3 ${
                              attr.isVisible ? 'bg-slate-50/70 border-gray-200' : 'bg-gray-100/60 border-dashed border-gray-300 opacity-60'
                            }`}
                          >
                            <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-black flex items-center justify-center shrink-0">
                              {aIdx + 1}
                            </span>

                            {/* Label */}
                            <div className="flex-1 w-full sm:w-auto">
                              <label className="block text-[9px] font-bold text-gray-400 uppercase">Field Label</label>
                              <input
                                type="text"
                                value={attr.label}
                                onChange={(e) => handleUpdateAttribute(currentActiveSection.id, attr.id, { label: e.target.value })}
                                placeholder="e.g. Protein Per 100 g"
                                className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-gray-900 outline-none focus:border-purple-600"
                              />
                            </div>

                            {/* Value */}
                            <div className="flex-2 w-full sm:w-auto">
                              <label className="block text-[9px] font-bold text-gray-400 uppercase">Value</label>
                              <input
                                type="text"
                                value={attr.value}
                                onChange={(e) => handleUpdateAttribute(currentActiveSection.id, attr.id, { value: e.target.value })}
                                placeholder="e.g. 12.3"
                                className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-900 outline-none focus:border-purple-600"
                              />
                            </div>

                            {/* Optional Unit */}
                            <div className="w-24">
                              <label className="block text-[9px] font-bold text-gray-400 uppercase">Unit (Opt)</label>
                              <input
                                type="text"
                                value={attr.unit || ''}
                                onChange={(e) => handleUpdateAttribute(currentActiveSection.id, attr.id, { unit: e.target.value })}
                                placeholder="g, kcal, mg"
                                className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-gray-700 outline-none focus:border-purple-600"
                              />
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 self-end sm:self-center shrink-0 pt-2 sm:pt-4">
                              <button
                                type="button"
                                onClick={() => handleToggleAttributeVisibility(currentActiveSection.id, attr.id)}
                                title={attr.isVisible ? 'Visible' : 'Hidden'}
                                className={`p-1.5 rounded-lg text-xs ${
                                  attr.isVisible ? 'text-emerald-600 hover:bg-emerald-100' : 'text-slate-400 hover:bg-slate-200'
                                }`}
                              >
                                {attr.isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                              </button>

                              <button
                                type="button"
                                disabled={aIdx === 0}
                                onClick={() => handleMoveAttribute(currentActiveSection.id, attr.id, 'up')}
                                className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-20"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                disabled={aIdx === (currentActiveSection.attributes?.length || 1) - 1}
                                onClick={() => handleMoveAttribute(currentActiveSection.id, attr.id, 'down')}
                                className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-20"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteAttribute(currentActiveSection.id, attr.id)}
                                className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}

                        {(!currentActiveSection.attributes || currentActiveSection.attributes.length === 0) && (
                          <div className="p-8 text-center border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 space-y-2">
                            <ListPlus className="w-8 h-8 mx-auto text-gray-300" />
                            <p className="text-xs font-bold">No fields in this section yet.</p>
                            <button
                              type="button"
                              onClick={() => handleAddAttribute(currentActiveSection.id)}
                              className="text-xs font-black text-purple-700 hover:underline"
                            >
                              + Add first field
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-gray-400">Select a section to edit.</p>
                  )}
                </div>
              </div>
            )}

            {/* ── TAB 4: CUSTOMER APP LIVE PREVIEW (MATCHING REFERENCE UI) ── */}
            {activeTab === 'preview' && (
              <div className="flex justify-center p-2">
                <div className="w-full max-w-sm bg-[#121215] rounded-[36px] border-4 border-slate-800 shadow-2xl overflow-hidden text-white font-sans">
                  
                  {/* Top Image Showcase */}
                  <div className="relative bg-white rounded-b-[28px] p-6 flex items-center justify-center h-64 overflow-hidden">
                    <img
                      src={images[previewImgIndex] || thumbnail}
                      alt="Preview"
                      className="max-h-full max-w-full object-contain"
                    />
                    <div className="absolute bottom-3 right-3 bg-white p-1 rounded-md border border-emerald-600 shadow-xs">
                      <div className="w-2 h-2 rounded-full bg-emerald-600" />
                    </div>
                  </div>

                  {/* Pricing Details */}
                  <div className="p-4 space-y-3">
                    <div>
                      <h4 className="text-sm font-black text-white">{name || 'Product Title'}</h4>
                      <span className="text-xs text-slate-400 font-mono">{unit}</span>
                    </div>

                    <div className="flex items-baseline gap-2">
                      <strong className="text-xl font-black text-white font-mono">₹{sellingPrice || '0'}</strong>
                      {parseFloat(mrp) > parseFloat(sellingPrice) && (
                        <span className="text-xs font-bold text-slate-500 line-through font-mono">MRP ₹{mrp}</span>
                      )}
                    </div>

                    {/* Dynamic Accordions Preview */}
                    <div className="space-y-2 pt-2">
                      <span className="text-xs font-black text-slate-400 uppercase tracking-wider block">
                        Specifications &amp; Details
                      </span>

                      {sections.filter((s) => s.isVisible).map((sec) => {
                        const isOpen = previewAccordionState[sec.id] ?? sec.defaultExpanded;
                        return (
                          <div key={`prev-${sec.id}`} className="bg-[#24242C] border border-slate-700/60 rounded-2xl overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setPreviewAccordionState((prev) => ({ ...prev, [sec.id]: !isOpen }))}
                              className="w-full p-3 flex items-center justify-between text-left text-xs font-bold text-white cursor-pointer"
                            >
                              <span>{sec.title}</span>
                              {isOpen ? <ChevronUp className="w-4 h-4 text-slate-300" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                            </button>

                            {isOpen && (
                              <div className="px-3 pb-3 pt-1 border-t border-slate-700/40 space-y-1.5 text-[11px]">
                                {(sec.attributes || [])
                                  .filter((a) => a.isVisible && a.value)
                                  .map((a) => (
                                    <div key={`prev-a-${a.id}`} className="flex items-center justify-between py-0.5">
                                      <span className="text-slate-400 font-medium">{a.label}</span>
                                      <span className="text-slate-200 font-bold font-mono">
                                        {a.value} {a.unit || ''}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

          </form>
        </div>

        {/* ── FOOTER ACTIONS ── */}
        <div className="px-6 py-4 border-t border-gray-100 bg-white flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setPublishStatus('DRAFT');
                setTimeout(() => {
                  const form = document.getElementById('product-editor-form') as HTMLFormElement;
                  form?.requestSubmit();
                }, 50);
              }}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-all cursor-pointer"
            >
              Save as Draft
            </button>

            <button
              type="submit"
              form="product-editor-form"
              className="px-6 py-2.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white font-black text-xs shadow-md shadow-emerald-900/20 transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{isEdit ? 'Save & Publish Product' : 'Create & Publish Product'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
