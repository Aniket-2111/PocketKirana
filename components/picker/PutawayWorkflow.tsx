'use client';

import React, { useState } from 'react';
import { Product, StorageLocation, InventoryMovement } from '@/types';
import {
  Scan,
  MapPin,
  CheckCircle2,
  Package,
  Layers,
  ArrowRight,
  Sparkles,
  Barcode as BarcodeIcon,
  Archive,
  History,
  TrendingUp
} from 'lucide-react';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { showToast } from '@/components/ui/Toast';

interface PutawayWorkflowProps {
  products: Product[];
  storageLocations: StorageLocation[];
  inventoryMovements: InventoryMovement[];
  onPerformPutaway: (productId: string, locationId: string, quantity: number) => { success: boolean; message: string };
}

export const PutawayWorkflow: React.FC<PutawayWorkflowProps> = ({
  products,
  storageLocations,
  inventoryMovements,
  onPerformPutaway,
}) => {
  const [step, setStep] = useState<'scan_product' | 'scan_location' | 'enter_qty'>('scan_product');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<StorageLocation | null>(null);
  const [quantity, setQuantity] = useState<number>(50);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<'product' | 'location'>('product');

  const openProductScanner = () => {
    setScannerTarget('product');
    setScannerOpen(true);
  };

  const openLocationScanner = () => {
    setScannerTarget('location');
    setScannerOpen(true);
  };

  const handleScanResult = (scannedCode: string) => {
    setScannerOpen(false);

    if (scannerTarget === 'product') {
      const prod = products.find(
        (p) =>
          p.barcode === scannedCode ||
          p.upc === scannedCode ||
          p.sku === scannedCode ||
          p.id === scannedCode
      ) || products[0];

      if (prod) {
        setSelectedProduct(prod);
        setStep('scan_location');
        showToast(`✓ Identified: ${prod.name}`, 'success');
      } else {
        showToast(`Product with code ${scannedCode} not recognized.`, 'error');
      }
    } else {
      const loc = storageLocations.find(
        (l) =>
          l.barcode === scannedCode ||
          l.displayCode === scannedCode ||
          l.id === scannedCode
      ) || storageLocations[3]; // A-02-B-04

      if (loc) {
        setSelectedLocation(loc);
        setStep('enter_qty');
        showToast(`✓ Target Location: ${loc.displayCode}`, 'success');
      } else {
        showToast(`Location code ${scannedCode} not found.`, 'error');
      }
    }
  };

  const handleConfirmPutaway = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !selectedLocation) return;

    const res = onPerformPutaway(selectedProduct.id, selectedLocation.id, quantity);
    if (res.success) {
      showToast(res.message, 'success');
      // Reset flow
      setStep('scan_product');
      setSelectedProduct(null);
      setSelectedLocation(null);
      setQuantity(50);
    } else {
      showToast(res.message, 'error');
    }
  };

  return (
    <div className="space-y-5 text-slate-900">
      {/* ── PUTAWAY WIZARD HERO CARD ── */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4 text-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900">Stock Receiving &amp; Putaway</h3>
              <p className="text-xs text-slate-500">Place inward stock into shelf/bin locations</p>
            </div>
          </div>
          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-black px-2.5 py-1 rounded-full uppercase">
            Inward Mode
          </span>
        </div>

        {/* ── STEP 1: SCAN INWARD PRODUCT ── */}
        {step === 'scan_product' && (
          <div className="space-y-4 text-center py-2 animate-in fade-in duration-200">
            <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-200 text-emerald-700 flex items-center justify-center mx-auto shadow-xs">
              <Scan className="w-8 h-8" />
            </div>
            <div>
              <h4 className="font-black text-sm text-slate-900">Step 1: Scan Product Barcode</h4>
              <p className="text-xs text-slate-500 mt-0.5">Scan carton / item UPC from inward delivery batch</p>
            </div>

            <button
              onClick={openProductScanner}
              className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
            >
              <Scan className="w-5 h-5 text-white" />
              <span>SCAN PRODUCT BARCODE</span>
            </button>
          </div>
        )}

        {/* ── STEP 2: SCAN STORAGE LOCATION BIN ── */}
        {step === 'scan_location' && selectedProduct && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex items-center gap-3">
              <img
                src={selectedProduct.thumbnail}
                alt={selectedProduct.name}
                className="w-12 h-12 rounded-xl object-cover bg-white border border-slate-200 shrink-0"
              />
              <div className="flex-1 min-w-0 text-xs">
                <span className="text-[10px] font-bold text-emerald-800 uppercase">Product Identified</span>
                <strong className="text-slate-900 block font-bold truncate">{selectedProduct.name}</strong>
                <span className="text-slate-500 font-mono text-[11px]">UPC: {selectedProduct.barcode}</span>
              </div>
            </div>

            <div className="text-center py-2 space-y-1">
              <div className="w-14 h-14 rounded-full bg-slate-50 border border-slate-200 text-emerald-700 flex items-center justify-center mx-auto">
                <MapPin className="w-7 h-7" />
              </div>
              <h4 className="font-black text-sm text-slate-900">Step 2: Scan Shelf / Bin Barcode</h4>
              <p className="text-xs text-slate-500">Scan location sticker on target rack (e.g. A-02-B-04)</p>
            </div>

            <button
              onClick={openLocationScanner}
              className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
            >
              <Scan className="w-5 h-5 text-white" />
              <span>SCAN BIN LOCATION (A-02-B-04)</span>
            </button>
          </div>
        )}

        {/* ── STEP 3: ENTER QUANTITY & CONFIRM ── */}
        {step === 'enter_qty' && selectedProduct && selectedLocation && (
          <form onSubmit={handleConfirmPutaway} className="space-y-4 animate-in fade-in duration-200">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Product:</span>
                <strong className="text-slate-900">{selectedProduct.name}</strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Target Shelf / Bin:</span>
                <strong className="text-emerald-800 font-mono font-black">{selectedLocation.displayCode} ({selectedLocation.aisle})</strong>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Quantity Inward (Units)
              </label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-slate-900 font-mono font-black text-xl text-center focus:border-emerald-600 focus:outline-none"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
            >
              <CheckCircle2 className="w-5 h-5 text-white" />
              <span>CONFIRM PUTAWAY &amp; UPDATE STOCK</span>
            </button>
          </form>
        )}
      </div>

      {/* ── RECENT INVENTORY MOVEMENT AUDIT TRAIL ── */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-3.5 shadow-xs text-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <h4 className="font-black text-sm text-slate-900 flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-600" />
            Inventory Audit Trail (Movements)
          </h4>
          <span className="text-[10px] font-bold text-slate-400 uppercase">Live Logs</span>
        </div>

        <div className="space-y-2 divide-y divide-slate-100">
          {inventoryMovements.slice(0, 5).map((mov) => (
            <div key={mov.id} className="pt-2 first:pt-0 flex items-center justify-between text-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`font-black text-[10px] px-2 py-0.5 rounded-md uppercase font-mono ${
                      mov.type === 'PUTAWAY' || mov.type === 'RECEIVE'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {mov.type} {mov.quantity > 0 ? `+${mov.quantity}` : mov.quantity}
                  </span>
                  <strong className="text-slate-900 font-bold">{mov.productName}</strong>
                </div>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  {mov.toLocation ? `Placed into ${mov.toLocation}` : mov.fromLocation ? `Picked from ${mov.fromLocation}` : 'Store Inward'} • {new Date(mov.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <span className="text-slate-400 font-mono text-[10px]">
                {mov.pickerName}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Barcode Scanner Simulator Modal */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScanResult}
        title={scannerTarget === 'product' ? 'Scan Inward Product' : 'Scan Storage Bin Location'}
        quickSampleBarcodes={
          scannerTarget === 'product'
            ? [
                { label: 'Tata Salt 1KG', code: '8901234567890' },
                { label: 'Aashirvaad Atta 5KG', code: '8901725181222' },
                { label: 'Fortune Oil 1L', code: '8906007280014' },
              ]
            : [
                { label: 'Bin A-02-B-04', code: 'LOC-A02B04' },
                { label: 'Bin A-01-A-01', code: 'LOC-A01A01' },
                { label: 'Bin C-01-A-01', code: 'LOC-C01A01' },
              ]
        }
      />
    </div>
  );
};
