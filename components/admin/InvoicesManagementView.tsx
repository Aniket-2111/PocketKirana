'use client';

import React, { useState, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { InvoiceSnapshot, generateInvoicePDF } from '@/lib/invoiceEngine';
import { showToast } from '@/components/ui/Toast';
import {
  FileText,
  Search,
  Filter,
  Download,
  Eye,
  Calendar,
  DollarSign,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  Package,
  Layers,
  ArrowUpRight
} from 'lucide-react';

export function InvoicesManagementView() {
  const { orders, invoices, getOrGenerateInvoice } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceSnapshot | null>(null);

  // Ensure all orders have a finalized invoice snapshot ready in memory
  const allInvoices = useMemo(() => {
    const map = new Map<string, InvoiceSnapshot>();
    
    // Existing stored invoices
    (invoices || []).forEach((inv) => {
      map.set(inv.orderNumber, inv);
      map.set(inv.orderId, inv);
    });

    // Ensure all orders have an invoice generated
    (orders || []).forEach((ord) => {
      if (!map.has(ord.orderNumber) && !map.has(ord.id)) {
        const inv = getOrGenerateInvoice(ord.id);
        if (inv) {
          map.set(ord.orderNumber, inv);
          map.set(ord.id, inv);
        }
      }
    });

    // Deduplicate by invoiceNumber
    const unique = Array.from(new Set(Array.from(map.values()).map((i) => i.invoiceNumber)))
      .map((invNum) => Array.from(map.values()).find((i) => i.invoiceNumber === invNum)!)
      .filter(Boolean);

    // Sort newest first
    return unique.sort(
      (a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime()
    );
  }, [orders, invoices, getOrGenerateInvoice]);

  const filteredInvoices = useMemo(() => {
    return allInvoices.filter((inv) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.orderNumber.toLowerCase().includes(q) ||
        inv.customer.name.toLowerCase().includes(q) ||
        inv.customer.mobile.includes(q);

      const matchStatus =
        statusFilter === 'all' ||
        inv.orderStatus.toLowerCase() === statusFilter.toLowerCase();

      return matchQuery && matchStatus;
    });
  }, [allInvoices, searchQuery, statusFilter]);

  const handleDownloadPDF = (invoice: InvoiceSnapshot) => {
    try {
      generateInvoicePDF(invoice, { saveAsFile: true });
      showToast(`Invoice ${invoice.invoiceNumber} downloaded successfully.`, 'success');
    } catch (err: any) {
      showToast('Unable to download invoice. Please try again.', 'error');
    }
  };

  return (
    <div className="space-y-6 text-slate-900 font-sans">
      
      {/* ── TOP HEADER / STATS ── */}
      <div className="bg-white border border-slate-200/90 rounded-[28px] p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl">
                <FileText className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-black text-slate-900">Invoices &amp; Billing Ledger</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Immutable finalized financial records for all customer grocery orders.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold text-emerald-800">
              {allInvoices.length} Total Invoices
            </span>
          </div>
        </div>

        {/* ── SEARCH & FILTER BAR ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="sm:col-span-2 relative">
            <input
              type="text"
              placeholder="Search by invoice #, order #, customer name, mobile..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold placeholder-slate-400 focus:outline-none focus:border-emerald-600 transition-colors"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            )}
          </div>

          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-600 transition-colors"
            >
              <option value="all">All Order Statuses</option>
              <option value="delivered">Delivered / Completed</option>
              <option value="packed">Packed</option>
              <option value="picking">Picking</option>
              <option value="confirmed">Confirmed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── INVOICES TABLE ── */}
      <div className="bg-white border border-slate-200/90 rounded-[28px] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-extrabold text-[10px]">
                <th className="py-3.5 px-4">Invoice #</th>
                <th className="py-3.5 px-4">Order #</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Date &amp; Time</th>
                <th className="py-3.5 px-4 text-right">Items</th>
                <th className="py-3.5 px-4 text-right">Grand Total</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredInvoices.length > 0 ? (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-black text-emerald-800">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {inv.orderNumber}
                    </td>
                    <td className="py-3.5 px-4">
                      <strong className="block font-bold text-slate-900">{inv.customer.name}</strong>
                      <span className="text-[10px] text-slate-400 font-mono">{inv.customer.mobile}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                      {new Date(inv.invoiceDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                      {inv.items.length} items
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-black text-slate-900 text-sm">
                      ₹{inv.totals.grandTotal.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                          inv.orderStatus.toLowerCase() === 'delivered' || inv.orderStatus.toLowerCase() === 'completed'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : inv.orderStatus.toLowerCase() === 'cancelled'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {inv.orderStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          title="Quick Preview"
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDownloadPDF(inv)}
                          title="Download PDF"
                          className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-xs font-bold">No invoices found matching criteria</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL: INVOICE PREVIEW ── */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-2xl w-full p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block">
                  INVOICE SNAPSHOT
                </span>
                <h3 className="text-base font-black text-slate-900">
                  {selectedInvoice.invoiceNumber}
                </h3>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Seller & Customer details */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  Seller
                </span>
                <strong className="text-slate-900 block">{selectedInvoice.seller.sellerDisplayName}</strong>
                <p className="text-slate-600 text-[11px]">{selectedInvoice.seller.address}</p>
                <p className="text-slate-500 text-[10px] font-mono">
                  FSSAI: {selectedInvoice.seller.fssaiNumber}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  Customer
                </span>
                <strong className="text-slate-900 block">{selectedInvoice.customer.name}</strong>
                <p className="text-slate-600 text-[11px]">{selectedInvoice.customer.deliveryAddress}</p>
                <p className="text-slate-500 text-[10px] font-mono">Mobile: {selectedInvoice.customer.mobile}</p>
              </div>
            </div>

            {/* Products breakdown */}
            <div className="space-y-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                Products ({selectedInvoice.items.length})
              </span>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                {selectedInvoice.items.map((item, idx) => (
                  <div key={idx} className="p-3 bg-white flex items-center justify-between text-xs">
                    <div>
                      <strong className="text-slate-900 block">{item.productName}</strong>
                      <span className="text-[10px] text-slate-400">
                        {item.unit} • Qty: {item.quantity} × ₹{item.unitPrice}
                      </span>
                    </div>
                    <span className="font-mono font-black text-slate-900">
                      ₹{item.itemTotal.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-mono font-bold text-slate-900">₹{selectedInvoice.totals.subtotal.toFixed(2)}</span>
              </div>
              {selectedInvoice.totals.discount > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Discount:</span>
                  <span className="font-mono font-bold text-emerald-700">-₹{selectedInvoice.totals.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Delivery:</span>
                <span className="font-mono font-bold text-slate-900">
                  {selectedInvoice.totals.deliveryFee === 0 ? 'FREE' : `₹${selectedInvoice.totals.deliveryFee.toFixed(2)}`}
                </span>
              </div>
              <div className="flex justify-between text-slate-900 font-black text-sm pt-2 border-t border-slate-200">
                <span>Total:</span>
                <span className="font-mono text-emerald-800 text-base">₹{selectedInvoice.totals.grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleDownloadPDF(selectedInvoice)}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/30 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
