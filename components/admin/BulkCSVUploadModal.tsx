'use client';

import React, { useState, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { Product, Category } from '@/types';
import { showToast } from '@/components/ui/Toast';
import {
  FileSpreadsheet,
  UploadCloud,
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  Trash2,
  Edit2,
  Search,
  Sparkles,
  RefreshCw,
  Layers,
  ArrowRight
} from 'lucide-react';

interface BulkCSVUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ParsedCSVRow {
  tempId: string;
  name: string;
  categoryId: string;
  categoryName: string;
  sellingPrice: number;
  mrp: number;
  unit: string;
  weight: number;
  description: string;
  thumbnail: string;
  sku: string;
  status: 'active' | 'out_of_stock' | 'discontinued';
  isValid: boolean;
  errorReason?: string;
}

export const BulkCSVUploadModal: React.FC<BulkCSVUploadModalProps> = ({ isOpen, onClose }) => {
  const { categories, addProductsBatch, addCategory } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ParsedCSVRow[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);

  if (!isOpen) return null;

  // Generate and Download Sample CSV
  const handleDownloadSampleCSV = () => {
    const csvContent =
      `Name,Category,Selling Price,MRP,Unit,Weight(g),Description,Image URL,SKU\n` +
      `"Fortune Sunflower Refined Oil 1L","Oils & Ghee",145,175,"1 L",900,"100% pure refined sunflower oil rich in vitamins.","https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=400&q=80","SKU-OIL-101"\n` +
      `"Aashirvaad Shuddh Chakki Atta 5kg","Atta & Rice",235,275,"5 kg",5000,"High quality whole wheat flour for soft and fluffy rotis.","https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=400&q=80","SKU-ATTA-202"\n` +
      `"Amul Taaza Toned Milk 1L","Dairy & Eggs",68,72,"1 L",1000,"Fresh pasteurized toned milk full of cream.","https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=400&q=80","SKU-MILK-303"\n` +
      `"Lays India's Magic Masala Chips","Snacks & Drinks",20,20,"50g",50,"Crispy potato chips coated in spicy Indian spices.","https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=400&q=80","SKU-SNK-404"`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'sample_pocketkirana_products.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Downloaded sample_pocketkirana_products.csv template!', 'info');
  };

  // Helper to resolve or auto-match Category ID by name
  const resolveCategoryId = (categoryInput: string): { id: string; name: string } => {
    if (!categoryInput) {
      const fallback = categories[0] || { id: 'cat-dairy', name: 'Dairy & Eggs' };
      return { id: fallback.id, name: fallback.name };
    }

    const trimmed = categoryInput.trim().toLowerCase();
    const existing = categories.find(
      (c) => c.name.toLowerCase() === trimmed || c.slug.toLowerCase() === trimmed || c.id.toLowerCase() === trimmed
    );

    if (existing) {
      return { id: existing.id, name: existing.name };
    }

    // Auto match by fuzzy keyword
    if (trimmed.includes('atta') || trimmed.includes('flour') || trimmed.includes('rice')) {
      return { id: 'cat-atta', name: 'Atta & Rice' };
    }
    if (trimmed.includes('oil') || trimmed.includes('ghee')) {
      return { id: 'cat-oil', name: 'Oils & Ghee' };
    }
    if (trimmed.includes('milk') || trimmed.includes('dairy') || trimmed.includes('egg')) {
      return { id: 'cat-dairy', name: 'Dairy & Eggs' };
    }
    if (trimmed.includes('snack') || trimmed.includes('drink') || trimmed.includes('chip')) {
      return { id: 'cat-snacks', name: 'Snacks & Drinks' };
    }

    const firstCat = categories[0] || { id: 'cat-dairy', name: 'Dairy & Eggs' };
    return { id: firstCat.id, name: firstCat.name };
  };

  // Robust CSV Line Parser
  const parseCSVText = (text: string): ParsedCSVRow[] => {
    const lines = text.split(/\r\n|\n/).filter((line) => line.trim().length > 0);
    if (lines.length <= 1) return [];

    // Header row skip
    const dataRows = lines.slice(1);
    const parsed: ParsedCSVRow[] = [];

    dataRows.forEach((rowStr, index) => {
      // RegEx to split CSV values handling quotes
      const regex = /(?:^|,)(?:"([^"]*)"|([^,]*))/g;
      const matches: string[] = [];
      let match;
      while ((match = regex.exec(rowStr)) !== null) {
        let val = match[1] !== undefined ? match[1] : match[2];
        matches.push(val.trim());
      }

      // Cleanup leading empty split if any
      const columns = matches.slice(0, 10);
      const rawName = columns[0] || '';
      const rawCategory = columns[1] || '';
      const rawPrice = columns[2] || '';
      const rawMrp = columns[3] || '';
      const rawUnit = columns[4] || '1 unit';
      const rawWeight = columns[5] || '0';
      const rawDesc = columns[6] || '';
      const rawImage = columns[7] || '';
      const rawSku = columns[8] || '';

      const sellingPrice = parseFloat(rawPrice.replace(/[^0-9.]/g, '')) || 0;
      const mrp = parseFloat(rawMrp.replace(/[^0-9.]/g, '')) || sellingPrice;
      const weight = parseFloat(rawWeight.replace(/[^0-9.]/g, '')) || 500;

      const catInfo = resolveCategoryId(rawCategory);

      let isValid = true;
      let errorReason = '';

      if (!rawName) {
        isValid = false;
        errorReason = 'Missing Product Name';
      } else if (sellingPrice <= 0) {
        isValid = false;
        errorReason = 'Price must be greater than ₹0';
      }

      parsed.push({
        tempId: `row-${Date.now()}-${index}`,
        name: rawName || `Unnamed Product ${index + 1}`,
        categoryId: catInfo.id,
        categoryName: catInfo.name,
        sellingPrice,
        mrp: mrp < sellingPrice ? sellingPrice : mrp,
        unit: rawUnit || '1 pack',
        weight,
        description: rawDesc || `${rawName} premium grocery item from PocketKirana.`,
        thumbnail:
          rawImage && rawImage.startsWith('http')
            ? rawImage
            : 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80',
        sku: rawSku || `SKU-AUTO-${Math.floor(1000 + Math.random() * 9000)}`,
        status: 'active',
        isValid,
        errorReason
      });
    });

    return parsed;
  };

  // Process Selected File
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text) {
        const rows = parseCSVText(text);
        setParsedRows(rows);
        showToast(`Scanned ${rows.length} product entries from ${file.name}`, 'success');
      }
    };
    reader.readAsText(file);
  };

  // Drag & Drop handlers
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
    if (file && file.name.endsWith('.csv')) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        if (text) {
          const rows = parseCSVText(text);
          setParsedRows(rows);
          showToast(`Scanned ${rows.length} product entries from ${file.name}`, 'success');
        }
      };
      reader.readAsText(file);
    } else {
      showToast('Please upload a valid .csv file', 'error');
    }
  };

  // Inline edit row handler
  const handleRowEdit = (tempId: string, field: keyof ParsedCSVRow, value: any) => {
    setParsedRows((prev) =>
      prev.map((row) => {
        if (row.tempId !== tempId) return row;
        const updated = { ...row, [field]: value };
        if (field === 'categoryId') {
          const cat = categories.find((c) => c.id === value);
          if (cat) updated.categoryName = cat.name;
        }
        // Re-validate
        updated.isValid = Boolean(updated.name && updated.sellingPrice > 0);
        if (updated.isValid) updated.errorReason = undefined;
        return updated;
      })
    );
  };

  // Remove row from parsed list
  const handleRemoveRow = (tempId: string) => {
    setParsedRows((prev) => prev.filter((r) => r.tempId !== tempId));
  };

  // Publish Scanned Items
  const handlePublishAll = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      showToast('No valid products to publish. Please check missing fields.', 'error');
      return;
    }

    setIsPublishing(true);
    try {
      const productsToBatch: Omit<Product, 'id'>[] = validRows.map((r) => ({
        categoryId: r.categoryId,
        storeId: 'store-1',
        sku: r.sku,
        barcode: `890${Math.floor(100000000 + Math.random() * 900000000)}`,
        name: r.name,
        slug: r.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        description: r.description,
        unit: r.unit,
        weight: r.weight,
        mrp: r.mrp,
        sellingPrice: r.sellingPrice,
        taxPercentage: 5,
        thumbnail: r.thumbnail,
        status: r.status,
        rating: 4.8,
        reviewsCount: Math.floor(Math.random() * 40) + 10,
        isPopular: true,
        isFeatured: true
      }));

      const count = await addProductsBatch(productsToBatch);
      setIsPublishing(false);
      showToast(`🎉 Successfully published ${count} products to website & Firestore!`, 'success');
      onClose();
    } catch (err: any) {
      setIsPublishing(false);
      showToast(`Publish failed: ${err?.message || err}`, 'error');
    }
  };

  const filteredRows = parsedRows.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.categoryName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.length - validCount;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                Bulk CSV Product Import & Scanner
              </h2>
              <p className="text-xs text-slate-400">
                Upload CSV inventory files, review scanned items, and publish live to Firestore & website catalog.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Header & Sample CSV Downloader */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>Need formatted template? Download sample CSV structure:</span>
          </div>

          <button
            onClick={handleDownloadSampleCSV}
            className="bg-white hover:bg-slate-100 text-slate-900 text-xs font-black px-3.5 py-1.5 rounded-xl border border-slate-300 shadow-2xs transition-all flex items-center gap-2"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Download Sample CSV</span>
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* File Upload Zone */}
          {parsedRows.length === 0 ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-10 text-center cursor-pointer transition-all ${
                dragActive
                  ? 'border-emerald-500 bg-emerald-50/50'
                  : 'border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="w-16 h-16 rounded-2xl bg-white text-emerald-600 border border-slate-200 shadow-md flex items-center justify-center mx-auto mb-4">
                <UploadCloud className="w-8 h-8" />
              </div>

              <h3 className="text-base font-black text-slate-900">
                Click to upload or drag & drop your CSV file
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Supports standard comma-separated `.csv` files containing product names, categories, selling prices, MRPs, units, and images.
              </p>

              <div className="mt-5 inline-flex items-center gap-2 text-xs font-bold bg-slate-900 text-white px-4 py-2 rounded-xl shadow-sm">
                <span>Browse Local CSV File</span>
              </div>
            </div>
          ) : (
            /* Scanned Results Table & Controls */
            <div className="space-y-4">
              
              {/* Summary Stats & Search Filter */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="text-xs font-bold text-slate-900">
                    Scanned: <span className="font-black text-black">{parsedRows.length} Items</span>
                  </div>
                  <span className="text-slate-300">|</span>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{validCount} Ready to Publish</span>
                  </div>
                  {invalidCount > 0 && (
                    <>
                      <span className="text-slate-300">|</span>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-red-600">
                        <AlertCircle className="w-4 h-4" />
                        <span>{invalidCount} Missing Information</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative w-64">
                    <input
                      type="text"
                      placeholder="Search scanned items..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl pl-8 pr-3 py-2 outline-none focus:border-slate-900"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  </div>

                  <button
                    onClick={() => {
                      setParsedRows([]);
                      setFileName('');
                    }}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Re-upload</span>
                  </button>
                </div>
              </div>

              {/* Data Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                <div className="overflow-x-auto max-h-[380px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-900 text-white font-bold sticky top-0 z-10">
                      <tr>
                        <th className="p-3 w-10 text-center">Status</th>
                        <th className="p-3">Product Name</th>
                        <th className="p-3">Category</th>
                        <th className="p-3 w-24">Price (₹)</th>
                        <th className="p-3 w-24">MRP (₹)</th>
                        <th className="p-3 w-24">Unit</th>
                        <th className="p-3 w-32">SKU</th>
                        <th className="p-3 w-16 text-center">Action</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 font-medium">
                      {filteredRows.map((row) => (
                        <tr
                          key={row.tempId}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            !row.isValid ? 'bg-red-50/40' : ''
                          }`}
                        >
                          {/* Validation Status */}
                          <td className="p-3 text-center">
                            {row.isValid ? (
                              <span title="Valid Item">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 inline-block" />
                              </span>
                            ) : (
                              <span title={row.errorReason || 'Missing required fields'}>
                                <AlertCircle className="w-4 h-4 text-red-500 inline-block" />
                              </span>
                            )}
                          </td>

                          {/* Name Input */}
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.name}
                              onChange={(e) => handleRowEdit(row.tempId, 'name', e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 focus:border-slate-900 rounded-lg px-2 py-1 text-slate-900 text-xs font-bold"
                            />
                            {!row.isValid && row.errorReason && (
                              <span className="text-[10px] text-red-600 font-bold block mt-0.5">
                                {row.errorReason}
                              </span>
                            )}
                          </td>

                          {/* Category Selector */}
                          <td className="p-2">
                            <select
                              value={row.categoryId}
                              onChange={(e) => handleRowEdit(row.tempId, 'categoryId', e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 focus:border-slate-900 rounded-lg px-2 py-1 text-slate-900 text-xs font-bold"
                            >
                              {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Price */}
                          <td className="p-2">
                            <input
                              type="number"
                              value={row.sellingPrice}
                              onChange={(e) =>
                                handleRowEdit(row.tempId, 'sellingPrice', parseFloat(e.target.value) || 0)
                              }
                              className="w-full bg-slate-50 border border-slate-200 focus:border-slate-900 rounded-lg px-2 py-1 text-slate-900 text-xs font-bold"
                            />
                          </td>

                          {/* MRP */}
                          <td className="p-2">
                            <input
                              type="number"
                              value={row.mrp}
                              onChange={(e) =>
                                handleRowEdit(row.tempId, 'mrp', parseFloat(e.target.value) || 0)
                              }
                              className="w-full bg-slate-50 border border-slate-200 focus:border-slate-900 rounded-lg px-2 py-1 text-slate-900 text-xs"
                            />
                          </td>

                          {/* Unit */}
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.unit}
                              onChange={(e) => handleRowEdit(row.tempId, 'unit', e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 focus:border-slate-900 rounded-lg px-2 py-1 text-slate-900 text-xs"
                            />
                          </td>

                          {/* SKU */}
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.sku}
                              onChange={(e) => handleRowEdit(row.tempId, 'sku', e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 focus:border-slate-900 rounded-lg px-2 py-1 text-slate-900 text-xs font-mono"
                            />
                          </td>

                          {/* Action Delete */}
                          <td className="p-2 text-center">
                            <button
                              onClick={() => handleRemoveRow(row.tempId)}
                              className="text-slate-400 hover:text-red-600 transition-colors p-1"
                              title="Delete Item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="bg-slate-100 border-t border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-600">
            {parsedRows.length > 0 ? (
              <span>
                Publishing will save <strong className="text-slate-900">{validCount} products</strong> to Firestore and update website catalog live.
              </span>
            ) : (
              <span>Upload CSV to scan product inventory entries.</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="bg-white hover:bg-slate-200 text-slate-800 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-300 transition-all"
            >
              Cancel
            </button>

            {parsedRows.length > 0 && (
              <button
                onClick={handlePublishAll}
                disabled={isPublishing || validCount === 0}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs px-5 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2"
              >
                {isPublishing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Publishing to Firestore...</span>
                  </>
                ) : (
                  <>
                    <span>Publish {validCount} Products Live</span>
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
