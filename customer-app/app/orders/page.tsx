'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import CustomerShell from '../../components/CustomerShell';
import { Package, Clock, ChevronRight, CheckCircle2, Truck, ShoppingCart, RotateCcw, Download, Loader2 } from 'lucide-react';
import { showToast } from '@/components/ui/Toast';
import { apiFetch } from '@/lib/apiClient';
import type { Order } from '@/types';

export default function CustomerOrdersPage() {
  const router = useRouter();
  const { orders, products, addToCart, downloadInvoicePDF } = useAppStore();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const formatOrderDate = (dateStr?: string) => {
    if (!dateStr) return 'Recently';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return `${d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })} at ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return dateStr || 'Recently';
    }
  };

  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'DELIVERED' || s === 'COMPLETED') {
      return { label: 'Delivered', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40' };
    }
    if (s === 'OUT_FOR_DELIVERY' || s === 'ARRIVED_AT_CUSTOMER') {
      return { label: 'Out for Delivery 🚴', bg: 'bg-purple-500/10 text-purple-400 border-purple-500/30 animate-pulse' };
    }
    if (s === 'PACKED' || s === 'WAITING_FOR_DELIVERY' || s === 'READY_FOR_PICKUP') {
      return { label: 'Order Packed', bg: 'bg-blue-500/10 text-blue-400 border-blue-500/30' };
    }
    if (s === 'PICKING' || s === 'PACKING') {
      return { label: 'Being Packed', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
    }
    return { label: 'Order Confirmed', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
  };

  const handleRepeatOrder = (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    if (!order.items || order.items.length === 0) {
      showToast('No items to reorder', 'error');
      return;
    }
    let addedCount = 0;
    order.items.forEach((item) => {
      const resolvedProduct = item.product || products.find((p) => p.id === item.productId);
      if (resolvedProduct) {
        addToCart(resolvedProduct, item.quantity || 1);
        addedCount += 1;
      }
    });
    showToast(`Added ${addedCount || order.items.length} items to your cart!`, 'success');
    router.push('/cart');
  };

  const handleDownloadInvoice = async (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    setDownloadingId(order.id);
    try {
      const response = await apiFetch(`/api/orders/${encodeURIComponent(order.id)}/invoice?format=pdf`, {
        headers: { Accept: 'application/pdf' },
      });
      if (response.ok) {
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `PocketKirana-Invoice-${order.orderNumber || order.id}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
        showToast('Invoice downloaded successfully!', 'success');
      } else {
        const res = await downloadInvoicePDF(order.id);
        if (res.success) {
          showToast('Invoice downloaded successfully!', 'success');
        } else {
          showToast('Unable to download invoice.', 'error');
        }
      }
    } catch {
      try {
        const res = await downloadInvoicePDF(order.id);
        if (res.success) {
          showToast('Invoice downloaded successfully!', 'success');
        } else {
          showToast('Unable to download invoice.', 'error');
        }
      } catch {
        showToast('Unable to download invoice.', 'error');
      }
    } finally {
      setDownloadingId(null);
    }
  };

  if (orders.length === 0) {
    return (
      <CustomerShell title="My Orders">
        <div className="bg-white dark:bg-[#151B23] border border-[#E5E7EB] dark:border-[#263241] rounded-3xl p-8 text-center space-y-4 shadow-xs mt-6">
          <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#263241] flex items-center justify-center mx-auto text-slate-400 dark:text-[#9CA3AF]">
            <Package className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-black text-[#111827] dark:text-[#F9FAFB]">No orders yet</h3>
            <p className="text-xs text-slate-500 dark:text-[#9CA3AF] mt-1">Your past and active grocery orders will appear here.</p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-2xl shadow-md shadow-emerald-600/30 cursor-pointer uppercase tracking-wider transition-all"
          >
            Shop Now
          </button>
        </div>
      </CustomerShell>
    );
  }

  return (
    <CustomerShell title="My Orders">
      <div className="space-y-4 animate-in fade-in duration-200 pb-20">
        
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-[#111827] dark:text-[#F9FAFB] tracking-tight">Order History ({orders.length})</h2>
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Express Deliveries</span>
        </div>

        <div className="space-y-3">
          {orders.map((order) => {
            const statusStr = (order.orderStatus || '').toLowerCase();
            const isDelivered = statusStr === 'delivered' || statusStr === 'completed';
            const badge = getStatusBadge(order.orderStatus);
            const itemsCount = order.items?.reduce((sum, i) => sum + (i.quantity || 1), 0) || order.items?.length || 1;
            const itemsSummary = order.items && order.items.length > 0
              ? order.items.map((i) => i.product?.name || (i as any).name || 'Item').join(', ')
              : 'Grocery items';

            return (
              <div
                key={order.id}
                onClick={() => router.push(`/orders/${order.id}`)}
                className="bg-white dark:bg-[#151B23] border border-[#E5E7EB] dark:border-[#263241] rounded-3xl p-5 space-y-3.5 shadow-xs hover:border-emerald-500 dark:hover:border-emerald-500 transition-all cursor-pointer group"
              >
                {/* Header Strip */}
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#263241] pb-3">
                  <div>
                    <span className="text-[10px] text-slate-400 dark:text-[#9CA3AF] font-bold uppercase block">
                      Order #{order.orderNumber || order.id}
                    </span>
                    <strong className="text-xs font-black text-[#111827] dark:text-[#F9FAFB] block mt-0.5">
                      {formatOrderDate(order.placedAt)}
                    </strong>
                  </div>

                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase border ${badge.bg}`}>
                    {badge.label}
                  </span>
                </div>

                {/* Items preview */}
                <div className="text-xs space-y-1">
                  <div className="text-slate-500 dark:text-[#9CA3AF] font-medium truncate">
                    <span className="font-bold text-slate-700 dark:text-[#D1D5DB]">{itemsCount} Items: </span>
                    <span>{itemsSummary}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="font-mono font-black text-[#111827] dark:text-[#F9FAFB] text-base">
                      ₹{order.total}
                    </span>

                    {/* Action buttons based on status */}
                    <div className="flex items-center gap-2">
                      {isDelivered ? (
                        <>
                          <button
                            type="button"
                            onClick={(e) => handleDownloadInvoice(e, order)}
                            disabled={downloadingId === order.id}
                            className="flex items-center gap-1.5 py-2 px-3 bg-slate-100 dark:bg-[#111827] hover:bg-slate-200 dark:hover:bg-[#1B2430] text-slate-700 dark:text-[#D1D5DB] font-black text-[11px] rounded-xl transition-all cursor-pointer"
                            title="Download Invoice"
                          >
                            {downloadingId === order.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                            ) : (
                              <Download className="w-3.5 h-3.5 text-emerald-500" />
                            )}
                            <span>Invoice</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleRepeatOrder(e, order)}
                            className="flex items-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-[11px] rounded-xl shadow-xs transition-all cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Reorder</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/orders/${order.id}`);
                            }}
                            className="flex items-center gap-1 py-2 px-2.5 bg-slate-100 dark:bg-[#111827] text-slate-700 dark:text-[#D1D5DB] font-bold text-[11px] rounded-xl hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                          >
                            <span>Details</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/orders/${order.id}`);
                          }}
                          className="flex items-center gap-1.5 py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl transition-colors cursor-pointer shadow-xs"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>TRACK ORDER</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </CustomerShell>
  );
}
