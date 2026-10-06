'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PickerShell from '../../components/PickerShell';
import { useAppStore } from '@/lib/store';
import {
  detectMeasurementType,
  detectWeightUnit,
  formatQuantity,
  normalizeDecimal,
} from '@/lib/measurementUtils';
import {
  Boxes,
  Search,
  Package,
  Plus,
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  History,
  X
} from 'lucide-react';
import { MeasurementType, WeightUnit } from '@/types';
import { apiFetch } from '@/lib/apiClient';

interface InventorySearchResult {
  id: string;
  name: string;
  slug?: string;
  sku: string;
  barcode: string;
  brandName: string;
  unit: string;
  measurementType?: MeasurementType;
  weightUnit?: WeightUnit;
  sellingPrice: number;
  mrp: number;
  stock: number;
  availableStock: number;
  reservedStock: number;
  thumbnail: string;
  storageLocation: string;
}

interface RecentActivityItem {
  id: string;
  time: string;
  productName: string;
  quantityAdded: number;
  previousStock: number;
  newStock: number;
  addedBy: string;
  measurementType?: 'UNIT' | 'WEIGHT';
  weightUnit?: 'KG' | 'G';
  batchNumber?: string;
}

export default function InventorySearchPage() {
  const router = useRouter();
  const { products: storeProducts } = useAppStore();

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<InventorySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Initial & Recent Activities state
  const [recentActivities, setRecentActivities] = useState<RecentActivityItem[]>([
    {
      id: 'act-1',
      time: '15:32 Today',
      productName: 'Loose Basmati Rice',
      quantityAdded: 10.25,
      previousStock: 63.5,
      newStock: 73.75,
      addedBy: 'Picker Rahul',
      measurementType: 'WEIGHT',
      weightUnit: 'KG',
      batchNumber: 'RIC-2026-B1',
    },
    {
      id: 'act-2',
      time: '14:15 Today',
      productName: 'Fortune Sunlite Refined Sunflower Oil 1L',
      quantityAdded: 15,
      previousStock: 20,
      newStock: 35,
      addedBy: 'Picker Rahul',
      measurementType: 'UNIT',
    },
    {
      id: 'act-3',
      time: '11:40 Today',
      productName: 'Amul Butter Pasteurised 500g',
      quantityAdded: 24,
      previousStock: 8,
      newStock: 32,
      addedBy: 'Store Supervisor',
      measurementType: 'UNIT',
      batchNumber: 'AML-MAY-04',
    },
  ]);

  // Perform search
  useEffect(() => {
    let isCancelled = false;
    const searchTimer = setTimeout(async () => {
      if (!query.trim()) {
        // Default initial items preview
        const initialList = (storeProducts || []).slice(0, 10).map((p) => {
          const type = detectMeasurementType(p);
          const weightUnit = detectWeightUnit(p);
          const rawStock = normalizeDecimal(p.stock ?? (type === 'WEIGHT' ? 63.5 : 63), 3);
          const reserved = type === 'WEIGHT' ? 3.5 : 6;
          return {
            id: p.id,
            name: p.name,
            slug: p.slug,
            sku: p.sku || `SKU-${p.id.slice(0, 8).toUpperCase()}`,
            barcode: p.barcode || '8901234567890',
            brandName: p.brandId ? p.brandId.replace('brand-', '').toUpperCase() : 'POCKETKIRANA',
            unit: p.unit || (type === 'WEIGHT' ? 'Loose' : '1 unit'),
            measurementType: type,
            weightUnit,
            sellingPrice: p.sellingPrice || 0,
            mrp: p.mrp || p.sellingPrice || 0,
            stock: rawStock,
            availableStock: Math.max(0, normalizeDecimal(rawStock - reserved, 3)),
            reservedStock: reserved,
            thumbnail: p.thumbnail || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=300&q=80',
            storageLocation: 'A-02-B-04',
          };
        });
        setSearchResults(initialList);
        return;
      }

      setIsSearching(true);
      try {
        const res = await apiFetch(`/api/inventory/search?query=${encodeURIComponent(query)}&limit=20`);
        const data = await res.json();
        if (!isCancelled && data.success && Array.isArray(data.products)) {
          setSearchResults(data.products);
        }
      } catch (e) {
        console.warn('Inventory search fallback:', e);
      } finally {
        if (!isCancelled) setIsSearching(false);
      }
    }, 200);

    return () => {
      isCancelled = true;
      clearTimeout(searchTimer);
    };
  }, [query, storeProducts]);

  return (
    <PickerShell>
      <div className="space-y-6 text-slate-900 pb-12 animate-in fade-in duration-200">
        
        {/* ── HEADER ── */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                Dark Store Operations
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1 flex items-center gap-2">
              <Boxes className="w-6 h-6 text-emerald-600" />
              <span>Inventory Management</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Search store catalog by product name or SKU, check stock reserves, and receive inbound inventory.
            </p>
          </div>
        </div>

        {/* ── SEARCH PRODUCTS BAR ── */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search product name or SKU..."
              className="w-full pl-11 pr-10 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:border-emerald-600 focus:bg-white text-xs sm:text-sm font-bold text-slate-900 focus:outline-hidden transition-all placeholder:text-slate-400"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Filter Tag Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-[11px] font-bold text-slate-600 scrollbar-none">
            <span className="text-slate-400 uppercase text-[9px] font-black shrink-0">Quick:</span>
            {['Rice', 'Atta', 'Milk', 'Oil', 'Butter', 'Maggi', 'Sugar', 'Flour'].map((tag) => (
              <button
                key={tag}
                onClick={() => setQuery(tag)}
                className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 shrink-0 transition-colors cursor-pointer"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* ── SEARCH RESULTS GRID ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
              {query ? `Search Results (${searchResults.length})` : `Store Catalog (${searchResults.length})`}
            </h3>
            {isSearching && (
              <span className="text-[10px] text-emerald-700 font-bold font-mono animate-pulse">
                Searching live database...
              </span>
            )}
          </div>

          {searchResults.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-2 shadow-xs">
              <Package className="w-10 h-10 text-slate-300 mx-auto" />
              <strong className="text-sm font-black text-slate-800 block">No Products Found</strong>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                No inventory item matched "{query}". Try checking the spelling or product SKU.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {searchResults.map((prod) => {
                const type = prod.measurementType || detectMeasurementType(prod);
                const weightUnit = prod.weightUnit || detectWeightUnit(prod);

                return (
                  <div
                    key={prod.id}
                    className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 flex flex-col justify-between gap-3 shadow-xs hover:shadow-md hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200 p-1 flex items-center justify-center shrink-0">
                        <img
                          src={prod.thumbnail}
                          alt={prod.name}
                          className="w-full h-full object-contain rounded-xl"
                        />
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[9px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-md inline-block">
                            {prod.brandName}
                          </span>
                          <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded-md">
                            {type === 'WEIGHT' ? '⚖️ Loose Weight' : '📦 Packaged'}
                          </span>
                        </div>
                        <h4 className="text-sm font-black text-slate-900 truncate leading-snug">
                          {prod.name}
                        </h4>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                          <span>SKU: {prod.sku}</span>
                          <span>•</span>
                          <span>{prod.unit}</span>
                        </div>
                      </div>
                    </div>

                    {/* Stock level breakdown */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-black block">Current Stock</span>
                        <strong className="text-base font-black text-slate-900 font-mono">
                          {formatQuantity(prod.stock, type, weightUnit)}
                        </strong>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Available</span>
                        <span className="text-xs font-bold text-emerald-700 font-mono">
                          {formatQuantity(prod.availableStock, type, weightUnit)} to sell
                        </span>
                      </div>
                    </div>

                    {/* View Inventory Action */}
                    <Link
                      href={`/inventory/${encodeURIComponent(prod.id)}`}
                      className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-xs uppercase tracking-wider"
                    >
                      <span>VIEW INVENTORY &amp; ADD STOCK</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── RECENT INVENTORY ACTIVITY FEED ── */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-600" />
              <span>Recent Store Inventory Ledger</span>
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">Auditable</span>
          </div>

          <div className="space-y-2.5">
            {recentActivities.map((act) => (
              <div
                key={act.id}
                className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-400 font-bold">{act.time}</span>
                    <span className="text-[9px] font-black text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded-md uppercase">
                      +{formatQuantity(act.quantityAdded, act.measurementType || 'UNIT', act.weightUnit || 'KG')}
                    </span>
                  </div>
                  <strong className="text-slate-900 block font-bold truncate text-xs">
                    {act.productName}
                  </strong>
                  <span className="text-[11px] text-slate-500 font-medium block">
                    Stock: <strong className="font-mono text-slate-800">{formatQuantity(act.previousStock, act.measurementType, act.weightUnit)}</strong> →{' '}
                    <strong className="font-mono text-emerald-700 font-black">{formatQuantity(act.newStock, act.measurementType, act.weightUnit)}</strong> • Added by: {act.addedBy}
                  </span>
                </div>

                <div className="shrink-0 text-right">
                  <span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
                    ✓
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </PickerShell>
  );
}
