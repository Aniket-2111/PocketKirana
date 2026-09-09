'use client';

import React, { useState, useEffect } from 'react';
import {
  Zap,
  Clock,
  Package,
  Layers,
  Truck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  UserCheck,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

export const DispatchControlCenterView: React.FC = () => {
  const [pipeline, setPipeline] = useState<any[]>([]);
  const [counts, setCounts] = useState<any>({
    urgent: 0,
    picking: 0,
    packing: 0,
    readyForDelivery: 0,
    outForDelivery: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchDispatchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/dispatch', {
        headers: { 'x-pk-role': 'admin', 'x-pk-uid': 'admin_1' },
      });
      const data = await res.json();
      if (data.success) {
        setPipeline(data.activePipeline || []);
        setCounts(data.counts || {});
      }
    } catch (e) {
      console.error('Failed to load dispatch data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDispatchData();
    const interval = setInterval(fetchDispatchData, 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, []);

  const handleReassign = async (orderId: string, taskType: 'PICKER' | 'RIDER') => {
    const newName = prompt(`Enter new ${taskType === 'PICKER' ? 'Picker' : 'Rider'} name:`, 'Assigned Partner');
    if (!newName) return;

    try {
      const res = await fetch('/api/admin/dispatch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-pk-role': 'admin',
          'x-pk-uid': 'admin_1',
        },
        body: JSON.stringify({
          taskType,
          orderId,
          newAssigneeId: `manual_${Date.now()}`,
          newAssigneeName: newName,
          reason: 'Manual Dispatch Override by Store Manager',
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Dispatch assignment updated & audited!', 'success');
        fetchDispatchData();
      } else {
        showToast(data.error || 'Failed to reassign', 'error');
      }
    } catch (e) {
      showToast('Network error during reassignment', 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4">
      {/* 1. Header & Live Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-500 fill-amber-400" />
            Dispatch & Fulfillment Control Center
          </h1>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Intelligent order prioritization, FEFO-protected pick paths, and real-time SLA protection
          </p>
        </div>

        <button
          onClick={fetchDispatchData}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-2xl text-xs font-bold transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Live Pipeline
        </button>
      </div>

      {/* 2. Pipeline Status Counter Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center font-black text-sm shadow-md">
            🔴
          </div>
          <div>
            <span className="text-2xl font-black text-red-900">{counts.urgent}</span>
            <span className="text-xs font-bold text-red-700 block">Urgent / SLA Risk</span>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-md">
            📦
          </div>
          <div>
            <span className="text-2xl font-black text-blue-900">{counts.picking}</span>
            <span className="text-xs font-bold text-blue-700 block">Picking In Progress</span>
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black text-sm shadow-md">
            🎁
          </div>
          <div>
            <span className="text-2xl font-black text-purple-900">{counts.packing}</span>
            <span className="text-xs font-bold text-purple-700 block">Packing Station</span>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-sm shadow-md">
            🛵
          </div>
          <div>
            <span className="text-2xl font-black text-amber-900">{counts.readyForDelivery}</span>
            <span className="text-xs font-bold text-amber-700 block">Ready for Pickup</span>
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-sm shadow-md">
            🚴
          </div>
          <div>
            <span className="text-2xl font-black text-emerald-900">{counts.outForDelivery}</span>
            <span className="text-xs font-bold text-emerald-700 block">Out for Delivery</span>
          </div>
        </div>
      </div>

      {/* 3. Active Fulfillment Pipeline Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-black text-gray-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-600" />
            Live Priority Queue & Assignments
          </h3>
          <span className="text-xs font-semibold text-gray-400">
            {pipeline.length} active orders
          </span>
        </div>

        {pipeline.length === 0 ? (
          <div className="p-8 text-center text-gray-400 font-semibold text-xs">
            No active orders in the pipeline right now.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider border-b border-gray-100">
                <tr>
                  <th className="py-3 px-4">Order</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Priority & SLA</th>
                  <th className="py-3 px-4">Picker</th>
                  <th className="py-3 px-4">Delivery Rider</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {pipeline.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-black text-gray-900">{order.order_number || order.id.slice(0, 8)}</div>
                      <div className="text-[11px] text-gray-400">₹{order.total_amount} • {order.item_count} items</div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-gray-100 text-gray-800">
                        {order.order_status}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            order.priorityLevel === 'URGENT'
                              ? 'bg-red-100 text-red-800'
                              : order.priorityLevel === 'HIGH'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {order.priorityLevel}
                        </span>
                        <span className="text-[11px] text-gray-500 font-bold">
                          ⏱ {order.timeRemainingMinutes}m left
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="text-gray-900 font-bold">
                        {order.picker_name || 'Unassigned'}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="text-gray-900 font-bold">
                        {order.delivery_partner_id || 'Pending Pickup'}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right space-x-1.5">
                      <button
                        onClick={() => handleReassign(order.id, 'PICKER')}
                        className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-[10px] font-bold"
                      >
                        Reassign Picker
                      </button>
                      <button
                        onClick={() => handleReassign(order.id, 'RIDER')}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-bold"
                      >
                        Reassign Rider
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
