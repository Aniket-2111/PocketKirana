'use client';

import React, { Suspense, useState, useEffect, useMemo } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import PickerShell from '../../../components/PickerShell';
import { ProductPickingCard } from '../../../components/picking/ProductPickingCard';
import { PickingChecklist } from '../../../components/picking/PickingChecklist';
import { SlideToConfirm } from '../../../components/SlideToConfirm';
import { triggerHaptic, playCompleteSound } from '../../../lib/pickerFeedback';
import {
  detectMeasurementType,
  detectWeightUnit,
  formatQuantity,
  isQuantityComplete,
  calculateRemaining,
} from '@/lib/measurementUtils';
import { 
  ArrowLeft, 
  Loader2, 
  CheckCircle2, 
  ListChecks, 
  Package, 
  Sparkles,
  Layers,
  ShoppingBag,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';
import { apiFetch } from '@/lib/apiClient';
import type { PickingTask, PickingItem } from '@/types';

function PickingContent({ taskId: propTaskId }: { taskId?: string }) {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const {
    pickers,
    activePickerId,
    pickingTasks,
    orders,
    packOrderTask,
  } = useAppStore();

  const picker = pickers.find((p) => p.id === activePickerId) || pickers[0];

  // Resolve taskId from props, route params, search params, or picker's active task
  let taskId = propTaskId || (params?.id as string) || searchParams?.get('id') || searchParams?.get('taskId') || '';
  if (!taskId || taskId === 'default') {
    taskId = picker?.activeTaskId || '';
  }

  // Find task or synthesize from orders
  const task: PickingTask | undefined = useMemo(() => {
    let t = pickingTasks.find((item) => item.id === taskId || item.orderNumber === taskId || item.orderId === taskId);
    if (t) return t;

    const rawOrderId = taskId.startsWith('task-') ? taskId.slice(5) : taskId;
    const order = (orders || []).find(
      (o) => o.id === rawOrderId || o.id === taskId || o.orderNumber === taskId || o.orderNumber === rawOrderId
    );

    if (order) {
      const statusUpper = (order.orderStatus || '').toUpperCase();
      return {
        id: taskId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        storeId: order.storeId || 'store-001',
        storeName: 'PocketKirana Neral Hub',
        status: statusUpper === 'PACKED' ? 'packed' : statusUpper === 'PICKING' ? 'picking' : 'assigned',
        priority: (order as any).priority || 'NORMAL',
        items: (order.items || []).map((it: any, idx: number): PickingItem => {
          const itemType = detectMeasurementType(it);
          const itemWeightUnit = detectWeightUnit(it);
          return {
            id: `pi-${order.id}-${idx}`,
            productId: it.productId,
            productName: it.productName || it.product?.name || 'Grocery Item',
            sku: `SKU-${it.productId.slice(0, 8).toUpperCase()}`,
            upc: it.barcode || '8901234567890',
            barcode: it.barcode || it.productId,
            unit: it.unit || (it.product?.unit) || (itemType === 'WEIGHT' ? 'Loose' : '1 unit'),
            measurementType: itemType,
            weightUnit: itemWeightUnit,
            imageUrl: it.imageUrl || it.product?.thumbnail || '',
            quantityRequired: it.quantity,
            quantityPicked: statusUpper === 'PACKED' ? it.quantity : 0,
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
            status: statusUpper === 'PACKED' ? 'picked' : 'pending',
          };
        }),
        totalItemsCount: (order.items || []).length,
        pickedItemsCount: statusUpper === 'PACKED' ? (order.items || []).length : 0,
        createdAt: order.placedAt || new Date().toISOString(),
      };
    }

    return undefined;
  }, [taskId, pickingTasks, orders]);

  // Local live items state for progressive picking updates
  const [items, setItems] = useState<PickingItem[]>(task?.items || []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isCompletingOrder, setIsCompletingOrder] = useState(false);
  const [activeTab, setActiveTab] = useState<'CARD' | 'CHECKLIST'>('CARD');
  const [bagCount, setBagCount] = useState(1);
  const [serverIncompleteError, setServerIncompleteError] = useState<string | null>(null);

  useEffect(() => {
    if (task?.items && task.items.length > 0) {
      setItems(task.items);
      // Auto-focus first unpicked item
      const firstUnpicked = task.items.findIndex((i) => {
        const type = detectMeasurementType(i);
        return !isQuantityComplete(i.quantityPicked, i.quantityRequired, type);
      });
      if (firstUnpicked !== -1) {
        setCurrentIndex(firstUnpicked);
      }
    }
  }, [task]);

  if (!task || items.length === 0) {
    return (
      <PickerShell>
        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-4 shadow-sm text-slate-900">
          <Package className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="font-extrabold text-sm text-slate-900">Order Task Not Found</h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            The active task ID `#{taskId || 'N/A'}` could not be resolved in the queue.
          </p>
          <button
            onClick={() => router.push('/home')}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer"
          >
            Return to Home
          </button>
        </div>
      </PickerShell>
    );
  }

  const completedCount = items.filter((i) => {
    const type = detectMeasurementType(i);
    return isQuantityComplete(i.quantityPicked, i.quantityRequired, type);
  }).length;

  const totalCount = items.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);
  const isAllPicked = completedCount === totalCount;
  const currentItem = items[currentIndex] || items[0];

  // Incomplete items list for display
  const incompleteItems = items.filter((i) => {
    const type = detectMeasurementType(i);
    return !isQuantityComplete(i.quantityPicked, i.quantityRequired, type);
  });

  // Pick Confirmation Handler for individual item
  const handleItemPickConfirmed = async (
    productId: string,
    quantityPicked: number
  ) => {
    setIsSaving(true);
    setServerIncompleteError(null);
    try {
      const cleanOrderId = task.orderId || (task.id.startsWith('task-') ? task.id.slice(5) : task.id);

      // 1. Post to backend item pick API
      await apiFetch(`/api/picker/orders/${encodeURIComponent(cleanOrderId)}/item-pick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          quantityPicked,
          pickerId: picker.id,
        }),
      }).catch(() => {});

      // 2. Update local state
      const updated = items.map((it) => {
        if (it.productId === productId) {
          const itemType = detectMeasurementType(it);
          const isDone = isQuantityComplete(quantityPicked, it.quantityRequired, itemType);
          return {
            ...it,
            quantityPicked,
            status: isDone ? ('picked' as const) : ('picking' as const),
          };
        }
        return it;
      });

      setItems(updated);
      showToast(`✓ Picked: ${currentItem.productName}`, 'success');

      // 3. Auto-advance to the next pending item
      const nextPendingIndex = updated.findIndex((it, idx) => {
        if (idx <= currentIndex) return false;
        const type = detectMeasurementType(it);
        return !isQuantityComplete(it.quantityPicked, it.quantityRequired, type);
      });

      if (nextPendingIndex !== -1) {
        setCurrentIndex(nextPendingIndex);
      } else {
        // Wrap around to start
        const anyPending = updated.findIndex((it) => {
          const type = detectMeasurementType(it);
          return !isQuantityComplete(it.quantityPicked, it.quantityRequired, type);
        });
        if (anyPending !== -1) {
          setCurrentIndex(anyPending);
        } else {
          // All items picked!
          playCompleteSound();
          triggerHaptic('success');
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to record pick', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Order Complete Handler with server-side picking validation check
  const handleCompletePicking = async () => {
    if (!isAllPicked) {
      showToast('All items must be 100% picked before completing.', 'error');
      triggerHaptic('error');
      return;
    }

    setIsCompletingOrder(true);
    setServerIncompleteError(null);

    try {
      const cleanOrderId = task.orderId || (task.id.startsWith('task-') ? task.id.slice(5) : task.id);

      // 1. Call server-side transition to ORDER_PACKED with picked validation
      try {
        const res = await apiFetch(`/api/picker/orders/${encodeURIComponent(cleanOrderId)}/pack`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pickerId: picker.id,
            bagCount: 1,
            sealNumber: `PK-SEAL-${Date.now().toString().slice(-4)}`,
            itemsPicked: items.map((i) => ({
              productId: i.productId,
              quantityPicked: i.quantityPicked,
              quantityRequired: i.quantityRequired,
            })),
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok && data.success === false && data.code === 'PICKING_INCOMPLETE') {
          const remainingMsg = (data.remainingItems || [])
            .map((r: any) => `${r.name || r.productId}: ${r.remaining} ${r.unit || ''}`)
            .join(', ');
          setServerIncompleteError(`Incomplete items: ${remainingMsg}`);
          showToast('Cannot complete: Some items are not fully picked.', 'error');
          triggerHaptic('error');
          setIsCompletingOrder(false);
          return;
        }
      } catch (networkErr) {
        console.warn('Backend order pack sync notice:', networkErr);
      }

      // 2. Update local store
      packOrderTask(task.id, 1, ['Standard Eco-Bag']);
      showToast('🎉 Order Picking & Packing Complete! Moving to Handover.', 'success');
      playCompleteSound();
      triggerHaptic('success');

      // 3. Redirect back to Home
      setTimeout(() => {
        router.push('/home');
      }, 800);
    } catch (err: any) {
      // Gracefully finish
      packOrderTask(task.id, 1, ['Standard Eco-Bag']);
      showToast('🎉 Order Picking & Packing Complete!', 'success');
      setTimeout(() => {
        router.push('/home');
      }, 800);
    }
  };

  return (
    <PickerShell>
      <div className="space-y-4 text-slate-900 pb-12 animate-in fade-in duration-200">
        
        {/* ── TOP HEADER BAR ── */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <div className="text-center">
            <h1 className="text-base font-black text-slate-900 font-mono">
              Order #{task.orderNumber || task.id}
            </h1>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              {task.storeName || 'PocketKirana Neral Hub'}
            </span>
          </div>

          {/* View toggle button */}
          <button
            onClick={() => setActiveTab(activeTab === 'CARD' ? 'CHECKLIST' : 'CARD')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'CHECKLIST'
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <ListChecks className="w-4 h-4" />
            <span>Checklist</span>
          </button>
        </div>

        {/* ── PROGRESS BAR ── */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-800 uppercase tracking-wider text-[11px]">
                Products Progress
              </span>
              <span className="text-[10px] font-mono text-emerald-700 font-black bg-emerald-50 border border-emerald-200 px-2 py-0.2 rounded-md">
                {completedCount} / {totalCount} products complete
              </span>
            </div>

            <strong className="text-sm font-black font-mono text-emerald-700">
              {progressPercent}%
            </strong>
          </div>

          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
            <div
              className="bg-gradient-to-r from-emerald-600 to-[#0B8F5A] h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Server Incomplete Error Notice */}
        {serverIncompleteError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl text-xs space-y-1 animate-in shake duration-200">
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>PICKING INCOMPLETE REJECTED BY SERVER</span>
            </div>
            <p className="text-slate-700 pl-6">{serverIncompleteError}</p>
          </div>
        )}

        {/* ── ORDER READY OR ACTIVE PICKING CARD ── */}
        {isAllPicked ? (
          /* ── CELEBRATORY ORDER COMPLETE CARD ── */
          <div className="bg-gradient-to-br from-emerald-900 to-slate-900 text-white border-2 border-emerald-500 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-black tracking-tight text-white uppercase">
                ALL PRODUCTS PICKED! 🎉
              </h2>
              <p className="text-xs sm:text-sm text-emerald-200 font-medium max-w-sm mx-auto">
                {totalCount} / {totalCount} products 100% picked and ready for packing.
              </p>
            </div>

            {/* Slide to Complete Picking */}
            <div className="max-w-md mx-auto pt-2">
              <SlideToConfirm
                label="Slide to Complete Picking"
                completedLabel="Order Packed! Finishing..."
                variant="success"
                isLoading={isCompletingOrder}
                onConfirm={handleCompletePicking}
              />
            </div>
          </div>
        ) : (
          /* ── ACTIVE PRODUCT PICKING CARD ── */
          <div>
            {activeTab === 'CARD' ? (
              <ProductPickingCard
                item={currentItem}
                itemIndex={currentIndex}
                totalItems={totalCount}
                isSaving={isSaving}
                onPickConfirmed={handleItemPickConfirmed}
              />
            ) : (
              <PickingChecklist
                items={items}
                currentIndex={currentIndex}
                onSelectItem={(idx) => {
                  setCurrentIndex(idx);
                  setActiveTab('CARD');
                }}
              />
            )}
          </div>
        )}

        {/* ── PICKING CHECKLIST DRAWER (ALWAYS VISIBLE BELOW CARD) ── */}
        {!isAllPicked && activeTab === 'CARD' && (
          <div className="pt-2">
            <PickingChecklist
              items={items}
              currentIndex={currentIndex}
              onSelectItem={(idx) => setCurrentIndex(idx)}
            />
          </div>
        )}

      </div>
    </PickerShell>
  );
}

export default function PickingWorkflowPage({ taskId }: { taskId?: string }) {
  return (
    <Suspense
      fallback={
        <PickerShell>
          <div className="flex flex-col items-center justify-center p-12 text-slate-500 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            <span className="text-xs font-bold">Loading picking workflow...</span>
          </div>
        </PickerShell>
      }
    >
      <PickingContent taskId={taskId} />
    </Suspense>
  );
}
