'use client';

import React, { useState, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { Product, Category, Brand, ProductSection } from '@/types';
import { showToast } from '@/components/ui/Toast';
import {
  FileSpreadsheet,
  UploadCloud,
  Download,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  Trash2,
  Search,
  Sparkles,
  RefreshCw,
  Layers,
  ArrowRight,
  Eye,
  ChevronDown,
  ChevronUp,
  Tag,
  Scale,
  FileText,
  Info,
  Check,
  Edit3,
} from 'lucide-react';
import {
  generateProductExcelTemplate,
  exportProductsToExcel,
  parseProductExcelFile,
  mergeProductSections,
  ParsedProductRow,
  ExcelValidationError,
  ExcelValidationWarning,
} from '@/lib/productExcelUtils';
import { formatCustomerDisplay } from '@/lib/measurementUtils';

interface ProductExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProductExcelImportModal: React.FC<ProductExcelImportModalProps> = ({ isOpen, onClose }) => {
  const { products, categories, brands, addProduct, updateProduct } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ParsedProductRow[]>([]);
  const [errors, setErrors] = useState<ExcelValidationError[]>([]);
  const [warnings, setWarnings] = useState<ExcelValidationWarning[]>([]);
  const [totalSpecsCount, setTotalSpecsCount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'preview' | 'table' | 'errors' | 'warnings'>('preview');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [replaceExistingSpecs, setReplaceExistingSpecs] = useState<boolean>(false);
  const [expandedPreviewRows, setExpandedPreviewRows] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;

  // 1. Download official Excel template
  const handleDownloadTemplate = () => {
    try {
      const bytes = generateProductExcelTemplate(categories, brands);
      const blob = new Blob([bytes as any], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'PocketKirana_Product_Import_Template.xlsx');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Downloaded PocketKirana_Product_Import_Template.xlsx', 'success');
    } catch (err: any) {
      showToast(`Download failed: ${err.message}`, 'error');
    }
  };

  // 2. Export current catalog to Excel
  const handleExportCatalog = () => {
    try {
      const bytes = exportProductsToExcel(products, categories, brands);
      const blob = new Blob([bytes as any], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `PocketKirana_Catalog_Export_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(`Exported ${products.length} products to Excel!`, 'success');
    } catch (err: any) {
      showToast(`Export failed: ${err.message}`, 'error');
    }
  };

  // 3. Process File Upload
  const processUploadedFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const buffer = evt.target?.result as ArrayBuffer;
      if (buffer) {
        const result = parseProductExcelFile(buffer, products, categories, brands);
        setParsedRows(result.parsedProducts);
        setErrors(result.errors);
        setWarnings(result.warnings);
        setTotalSpecsCount(result.totalSpecificationsCount);

        if (result.errors.length > 0) {
          setActiveTab('errors');
          showToast(`Found ${result.errors.length} validation errors. Review before importing.`, 'error');
        } else {
          setActiveTab('preview');
          showToast(
            `Parsed ${result.parsedProducts.length} products (${result.updateProductsCount} updates, ${result.newProductsCount} new) & ${result.totalSpecificationsCount} specifications!`,
            'success'
          );
        }
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processUploadedFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };

  // 4. Confirm & Execute Import
  const handleConfirmImport = async () => {
    if (errors.length > 0) {
      showToast('Cannot import with active errors. Please fix errors first.', 'error');
      return;
    }
    if (parsedRows.length === 0) {
      showToast('No products to import.', 'error');
      return;
    }

    setIsImporting(true);
    let updatedCount = 0;
    let createdCount = 0;

    try {
      for (const row of parsedRows) {
        const syntheticUnit = formatCustomerDisplay(
          row.measurementType,
          row.measurementValue,
          row.measurementUnit,
          row.packagingType,
          { showPackaging: true }
        );

        if (row.isUpdate && row.existingProduct) {
          // Merge or replace specifications
          const finalSections = mergeProductSections(
            row.existingProduct.sections,
            row.sections,
            replaceExistingSpecs
          );

          const updates: Partial<Product> = {
            name: row.name,
            categoryId: row.categoryId,
            brandId: row.brandId || '',
            brandName: row.brandName || '',
            sellingPrice: row.sellingPrice,
            mrp: row.mrp,
            price: row.sellingPrice,
            unit: syntheticUnit,
            measurementType: row.measurementType,
            measurementUnit: row.measurementUnit,
            measurementValue: row.measurementValue,
            packagingType: row.packagingType,
            stock: row.stock,
            status: row.status,
            publishStatus: row.publishStatus,
            description: row.description,
            thumbnail: row.thumbnail,
            image: row.thumbnail,
            images: row.images,
            sku: row.sku,
            sections: finalSections,
          };

          updateProduct(row.existingProduct.id, updates);
          updatedCount++;
        } else {
          // New Product Creation
          const newProduct: any = {
            id: row.productId || `prod-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: row.name,
            slug: row.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            categoryId: row.categoryId,
            brandId: row.brandId || '',
            brandName: row.brandName || '',
            sellingPrice: row.sellingPrice,
            mrp: row.mrp,
            price: row.sellingPrice,
            unit: syntheticUnit,
            measurementType: row.measurementType,
            measurementUnit: row.measurementUnit,
            measurementValue: row.measurementValue,
            packagingType: row.packagingType,
            stock: row.stock,
            status: row.status,
            publishStatus: row.publishStatus,
            description: row.description,
            thumbnail: row.thumbnail,
            image: row.thumbnail,
            images: row.images,
            sku: row.sku,
            sections: row.sections,
            rating: 4.8,
            reviewsCount: 12,
            isPopular: true,
            isFeatured: true,
          };

          addProduct(newProduct);
          createdCount++;
        }
      }

      setIsImporting(false);
      showToast(
        `🎉 Successfully imported! (${createdCount} created, ${updatedCount} updated). Catalog updated live.`,
        'success'
      );
      onClose();
    } catch (err: any) {
      setIsImporting(false);
      showToast(`Import error: ${err.message || err}`, 'error');
    }
  };

  const filteredRows = parsedRows.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.categoryName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.sku && r.sku.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const updatesCount = parsedRows.filter((r) => r.isUpdate).length;
  const newCount = parsedRows.length - updatesCount;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-6xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* ── HEADER ── */}
        <div className="bg-[#3B0764] text-white px-6 py-4 flex items-center justify-between border-b border-purple-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 text-emerald-300 border border-white/20 flex items-center justify-center font-bold shadow-inner">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                Bulk Product Excel Import &amp; Specifications Sync
              </h2>
              <p className="text-xs text-purple-200 font-medium">
                Admin-editable product details, photos gallery, and dynamic accordion specifications
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-purple-200 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── ACTION BAR: TEMPLATES & EXPORT ── */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Sparkles className="w-4 h-4 text-purple-700" />
            <span>Ready-to-use template with Products, Specifications &amp; Instructions:</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCatalog}
              className="bg-white hover:bg-slate-100 text-slate-800 text-xs font-black px-3.5 py-1.5 rounded-xl border border-slate-300 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Export Catalog (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-black px-4 py-1.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Excel Template (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* ── BODY CONTENT ── */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/40">
          
          {parsedRows.length === 0 ? (
            /* UPLOAD DROPZONE */
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all ${
                dragActive
                  ? 'border-purple-600 bg-purple-50/50 scale-[0.99]'
                  : 'border-slate-300 hover:border-purple-500 bg-white hover:bg-purple-50/20'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="w-16 h-16 rounded-2xl bg-purple-50 text-purple-700 border border-purple-200 shadow-sm flex items-center justify-center mx-auto mb-4">
                <UploadCloud className="w-8 h-8" />
              </div>

              <h3 className="text-base font-black text-slate-900">
                Click to upload or drag &amp; drop your Product Excel file
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Supports <strong className="text-purple-900">.xlsx</strong> and <strong className="text-purple-900">.csv</strong> workbooks with <strong>Products</strong> &amp; <strong>Specifications</strong> sheets.
              </p>

              <div className="mt-5 inline-flex items-center gap-2 text-xs font-black bg-[#3B0764] hover:bg-purple-900 text-white px-5 py-2.5 rounded-xl shadow-sm transition-transform active:scale-95">
                <FileSpreadsheet className="w-4 h-4" />
                <span>Browse Local Excel File</span>
              </div>
            </div>
          ) : (
            /* PARSED SUMMARY & TABS */
            <div className="space-y-4">
              
              {/* Stats & Controls Bar */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="font-bold text-slate-900">
                    File: <span className="font-black text-purple-950">{fileName}</span>
                  </div>
                  <span className="text-slate-300">|</span>
                  <div className="flex items-center gap-1 font-bold text-slate-800">
                    <span>{parsedRows.length} Products</span>
                  </div>
                  <span className="text-slate-300">|</span>
                  <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold text-[11px]">
                    +{newCount} New
                  </span>
                  <span className="bg-purple-50 text-purple-800 border border-purple-200 px-2.5 py-0.5 rounded-full font-bold text-[11px]">
                    ↺ {updatesCount} Updates
                  </span>
                  <span className="bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-0.5 rounded-full font-bold text-[11px]">
                    📑 {totalSpecsCount} Specs
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setParsedRows([]);
                      setErrors([]);
                      setWarnings([]);
                      setFileName('');
                    }}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Upload Different File</span>
                  </button>
                </div>
              </div>

              {/* Options: Replace Specs Checkbox */}
              <div className="bg-purple-50/60 border border-purple-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={replaceExistingSpecs}
                    onChange={(e) => setReplaceExistingSpecs(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-black text-purple-950 block">
                      Replace existing specifications
                    </span>
                    <span className="text-[11px] text-purple-800 font-medium">
                      When enabled, product specifications are completely replaced with the Excel sheet contents. When disabled (default), specifications are merged seamlessly.
                    </span>
                  </div>
                </label>
              </div>

              {/* Review Tabs */}
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    activeTab === 'preview'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Preview Changes &amp; Specs ({parsedRows.length})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('table')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    activeTab === 'table'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Raw Scanned Table
                </button>

                {errors.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('errors')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'errors'
                        ? 'bg-rose-600 text-white'
                        : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Errors ({errors.length})</span>
                  </button>
                )}

                {warnings.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('warnings')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'warnings'
                        ? 'bg-amber-600 text-white'
                        : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Warnings ({warnings.length})</span>
                  </button>
                )}
              </div>

              {/* ── TAB 1: PREVIEW CHANGES & ACCORDIONS ── */}
              {activeTab === 'preview' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredRows.map((row) => {
                      const isExpanded = expandedPreviewRows[row.name] ?? true;
                      return (
                        <div
                          key={row.rowNumber}
                          className={`bg-white rounded-2xl border p-4 shadow-2xs space-y-3 transition-all ${
                            row.isUpdate ? 'border-purple-200 hover:border-purple-300' : 'border-emerald-200 hover:border-emerald-300'
                          }`}
                        >
                          {/* Row Header */}
                          <div className="flex items-start gap-3">
                            <img
                              src={row.thumbnail}
                              alt={row.name}
                              className="w-12 h-12 rounded-xl object-contain border border-slate-200 p-1 bg-white shrink-0"
                            />

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                    row.isUpdate
                                      ? 'bg-purple-100 text-purple-900'
                                      : 'bg-emerald-100 text-emerald-900'
                                  }`}
                                >
                                  {row.isUpdate ? 'UPDATE' : 'NEW PRODUCT'}
                                </span>
                                {row.productId && (
                                  <span className="text-[10px] font-mono text-slate-400 font-bold">
                                    {row.productId}
                                  </span>
                                )}
                              </div>
                              <h4 className="text-sm font-black text-slate-900 truncate mt-0.5">
                                {row.name}
                              </h4>
                              <p className="text-xs text-slate-500 font-medium">
                                {row.categoryName} • <span className="font-mono text-purple-700 font-bold">{row.measurementValue} {row.measurementUnit} ({row.packagingType})</span>
                              </p>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="text-base font-black text-slate-900 font-mono block">
                                ₹{row.sellingPrice}
                              </span>
                              {row.mrp > row.sellingPrice && (
                                <span className="text-xs text-slate-400 line-through font-mono">
                                  MRP ₹{row.mrp}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Diffs for Updated Products */}
                          {row.isUpdate && row.changesSummary.length > 0 && (
                            <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/80 text-[11px] space-y-1">
                              <span className="font-bold text-slate-600 block uppercase text-[9px]">
                                Modified Values:
                              </span>
                              {row.changesSummary.map((diff, dIdx) => (
                                <div key={dIdx} className="flex items-center justify-between">
                                  <span className="text-slate-500 font-medium">{diff.field}:</span>
                                  <span className="font-bold">
                                    <span className="text-rose-600 line-through mr-1">{diff.oldValue}</span>
                                    <span className="text-emerald-700 font-bold">→ {diff.newValue}</span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Attached Dynamic Specifications Accordion Summary */}
                          <div className="border-t border-slate-100 pt-2 space-y-2">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedPreviewRows((prev) => ({
                                  ...prev,
                                  [row.name]: !isExpanded,
                                }))
                              }
                              className="w-full flex items-center justify-between text-xs font-bold text-slate-700 hover:text-purple-900 cursor-pointer"
                            >
                              <span className="flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-purple-700" />
                                <span>
                                  {row.sections.length} Accordion Sections ({row.sections.reduce((acc, s) => acc + (s.attributes?.length || 0), 0)} fields)
                                </span>
                              </span>
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>

                            {isExpanded && (
                              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                                {row.sections.map((sec) => (
                                  <div
                                    key={sec.id}
                                    className="bg-slate-50 rounded-lg p-2 border border-slate-200/60 text-[11px]"
                                  >
                                    <div className="flex items-center justify-between font-bold text-slate-800 mb-1">
                                      <span>{sec.title}</span>
                                      <span className="text-[10px] text-slate-400 font-mono">
                                        {sec.attributes?.length || 0} fields
                                      </span>
                                    </div>
                                    <div className="space-y-0.5">
                                      {(sec.attributes || []).map((attr) => (
                                        <div
                                          key={attr.id}
                                          className="flex items-center justify-between text-[10px] text-slate-600"
                                        >
                                          <span>{attr.label}</span>
                                          <span className="font-bold text-slate-900 font-mono">
                                            {attr.value} {attr.unit || ''}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── TAB 2: RAW TABLE ── */}
              {activeTab === 'table' && (
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                  <div className="overflow-x-auto max-h-[400px]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-900 text-white font-bold sticky top-0 z-10 text-[11px] uppercase tracking-wider">
                        <tr>
                          <th className="p-3">Type</th>
                          <th className="p-3">Product Name</th>
                          <th className="p-3">Category</th>
                          <th className="p-3">Measurement</th>
                          <th className="p-3">Price</th>
                          <th className="p-3">MRP</th>
                          <th className="p-3">Stock</th>
                          <th className="p-3">SKU</th>
                          <th className="p-3">Sections</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {filteredRows.map((row) => (
                          <tr key={row.rowNumber} className="hover:bg-slate-50">
                            <td className="p-3">
                              <span
                                className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                  row.isUpdate
                                    ? 'bg-purple-100 text-purple-900'
                                    : 'bg-emerald-100 text-emerald-900'
                                }`}
                              >
                                {row.isUpdate ? 'UPDATE' : 'CREATE'}
                              </span>
                            </td>
                            <td className="p-3 font-bold text-slate-900">{row.name}</td>
                            <td className="p-3 text-slate-600">{row.categoryName}</td>
                            <td className="p-3 font-mono text-purple-900 font-bold">
                              {row.measurementValue} {row.measurementUnit}
                            </td>
                            <td className="p-3 font-black text-slate-900 font-mono">₹{row.sellingPrice}</td>
                            <td className="p-3 text-slate-400 line-through font-mono">₹{row.mrp}</td>
                            <td className="p-3 font-mono">{row.stock}</td>
                            <td className="p-3 font-mono text-slate-500">{row.sku}</td>
                            <td className="p-3 font-bold text-purple-700">{row.sections.length} Sections</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── TAB 3: ERRORS ── */}
              {activeTab === 'errors' && (
                <div className="space-y-3">
                  {errors.map((err, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-xs"
                    >
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-black text-rose-950 block">
                          Sheet: {err.sheet} • Row {err.rowNumber}
                        </span>
                        <p className="text-rose-800 font-medium mt-0.5">{err.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── TAB 4: WARNINGS ── */}
              {activeTab === 'warnings' && (
                <div className="space-y-3">
                  {warnings.map((warn, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-xs"
                    >
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-black text-amber-950 block">
                          Sheet: {warn.sheet} • Row {warn.rowNumber}
                        </span>
                        <p className="text-amber-800 font-medium mt-0.5">{warn.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── FOOTER CONTROLS ── */}
        <div className="bg-slate-100 border-t border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-600">
            {parsedRows.length > 0 ? (
              <span>
                Ready to import <strong className="text-slate-900">{parsedRows.length} products</strong> ({newCount} new, {updatesCount} updates) to catalog.
              </span>
            ) : (
              <span>Download template or upload your product Excel file above.</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="bg-white hover:bg-slate-200 text-slate-800 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-300 transition-all cursor-pointer"
            >
              Cancel
            </button>

            {parsedRows.length > 0 && (
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isImporting || errors.length > 0}
                className="bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-50 text-white font-black text-xs px-6 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Importing Catalog...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm &amp; Import {parsedRows.length} Products</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
