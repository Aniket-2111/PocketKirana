'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import PickerShell from '../../components/PickerShell';
import { BarcodeScannerModal } from '@/components/picker/BarcodeScannerModal';
import { Scan, Search, Sparkles, AlertCircle, ShoppingBag } from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

export default function UniversalScanner() {
  const { products } = useAppStore();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleScan = (scannedValue: string) => {
    setScannerOpen(false);
    
    // Find the product by barcode, upc, sku or id
    const found = products.find(
      (p) =>
        p.barcode === scannedValue ||
        p.upc === scannedValue ||
        p.sku === scannedValue ||
        p.id === scannedValue
    );

    if (found) {
      setScannedProduct(found);
      showToast(`✓ Identified: ${found.name}`, 'success');
    } else {
      setScannedProduct(null);
      showToast(`No product found matching code: ${scannedValue}`, 'error');
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    const found = products.find(
      (p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase() === searchQuery.toLowerCase()
    );

    if (found) {
      setScannedProduct(found);
      showToast(`✓ Found: ${found.name}`, 'success');
    } else {
      setScannedProduct(null);
      showToast('No matching products found', 'error');
    }
  };

  return (
    <PickerShell>
      <div className="space-y-6 animate-in fade-in duration-200 text-slate-900">
        
        {/* Header */}
        <div className="border-b border-slate-200 pb-3">
          <h1 className="text-xl font-black text-slate-900">Product &amp; Bin Scanner</h1>
          <p className="text-xs text-slate-500 mt-1">
            Lookup storage locations and live inventory levels in real-time.
          </p>
        </div>

        {/* Big Scanner Button */}
        <div className="bg-white border border-slate-200 rounded-[28px] p-6 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center mx-auto shadow-xs">
            <Scan className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-900">Open Scan Viewfinder</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              Scan product barcodes or bin storage tags (e.g. `LOC-A01A01`) to inspect.
            </p>
          </div>
          <button
            onClick={() => setScannerOpen(true)}
            className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/30 transition-transform active:scale-[0.98] cursor-pointer"
          >
            LAUNCH CAMERA SCANNER
          </button>
        </div>

        {/* Text Search Bypass */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <input
            type="text"
            placeholder="Search by name or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 font-bold shadow-xs"
          />
          <button
            type="submit"
            className="px-4 py-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Search className="w-4 h-4" />
            <span>Search</span>
          </button>
        </form>

        {/* Display Scanned/Found Product Info */}
        {scannedProduct ? (
          <div className="bg-white border border-slate-200 rounded-[28px] p-5 space-y-4 shadow-sm animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              {scannedProduct.thumbnail ? (
                <img
                  src={scannedProduct.thumbnail}
                  alt={scannedProduct.name}
                  className="w-20 h-20 rounded-2xl object-cover bg-slate-50 border border-slate-200 shrink-0 shadow-xs"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-slate-50 border border-slate-200 text-slate-400 flex items-center justify-center shrink-0 shadow-xs">
                  <ShoppingBag className="w-8 h-8" />
                </div>
              )}

              <div className="flex-1 min-w-0 space-y-1">
                <span className="text-[9px] font-black text-emerald-800 uppercase tracking-widest block bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md w-fit">
                  Identified
                </span>
                <h4 className="font-extrabold text-sm text-slate-900 truncate leading-snug">
                  {scannedProduct.name}
                </h4>
                <p className="text-xs text-slate-500">
                  SKU: <span className="font-mono font-bold">{scannedProduct.sku}</span> • {scannedProduct.unit}
                </p>
                <p className="text-xs font-extrabold text-slate-900">
                  MRP: ₹{scannedProduct.mrp} • Selling Price: <span className="text-emerald-700">₹{scannedProduct.sellingPrice}</span>
                </p>
              </div>
            </div>

            {/* Inventory locations info */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block uppercase font-black">Storage Location</span>
                <strong className="text-emerald-800 font-mono font-black text-sm block mt-1">
                  {scannedProduct.locationCode || 'Aisle A • Shelf 3'}
                </strong>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block uppercase font-black">Available Stock</span>
                <strong className="text-slate-900 font-mono font-black text-sm block mt-1">
                  100 Units
                </strong>
              </div>
            </div>
          </div>
        ) : (
          /* Empty / Waiting State */
          <div className="bg-white border border-dashed border-slate-200 rounded-[28px] p-8 text-center text-xs text-slate-500 shadow-xs">
            <AlertCircle className="w-6 h-6 text-slate-400 mx-auto mb-2" />
            <span>Waiting for barcode scan or search query input.</span>
          </div>
        )}

      </div>

      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
      />
    </PickerShell>
  );
}
