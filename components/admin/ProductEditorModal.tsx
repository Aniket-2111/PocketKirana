'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Scale,
  Box,
  Edit3,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
} from 'lucide-react';
import {
  Product,
  Category,
  Brand,
  ProductSection,
  ProductAttribute,
  ProductPublishStatus,
  ProductVariant,
  MeasurementType,
  PackagingType,
  MeasurementUnit,
} from '@/types';
import { uploadProductImageFS } from '@/lib/firebaseStorage';
import { showToast } from '@/components/ui/Toast';
import { normalizeProductSections, getDefaultProductSections } from '@/lib/productSectionUtils';
import {
  UNIT_OPTIONS,
  WEIGHT_OPTIONS,
  VOLUME_OPTIONS,
  PACKAGING_OPTIONS,
  parseLegacyUnit,
  formatCustomerDisplay,
  areVariantsDuplicate,
  normalizeVariantMeasurement,
  normalizeDecimal,
} from '@/lib/measurementUtils';

interface ProductEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null;
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
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [status, setStatus] = useState<'active' | 'out_of_stock' | 'discontinued'>('active');
  const [publishStatus, setPublishStatus] = useState<ProductPublishStatus>('PUBLISHED');
  const [stock, setStock] = useState('100');
  const [description, setDescription] = useState('');

  // Structured Measurement & Packaging
  const [measurementType, setMeasurementType] = useState<MeasurementType>('WEIGHT');
  const [measurementUnit, setMeasurementUnit] = useState<string>('KG');
  const [measurementValue, setMeasurementValue] = useState<string>('1');
  const [packagingType, setPackagingType] = useState<PackagingType>('Packet');

  // Product Variants State
  const [hasVariants, setHasVariants] = useState<boolean>(false);
  const [variants, setVariants] = useState<ProductVariant[]>([]);

  // Variant Modal / Editor state
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [editingVariantIndex, setEditingVariantIndex] = useState<number | null>(null);
  const [vName, setVName] = useState('');
  const [vMeasurementType, setVMeasurementType] = useState<MeasurementType>('WEIGHT');
  const [vMeasurementUnit, setVMeasurementUnit] = useState<string>('KG');
  const [vMeasurementValue, setVMeasurementValue] = useState<string>('1');
  const [vPackagingType, setVPackagingType] = useState<PackagingType>('Packet');
  const [vSellingPrice, setVSellingPrice] = useState('120');
  const [vMrp, setVMrp] = useState('140');
  const [vStock, setVStock] = useState('50');
  const [vSku, setVSku] = useState('');
  const [vBarcode, setVBarcode] = useState('');
  const [vIsActive, setVIsActive] = useState(true);

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
  const [previewSelectedVariantId, setPreviewSelectedVariantId] = useState<string>('');

  // Populate state on open or product change
  useEffect(() => {
    if (product) {
      setName(product.name || '');
      setCategoryId(product.categoryId || categories[0]?.id || 'cat-veg');
      setBrandId(product.brandId || '');
      setSellingPrice(product.sellingPrice !== undefined ? String(product.sellingPrice) : '');
      setMrp(product.mrp !== undefined ? String(product.mrp) : '');
      setSku(product.sku || `SKU-${Date.now().toString().slice(-6)}`);
      setBarcode(product.barcode || product.ean || '');
      setStatus(product.status || 'active');
      setPublishStatus(product.publishStatus || 'PUBLISHED');
      setStock(product.stock !== undefined ? String(product.stock) : '100');
      setDescription(product.description || '');

      // Parse structured measurement or legacy fallback
      if (product.measurementType && product.measurementUnit) {
        setMeasurementType(product.measurementType);
        setMeasurementUnit(product.measurementUnit);
        setMeasurementValue(product.measurementValue !== undefined ? String(product.measurementValue) : '1');
        setPackagingType(product.packagingType || 'Packet');
      } else {
        const parsed = parseLegacyUnit(product.unit, product.name);
        setMeasurementType(parsed.measurementType);
        setMeasurementUnit(parsed.measurementUnit);
        setMeasurementValue(String(parsed.measurementValue));
        setPackagingType(parsed.packagingType);
      }

      // Populate variants
      const existingVars = product.variants || [];
      setVariants(existingVars);
      setHasVariants(Boolean(product.hasVariants || existingVars.length > 0));
      if (existingVars.length > 0) {
        setPreviewSelectedVariantId(existingVars[0].id);
      }

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
      setSku(`SKU-${Date.now().toString().slice(-6)}`);
      setBarcode(`${Date.now().toString().slice(-12)}`);
      setStatus('active');
      setPublishStatus('PUBLISHED');
      setStock('100');
      setDescription('');

      setMeasurementType('WEIGHT');
      setMeasurementUnit('KG');
      setMeasurementValue('1');
      setPackagingType('Packet');

      setHasVariants(false);
      setVariants([]);
      setPreviewSelectedVariantId('');

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

  // Sync measurement unit default when measurementType changes
  const handleMeasurementTypeChange = (newType: MeasurementType) => {
    setMeasurementType(newType);
    if (newType === 'WEIGHT') {
      setMeasurementUnit('KG');
    } else if (newType === 'VOLUME') {
      setMeasurementUnit('LTR');
    } else {
      setMeasurementUnit('piece');
    }
  };

  // Sync variant unit default when variant measurementType changes
  const handleVMeasurementTypeChange = (newType: MeasurementType) => {
    setVMeasurementType(newType);
    if (newType === 'WEIGHT') {
      setVMeasurementUnit('KG');
    } else if (newType === 'VOLUME') {
      setVMeasurementUnit('LTR');
    } else {
      setVMeasurementUnit('piece');
    }
  };

  // Computed total variant stock
  const totalVariantStock = useMemo(() => {
    return variants
      .filter((v) => v.isActive)
      .reduce((sum, v) => sum + (v.stockQuantity !== undefined ? v.stockQuantity : v.stock || 0), 0);
  }, [variants]);

  // Customer display for base product
  const baseCustomerDisplay = useMemo(() => {
    return formatCustomerDisplay(
      measurementType,
      measurementValue,
      measurementUnit,
      packagingType,
      { showPackaging: true, showLooseLabel: true }
    );
  }, [measurementType, measurementValue, measurementUnit, packagingType]);

  // Active preview variant
  const activePreviewVariant = useMemo(() => {
    if (!hasVariants || variants.length === 0) return null;
    return variants.find((v) => v.id === previewSelectedVariantId) || variants[0];
  }, [hasVariants, variants, previewSelectedVariantId]);

  if (!isOpen) return null;

  // ── Variant Manager Actions ──
  const handleOpenAddVariant = () => {
    setEditingVariantIndex(null);
    setVMeasurementType(measurementType);
    setVMeasurementUnit(measurementUnit);
    setVMeasurementValue(measurementValue);
    setVPackagingType(packagingType);
    setVSellingPrice(sellingPrice || '120');
    setVMrp(mrp || '140');
    setVStock('25');
    setVSku(`${sku || 'SKU'}-V${variants.length + 1}`);
    setVBarcode('');
    setVIsActive(true);
    setVName(formatCustomerDisplay(measurementType, measurementValue, measurementUnit, packagingType));
    setIsVariantModalOpen(true);
  };

  const handleOpenEditVariant = (index: number) => {
    const v = variants[index];
    if (!v) return;
    setEditingVariantIndex(index);
    setVName(v.variantName || '');
    setVMeasurementType(v.measurementType || measurementType);
    setVMeasurementUnit(v.measurementUnit || v.quantityUnit || measurementUnit);
    setVMeasurementValue(String(v.measurementValue ?? v.quantityValue ?? 1));
    setVPackagingType(v.packagingType || packagingType);
    setVSellingPrice(String(v.sellingPrice ?? 120));
    setVMrp(String(v.mrp ?? 140));
    setVStock(String(v.stockQuantity ?? v.stock ?? 50));
    setVSku(v.sku || '');
    setVBarcode(v.barcode || '');
    setVIsActive(v.isActive !== false);
    setIsVariantModalOpen(true);
  };

  const handleDuplicateVariant = (index: number) => {
    const orig = variants[index];
    if (!orig) return;
    const cloned: ProductVariant = {
      ...orig,
      id: `v-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      variantName: `${orig.variantName} (Copy)`,
      sku: `${orig.sku || 'SKU'}-COPY`,
      isActive: true,
      displayOrder: variants.length + 1,
    };
    setVariants([...variants, cloned]);
    showToast(`Variant "${orig.variantName}" duplicated`, 'success');
  };

  const handleToggleVariantActive = (index: number) => {
    const updated = variants.map((v, i) => (i === index ? { ...v, isActive: !v.isActive } : v));
    setVariants(updated);
    showToast(`Variant ${updated[index].isActive ? 'enabled' : 'disabled'}`, 'info');
  };

  const handleDeleteVariant = (index: number) => {
    const v = variants[index];
    const updated = variants.filter((_, i) => i !== index);
    setVariants(updated);
    if (previewSelectedVariantId === v.id && updated.length > 0) {
      setPreviewSelectedVariantId(updated[0].id);
    }
    showToast(`Variant "${v.variantName}" removed`, 'info');
  };

  const handleSaveVariant = () => {
    const numVal = parseFloat(vMeasurementValue) || 1;
    const sPrice = parseFloat(vSellingPrice) || 0;
    const mPrice = parseFloat(vMrp) || sPrice;
    const stockQty = parseInt(vStock, 10) || 0;

    if (sPrice <= 0) {
      showToast('Selling price must be greater than 0', 'error');
      return;
    }
    if (numVal <= 0) {
      showToast('Measurement value must be greater than 0', 'error');
      return;
    }

    const autoName = vName.trim() || formatCustomerDisplay(vMeasurementType, numVal, vMeasurementUnit, vPackagingType);

    const draftVariant: ProductVariant = {
      id: editingVariantIndex !== null ? variants[editingVariantIndex].id : `v-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId: product?.id || 'prod-draft',
      variantName: autoName,
      measurementType: vMeasurementType,
      measurementUnit: vMeasurementUnit,
      measurementValue: numVal,
      packagingType: vPackagingType,
      quantityValue: numVal,
      quantityUnit: vMeasurementUnit,
      unit: autoName,
      sellingPrice: sPrice,
      price: sPrice,
      mrp: mPrice,
      stockQuantity: stockQty,
      stock: stockQty,
      sku: vSku.trim() || `${sku || 'SKU'}-${autoName.replace(/\s+/g, '').toUpperCase()}`,
      barcode: vBarcode.trim(),
      isActive: vIsActive,
      displayOrder: editingVariantIndex !== null ? variants[editingVariantIndex].displayOrder : variants.length + 1,
    };

    // Duplicate prevention check
    const isDuplicate = variants.some((other, idx) => {
      if (editingVariantIndex !== null && idx === editingVariantIndex) return false;
      if (!other.isActive) return false;
      return areVariantsDuplicate(draftVariant, other);
    });

    if (isDuplicate) {
      showToast(`A variant with the same measurement (${draftVariant.variantName}) already exists.`, 'error');
      return;
    }

    if (editingVariantIndex !== null) {
      const updated = variants.map((v, i) => (i === editingVariantIndex ? draftVariant : v));
      setVariants(updated);
      showToast('Variant updated successfully!', 'success');
    } else {
      setVariants([...variants, draftVariant]);
      if (!previewSelectedVariantId) {
        setPreviewSelectedVariantId(draftVariant.id);
      }
      showToast('Variant added!', 'success');
    }

    setIsVariantModalOpen(false);
  };

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

  // ── Attributes Actions ──
  const handleAddAttribute = (secId: string) => {
    setSections(
      sections.map((s) => {
        if (s.id !== secId) return s;
        const newAttr: ProductAttribute = {
          id: `attr-${Date.now()}`,
          sectionId: secId,
          label: 'New Field',
          value: '',
          unit: '',
          displayOrder: (s.attributes?.length || 0) + 1,
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
      try {
        setUploadProgress(`Uploading ${i + 1} of ${files.length} (${file.name})...`);
        const url = await uploadProductImageFS(file, product?.id || `new-prod-${Date.now()}`);
        if (url) {
          uploadedUrls.push(url);
        }
      } catch (err: any) {
        console.error('File upload error:', err);
        showToast(`Failed to upload ${file.name}: ${err.message}`, 'error');
      }
    }

    if (uploadedUrls.length > 0) {
      const newImages = [...images, ...uploadedUrls];
      setImages(newImages);
      if (!thumbnail) setThumbnail(uploadedUrls[0]);
      showToast(`Uploaded ${uploadedUrls.length} image(s) to Firebase Storage!`, 'success');
    }

    setIsUploading(false);
    setUploadProgress('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSetPrimaryImage = (url: string) => {
    setThumbnail(url);
    const reordered = [url, ...images.filter((img) => img !== url)];
    setImages(reordered);
    showToast('Set as primary cover photo', 'success');
  };

  const handleMoveImage = (idx: number, direction: 'left' | 'right') => {
    if (direction === 'left' && idx === 0) return;
    if (direction === 'right' && idx === images.length - 1) return;
    const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
    const reordered = [...images];
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(targetIdx, 0, moved);
    setImages(reordered);
  };

  const handleDeleteImage = (url: string) => {
    if (images.length <= 1) {
      showToast('You must keep at least one product photo.', 'error');
      return;
    }
    const filtered = images.filter((img) => img !== url);
    setImages(filtered);
    if (thumbnail === url) {
      setThumbnail(filtered[0] || '');
    }
    showToast('Photo removed from gallery', 'info');
  };

  // ── Submit & Validation Handler ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showToast('Product name is required', 'error');
      return;
    }

    const numVal = parseFloat(measurementValue) || 1;
    if (numVal <= 0) {
      showToast('Measurement quantity must be greater than 0', 'error');
      return;
    }

    let sPrice = parseFloat(sellingPrice) || 0;
    let mPrice = parseFloat(mrp) || sPrice;
    let finalStock = parseInt(stock, 10) || 100;

    // When variants are enabled, validate variant requirements
    if (hasVariants) {
      if (variants.length === 0) {
        showToast('Please add at least one product variant, or uncheck "This product has variants".', 'error');
        return;
      }
      finalStock = totalVariantStock;
      const activeVars = variants.filter((v) => v.isActive);
      if (activeVars.length > 0) {
        sPrice = activeVars[0].sellingPrice;
        mPrice = activeVars[0].mrp;
      }
    } else {
      if (sPrice <= 0) {
        showToast('Selling price must be greater than 0', 'error');
        return;
      }
    }

    const primaryImg = thumbnail || images[0] || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80';
    const syntheticUnit = formatCustomerDisplay(measurementType, numVal, measurementUnit, packagingType, { showPackaging: true });

    const payload: Partial<Product> = {
      id: product?.id || `p-${Date.now()}`,
      name: name.trim(),
      categoryId,
      brandId: brandId || '',
      brandName: brands.find((b) => b.id === brandId)?.name || '',
      sellingPrice: sPrice,
      mrp: mPrice,
      price: sPrice,
      unit: syntheticUnit,
      measurementType,
      measurementUnit,
      measurementValue: numVal,
      packagingType,
      hasVariants,
      variants,
      sku: sku.trim() || `SKU-${Date.now().toString().slice(-6)}`,
      barcode: barcode.trim(),
      status,
      publishStatus,
      stock: finalStock,
      description: description.trim(),
      thumbnail: primaryImg,
      image: primaryImg,
      images,
      maxDisplayImages: isLimitEnabled ? customLimit : 0,
      sections,
    };

    onSave(payload);

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

    showToast(isEdit ? 'Product updated and published!' : 'New product created and published!', 'success');
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
                {isEdit ? 'Edit Product & Specifications' : 'Add New Product (Admin Studio)'}
              </h2>
              <p className="text-xs text-gray-500 font-medium">
                Structured measurements, multi-variants, pricing &amp; dark store fulfillment
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
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
            <Tag className="w-4 h-4" />
            <span>1. Identity, Measurement &amp; Variants</span>
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
            <span>2. Photos Studio ({images.length})</span>
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
            <span>3. Dynamic Specifications ({sections.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'preview'
                ? 'bg-[#3B0764] text-white shadow-sm'
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
            
            {/* ── TAB 1: BASIC INFORMATION, MEASUREMENT & VARIANTS ── */}
            {activeTab === 'basic' && (
              <div className="space-y-6">
                
                {/* Product Identity Card */}
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
                        placeholder="e.g. Aashirvaad Superior MP Chakki Atta"
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
                      <label className="block text-xs font-bold text-gray-700 mb-1">Product SKU</label>
                      <input
                        type="text"
                        value={sku}
                        onChange={(e) => setSku(e.target.value)}
                        placeholder="e.g. ATTA-AASH-001"
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

                {/* ── MEASUREMENT & PACKAGING (STRUCTURED) ── */}
                <div className="bg-white p-6 rounded-3xl border border-purple-200/80 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                      <Scale className="w-4 h-4 text-purple-700" />
                      Measurement &amp; Packaging
                    </h3>
                    <div className="text-[11px] font-bold text-purple-900 bg-purple-50 px-3 py-1 rounded-full border border-purple-200">
                      Customer display: <span className="font-black text-purple-700">{baseCustomerDisplay}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    {/* Measurement Type */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Measurement Type <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={measurementType}
                        onChange={(e) => handleMeasurementTypeChange(e.target.value as MeasurementType)}
                        className="w-full bg-purple-50/50 border border-purple-200 rounded-xl px-3.5 py-2.5 text-xs font-black text-purple-950 focus:bg-white focus:border-purple-600 outline-none"
                      >
                        <option value="UNIT">UNIT (Countable items: packet, piece, bottle)</option>
                        <option value="WEIGHT">WEIGHT (Solid groceries: KG, G)</option>
                        <option value="VOLUME">VOLUME (Liquids &amp; drinks: LTR, ML)</option>
                      </select>
                    </div>

                    {/* Dynamic Unit Dropdown */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        {measurementType === 'WEIGHT' ? 'Weight Unit' : measurementType === 'VOLUME' ? 'Volume Unit' : 'Selling Unit'} <span className="text-rose-500">*</span>
                      </label>
                      {measurementType === 'WEIGHT' && (
                        <select
                          value={measurementUnit}
                          onChange={(e) => setMeasurementUnit(e.target.value)}
                          className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:bg-white focus:border-purple-600 outline-none"
                        >
                          {WEIGHT_OPTIONS.map((u) => (
                            <option key={u} value={u}>{u} (Kilogram / Gram)</option>
                          ))}
                        </select>
                      )}
                      {measurementType === 'VOLUME' && (
                        <select
                          value={measurementUnit}
                          onChange={(e) => setMeasurementUnit(e.target.value)}
                          className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:bg-white focus:border-purple-600 outline-none"
                        >
                          {VOLUME_OPTIONS.map((u) => (
                            <option key={u} value={u}>{u} (Liter / Milliliter)</option>
                          ))}
                        </select>
                      )}
                      {measurementType === 'UNIT' && (
                        <select
                          value={measurementUnit}
                          onChange={(e) => setMeasurementUnit(e.target.value)}
                          className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:bg-white focus:border-purple-600 outline-none capitalize"
                        >
                          {UNIT_OPTIONS.map((u) => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Quantity / Value */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Quantity / Value <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        step={measurementType === 'WEIGHT' ? '0.05' : '1'}
                        min="0.01"
                        required
                        value={measurementValue}
                        onChange={(e) => setMeasurementValue(e.target.value)}
                        placeholder="e.g. 1, 500, 2.5"
                        className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-black text-gray-900 focus:bg-white focus:border-purple-600 outline-none font-mono"
                      />
                    </div>

                    {/* Packaging Type */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Packaging Type <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={packagingType}
                        onChange={(e) => setPackagingType(e.target.value as PackagingType)}
                        className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:bg-white focus:border-purple-600 outline-none"
                      >
                        {PACKAGING_OPTIONS.map((p) => (
                          <option key={p} value={p}>
                            {p === 'Loose' ? 'Loose (Sold by Weight / Custom Qty)' : p}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* ── PRODUCT VARIANTS SECTION ── */}
                <div className="bg-white p-6 rounded-3xl border border-gray-200/80 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                          <Box className="w-4 h-4 text-purple-700" />
                          Product Variants
                        </h3>

                        <label className="inline-flex items-center gap-2 text-xs font-bold text-purple-900 bg-purple-50 hover:bg-purple-100 px-3 py-1 rounded-full cursor-pointer transition-colors border border-purple-200">
                          <input
                            type="checkbox"
                            checked={hasVariants}
                            onChange={(e) => setHasVariants(e.target.checked)}
                            className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                          />
                          <span>This product has variants (e.g. 500g, 1kg, 5kg)</span>
                        </label>
                      </div>
                      <p className="text-xs text-gray-500 font-medium mt-1">
                        Configure multiple sellable pack sizes, prices, barcodes and inventory stocks for this canonical item.
                      </p>
                    </div>

                    {hasVariants && (
                      <button
                        type="button"
                        onClick={handleOpenAddVariant}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#3B0764] hover:bg-purple-900 text-white rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer shrink-0 active:scale-95"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Variant</span>
                      </button>
                    )}
                  </div>

                  {hasVariants ? (
                    variants.length > 0 ? (
                      <div className="border border-gray-200/80 rounded-2xl overflow-hidden shadow-2xs">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-gray-600 font-bold border-b border-gray-200 text-[11px] uppercase tracking-wider">
                            <tr>
                              <th className="py-3 px-4">Variant Name</th>
                              <th className="py-3 px-3">Size / Measure</th>
                              <th className="py-3 px-3">Packaging</th>
                              <th className="py-3 px-3 font-mono">Selling Price</th>
                              <th className="py-3 px-3 font-mono">MRP</th>
                              <th className="py-3 px-3 font-mono">Stock</th>
                              <th className="py-3 px-3 font-mono">SKU</th>
                              <th className="py-3 px-3 text-center">Status</th>
                              <th className="py-3 px-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {variants.map((v, idx) => (
                              <tr
                                key={v.id || idx}
                                className={`hover:bg-slate-50/80 transition-colors ${
                                  !v.isActive ? 'opacity-60 bg-gray-50/50' : ''
                                }`}
                              >
                                <td className="py-3 px-4 font-black text-gray-900">
                                  {v.variantName}
                                </td>
                                <td className="py-3 px-3 font-bold text-purple-900 font-mono">
                                  {v.measurementValue ?? v.quantityValue} {v.measurementUnit ?? v.quantityUnit}
                                </td>
                                <td className="py-3 px-3 text-gray-600 font-medium">
                                  {v.packagingType || 'Packet'}
                                </td>
                                <td className="py-3 px-3 font-black text-emerald-800 font-mono">
                                  ₹{v.sellingPrice}
                                </td>
                                <td className="py-3 px-3 text-gray-500 line-through font-mono">
                                  ₹{v.mrp}
                                </td>
                                <td className="py-3 px-3 font-bold font-mono">
                                  <span className={`px-2 py-0.5 rounded-md text-[11px] ${
                                    (v.stockQuantity ?? v.stock ?? 0) > 10
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                      : (v.stockQuantity ?? v.stock ?? 0) > 0
                                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                                  }`}>
                                    {v.stockQuantity ?? v.stock ?? 0}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-gray-500 font-mono text-[11px]">
                                  {v.sku || '-'}
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                    v.isActive
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-gray-200 text-gray-700'
                                  }`}>
                                    {v.isActive ? 'ACTIVE' : 'DISABLED'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditVariant(idx)}
                                      title="Edit Variant"
                                      className="p-1.5 text-purple-700 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDuplicateVariant(idx)}
                                      title="Duplicate Variant"
                                      className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleVariantActive(idx)}
                                      title={v.isActive ? 'Disable Variant' : 'Enable Variant'}
                                      className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                    >
                                      {v.isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteVariant(idx)}
                                      title="Delete Variant"
                                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-8 text-center border-2 border-dashed border-purple-200 rounded-2xl bg-purple-50/20 space-y-3">
                        <Box className="w-8 h-8 mx-auto text-purple-400" />
                        <div>
                          <p className="text-xs font-black text-gray-900">No variants created yet</p>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            Add pack sizes like 500g, 1kg, 5kg with independent pricing and stock.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleOpenAddVariant}
                          className="px-4 py-2 bg-[#3B0764] hover:bg-purple-900 text-white rounded-xl text-xs font-black transition-all cursor-pointer"
                        >
                          + Add First Variant
                        </button>
                      </div>
                    )
                  ) : (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-slate-600 flex items-center justify-between">
                      <span>Single pack configuration active. Enable the checkbox above if this product has multiple sizes or variants.</span>
                    </div>
                  )}
                </div>

                {/* ── PRICING & INVENTORY CARD ── */}
                <div className="bg-white p-6 rounded-3xl border border-gray-200/80 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      Pricing &amp; Inventory
                    </h3>
                    {hasVariants && (
                      <span className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        Managed per variant above (Total Active Stock: {totalVariantStock})
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Selling Price (₹) {hasVariants ? '(Base / Default)' : <span className="text-rose-500">*</span>}
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        required={!hasVariants}
                        value={hasVariants && variants[0] ? variants[0].sellingPrice : sellingPrice}
                        onChange={(e) => setSellingPrice(e.target.value)}
                        disabled={hasVariants}
                        placeholder="120"
                        className={`w-full border rounded-xl px-3.5 py-2.5 text-xs font-black font-mono outline-none ${
                          hasVariants
                            ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                            : 'bg-slate-50 border-gray-200 text-emerald-800 focus:bg-white focus:border-emerald-600'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        MRP (₹) {hasVariants && '(Base / Default)'}
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        value={hasVariants && variants[0] ? variants[0].mrp : mrp}
                        onChange={(e) => setMrp(e.target.value)}
                        disabled={hasVariants}
                        placeholder="140"
                        className={`w-full border rounded-xl px-3.5 py-2.5 text-xs font-bold font-mono outline-none ${
                          hasVariants
                            ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                            : 'bg-slate-50 border-gray-200 text-gray-700 focus:bg-white focus:border-purple-600'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Stock Quantity {hasVariants && '(Aggregated)'}
                      </label>
                      <input
                        type="number"
                        value={hasVariants ? totalVariantStock : stock}
                        onChange={(e) => setStock(e.target.value)}
                        disabled={hasVariants}
                        placeholder="100"
                        className={`w-full border rounded-xl px-3.5 py-2.5 text-xs font-bold font-mono outline-none ${
                          hasVariants
                            ? 'bg-slate-100 text-slate-700 border-slate-200 font-black cursor-not-allowed'
                            : 'bg-slate-50 border-gray-200 text-gray-900 focus:bg-white focus:border-purple-600'
                        }`}
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
                        ref={fileInputRef}
                        multiple
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        disabled={isUploading}
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                      >
                        <UploadCloud className="w-4 h-4" />
                        <span>{isUploading ? uploadProgress || 'Uploading...' : 'Upload Photos (Firebase)'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Add via direct URL */}
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="Paste direct image URL (https://...)"
                      className="flex-1 bg-slate-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-medium text-gray-900 focus:bg-white focus:border-purple-600 outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddImageUrl}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black transition-all cursor-pointer shrink-0"
                    >
                      + Add URL
                    </button>
                  </div>

                  {/* Customer display limit configuration */}
                  <div className="flex items-center gap-4 pt-2 border-t border-gray-100">
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isLimitEnabled}
                        onChange={(e) => setIsLimitEnabled(e.target.checked)}
                        className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                      />
                      <span>Limit photos shown on Customer App Carousel</span>
                    </label>

                    {isLimitEnabled && (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max={images.length}
                          value={customLimit}
                          onChange={(e) => setCustomLimit(parseInt(e.target.value, 10) || 1)}
                          className="w-16 bg-slate-50 border border-gray-200 rounded-xl px-2 py-1 text-xs font-bold font-mono text-center outline-none"
                        />
                        <span className="text-xs text-gray-500">max images displayed</span>
                      </div>
                    )}
                  </div>

                  {/* Images Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4 pt-3">
                    {images.map((url, idx) => {
                      const isPrimary = (thumbnail || images[0]) === url;
                      return (
                        <div
                          key={idx}
                          className={`relative group rounded-2xl border-2 overflow-hidden bg-slate-100 aspect-square flex items-center justify-center p-2 transition-all ${
                            isPrimary
                              ? 'border-purple-600 shadow-md ring-2 ring-purple-600/20'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-contain" />

                          {isPrimary && (
                            <span className="absolute top-2 left-2 bg-purple-700 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-xs">
                              COVER
                            </span>
                          )}

                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleDeleteImage(url)}
                                className="p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors cursor-pointer"
                                title="Delete Photo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="flex items-center justify-between gap-1">
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => handleMoveImage(idx, 'left')}
                                  className="p-1 bg-white/80 hover:bg-white text-gray-800 rounded disabled:opacity-30 cursor-pointer"
                                  title="Move Left"
                                >
                                  <ArrowUp className="w-3 h-3 -rotate-90" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === images.length - 1}
                                  onClick={() => handleMoveImage(idx, 'right')}
                                  className="p-1 bg-white/80 hover:bg-white text-gray-800 rounded disabled:opacity-30 cursor-pointer"
                                  title="Move Right"
                                >
                                  <ArrowDown className="w-3 h-3 -rotate-90" />
                                </button>
                              </div>

                              {!isPrimary && (
                                <button
                                  type="button"
                                  onClick={() => handleSetPrimaryImage(url)}
                                  className="px-2 py-1 bg-white hover:bg-purple-50 text-purple-900 text-[10px] font-black rounded transition-colors cursor-pointer"
                                >
                                  Set Cover
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 3: DYNAMIC SPECIFICATION SECTIONS ── */}
            {activeTab === 'sections' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Left: Sections List */}
                <div className="bg-white p-5 rounded-3xl border border-gray-200/80 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-purple-700" />
                      Accordion Sections
                    </h3>
                    <button
                      type="button"
                      onClick={handleAddCustomSection}
                      className="text-xs font-black text-purple-700 hover:text-purple-900 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Section</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {sections.map((sec, idx) => {
                      const isSelected = sec.id === activeSectionId;
                      return (
                        <div
                          key={sec.id}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'bg-purple-50/80 border-purple-600 shadow-2xs font-bold text-purple-950'
                              : 'bg-white border-gray-200 hover:border-gray-300 text-gray-700'
                          }`}
                          onClick={() => setActiveSectionId(sec.id)}
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span className="text-[10px] font-mono text-gray-400 font-bold">#{idx + 1}</span>
                            <span className="text-xs font-bold truncate">{sec.title}</span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleToggleSectionVisibility(sec.id)}
                              className={`p-1 rounded ${sec.isVisible ? 'text-purple-700 hover:bg-purple-100' : 'text-gray-400 hover:bg-gray-100'}`}
                              title={sec.isVisible ? 'Visible to Customer' : 'Hidden'}
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
                              className="p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right: Section Attributes Editor */}
                <div className="md:col-span-2 bg-white p-6 rounded-3xl border border-gray-200/80 shadow-xs space-y-4">
                  {currentActiveSection ? (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                        <div className="flex-1">
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                            Section Title
                          </label>
                          <input
                            type="text"
                            value={currentActiveSection.title}
                            onChange={(e) => handleUpdateSectionTitle(currentActiveSection.id, e.target.value)}
                            className="text-sm font-black text-gray-900 bg-slate-50 border border-gray-200 rounded-xl px-3 py-1.5 focus:bg-white focus:border-purple-600 outline-none w-full"
                          />
                        </div>

                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={currentActiveSection.defaultExpanded}
                              onChange={() => handleToggleSectionDefaultExpanded(currentActiveSection.id)}
                              className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                            />
                            <span>Expanded by default</span>
                          </label>

                          <button
                            type="button"
                            onClick={() => handleAddAttribute(currentActiveSection.id)}
                            className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Field</span>
                          </button>
                        </div>
                      </div>

                      {/* Attribute rows */}
                      <div className="space-y-3">
                        {(currentActiveSection.attributes || []).map((attr, aIdx) => (
                          <div
                            key={attr.id}
                            className="p-3 bg-slate-50 rounded-2xl border border-gray-200/70 flex flex-col sm:flex-row items-center gap-3"
                          >
                            <div className="w-full sm:w-1/3">
                              <label className="block text-[10px] font-bold text-gray-500 mb-0.5">Field Name</label>
                              <input
                                type="text"
                                value={attr.label}
                                onChange={(e) =>
                                  handleUpdateAttribute(currentActiveSection.id, attr.id, { label: e.target.value })
                                }
                                placeholder="e.g. Shelf Life"
                                className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-gray-800 outline-none"
                              />
                            </div>

                            <div className="w-full sm:w-1/2">
                              <label className="block text-[10px] font-bold text-gray-500 mb-0.5">Value</label>
                              <input
                                type="text"
                                value={attr.value}
                                onChange={(e) =>
                                  handleUpdateAttribute(currentActiveSection.id, attr.id, { value: e.target.value })
                                }
                                placeholder="e.g. 6 Months"
                                className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-900 outline-none"
                              />
                            </div>

                            <div className="w-full sm:w-20">
                              <label className="block text-[10px] font-bold text-gray-500 mb-0.5">Unit (opt)</label>
                              <input
                                type="text"
                                value={attr.unit || ''}
                                onChange={(e) =>
                                  handleUpdateAttribute(currentActiveSection.id, attr.id, { unit: e.target.value })
                                }
                                placeholder="e.g. mg, %"
                                className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-gray-700 outline-none"
                              />
                            </div>

                            <div className="flex items-center gap-1 sm:pt-4">
                              <button
                                type="button"
                                onClick={() => handleToggleAttributeVisibility(currentActiveSection.id, attr.id)}
                                className={`p-1.5 rounded-lg ${
                                  attr.isVisible ? 'text-purple-700 hover:bg-purple-100' : 'text-gray-400 hover:bg-gray-200'
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
                                disabled={aIdx === (currentActiveSection.attributes?.length || 0) - 1}
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

            {/* ── TAB 4: CUSTOMER APP LIVE PREVIEW ── */}
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

                  {/* Product Details & Variant Switcher */}
                  <div className="p-4 space-y-3">
                    <div>
                      <h4 className="text-sm font-black text-white">{name || 'Product Title'}</h4>
                      <span className="text-xs text-slate-400 font-mono">
                        {activePreviewVariant ? activePreviewVariant.variantName : baseCustomerDisplay}
                      </span>
                    </div>

                    {/* Pricing */}
                    <div className="flex items-baseline gap-2">
                      <strong className="text-xl font-black text-white font-mono">
                        ₹{activePreviewVariant ? activePreviewVariant.sellingPrice : sellingPrice || '0'}
                      </strong>
                      {parseFloat(activePreviewVariant ? String(activePreviewVariant.mrp) : mrp) > parseFloat(activePreviewVariant ? String(activePreviewVariant.sellingPrice) : sellingPrice) && (
                        <span className="text-xs font-bold text-slate-500 line-through font-mono">
                          MRP ₹{activePreviewVariant ? activePreviewVariant.mrp : mrp}
                        </span>
                      )}
                    </div>

                    {/* Live Variant Selector Pills in Preview */}
                    {hasVariants && variants.length > 0 && (
                      <div className="pt-2 border-t border-slate-800 space-y-1.5">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                          Select Size / Weight
                        </span>
                        <div className="grid grid-cols-3 gap-1.5">
                          {variants.map((v) => {
                            const isSelected = (activePreviewVariant?.id || variants[0]?.id) === v.id;
                            return (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() => setPreviewSelectedVariantId(v.id)}
                                className={`p-2 rounded-xl text-center border text-xs font-bold transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500'
                                    : 'bg-[#24242C] border-slate-700 text-slate-300 hover:border-slate-500'
                                }`}
                              >
                                <span className="block text-[11px] font-black truncate">{v.variantName}</span>
                                <span className="block text-[10px] text-slate-400 font-mono">₹{v.sellingPrice}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Dynamic Accordions Preview */}
                    <div className="space-y-2 pt-2 border-t border-slate-800">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
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

      {/* ── VARIANT EDITOR MODAL / DRAWER ── */}
      {isVariantModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 bg-purple-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Box className="w-5 h-5 text-purple-700" />
                <h4 className="text-sm font-black text-gray-900">
                  {editingVariantIndex !== null ? 'Edit Product Variant' : 'Add New Product Variant'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsVariantModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-gray-200/80 text-gray-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
              {/* Variant Name & Auto-gen button */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-gray-700">Variant Display Name</label>
                  <button
                    type="button"
                    onClick={() => {
                      const num = parseFloat(vMeasurementValue) || 1;
                      setVName(formatCustomerDisplay(vMeasurementType, num, vMeasurementUnit, vPackagingType));
                    }}
                    className="text-[11px] font-bold text-purple-700 hover:underline"
                  >
                    Auto-Generate
                  </button>
                </div>
                <input
                  type="text"
                  value={vName}
                  onChange={(e) => setVName(e.target.value)}
                  placeholder="e.g. 500 g, 1 kg, 5 kg"
                  className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-black text-gray-900 outline-none focus:bg-white focus:border-purple-600"
                />
              </div>

              {/* Measurement Structure for Variant */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-purple-50/40 rounded-2xl border border-purple-100">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Measurement Type</label>
                  <select
                    value={vMeasurementType}
                    onChange={(e) => handleVMeasurementTypeChange(e.target.value as MeasurementType)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-900 outline-none"
                  >
                    <option value="WEIGHT">WEIGHT (KG, G)</option>
                    <option value="VOLUME">VOLUME (LTR, ML)</option>
                    <option value="UNIT">UNIT (packet, piece, etc)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Unit</label>
                  {vMeasurementType === 'WEIGHT' && (
                    <select
                      value={vMeasurementUnit}
                      onChange={(e) => setVMeasurementUnit(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-900 outline-none"
                    >
                      {WEIGHT_OPTIONS.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  )}
                  {vMeasurementType === 'VOLUME' && (
                    <select
                      value={vMeasurementUnit}
                      onChange={(e) => setVMeasurementUnit(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-900 outline-none"
                    >
                      {VOLUME_OPTIONS.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  )}
                  {vMeasurementType === 'UNIT' && (
                    <select
                      value={vMeasurementUnit}
                      onChange={(e) => setVMeasurementUnit(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-900 outline-none capitalize"
                    >
                      {UNIT_OPTIONS.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Quantity Value</label>
                  <input
                    type="number"
                    step={vMeasurementType === 'WEIGHT' ? '0.05' : '1'}
                    min="0.01"
                    value={vMeasurementValue}
                    onChange={(e) => setVMeasurementValue(e.target.value)}
                    placeholder="e.g. 500, 1, 5"
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-black text-gray-900 font-mono outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Packaging</label>
                  <select
                    value={vPackagingType}
                    onChange={(e) => setVPackagingType(e.target.value as PackagingType)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-900 outline-none"
                  >
                    {PACKAGING_OPTIONS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pricing & Stock for Variant */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Selling Price (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={vSellingPrice}
                    onChange={(e) => setVSellingPrice(e.target.value)}
                    placeholder="120"
                    className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-black text-emerald-800 font-mono outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">MRP (₹)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={vMrp}
                    onChange={(e) => setVMrp(e.target.value)}
                    placeholder="140"
                    className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 font-mono outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Stock <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={vStock}
                    onChange={(e) => setVStock(e.target.value)}
                    placeholder="25"
                    className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-black text-gray-900 font-mono outline-none"
                  />
                </div>
              </div>

              {/* SKU & Barcode */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Variant SKU</label>
                  <input
                    type="text"
                    value={vSku}
                    onChange={(e) => setVSku(e.target.value)}
                    placeholder="e.g. ATTA-5KG"
                    className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 font-mono outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Variant Barcode / EAN</label>
                  <input
                    type="text"
                    value={vBarcode}
                    onChange={(e) => setVBarcode(e.target.value)}
                    placeholder="e.g. 8901030384738"
                    className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 font-mono outline-none"
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <div className="pt-2">
                <label className="flex items-center gap-2 text-xs font-bold text-gray-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={vIsActive}
                    onChange={(e) => setVIsActive(e.target.checked)}
                    className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                  />
                  <span>Variant is active &amp; available for sale</span>
                </label>
              </div>
            </div>

            <div className="px-6 py-3.5 border-t border-gray-100 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsVariantModalOpen(false)}
                className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveVariant}
                className="px-5 py-2 bg-[#3B0764] hover:bg-purple-900 text-white rounded-xl text-xs font-black shadow-md"
              >
                {editingVariantIndex !== null ? 'Save Changes' : 'Add Variant'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
