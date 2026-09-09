'use client';

import React, { useState, useEffect } from 'react';
import {
  Store,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Truck,
  Package,
  Layers,
  Save,
  RefreshCw,
} from 'lucide-react';
import { DarkstoreCapacityMetrics, StoreOperatingStatus } from '@/lib/storeOperationsService';
import { showToast } from '@/components/ui/Toast';

export const StoreOperationsControlView: React.FC = () => {
  const [metrics, setMetrics] = useState<DarkstoreCapacityMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [status, setStatus] = useState<StoreOperatingStatus>('OPEN');
  const [openingTime, setOpeningTime] = useState('06:00');
  const [closingTime, setClosingTime] = useState('23:30');
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState(5.0);

  const fetchOperations = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/store/operations', {
        headers: { 'x-pk-role': 'admin', 'x-pk-uid': 'admin_1' },
      });
      const data = await res.json();
      if (data.success && data.data) {
        setMetrics(data.data);
        setStatus(data.data.status);
        setOpeningTime(data.data.openingTime);
        setClosingTime(data.data.closingTime);
        setDeliveryRadiusKm(data.data.deliveryRadiusKm);
      }
    } catch (e) {
      console.error('Failed to load store operations', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOperations();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/admin/store/operations', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-pk-role': 'admin',
          'x-pk-uid': 'admin_1',
        },
        body: JSON.stringify({
          status,
          openingTime,
          closingTime,
          deliveryRadiusKm,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMetrics(data.data);
        showToast('Store operational settings updated!', 'success');
      } else {
        showToast(data.error || 'Failed to update store settings', 'error');
      }
    } catch (e) {
      showToast('Network error updating store settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !metrics) {
    return (
      <div className="p-8 text-center space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mx-auto" />
        <p className="text-sm font-semibold text-gray-500">Loading darkstore operational metrics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4">
      {/* 1. Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Store className="w-6 h-6 text-emerald-600" />
            Darkstore Operational Control
          </h1>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Single-store capacity management, operating window, and live fulfillment throttling
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
              status === 'OPEN'
                ? 'bg-emerald-100 text-emerald-800'
                : status === 'HIGH_DEMAND'
                ? 'bg-amber-100 text-amber-800'
                : status === 'PAUSED'
                ? 'bg-orange-100 text-orange-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
            {status}
          </span>
        </div>
      </div>

      {/* 2. Live Capacity Meters */}
      {metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Picker Queue Capacity */}
          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-blue-600" />
                Picking Capacity
              </span>
              <span className="text-xs font-black text-gray-900">
                {metrics.currentActivePicking} / {metrics.maxActivePickingOrders} Active
              </span>
            </div>
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  metrics.pickingCapacityUtilization > 85
                    ? 'bg-red-500'
                    : metrics.pickingCapacityUtilization > 60
                    ? 'bg-amber-500'
                    : 'bg-blue-600'
                }`}
                style={{ width: `${metrics.pickingCapacityUtilization}%` }}
              />
            </div>
            <span className="text-[11px] text-gray-400 font-medium block">
              {metrics.pickingCapacityUtilization}% queue utilization
            </span>
          </div>

          {/* Packing Queue Capacity */}
          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-purple-600" />
                Packing Capacity
              </span>
              <span className="text-xs font-black text-gray-900">
                {metrics.currentActivePacking} / {metrics.maxActivePackingOrders} Active
              </span>
            </div>
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  metrics.packingCapacityUtilization > 85
                    ? 'bg-red-500'
                    : metrics.packingCapacityUtilization > 60
                    ? 'bg-amber-500'
                    : 'bg-purple-600'
                }`}
                style={{ width: `${metrics.packingCapacityUtilization}%` }}
              />
            </div>
            <span className="text-[11px] text-gray-400 font-medium block">
              {metrics.packingCapacityUtilization}% packing station load
            </span>
          </div>

          {/* Delivery Fleet in Flight */}
          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-emerald-600" />
                Riders in Transit
              </span>
              <span className="text-xs font-black text-emerald-700">
                {metrics.currentOutForDelivery} En Route
              </span>
            </div>
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, metrics.currentOutForDelivery * 10)}%` }}
              />
            </div>
            <span className="text-[11px] text-gray-400 font-medium block">
              Live orders being delivered right now
            </span>
          </div>
        </div>
      )}

      {/* 3. Operational Settings Form */}
      <form onSubmit={handleSave} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6">
        <h3 className="text-base font-black text-gray-900">Configure Darkstore Operational Parameters</h3>

        {/* Operating Status Selector */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Store Status</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { val: 'OPEN', label: '🟢 Open & Active', desc: 'Accepting all orders normally' },
              { val: 'HIGH_DEMAND', label: '🟡 High Demand', desc: 'Slight delivery buffer (15-20 min)' },
              { val: 'PAUSED', label: '⏸️ Paused', desc: 'Temporary checkout hold' },
              { val: 'CLOSED', label: '🔴 Closed', desc: 'After hours / maintenance' },
            ].map((opt) => (
              <button
                type="button"
                key={opt.val}
                onClick={() => setStatus(opt.val as StoreOperatingStatus)}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  status === opt.val
                    ? 'border-emerald-500 bg-emerald-50/50 shadow-sm ring-2 ring-emerald-500/20'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-bold text-xs text-gray-900">{opt.label}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Operating Window & Delivery Radius */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              Opening Time
            </label>
            <input
              type="time"
              value={openingTime}
              onChange={(e) => setOpeningTime(e.target.value)}
              className="w-full text-xs font-bold border border-gray-300 rounded-xl px-3 py-2.5 focus:outline-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              Closing Time
            </label>
            <input
              type="time"
              value={closingTime}
              onChange={(e) => setClosingTime(e.target.value)}
              className="w-full text-xs font-bold border border-gray-300 rounded-xl px-3 py-2.5 focus:outline-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-gray-400" />
              Delivery Radius ({deliveryRadiusKm} km)
            </label>
            <input
              type="range"
              min="1"
              max="15"
              step="0.5"
              value={deliveryRadiusKm}
              onChange={(e) => setDeliveryRadiusKm(parseFloat(e.target.value))}
              className="w-full accent-emerald-600 mt-2"
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-3 border-t border-gray-100 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving Settings...' : 'Save Operational Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};
