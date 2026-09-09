'use client';

import React, { useState, useEffect } from 'react';
import {
  History,
  RefreshCw,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  Tag,
  Package,
} from 'lucide-react';

export function InventoryLedgerView() {
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [eventTypeFilter, setEventTypeFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadLedger();
  }, [eventTypeFilter]);

  async function loadLedger() {
    setIsLoading(true);
    try {
      const url = eventTypeFilter === 'ALL'
        ? '/api/inventory/events?limit=100'
        : `/api/inventory/events?event_type=${eventTypeFilter}&limit=100`;

      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setEvents(json.data || []);
      }
    } catch (err) {
      console.warn('Error loading inventory ledger:', err);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredEvents = events.filter(
    (ev) =>
      ev.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.reference_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.event_type?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getEventBadge = (type: string) => {
    switch (type) {
      case 'RECEIVED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'RESERVED':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'PICKED':
      case 'SOLD':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'DAMAGED':
      case 'EXPIRED':
      case 'DISPOSED':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            <span>Immutable Inventory Audit Ledger</span>
          </h2>
          <p className="text-xs text-slate-500">
            Append-only transactional log tracking every unit received, reserved, picked, sold, or disposed
          </p>
        </div>

        <button
          onClick={loadLedger}
          className="p-2 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl transition-colors shadow-2xs self-start"
          title="Refresh Ledger"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search by product, SKU, reference ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl py-2 pl-8 pr-3 focus:bg-white focus:outline-none"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
          <span className="text-slate-500 pr-1">Type:</span>
          {(['ALL', 'RECEIVED', 'RESERVED', 'PICKED', 'SOLD', 'DISPOSED'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setEventTypeFilter(t)}
              className={`px-2.5 py-1 rounded-lg transition-all border text-[11px] ${
                eventTypeFilter === t
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-black tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Event ID & Time</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Product & SKU</th>
                <th className="py-3 px-4 text-right">Quantity</th>
                <th className="py-3 px-4 text-right">Balance After</th>
                <th className="py-3 px-4">Reference & Notes</th>
                <th className="py-3 px-4">Operator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
                    Loading PostgreSQL inventory events ledger...
                  </td>
                </tr>
              ) : filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No ledger records match the selected query.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((ev, idx) => (
                  <tr key={ev.id || idx} className="hover:bg-slate-50/80 transition-colors font-mono">
                    <td className="py-3 px-4">
                      <strong className="text-slate-900 block font-bold">#{ev.id}</strong>
                      <span className="text-[10px] text-slate-400 font-sans">
                        {new Date(ev.created_at).toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-md border text-[10px] font-black uppercase inline-block ${getEventBadge(
                          ev.event_type
                        )}`}
                      >
                        {ev.event_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <strong className="text-slate-900 block">{ev.product_name || 'Product Variant'}</strong>
                      <span className="text-[10px] text-slate-500 font-mono">{ev.sku || ev.variant_id}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-black text-sm">
                      <span
                        className={
                          ev.event_type === 'RECEIVED' || ev.event_type === 'RETURNED'
                            ? 'text-emerald-600'
                            : 'text-slate-900'
                        }
                      >
                        {ev.event_type === 'RECEIVED' || ev.event_type === 'RETURNED' ? `+${ev.quantity}` : `-${ev.quantity}`}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-700">
                      {ev.balance_after !== null ? ev.balance_after : '—'}
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-600">
                      {ev.reference_type && (
                        <span className="text-[10px] font-bold text-slate-800 block">
                          {ev.reference_type}: {ev.reference_id}
                        </span>
                      )}
                      <span className="text-[11px] text-slate-500">{ev.notes || '—'}</span>
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-500 text-[11px]">
                      {ev.performed_by_role || 'system'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
