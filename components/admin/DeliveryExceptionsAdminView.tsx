'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  Phone,
  MapPin,
  RefreshCw,
  Truck,
  RotateCcw,
  Search,
  ExternalLink,
  ShieldCheck,
  FileWarning
} from 'lucide-react';
import { DeliveryExceptionRecord } from '@/types';
import { showToast } from '@/components/ui/Toast';

export function DeliveryExceptionsAdminView() {
  const [exceptions, setExceptions] = useState<DeliveryExceptionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadExceptions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/delivery-exceptions');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setExceptions(json.data);
      }
    } catch (err: any) {
      showToast('Failed to load delivery exceptions', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExceptions();
  }, []);

  const filtered = exceptions.filter(
    (e) =>
      e.orderNumber?.toLowerCase().includes(search.toLowerCase()) ||
      e.reason?.toLowerCase().includes(search.toLowerCase()) ||
      e.deliveryPartnerName?.toLowerCase().includes(search.toLowerCase()) ||
      e.partnerName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <FileWarning className="w-5 h-5 text-amber-600" />
            <span>Delivery Exceptions & Failed Attempts</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time audit log of customer unreachable attempts, door locks, and failed deliveries
          </p>
        </div>

        <button
          onClick={loadExceptions}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl active:scale-95 transition-all cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by Order #, Rider, Reason..."
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none focus:border-emerald-500"
        />
      </div>

      {/* Exception Cards List */}
      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500">Loading delivery exceptions…</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-800 dark:text-white">No delivery exceptions found</p>
          <p className="text-xs text-slate-500 mt-1">All deliveries completed smoothly without exceptions.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((exc) => (
            <div
              key={exc.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-black text-slate-900 dark:text-white">
                    Order #{exc.orderNumber}
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    Rider: <strong className="text-slate-800 dark:text-slate-200">{exc.deliveryPartnerName || exc.partnerName || 'Assigned Rider'}</strong>
                  </span>
                </div>
                <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-full text-[10px] font-bold">
                  {exc.status || 'RETURN_INITIATED'}
                </span>
              </div>

              {/* Reason Box */}
              <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 rounded-xl text-xs">
                <p className="font-bold text-amber-900 dark:text-amber-200">{exc.reason}</p>
                {exc.notes && <p className="text-[11px] text-amber-800 dark:text-amber-400 mt-0.5">{exc.notes}</p>}
              </div>

              {/* Metrics (Calls, Arrived Time, Coordinates) */}
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl">
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Calls: <strong>{exc.callAttempts || 0} attempted</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  <span>Waited: <strong>{Math.round((exc.waitingSeconds || 0) / 60)} mins</strong></span>
                </div>
                {exc.latitude && exc.longitude && (
                  <div className="col-span-2 flex items-center gap-1.5 text-slate-500">
                    <MapPin className="w-3.5 h-3.5 text-rose-500" />
                    <span>GPS: {Number(exc.latitude).toFixed(4)}, {Number(exc.longitude).toFixed(4)}</span>
                  </div>
                )}
              </div>

              <div className="text-[10px] text-slate-400 pt-1">
                Recorded: {new Date(exc.createdAt || (exc as any).failedAt || Date.now()).toLocaleString('en-IN')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
