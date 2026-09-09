'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import PickerShell from '../../components/PickerShell';
import { 
  Package, 
  ChevronRight, 
  Filter, 
  Clock, 
  AlertTriangle,
  Play
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

type TaskFilter = 'all' | 'assigned' | 'picking' | 'packing' | 'packed';

export default function TasksQueue() {
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
  };

  const [activeFilter, setActiveFilter] = useState<TaskFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Deduplicate tasks by order number / order ID so no order appears twice
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
    const finishedStatuses = ['CANCELLED', 'DELIVERED', 'COMPLETED', 'HANDED_OVER', 'OUT_FOR_DELIVERY', 'PICKED_UP', 'READY_FOR_PICKUP'];
    if (!finishedStatuses.includes(statusUpper) && !taskMap.has(key)) {
      taskMap.set(key, {
        id: `task-${o.id}`,
        orderId: o.id,
        orderNumber: o.orderNumber,
        storeId: o.storeId || 'store-001',
        storeName: 'PocketKirana Neral Hub',
        status: statusUpper === 'PACKED' ? 'packed' : statusUpper === 'PICKING' ? 'picking' : 'assigned',
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
          quantityPicked: statusUpper === 'PACKED' ? it.quantity : 0,
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
          status: statusUpper === 'PACKED' ? 'picked' : 'pending'
        })),
        totalItemsCount: (o.items || []).length,
        pickedItemsCount: statusUpper === 'PACKED' ? (o.items || []).length : 0,
        createdAt: o.placedAt || new Date().toISOString()
      });
    }
  });

  const effectiveTasks = Array.from(taskMap.values());

  const filteredTasks = effectiveTasks.filter((task) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = task.orderNumber.toLowerCase().includes(q);
      const matchId = task.orderId.toLowerCase().includes(q);
      const matchStatus = task.status.toLowerCase().includes(q);
      if (!matchNum && !matchId && !matchStatus) return false;
    }
    const status = (task.status || '').toLowerCase();
    if (activeFilter === 'all') {
      return status !== 'packed' && status !== 'handed_over' && status !== 'completed';
    }
    if (activeFilter === 'assigned') {
      return status === 'assigned' || status === 'pending' || status === 'created' || status === 'confirmed' || status === 'placed';
    }
    if (activeFilter === 'packed') {
      return status === 'packed' || status === 'ready';
    }
    return status === activeFilter;
  });

  const handleOpenTask = async (taskId: string, status: string) => {
    try {
      if (status === 'assigned' || status === 'pending' || status === 'created' || status === 'confirmed' || status === 'placed') {
        const acceptRes = acceptOrderTask(taskId, picker.id);
        if (!acceptRes.success) {
          showToast(acceptRes.message, 'error');
          return;
        }
        startPickingTask(taskId, picker.id);
        showToast('Order opened! Starting one-by-one packing...', 'success');
        router.push(`/picking/${taskId}`);
        return;
      }
      
      if (status === 'packing' || status === 'packed') {
        router.push(`/packing/${taskId}`);
      } else {
        router.push(`/picking/${taskId}`);
      }
    } catch (err: any) {
      showToast('Failed to accept or open task', 'error');
    }
  };

  const filterTabs: { label: string; value: TaskFilter }[] = [
    { label: 'All Active', value: 'all' },
    { label: 'New', value: 'assigned' },
    { label: 'Picking', value: 'picking' },
    { label: 'Packing', value: 'packing' },
    { label: 'Ready', value: 'packed' },
  ];

  return (
    <PickerShell>
      <div className="space-y-4 animate-in fade-in duration-200 text-slate-900 font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h1 className="text-xl font-black text-slate-900">Orders Queue</h1>
            <span className="text-xs text-slate-500 mt-1 block font-bold">
              Active assignments for {picker.storeName || 'MG Road Store'}
            </span>
          </div>
          <span className="bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl text-xs font-mono text-emerald-800 font-bold">
            {filteredTasks.length} Tasks
          </span>
        </div>

        {/* Search Input Bar */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search order #, ID, or status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-4 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-slate-900 text-xs font-mono placeholder-slate-400 focus:outline-none focus:border-emerald-600 transition-colors shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-3 text-xs text-slate-400 hover:text-slate-900 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Scrollable Row */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 shrink-0 scrollbar-none">
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all shrink-0 cursor-pointer ${
                activeFilter === tab.value
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-emerald-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Queue List */}
        {filteredTasks.length > 0 ? (
          <div className="space-y-3">
            {filteredTasks.map((task) => {
              const totalItemsCount = task.items?.reduce((sum: number, i: any) => sum + (i.quantityRequired || 1), 0) || task.totalItemsCount || 0;
              const productsCount = task.items?.length || task.totalItemsCount || 0;

              return (
                <div
                  key={task.id}
                  className="bg-white border border-slate-200/90 rounded-[24px] p-5 space-y-4 shadow-xs transition-all hover:border-emerald-300"
                >
                  {/* Status Strip */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest block">
                        NEW ORDER
                      </span>
                      <strong className="text-base font-black text-slate-900 block mt-0.5">
                        Order #{task.orderNumber}
                      </strong>
                    </div>

                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase border ${
                      task.status === 'packed'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : task.status === 'packing' || task.status === 'picking'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}>
                      {task.status}
                    </span>
                  </div>

                  {/* Order Specifications */}
                  <div className="flex items-center justify-between text-xs bg-slate-50 p-3 rounded-2xl border border-slate-200 font-bold">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Products</span>
                      <strong className="text-slate-900 block mt-0.5">{productsCount} Products</strong>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Total Items</span>
                      <strong className="text-emerald-800 font-mono block mt-0.5">{totalItemsCount} Items</strong>
                    </div>

                    <div className="text-right">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Placed</span>
                      <span className="text-slate-700 font-mono block mt-0.5">
                        {new Date(task.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {/* Main Action trigger */}
                  <button
                    onClick={() => handleOpenTask(task.id, task.status)}
                    className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-600/20 cursor-pointer uppercase tracking-wider"
                  >
                    <span>OPEN ORDER</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          /* Empty Queue */
          <div className="bg-white border border-slate-200 rounded-[28px] p-8 text-center space-y-3 shadow-xs">
            <div className="w-14 h-14 rounded-full bg-slate-50 border border-slate-200 text-slate-400 flex items-center justify-center mx-auto">
              <Filter className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">No active orders</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                There are no active orders matching the selected filter (**{activeFilter}**).
              </p>
            </div>
          </div>
        )}

      </div>
    </PickerShell>
  );
}
