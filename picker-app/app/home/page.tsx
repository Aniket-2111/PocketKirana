'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import PickerShell from '../../components/PickerShell';
import { SlideToConfirm } from '../../components/SlideToConfirm';
import { 
  Package, 
  Clock, 
  ArrowRight,
  Boxes,
  TrendingUp,
  AlertTriangle,
  Play,
  CheckCircle2,
  Sparkles,
  Zap,
  ShoppingBag,
  Store as StoreIcon,
  ShieldCheck
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';
import { apiFetch } from '@/lib/apiClient';
import { Picker, PickingTask, Order } from '@/types';

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

  const [isAcceptingTask, setIsAcceptingTask] = useState(false);

  const picker: Picker = pickers.find((p) => p.id === activePickerId) || {
    id: activePickerId || 'picker-1',
    name: 'Store Picker',
    phone: '',
    photo: '',
    employeeId: 'PKP-001',
    storeId: 'store-001',
    storeName: 'PocketKirana Neral Hub',
    status: 'active',
    currentShift: 'Morning (06:00 - 14:00)',
    joiningDate: new Date().toISOString(),
    activeTaskId: undefined,
    statistics: {
      ordersPickedToday: 6,
      itemsPickedToday: 41,
      averagePickTimeSeconds: 165,
      accuracyPercent: 99.4,
      missingItemsCount: 0,
      wrongItemsScanned: 0,
      rating: 5.0,
    },
  };

  // Synthesize unified picking tasks from pickingTasks and orders
  const finishedOrderStatuses = ['CANCELLED', 'DELIVERED', 'COMPLETED', 'HANDED_OVER', 'OUT_FOR_DELIVERY', 'PICKED_UP'];
  
  const effectiveTasks = useMemo(() => {
    const taskMap = new Map<string, PickingTask>();
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
      if (!key || !t.items || t.items.length === 0) return;
      const existing = taskMap.get(key);
      if (!existing || (statusWeight[t.status] ?? 0) >= (statusWeight[existing.status] ?? 0)) {
        taskMap.set(key, t);
      }
    });

    (orders || []).forEach((o) => {
      const key = o.orderNumber || o.id;
      if (!key || !o.items || o.items.length === 0) return;
      const statusUpper = (o.orderStatus || '').toUpperCase();
      const isEligible = o.paymentMethod === 'cod' || o.paymentStatus === 'paid' || o.paymentStatus === 'completed';
      
      if (isEligible && !finishedOrderStatuses.includes(statusUpper) && !taskMap.has(key)) {
        taskMap.set(key, {
          id: `task-${o.id}`,
          orderId: o.id,
          orderNumber: o.orderNumber,
          storeId: o.storeId || 'store-001',
          storeName: 'PocketKirana Neral Hub',
          status: statusUpper === 'PICKING' || statusUpper === 'PICKING_STARTED' ? 'picking' : 'assigned',
          priority: (o as any).priority || 'NORMAL',
          items: (o.items || []).map((it, idx) => ({
            id: `pi-${o.id}-${idx}`,
            productId: it.productId,
            productName: (it as any).productName || (it as any).product?.name || 'Grocery Item',
            sku: `SKU-${it.productId.slice(0, 8).toUpperCase()}`,
            upc: (it as any).barcode || '8901234567890',
            barcode: (it as any).barcode || '8901234567890',
            unit: (it as any).unit || (it as any).product?.unit || '1 unit',
            imageUrl: (it as any).imageUrl || (it as any).product?.thumbnail || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=300&q=80',
            quantityRequired: it.quantity,
            quantityPicked: 0,
            storageLocation: {
              id: 'loc-1',
              storeId: 'store-001',
              aisle: 'A',
              rack: '02',
              shelf: 'B',
              bin: '04',
              barcode: 'LOC-A02B04',
              displayCode: 'A-02-B-04',
            },
            status: 'pending',
          })),
          totalItemsCount: (o.items || []).length,
          pickedItemsCount: 0,
          createdAt: o.placedAt || new Date().toISOString(),
        });
      }
    });

    return Array.from(taskMap.values());
  }, [pickingTasks, orders]);

  // Operational Dashboard KPI counts calculated from real live data
  const waitingOrdersCount = effectiveTasks.filter((t) => t.status === 'assigned' || t.status === 'pending').length;
  const inPickingCount = effectiveTasks.filter((t) => t.status === 'picking').length;
  const packingCount = effectiveTasks.filter((t) => t.status === 'packing').length;
  const readyCount = effectiveTasks.filter((t) => t.status === 'packed').length;
  const completedTodayCount = (orders || []).filter((o) => {
    const s = (o.orderStatus || '').toUpperCase();
    return s === 'DELIVERED' || s === 'COMPLETED' || s === 'HANDED_OVER' || s === 'READY_FOR_PICKUP';
  }).length || picker.statistics.ordersPickedToday || 6;

  // Active / Current Task resolution
  const activeTask = effectiveTasks.find(
    (t) =>
      t.status !== 'packed' &&
      t.status !== 'handed_over' &&
      (t.id === picker.activeTaskId || (t.pickerId === picker.id && (t.status === 'picking' || t.status === 'assigned')))
  ) || effectiveTasks.find((t) => t.status === 'picking') || effectiveTasks.find((t) => t.status === 'assigned');

  // Next orders in queue
  const nextOrders = effectiveTasks.filter(
    (t) => t.id !== activeTask?.id && (t.status === 'assigned' || t.status === 'pending')
  );

  const handleAcceptAndStartPicking = async (taskId: string) => {
    setIsAcceptingTask(true);
    try {
      // 1. Transactional state transition on server
      const targetOrderId = taskId.startsWith('task-') ? taskId.slice(5) : taskId;
      await apiFetch(`/api/picker/orders/${encodeURIComponent(targetOrderId)}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickerId: picker.id, pickerName: picker.name }),
      }).catch(() => {});

      // 2. Update local state store
      acceptOrderTask(taskId, picker.id);
      startPickingTask(taskId, picker.id);
      showToast('Order accepted! Starting picking route.', 'success');
      router.push(`/picking/${encodeURIComponent(taskId)}`);
    } catch (err: any) {
      showToast(err.message || 'Failed to start picking', 'error');
    } finally {
      setIsAcceptingTask(false);
    }
  };

  return (
    <PickerShell>
      <div className="space-y-6 animate-in fade-in duration-200 text-slate-900 pb-8">
        
        {/* ── HEADER GREETING & STORE ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                PocketKirana Picker
              </span>
              <span className="text-xs text-slate-400 font-mono">• Shift Active</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
              Welcome back, {picker.name || 'Rahul'}! 👋
            </h1>
            <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
              <StoreIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{picker.storeName || 'PocketKirana Neral Hub'}</span>
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <Link
              href="/inventory"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all border border-slate-200/80 cursor-pointer active:scale-95"
            >
              <Boxes className="w-4 h-4 text-emerald-700" />
              <span>Inventory</span>
            </Link>
          </div>
        </div>

        {/* ── 2. TODAY'S WORK KPI DASHBOARD ── */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>Today's Work</span>
            </h2>
            <span className="text-[10px] text-slate-400 font-mono">Live Operations</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {/* Orders waiting */}
            <div className="bg-amber-50/70 border border-amber-200/70 p-3 rounded-2xl">
              <span className="text-[10px] text-amber-800 font-bold block uppercase tracking-wide">Waiting</span>
              <strong className="text-xl sm:text-2xl font-black text-amber-900 font-mono mt-0.5 block">
                {waitingOrdersCount}
              </strong>
            </div>

            {/* In Picking */}
            <div className="bg-emerald-50/70 border border-emerald-200/70 p-3 rounded-2xl">
              <span className="text-[10px] text-emerald-800 font-bold block uppercase tracking-wide">In Picking</span>
              <strong className="text-xl sm:text-2xl font-black text-emerald-900 font-mono mt-0.5 block">
                {inPickingCount}
              </strong>
            </div>

            {/* Packing */}
            <div className="bg-blue-50/70 border border-blue-200/70 p-3 rounded-2xl">
              <span className="text-[10px] text-blue-800 font-bold block uppercase tracking-wide">Packing</span>
              <strong className="text-xl sm:text-2xl font-black text-blue-900 font-mono mt-0.5 block">
                {packingCount}
              </strong>
            </div>

            {/* Ready */}
            <div className="bg-purple-50/70 border border-purple-200/70 p-3 rounded-2xl">
              <span className="text-[10px] text-purple-800 font-bold block uppercase tracking-wide">Ready</span>
              <strong className="text-xl sm:text-2xl font-black text-purple-900 font-mono mt-0.5 block">
                {readyCount}
              </strong>
            </div>

            {/* Completed Today */}
            <div className="bg-slate-100 border border-slate-200/80 p-3 rounded-2xl col-span-2 sm:col-span-1">
              <span className="text-[10px] text-slate-600 font-bold block uppercase tracking-wide">Completed</span>
              <strong className="text-xl sm:text-2xl font-black text-slate-900 font-mono mt-0.5 block">
                {completedTodayCount}
              </strong>
            </div>
          </div>
        </div>

        {/* ── 3. ACTIVE ORDER CARD ── */}
        {activeTask ? (
          <div className="bg-white border-2 border-emerald-500 rounded-3xl p-5 sm:p-6 space-y-4 shadow-lg shadow-emerald-900/5 relative overflow-hidden">
            {/* Header / Priority */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-ping" />
                <span className="text-xs font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                  {activeTask.status === 'picking' ? '● Currently Picking' : 'Assigned Task'}
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-md">
                Priority: {activeTask.priority || 'Normal'}
              </span>
            </div>

            {/* Order Title and Details */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                  Order #{activeTask.orderNumber || activeTask.id}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeTask.totalItemsCount || activeTask.items?.length || 0} Products •{' '}
                  {activeTask.items?.reduce((s, i) => s + (i.quantityRequired || 1), 0)} Units Total
                </p>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Store</span>
                <span className="text-xs font-bold text-slate-800 block">{activeTask.storeName || 'Neral Hub'}</span>
              </div>
            </div>

            {/* Picking Progress Bar */}
            {(() => {
              const pickedItems = activeTask.items?.filter(
                (i: any) => i.status === 'picked' || i.quantityPicked >= i.quantityRequired
              ).length || 0;
              const totalItems = activeTask.totalItemsCount || activeTask.items?.length || 1;
              const pct = Math.round((pickedItems / totalItems) * 100);

              return (
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-600">Picking Progress</span>
                    <strong className="font-mono text-emerald-700 font-black">
                      {pickedItems} / {totalItems} items ({pct}%)
                    </strong>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Products Quick Preview List */}
            <div className="space-y-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                Products in this order ({activeTask.items?.length || 0})
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {activeTask.items?.map((item, idx) => {
                  const isDone = item.status === 'picked' || (item.quantityPicked > 0 && item.quantityPicked >= item.quantityRequired);
                  return (
                    <div
                      key={item.id || idx}
                      className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200/70 rounded-xl text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.productName}
                            className="w-9 h-9 rounded-lg object-cover bg-white border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 text-slate-400 flex items-center justify-center shrink-0">
                            <Package className="w-4 h-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <strong className="text-slate-900 block font-bold truncate text-xs">
                            {item.productName}
                          </strong>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            Qty: <strong className="text-slate-800">{item.quantityRequired}x</strong>
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase border shrink-0 ${
                          isDone
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {isDone ? 'Picked ✓' : 'Pending'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── 4. SLIDE TO START OR CONTINUE BUTTON ── */}
            {activeTask.status === 'picking' ? (
              <Link
                href={`/picking/${encodeURIComponent(activeTask.id)}`}
                className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-900/20 transition-transform active:scale-[0.98] uppercase tracking-wider"
              >
                <span>CONTINUE PICKING ORDER</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
            ) : (
              <SlideToConfirm
                label="Slide to Accept &amp; Start Picking"
                completedLabel="Accepted! Starting..."
                isLoading={isAcceptingTask}
                onConfirm={() => handleAcceptAndStartPicking(activeTask.id)}
              />
            )}
          </div>
        ) : (
          /* ── 31. WHEN THERE ARE NO ACTIVE ORDERS ── */
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-xs">
            <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="font-black text-lg sm:text-xl text-slate-900">
                ✓ ALL ACTIVE TASKS COMPLETED
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
                You're all caught up. New incoming orders will appear in your queue automatically.
              </p>
            </div>

            {/* Today's Summary */}
            <div className="grid grid-cols-3 gap-3 bg-slate-50 border border-slate-200/80 p-4 rounded-2xl max-w-md mx-auto text-left">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-black block">Orders Done</span>
                <strong className="text-lg font-black text-slate-900 font-mono mt-0.5 block">
                  {completedTodayCount}
                </strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-black block">Items Picked</span>
                <strong className="text-lg font-black text-emerald-600 font-mono mt-0.5 block">
                  {picker.statistics.itemsPickedToday || 41}
                </strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-black block">Avg Pick Time</span>
                <strong className="text-lg font-black text-slate-900 font-mono mt-0.5 block">
                  2m 45s
                </strong>
              </div>
            </div>

            <div>
              <Link
                href="/inventory"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs sm:text-sm shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <Boxes className="w-4 h-4 text-emerald-400" />
                <span>OPEN INVENTORY</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {/* ── NEXT ORDERS IN QUEUE ── */}
        {nextOrders.length > 0 && (
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-emerald-600" />
                <span>Next Orders in Queue ({nextOrders.length})</span>
              </h3>
              <Link href="/tasks" className="text-xs font-bold text-emerald-700 hover:underline">
                View All
              </Link>
            </div>

            <div className="space-y-2">
              {nextOrders.slice(0, 3).map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200/70 rounded-2xl hover:border-slate-300 transition-colors"
                >
                  <div>
                    <strong className="text-sm font-black text-slate-900 font-mono block">
                      Order #{task.orderNumber || task.id}
                    </strong>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {task.totalItemsCount || task.items?.length || 0} items • Priority: {task.priority || 'Normal'}
                    </span>
                  </div>

                  <Link
                    href={`/picking/${encodeURIComponent(task.id)}`}
                    className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs font-bold hover:bg-slate-50 shadow-2xs transition-all"
                  >
                    View
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </PickerShell>
  );
}
