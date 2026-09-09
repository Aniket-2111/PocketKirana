'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import PickerShell from '../../components/PickerShell';
import { PickerPerformanceView } from '@/components/picker/PickerPerformanceView';
import { StockCountModal } from '@/components/picker/StockCountModal';
import { NewProductRequestModal } from '@/components/picker/NewProductRequestModal';
import { 
  ClipboardCheck, 
  Sparkles, 
  HelpCircle, 
  LogOut,
  Store,
  User
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

function ProfileContent() {
  const searchParams = useSearchParams();
  const {
    pickers,
    activePickerId,
    storageLocations,
    products,
    categories,
    submitStockCount,
    requestNewProduct,
    logout,
  } = useAppStore();

  const picker = pickers.find((p) => p.id === activePickerId) || pickers[0] || {
    id: 'picker-1',
    name: 'Rahul',
    employeeId: 'PK-PICK-001',
    storeName: 'MG Road Store',
    status: 'online',
    statistics: {
      ordersPickedToday: 15,
      pickingTimeAvgMinutes: 8.5,
      itemsPerMinute: 12,
      accuracyRate: 98.4,
    },
  };

  const [stockCountOpen, setStockCountOpen] = useState(false);
  const [newProductOpen, setNewProductOpen] = useState(false);

  // Pre-open stock count modal if url query matches tab=audit
  useEffect(() => {
    if (searchParams.get('tab') === 'audit') {
      setStockCountOpen(true);
    }
  }, [searchParams]);

  const handleLogout = () => {
    logout();
    showToast('Signed out of shift', 'info');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 text-slate-900">
      {/* Header */}
      <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900">Shift Profile</h1>
          <p className="text-xs text-slate-500 mt-1">
            Inspect employee performance statistics and file inventory audits.
          </p>
        </div>
        <User className="w-5 h-5 text-emerald-600" />
      </div>

      {/* Performance score card view */}
      <PickerPerformanceView picker={picker} />

      {/* Shift Management Actions */}
      <div className="bg-white border border-slate-200 rounded-[28px] p-5 shadow-xs space-y-4 text-slate-900">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
          Store Audit Tools &amp; Actions
        </span>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setStockCountOpen(true)}
            className="py-3 px-4 rounded-2xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer text-slate-700 hover:text-slate-900 shadow-xs"
          >
            <ClipboardCheck className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
            <span>Audit Stock Count</span>
          </button>

          <button
            onClick={() => setNewProductOpen(true)}
            className="py-3 px-4 rounded-2xl bg-slate-50 hover:bg-amber-50 border border-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer text-slate-700 hover:text-slate-900 shadow-xs"
          >
            <Sparkles className="w-4.5 h-4.5 text-amber-600 shrink-0" />
            <span>Report Barcode</span>
          </button>
        </div>

        <button
          onClick={handleLogout}
          className="w-full py-3.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 rounded-2xl text-xs font-black flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Sign Out Shift</span>
        </button>
      </div>

      {/* Modal Modifiers */}
      <StockCountModal
        isOpen={stockCountOpen}
        onClose={() => setStockCountOpen(false)}
        storageLocations={storageLocations}
        products={products}
        onSubmitStockCount={submitStockCount}
      />

      <NewProductRequestModal
        isOpen={newProductOpen}
        onClose={() => setNewProductOpen(false)}
        categories={categories}
        onRequestNewProduct={requestNewProduct}
      />
    </div>
  );
}

export default function PickerProfile() {
  return (
    <PickerShell>
      <Suspense fallback={<div className="text-xs text-slate-400">Loading Profile...</div>}>
        <ProfileContent />
      </Suspense>
    </PickerShell>
  );
}
