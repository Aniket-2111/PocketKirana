'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import PickerShell from '../../../components/PickerShell';
import { OneByOnePackingWorkflow } from '@/components/picker/OneByOnePackingWorkflow';
import { ArrowLeft, Loader2 } from 'lucide-react';
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
    verifyOrderHandover,
    scanProductItem,
  } = useAppStore();

  const picker = pickers.find((p) => p.id === activePickerId) || pickers[0];

  // Resolve taskId from props, route params, search params, or picker's active task
  let taskId = propTaskId || (params?.id as string) || searchParams?.get('id') || searchParams?.get('taskId') || '';
  if (!taskId || taskId === 'default') {
    taskId = picker?.activeTaskId || '';
  }

  // Find in real pickingTasks first, then synthesise from orders
  let task: PickingTask | undefined = pickingTasks.find(
    (t) => t.id === taskId || t.orderNumber === taskId || t.orderId === taskId
  );

  if (!task && taskId) {
    const rawOrderId = taskId.startsWith('task-') ? taskId.slice(5) : taskId;
    const order = (orders || []).find(
      (o) => o.id === rawOrderId || o.id === taskId || o.orderNumber === taskId || o.orderNumber === rawOrderId
    );
    if (order) {
      const statusUpper = (order.orderStatus || '').toUpperCase();
      task = {
        id: taskId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        storeId: order.storeId || 'store-001',
        storeName: 'PocketKirana Neral Hub',
        status: statusUpper === 'PACKED' ? 'packed' : statusUpper === 'PICKING' ? 'picking' : 'assigned',
        priority: 'NORMAL',
        items: (order.items || []).map((it: any, idx: number): PickingItem => ({
          id: `pi-${order.id}-${idx}`,
          productId: it.productId,
          productName: it.productName || it.product?.name || 'Grocery Item',
          sku: `SKU-${it.productId.slice(0, 8).toUpperCase()}`,
          upc: it.barcode || '8901234567890',
          barcode: it.barcode || it.productId,
          unit: it.unit || '1 pack',
          imageUrl: it.imageUrl || it.product?.thumbnail || '',
          quantityRequired: it.quantity,
          quantityPicked: statusUpper === 'PACKED' ? it.quantity : 0,
          storageLocation: {
            id: 'loc-1',
            storeId: 'store-001',
            aisle: 'A',
            rack: '01',
            shelf: 'A',
            bin: '01',
            barcode: 'LOC-A01A01',
            displayCode: 'A-01-A-01',
          },
          status: statusUpper === 'PACKED' ? 'picked' : 'pending',
        })),
        totalItemsCount: (order.items || []).length,
        pickedItemsCount: statusUpper === 'PACKED' ? (order.items || []).length : 0,
        createdAt: order.placedAt || new Date().toISOString(),
      };
    }
  }

  // Fallback: If still not found, check if there is an active picking task in pickingTasks or orders
  if (!task) {
    task = pickingTasks.find(t => t.status === 'picking' || t.status === 'assigned');
    if (!task && orders && orders.length > 0) {
      const pendingOrder = orders.find(o => {
        const s = (o.orderStatus || '').toUpperCase();
        return s === 'CONFIRMED' || s === 'PLACED' || s === 'ASSIGNED' || s === 'PICKING';
      });
      if (pendingOrder) {
        task = {
          id: `task-${pendingOrder.id}`,
          orderId: pendingOrder.id,
          orderNumber: pendingOrder.orderNumber,
          storeId: pendingOrder.storeId || 'store-001',
          storeName: 'PocketKirana Neral Hub',
          status: 'picking',
          priority: 'NORMAL',
          items: (pendingOrder.items || []).map((it: any, idx: number): PickingItem => ({
            id: `pi-${pendingOrder.id}-${idx}`,
            productId: it.productId,
            productName: it.productName || it.product?.name || 'Grocery Item',
            sku: `SKU-${it.productId.slice(0, 8).toUpperCase()}`,
            upc: it.barcode || '8901234567890',
            barcode: it.barcode || it.productId,
            unit: it.unit || '1 pack',
            imageUrl: it.imageUrl || it.product?.thumbnail || '',
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
              displayCode: 'A-01-A-01',
            },
            status: 'pending',
          })),
          totalItemsCount: (pendingOrder.items || []).length,
          pickedItemsCount: 0,
          createdAt: pendingOrder.placedAt || new Date().toISOString(),
        };
      }
    }
  }

  if (!task) {
    return (
      <PickerShell>
        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-4 shadow-sm text-slate-900">
          <h3 className="font-extrabold text-sm text-slate-900">Order Task Not Found</h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            The active task ID `#{taskId || 'N/A'}` could not be resolved in the queue.
          </p>
          <button
            onClick={() => router.push('/home')}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-bold rounded-xl text-slate-700 cursor-pointer"
          >
            Return to Home
          </button>
        </div>
      </PickerShell>
    );
  }

  const handlePackProductDone = async (tId: string, productId: string) => {
    try {
      const cleanTaskId = tId.startsWith('task-') ? tId.slice(5) : tId;
      await fetch(`/api/picking/tasks/${cleanTaskId}/items/${productId}/pick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 1, status: 'picked' }),
      });
    } catch (e) {
      console.warn('API pick call fallback:', e);
    }
    if (typeof scanProductItem === 'function') {
      const res = scanProductItem(tId, productId, productId);
      return res?.success ?? true;
    }
    return true;
  };

  const handleCompleteOrderPacked = async (tId: string, bagsCount: number, bagTypes: string[]) => {
    try {
      const cleanTaskId = tId.startsWith('task-') ? tId.slice(5) : tId;
      await fetch(`/api/picking/tasks/${cleanTaskId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: `Picked and packed in ${bagsCount} bags (${bagTypes.join(', ')})` }),
      });
    } catch (e) {
      console.warn('API picking complete call fallback:', e);
    }
    if (typeof packOrderTask === 'function') {
      packOrderTask(tId, bagsCount, bagTypes);
    }
  };

  return (
    <PickerShell>
      <div className="space-y-4 text-slate-900">
        {/* Back Link */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer group pb-2"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back</span>
        </button>

        <OneByOnePackingWorkflow
          task={task}
          onPackProductDone={handlePackProductDone}
          onCompleteOrderPacked={handleCompleteOrderPacked}
          onReturnToQueue={() => router.push('/home')}
        />
      </div>
    </PickerShell>
  );
}

export default function PickingClient({ taskId }: { taskId?: string }) {
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
