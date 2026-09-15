'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState } from '@/components/ui/EmptyState';

export default function MyOrdersPage() {
  const { orders } = useAppStore();
  const [activeTab, setActiveTab] = useState<'All' | 'Processing' | 'Out for Delivery' | 'Delivered' | 'Cancelled'>('All');

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

          {/* Filter Tabs (Matching Screen 11) */}
          <div className="flex items-center gap-2 border-b border-gray-200 pb-3 overflow-x-auto text-xs font-extrabold scrollbar-none no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {(['All', 'Processing', 'Out for Delivery', 'Delivered', 'Cancelled'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-xl transition-all shrink-0 ${
                  activeTab === tab
                    ? 'bg-[#0F532B] text-white shadow-sm font-black'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Order Cards List (Matching Screen 11) */}
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
                const isOutForDelivery = order.orderStatus === 'out_for_delivery';
                const isDelivered = order.orderStatus === 'delivered';
                const isCancelled = order.orderStatus === 'cancelled';

                return (
                  <div
                    key={`${order.id}-${idx}`}
                    className="bg-white rounded-2xl border border-gray-200 p-5 shadow-2xs hover:shadow-sm transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="font-black text-sm text-gray-900">Order #{order.orderNumber}</span>
                        {isOutForDelivery && (
                          <span className="bg-amber-100 text-amber-800 border border-amber-300 font-extrabold text-[10px] uppercase px-2.5 py-0.5 rounded-full">
                            Out For Delivery
                          </span>
                        )}
                        {isDelivered && (
                          <span className="bg-emerald-100 text-[#0F532B] border border-emerald-300 font-extrabold text-[10px] uppercase px-2.5 py-0.5 rounded-full">
                            Delivered
                          </span>
                        )}
                        {isCancelled && (
                          <span className="bg-rose-100 text-rose-800 border border-rose-300 font-extrabold text-[10px] uppercase px-2.5 py-0.5 rounded-full">
                            Cancelled
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-gray-500 font-medium">
                        <span>{order.placedAt}</span>
                        <span className="mx-2">•</span>
                        <span>{order.items.length || 3} items</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 justify-between md:justify-end">
                      <span className="text-lg font-black text-gray-900">₹{order.total}</span>

                      <a
                        href={`/api/orders/${order.id}/invoice`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 font-extrabold text-xs px-3.5 py-2.5 rounded-xl uppercase tracking-wider transition-colors"
                        title="View Tax Invoice"
                      >
                        INVOICE
                      </a>

                      {isOutForDelivery ? (
                        <Link
                          href={`/orders/${order.id}/track`}
                          className="bg-[#0F532B] hover:bg-[#0B3E20] text-white font-extrabold text-xs px-5 py-2.5 rounded-xl uppercase tracking-wider shadow-2xs"
                        >
                          TRACK ORDER
                        </Link>
                      ) : (
                        <Link
                          href={`/orders/${order.id}/track`}
                          className="border border-[#0F532B] text-[#0F532B] hover:bg-emerald-50 font-extrabold text-xs px-5 py-2.5 rounded-xl uppercase tracking-wider"
                        >
                          VIEW DETAILS
                        </Link>
                      )}
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
