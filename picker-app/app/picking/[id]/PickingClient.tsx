'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import PickerShell from '../../../components/PickerShell';
import { OneByOnePackingWorkflow } from '@/components/picker/OneByOnePackingWorkflow';
import { ArrowLeft } from 'lucide-react';
import type { PickingTask, PickingItem } from '@/types';

export default function PickingClient({ taskId: propTaskId }: { taskId?: string }) {
  const router = useRouter();
  const params = useParams();
  const taskId = propTaskId || (params?.id as string) || 'default';

  const {
    pickingTasks,
    orders,
    packOrderTask,
    verifyOrderHandover,
    scanProductItem,
  } = useAppStore();

  // Find in real pickingTasks first, then synthesise from orders
  let task: PickingTask | undefined = pickingTasks.find(
    (t) => t.id === taskId || t.orderNumber === taskId || t.orderId === taskId
  );

  if (!task) {
    const orderId = taskId.startsWith('task-') ? taskId.slice(5) : taskId;
    const order = (orders || []).find(
      (o) => o.id === orderId || o.id === taskId || o.orderNumber === taskId || o.orderNumber === orderId
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

  if (!task) {
    return (
      <PickerShell>
        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-4 shadow-sm text-slate-900">
          <h3 className="font-extrabold text-sm text-slate-900">Order Task Not Found</h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            The active task ID `#{taskId}` could not be resolved in the queue.
          </p>
          <button
            onClick={() => router.push('/tasks')}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-bold rounded-xl text-slate-700 cursor-pointer"
          >
            Return to Tasks Queue
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

  const handleVerifyHandover = (orderNumber: string, partnerId: string) => {
    return verifyOrderHandover(orderNumber, partnerId);
  };

  return (
    <PickerShell>
      <div className="space-y-4 text-slate-900">
        {/* Back Link */}
        <button
          onClick={() => router.push('/tasks')}
          className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer group pb-2"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Tasks Queue</span>
        </button>

        <OneByOnePackingWorkflow
          task={task}
          onPackProductDone={handlePackProductDone}
          onCompleteOrderPacked={handleCompleteOrderPacked}
          onReturnToQueue={() => router.push('/tasks')}
        />
      </div>
    </PickerShell>
  );
}
