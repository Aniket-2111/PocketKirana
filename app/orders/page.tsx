'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProductImageWithFallback } from '@/components/states/ProductImageWithFallback';
import { Download, RotateCcw, Truck, ChevronRight, Loader2, Package } from 'lucide-react';
import { showToast } from '@/components/ui/Toast';
import type { Order } from '@/types';

export default function MyOrdersPage() {
  const router = useRouter();
  const { orders, products, addToCart, downloadInvoicePDF } = useAppStore();
  const [activeTab, setActiveTab] = useState<'All' | 'Processing' | 'Out for Delivery' | 'Delivered' | 'Cancelled'>('All');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const formatOrderDate = (dateStr?: string) => {
    if (!dateStr || dateStr.toLowerCase().includes('invalid')) return 'Delivered recently';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'Delivered recently';
      return `${d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })} at ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return 'Delivered recently';
    }
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
      const response = await fetch(`/api/orders/${encodeURIComponent(order.id)}/invoice?format=pdf`, {
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

  const filteredOrders = orders.filter((o) => {
    const status = (o.orderStatus || '').toLowerCase();
    if (activeTab === 'Processing') {
      return ['placed', 'accepted', 'preparing', 'picking', 'picked', 'packing', 'packed', 'ready', 'ready_for_pickup', 'assigned'].includes(status);
    }
    if (activeTab === 'Out for Delivery') {
      return ['out_for_delivery', 'picked_up', 'arrived_at_customer'].includes(status);
    }
    if (activeTab === 'Delivered') {
      return ['delivered', 'completed'].includes(status);
    }
    if (activeTab === 'Cancelled') {
      return status === 'cancelled';
    }
    return true;
  });

  return (
    <>
      <RoleSwitcher />
      <CustomerLayout>
        <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
          <Breadcrumb items={[{ label: 'My Orders' }]} />

          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">My Orders</h1>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 border-b border-gray-200 pb-3 overflow-x-auto text-xs font-extrabold scrollbar-none no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {(['All', 'Processing', 'Out for Delivery', 'Delivered', 'Cancelled'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-xl transition-all shrink-0 cursor-pointer ${
                  activeTab === tab
                    ? 'bg-[#0F532B] text-white shadow-sm font-black'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Order Cards List */}
          {filteredOrders.length === 0 ? (
            <EmptyState
              variant="orders"
              title="No orders found"
              description="No orders match your selected filter."
              ctaLabel="Shop Now"
              ctaHref="/"
            />
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order, idx) => {
                const statusStr = (order.orderStatus || '').toLowerCase();
                const isOutForDelivery = statusStr === 'out_for_delivery' || statusStr === 'arrived_at_customer';
                const isDelivered = statusStr === 'delivered' || statusStr === 'completed';
                const isCancelled = statusStr === 'cancelled';
                const itemsCount = order.items?.reduce((sum, i) => sum + (i.quantity || 1), 0) || order.items?.length || 1;
                const itemsSummary = order.items && order.items.length > 0
                  ? order.items.map((i) => i.product?.name || (i as any).name || 'Item').join(', ')
                  : 'Grocery items';

                return (
                  <div
                    key={`${order.id}-${idx}`}
                    onClick={() => router.push(isDelivered ? `/orders/${order.id}` : `/orders/${order.id}/track`)}
                    className="bg-white rounded-3xl border border-gray-200 p-5 shadow-2xs hover:shadow-sm hover:border-emerald-500 transition-all space-y-3.5 cursor-pointer group"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm text-gray-900">Order #{order.orderNumber}</span>
                          <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase border ${
                            isDelivered
                              ? 'bg-emerald-50 text-[#006E2F] border-emerald-300'
                              : isCancelled
                              ? 'bg-rose-50 text-rose-700 border-rose-300'
                              : isOutForDelivery
                              ? 'bg-purple-50 text-purple-700 border-purple-300 animate-pulse'
                              : 'bg-amber-50 text-amber-700 border-amber-300'
                          }`}>
                            {order.orderStatus.replace('_', ' ')}
                          </span>
                        </div>
                        <span className="text-[11px] text-gray-500 font-medium block mt-0.5">
                          {formatOrderDate(order.placedAt)}
                        </span>
                      </div>

                      <span className="text-base font-black text-gray-900 font-mono">₹{order.total}</span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Preview Avatars */}
                        <div className="flex items-center -space-x-2 shrink-0">
                          {order.items && order.items.length > 0 ? (
                            order.items.slice(0, 3).map((item, itemIdx) => {
                              const img = item.product?.image || item.product?.thumbnail;
                              return (
                                <div
                                  key={itemIdx}
                                  className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shrink-0 shadow-xs flex items-center justify-center"
                                >
                                  <ProductImageWithFallback
                                    src={img}
                                    alt=""
                                    className="w-full h-full object-contain"
                                    containerClassName="w-full h-full rounded-none"
                                  />
                                </div>
                              );
                            })
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                              <Package className="w-4 h-4" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <span className="font-bold text-gray-800">{itemsCount} Items: </span>
                          <span className="text-gray-500 truncate inline-block max-w-sm align-bottom">
                            {itemsSummary}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        {isDelivered ? (
                          <>
                            <button
                              type="button"
                              onClick={(e) => handleDownloadInvoice(e, order)}
                              disabled={downloadingId === order.id}
                              className="flex items-center gap-1 border border-gray-200 hover:border-emerald-600 hover:bg-emerald-50 text-gray-700 hover:text-emerald-800 font-black text-[11px] px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-2xs"
                              title="Download Tax Invoice"
                            >
                              {downloadingId === order.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#006E2F]" />
                              ) : (
                                <Download className="w-3.5 h-3.5 text-[#006E2F]" />
                              )}
                              <span>Invoice</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => handleRepeatOrder(e, order)}
                              className="flex items-center gap-1 bg-[#006E2F] hover:bg-emerald-800 active:scale-95 text-white font-black text-[11px] px-3.5 py-1.5 rounded-xl transition-all shadow-2xs cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Reorder</span>
                            </button>

                            <Link
                              href={`/orders/${order.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1 border border-gray-300 hover:border-[#006E2F] text-gray-700 hover:text-[#006E2F] font-black text-[11px] px-3 py-1.5 rounded-xl transition-all shadow-2xs"
                            >
                              <span>View Details</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </Link>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/orders/${order.id}/track`);
                            }}
                            className="flex items-center gap-1.5 bg-[#006E2F] hover:bg-emerald-800 text-white font-black text-xs px-4 py-2 rounded-xl transition-all shadow-2xs hover:shadow-md cursor-pointer"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>Track Order</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CustomerLayout>
    </>
  );
}
