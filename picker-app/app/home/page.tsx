'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import PickerShell from '../../components/PickerShell';
import { 
  Package, 
  Scan, 
  Archive, 
  HelpCircle, 
  Clock, 
  ArrowRight,
  Sparkles,
  ClipboardCheck,
  TrendingUp,
  AlertTriangle,
  Play,
  CheckCircle2
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

export default function PickerDashboard() {
  const router = useRouter();
  const {
    pickers,
    activePickerId,
    pickingTasks,
    orders,
    acceptOrderTask,
    startPickingTask,
  } = useAppStore();

  const picker = pickers.find((p) => p.id === activePickerId) || pickers[0] || {
    id: 'picker-1',
    name: 'Rahul',
    status: 'active' as const,
    activeTaskId: undefined,
  };

  // Synthesize picking tasks from both pickingTasks and live orders so no active order is missed and no order appears twice
  const finishedOrderStatuses = ['CANCELLED', 'DELIVERED', 'COMPLETED', 'HANDED_OVER', 'OUT_FOR_DELIVERY', 'PICKED_UP', 'READY_FOR_PICKUP', 'PACKED'];
  const taskMap = new Map<string, typeof pickingTasks[0]>();
  const statusWeight: Record<string, number> = {
    handed_over: 5,
    packed: 4,
    packing: 3,
    picking: 2,
    assigned: 1,
    pending: 0,
  };

  (pickingTasks || []).forEach((t) => {
    const key = t.orderNumber || t.orderId || t.id;
    if (!key) return;
    const existing = taskMap.get(key);
    if (!existing || (statusWeight[t.status] ?? 0) >= (statusWeight[existing.status] ?? 0)) {
      taskMap.set(key, t);
    }
  });

  (orders || []).forEach((o) => {
    const key = o.orderNumber || o.id;
    if (!key) return;
    const statusUpper = (o.orderStatus || '').toUpperCase();
    const isEligible = o.paymentMethod === 'cod' || o.paymentStatus === 'paid' || o.paymentStatus === 'completed';
    if (isEligible && !finishedOrderStatuses.includes(statusUpper) && !taskMap.has(key)) {
      taskMap.set(key, {
        id: `task-${o.id}`,
        orderId: o.id,
        orderNumber: o.orderNumber,
        storeId: o.storeId || 'store-001',
        storeName: 'PocketKirana Neral Hub',
        status: statusUpper === 'PICKING' ? 'picking' : 'assigned',
        priority: 'NORMAL',
        items: (o.items || []).map((it, idx) => ({
          id: `pi-${o.id}-${idx}`,
          productId: it.productId,
          productName: (it as any).productName || (it as any).product?.name || 'Grocery Item',
          sku: `SKU-${it.productId.slice(0, 8).toUpperCase()}`,
          upc: (it as any).barcode || '8901234567890',
          barcode: (it as any).barcode || '8901234567890',
          unit: (it as any).unit || '1 pack',
          imageUrl: (it as any).imageUrl || (it as any).product?.thumbnail || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=300&q=80',
          quantityRequired: it.quantity,
          quantityPicked: 0,
          storageLocation: {
            id: 'loc-1',
            storeId: 'store-001',
            aisle: 'A',
            rack: '01',
            shelf: 'A',
            bin: '01',
            barcode: 'LOC-A01A01',
            displayCode: 'A-01-A-01'
          },
          status: 'pending'
        })),
        totalItemsCount: (o.items || []).length,
        pickedItemsCount: 0,
        createdAt: o.placedAt || new Date().toISOString()
      });
    }
  });

  const effectivePickingTasks = Array.from(taskMap.values());

  // Find active picking task for this picker (must be active: assigned or picking)
  const activeTask = effectivePickingTasks.find(
    (t) =>
      t.status !== 'packed' &&
      t.status !== 'handed_over' &&
      (t.id === picker.activeTaskId || (t.pickerId === picker.id && (t.status === 'picking' || t.status === 'assigned')))
  );

  // If no task is assigned directly to this picker, show the first available active task from the queue
  const nextQueueTask = effectivePickingTasks.find(
    (t) =>
      t.status !== 'packed' &&
      t.status !== 'handed_over'
  );

  const handleStartRoute = async (taskId: string) => {
    try {
      const acceptRes = acceptOrderTask(taskId, picker.id);
      if (!acceptRes.success) {
        showToast(acceptRes.message, 'error');
        return;
      }
      startPickingTask(taskId, picker.id);
      showToast('Order accepted! Picking route initialized.', 'success');
      router.push(`/picking/${taskId}`);
    } catch (err: any) {
      showToast(err.message || 'Failed to accept order & start picking route', 'error');
    }
  };

  // Counts for Fulfillment summary
  const totalOrdersCount = effectivePickingTasks.length;
  const pickedCount = effectivePickingTasks.filter(t => t.status === 'picked' || t.status === 'packed' || t.status === 'handed_over').length;
  const pendingCount = effectivePickingTasks.filter(t => t.status === 'assigned' || t.status === 'pending' || t.status === 'picking').length;

  const inPickingCount = effectivePickingTasks.filter(t => t.status === 'picking').length;
  const packingCount = effectivePickingTasks.filter(t => t.status === 'packing').length;
  const readyCount = effectivePickingTasks.filter(t => t.status === 'packed').length;

  return (
    <PickerShell>
      <div className="space-y-6 animate-in fade-in duration-200 text-slate-900">
        
        {/* Hello Greeting */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Hello, {picker.name || 'Rahul'}! 👋</h1>
            <p className="text-xs text-slate-500 mt-1">
              Welcome back to your shift. You are currently <strong className="text-emerald-700 uppercase">{picker.status === 'active' || picker.status === 'busy' ? 'On Duty' : 'Off Duty'}</strong>.
            </p>
          </div>
          
          {/* Quick Stats Pill */}
          <div className="bg-white border border-slate-200 rounded-2xl px-4 py-2 flex items-center gap-3 text-xs shadow-xs">
            <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-slate-500">Shift Time Elapsed: <strong className="text-slate-900 font-mono">04h 32m</strong></span>
          </div>
        </div>

        {/* Today's Fulfillment summary */}
        <div className="bg-white border border-slate-200/90 rounded-[28px] p-5 md:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider block">
              Today's Fulfillment Summary
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Store: {picker.storeName || 'PocketKirana Neral Hub'}</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <span className="text-[10px] text-slate-400 block uppercase font-black">Total Orders</span>
              <strong className="text-xl md:text-2xl font-black text-slate-900 font-mono mt-1 block">{totalOrdersCount}</strong>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <span className="text-[10px] text-slate-400 block uppercase font-black">Picked</span>
              <strong className="text-xl md:text-2xl font-black text-emerald-600 font-mono mt-1 block">{pickedCount}</strong>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <span className="text-[10px] text-slate-400 block uppercase font-black">Pending</span>
              <strong className="text-xl md:text-2xl font-black text-amber-600 font-mono mt-1 block">{pendingCount}</strong>
            </div>
          </div>

          {/* Sub-status counts */}
          <div className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-4 text-center text-xs">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">In Picking</span>
              <strong className="text-slate-900 font-mono block mt-0.5">{inPickingCount}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Packing</span>
              <strong className="text-slate-900 font-mono block mt-0.5">{packingCount}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Ready</span>
              <strong className="text-emerald-700 font-mono block mt-0.5">{readyCount}</strong>
            </div>
          </div>
        </div>

        {/* Active Order Card */}
        {activeTask ? (
          <div className="bg-gradient-to-br from-white to-emerald-50/70 border border-emerald-300 rounded-[28px] p-6 space-y-4 shadow-md animate-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <h4 className="font-black text-xs text-slate-900 uppercase tracking-wider">
                  Active Order Task
                </h4>
              </div>
              <span className={`font-black text-[9px] px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                activeTask.priority === 'HIGH'
                  ? 'bg-rose-500 text-white'
                  : 'bg-emerald-600 text-white'
              }`}>
                {activeTask.priority || 'NORMAL'} PRIORITY
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <strong className="text-lg md:text-xl font-black text-slate-900 block">
                  Order #{activeTask.orderNumber || 'PK26081991761'}
                </strong>
                <span className="text-xs text-slate-500 block mt-0.5">
                  {activeTask.totalItemsCount || 4} Products Total
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between bg-white rounded-2xl p-4 border border-slate-200 text-xs shadow-xs">
              <span className="text-slate-500">Picking Progress</span>
              <strong className="text-slate-900 font-mono font-black">
                {activeTask.items?.filter((i: any) => i.status === 'picked' || i.status === 'substituted' || (i.quantityPicked > 0 && i.quantityPicked >= i.quantityRequired)).length || 0} / {activeTask.totalItemsCount || activeTask.items?.length || 0} Items
              </strong>
            </div>

            {/* Ordered Products Breakdown List */}
            <div className="space-y-2 bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider block">
                  Customer Ordered Products ({activeTask.items?.length || 0} Items)
                </span>
              </div>

              <div className="space-y-2 max-h-52 overflow-y-auto pr-1 scrollbar-thin">
                {activeTask.items?.map((item: any, idx: number) => {
                  const isDone = item.status === 'picked' || item.status === 'substituted' || (item.quantityPicked > 0 && item.quantityPicked >= item.quantityRequired);
                  return (
                    <div key={item.id || idx} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.productName} className="w-10 h-10 rounded-lg object-cover bg-white border border-slate-200 shrink-0 shadow-xs" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 text-slate-400 flex items-center justify-center shrink-0 shadow-xs">
                            <Package className="w-5 h-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <strong className="text-slate-900 block font-bold truncate text-xs">{item.productName}</strong>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                            <span>Required: <strong className="text-slate-900 font-mono">{item.quantityRequired}x</strong></span>
                          </div>
                        </div>
                      </div>

                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase border shrink-0 ml-2 ${
                        isDone
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        {isDone ? 'Picked ✓' : 'Pending'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action button based on status */}
            {activeTask.status === 'picking' || activeTask.status === 'assigned' ? (
              <Link
                href={`/picking/${activeTask.id}`}
                className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-md shadow-emerald-600/30 uppercase tracking-wider"
              >
                <span>OPEN ORDER &amp; START PACKING</span>
                <ArrowRight className="w-5 h-5 ml-auto" />
              </Link>
            ) : (
              <button
                onClick={() => handleStartRoute(activeTask.id)}
                className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-md shadow-emerald-600/30 cursor-pointer uppercase tracking-wider"
              >
                <span>OPEN ORDER</span>
                <ArrowRight className="w-5 h-5 ml-auto" />
              </button>
            )}
          </div>
        ) : (
          /* Empty Active State: No Active Assignment */
          <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-3 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="font-black text-lg text-slate-900">All Active Tasks Completed!</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              You currently have no active order assigned. New incoming orders will appear in your queue automatically.
            </p>
          </div>
        )}

        {/* ── QUEUED ASSIGNMENTS SECTION ── */}
        {nextQueueTask && (
          <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                Next Order in Queue
              </span>
              <span className="bg-slate-100 text-slate-600 font-bold text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                Unassigned
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <strong className="text-lg font-black text-slate-900 block">
                  Order #{nextQueueTask.orderNumber}
                </strong>
                <span className="text-xs text-slate-500 block mt-0.5">
                  {nextQueueTask.totalItemsCount} Products • Assigned to store
                </span>
              </div>
            </div>

            {/* Ordered Products Breakdown List */}
            <div className="space-y-2 bg-slate-50 rounded-2xl p-4 border border-slate-200">
              <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider block">
                Customer Ordered Products ({nextQueueTask.items?.length || 0} Items)
              </span>

              <div className="space-y-2 max-h-44 overflow-y-auto pr-1 scrollbar-thin">
                {nextQueueTask.items?.map((item: any, idx: number) => (
                  <div key={item.id || idx} className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200 text-xs shadow-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.productName} className="w-10 h-10 rounded-lg object-cover bg-slate-50 border border-slate-200 shrink-0 shadow-xs" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 text-slate-400 flex items-center justify-center shrink-0 shadow-xs">
                          <Package className="w-5 h-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <strong className="text-slate-900 block font-bold truncate text-xs">{item.productName}</strong>
                      </div>
                    </div>
                    <span className="text-slate-900 font-mono font-black text-xs shrink-0 ml-2">
                      {item.quantityRequired}x
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => handleStartRoute(nextQueueTask.id)}
              className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition-transform active:scale-[0.98] cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white text-white" />
              <span>ACCEPT ORDER &amp; START PICKING WORKFLOW</span>
            </button>
          </div>
        )}

        {/* Other Tasks Grid */}
        <div className="space-y-3">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
            Operational Shortcuts
          </span>
          
          <div className="grid grid-cols-3 gap-3 text-center">
            <Link 
              href="/scan"
              className="bg-white border border-slate-200 p-4 rounded-2xl hover:border-emerald-300 hover:bg-emerald-50/30 transition-all flex flex-col items-center gap-2 group cursor-pointer shadow-xs"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <Scan className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-black text-slate-700">Scan Bin</span>
            </Link>

            <Link 
              href="/putaway"
              className="bg-white border border-slate-200 p-4 rounded-2xl hover:border-sky-300 hover:bg-sky-50/30 transition-all flex flex-col items-center gap-2 group cursor-pointer shadow-xs"
            >
              <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <Archive className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-black text-slate-700">Putaway</span>
            </Link>

            <Link 
              href="/profile?tab=audit"
              className="bg-white border border-slate-200 p-4 rounded-2xl hover:border-amber-300 hover:bg-amber-50/30 transition-all flex flex-col items-center gap-2 group cursor-pointer shadow-xs"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <ClipboardCheck className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-black text-slate-700">Stock Count</span>
            </Link>
          </div>
        </div>

      </div>
    </PickerShell>
  );
}
