'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { RoleSwitcher } from '@/components/common/RoleSwitcher';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { LocationPickerModal } from '@/components/customer/LocationPickerModal';
import { showToast } from '@/components/ui/Toast';
import { Address, Order, Product } from '@/types';
import {
  MapPin,
  Package,
  Heart,
  HelpCircle,
  LogOut,
  Plus,
  CreditCard,
  Phone,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
  Trash2,
  X,
  Bell,
  Sliders,
  Volume2,
  VolumeX,
  Smartphone,
  Mail,
  MessageSquare,
  CheckCheck,
  Tag,
  Truck,
  Sparkles,
  Copy,
  Clock,
  Download,
  RotateCcw,
  Loader2,
  ChevronRight,
  Sun,
  Moon,
  Laptop,
  Check
} from 'lucide-react';
import { requestFCMNotificationPermission } from '@/lib/fcmClient';
import { ThemeMode, getStoredTheme, setAppTheme, initThemeListener } from '@/lib/themeUtils';
import { EmptyState, ProductImageWithFallback } from '@/components/states';

export default function UserProfilePage() {
  const router = useRouter();
  const {
    currentUser,
    isLoggedIn,
    logout,
    addresses,
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
    orders,
    wishlist,
    products,
    addToCart,
    toggleWishlist,
    tickets,
    createTicket,
    getFilteredNotifications,
    notificationPreferences,
    updateNotificationPreferences,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    downloadInvoicePDF
  } = useAppStore();

  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialTab = (searchParams?.get('tab') as any) || 'my_orders';

  // Redirect to home if logged out
  React.useEffect(() => {
    if (!isLoggedIn || !currentUser) {
      router.push('/');
    }
  }, [isLoggedIn, currentUser, router]);

  // Active Tab State (Default: My Orders or from query param)
  const [activeTab, setActiveTab] = useState<
    'my_orders' | 'notifications' | 'notification_settings' | 'manage_address' | 'appearance' | 'wishlist' | 'faq'
  >(initialTab === 'payment_method' ? 'appearance' : initialTab);

  const [themeMode, setThemeMode] = useState<ThemeMode>('system');

  React.useEffect(() => {
    setThemeMode(getStoredTheme());
    const cleanup = initThemeListener((m) => {
      setThemeMode(m);
    });
    return cleanup;
  }, []);

  const handleSelectTheme = (mode: ThemeMode) => {
    setThemeMode(mode);
    setAppTheme(mode);
    const modeName = mode === 'system' ? 'System Default' : mode === 'dark' ? 'Dark' : 'Light';
    showToast(`Appearance set to ${modeName} Mode`, 'success');
  };

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlTab = new URLSearchParams(window.location.search).get('tab');
      if (urlTab) {
        if (urlTab === 'payment_method') {
          setActiveTab('appearance');
        } else {
          setActiveTab(urlTab as any);
        }
      }
    }
  }, []);

  const handleLogout = () => {
    logout();
    showToast('Logged out successfully', 'info');
    router.push('/');
  };

  const customerNotifs = getFilteredNotifications('customer');
  const unreadNotifsCount = customerNotifs.filter((n) => !n.isRead).length;

  // Support Ticket Form
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketDesc, setTicketDesc] = useState('');

  // FAQ Accordion State
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  // Location Picker Modal State (Opens Google Map delivery location picker)
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);

  // Order Details Modal State
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<Order | null>(null);

  // Downloading invoice state tracking
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);

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

  const handleRepeatOrder = (e: React.MouseEvent, ord: Order) => {
    e.stopPropagation();
    if (!ord.items || ord.items.length === 0) {
      showToast('No items to reorder', 'error');
      return;
    }
    let count = 0;
    ord.items.forEach((item) => {
      const resolvedProduct = item.product || products.find((p) => p.id === item.productId);
      if (resolvedProduct) {
        addToCart(resolvedProduct, item.quantity || 1);
        count += 1;
      }
    });
    showToast(`Added ${count || ord.items.length} items to your cart!`, 'success');
    router.push('/cart');
  };

  const handleDownloadInvoice = async (e: React.MouseEvent, ord: Order) => {
    e.stopPropagation();
    setDownloadingInvoiceId(ord.id);
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(ord.id)}/invoice?format=pdf`, {
        headers: { Accept: 'application/pdf' },
      });
      if (response.ok) {
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `PocketKirana-Invoice-${ord.orderNumber || ord.id}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
        showToast('Invoice downloaded successfully!', 'success');
      } else {
        const res = await downloadInvoicePDF(ord.id);
        if (res.success) {
          showToast('Invoice downloaded successfully!', 'success');
        } else {
          showToast('Unable to download invoice.', 'error');
        }
      }
    } catch {
      try {
        const res = await downloadInvoicePDF(ord.id);
        if (res.success) {
          showToast('Invoice downloaded successfully!', 'success');
        } else {
          showToast('Unable to download invoice.', 'error');
        }
      } catch {
        showToast('Unable to download invoice.', 'error');
      }
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  const handleRaiseTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject || !ticketDesc) {
      showToast('Please fill all ticket details', 'error');
      return;
    }
    createTicket(ticketSubject, ticketDesc);
    setTicketSubject('');
    setTicketDesc('');
    showToast('Support ticket #TICK-' + Date.now().toString().slice(-4) + ' raised successfully!', 'success');
  };

  const handleOpenLocationPicker = (addr?: Address) => {
    setEditingAddress(addr || null);
    setShowLocationModal(true);
  };

  const wishlistedProducts = products.filter((p) => wishlist.includes(p.id));

  // Navigation tabs with Notifications and Settings
  const navTabs = [
    { id: 'my_orders', label: 'My Orders', icon: Package, count: orders.length },
    { id: 'notifications', label: 'Notifications', icon: Bell, count: unreadNotifsCount > 0 ? unreadNotifsCount : undefined },
    { id: 'notification_settings', label: 'Notification Settings', icon: Sliders },
    { id: 'manage_address', label: 'Manage Address', icon: MapPin, count: addresses.length },
    { id: 'appearance', label: 'Appearance', icon: Moon },
    { id: 'wishlist', label: 'My Wishlist', icon: Heart, count: wishlistedProducts.length },
    { id: 'faq', label: 'FAQ & Help', icon: HelpCircle },
  ];

  const userMobile = currentUser?.mobile || '+91 8698893348';

  return (
    <>
      <RoleSwitcher />
      <CustomerLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 font-sans transition-colors duration-200">
          
          {/* Breadcrumb Path */}
          <div className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400">
            <Link href="/" className="hover:text-gray-900 dark:hover:text-white transition-colors">Home</Link>
            <span>/</span>
            <span className="text-gray-900 dark:text-white font-extrabold">My Account</span>
          </div>

          {/* Page Title */}
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">My Account</h1>

          {/* User Profile Header Card */}
          <div className="bg-gradient-to-r from-[#006E2F] via-emerald-800 to-teal-950 rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-white shadow-lg flex flex-row items-center justify-between gap-3 sm:gap-6">
            <div className="flex items-center gap-3 sm:gap-5 min-w-0">
              <div className="w-11 h-11 sm:w-16 sm:h-16 shrink-0 rounded-xl sm:rounded-2xl border-2 border-white/40 bg-white/20 flex items-center justify-center font-black text-white shadow-md">
                <Phone className="w-5 h-5 sm:w-7 sm:h-7" />
              </div>

              <div className="min-w-0">
                <h2 className="text-base sm:text-2xl font-black truncate">{userMobile}</h2>
                <p className="text-[10px] sm:text-xs text-emerald-100 mt-0.5">Verified PocketKirana Account</p>
              </div>
            </div>

            {/* Logout CTA */}
            <button
              type="button"
              onClick={handleLogout}
              suppressHydrationWarning
              className="shrink-0 flex items-center gap-1.5 sm:gap-2 bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl border border-white/20 backdrop-blur-xs transition-all active:scale-95 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Logout</span>
            </button>
          </div>

          {/* ══ MOBILE HORIZONTAL SCROLL TAB BAR (hidden on lg+) ══ */}
          <div className="lg:hidden -mx-1 px-1 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-2 pb-1">
              {navTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    suppressHydrationWarning
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-black transition-all cursor-pointer border ${
                      isActive
                        ? 'bg-[#006E2F] text-white border-[#006E2F] shadow-sm'
                        : 'bg-white dark:bg-[#151B23] text-gray-600 dark:text-gray-300 border-gray-200 dark:border-[#263241] hover:border-emerald-300 dark:hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-[#1B2430]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="whitespace-nowrap">{tab.label}</span>
                    {tab.count !== undefined && tab.count > 0 && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-extrabold ${
                        isActive ? 'bg-white text-[#006E2F]' : 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                      }`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main 2-Column Grid: Left Sidebar Navigation + Right Content Area */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* ══ LEFT SIDEBAR: Navigation Tabs (desktop only) ══ */}
            <div className="hidden lg:block lg:col-span-4 space-y-4">
              <div className="bg-white dark:bg-[#151B23] border border-gray-200 dark:border-[#263241] rounded-3xl p-3 shadow-2xs space-y-1.5 transition-colors duration-200">
                <p className="text-[11px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 px-3 pt-2 pb-1">
                  Account Menu
                </p>
                {navTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      suppressHydrationWarning
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-xs font-black transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#006E2F] text-white shadow-md'
                          : 'text-gray-700 dark:text-[#D1D5DB] hover:bg-emerald-50/60 dark:hover:bg-[#1B2430]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`} />
                        <span>{tab.label}</span>
                      </div>
                      {tab.count !== undefined && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                          isActive ? 'bg-white text-[#006E2F]' : 'bg-gray-100 dark:bg-[#1A2232] text-gray-600 dark:text-gray-300'
                        }`}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ══ RIGHT MAIN CONTENT AREA ══ */}
            <div className="lg:col-span-8">
              <div className="bg-white dark:bg-[#151B23] border border-gray-200 dark:border-[#263241] rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-2xs transition-colors duration-200">
            
            {/* ── TAB 1: MY ORDERS ── */}
            {activeTab === 'my_orders' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-[#263241]">
                  <div>
                    <h3 className="text-lg font-black text-gray-900 dark:text-white">Order History ({orders.length})</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Track current express deliveries or reorder past items</p>
                  </div>
                </div>

                {orders.length === 0 ? (
                  <EmptyState
                    type="orders"
                    primaryAction={{
                      label: "Start Shopping",
                      onClick: () => router.push('/'),
                    }}
                  />
                ) : (
                  <div className="space-y-4">
                    {orders.map((ord, idx) => {
                      const statusStr = (ord.orderStatus || '').toLowerCase();
                      const isDelivered = statusStr === 'delivered' || statusStr === 'completed';
                      const isCancelled = statusStr === 'cancelled';
                      const isOutForDelivery = statusStr === 'out_for_delivery' || statusStr === 'arrived_at_customer';
                      const itemsCount = ord.items?.reduce((sum, i) => sum + (i.quantity || 1), 0) || ord.items?.length || 1;
                      const itemsSummary = ord.items && ord.items.length > 0
                        ? ord.items.map((i) => i.product?.name || (i as any).name || 'Item').join(', ')
                        : 'Grocery items';

                      return (
                        <div
                          key={`${ord.id}-${idx}`}
                          onClick={() => router.push(isDelivered ? `/orders/${ord.id}` : `/orders/${ord.id}/track`)}
                          className="border border-gray-200 dark:border-[#263241] rounded-3xl p-5 hover:border-emerald-500 dark:hover:border-emerald-500 transition-all space-y-3.5 bg-white dark:bg-[#1A2232] hover:shadow-sm cursor-pointer group"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 dark:border-[#263241] pb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-black text-gray-900 dark:text-white text-sm">Order #{ord.orderNumber}</span>
                                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase border ${
                                  isDelivered
                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-[#006E2F] dark:text-emerald-400 border-emerald-300 dark:border-emerald-800'
                                    : isCancelled
                                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-800'
                                    : isOutForDelivery
                                    ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-300 dark:border-purple-800 animate-pulse'
                                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800'
                                }`}>
                                  {ord.orderStatus.replace('_', ' ')}
                                </span>
                              </div>
                              <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium block mt-0.5">
                                {formatOrderDate(ord.placedAt)}
                              </span>
                            </div>

                            <span className="text-base font-black text-gray-900 dark:text-white font-mono">₹{ord.total}</span>
                          </div>

                          {/* Items Preview with Thumbnails */}
                          <div className="flex items-center justify-between gap-4 text-xs">
                            <div className="flex items-center gap-2.5 min-w-0">
                              {/* Preview Avatars */}
                              <div className="flex items-center -space-x-2 shrink-0">
                                {ord.items && ord.items.length > 0 ? (
                                  ord.items.slice(0, 3).map((item, itemIdx) => {
                                    const img = item.product?.image || item.product?.thumbnail;
                                    return (
                                      <div
                                        key={itemIdx}
                                        className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 border-2 border-white dark:border-[#1A2232] flex items-center justify-center overflow-hidden shadow-2xs"
                                      >
                                        {img ? (
                                          <img src={img} alt="" className="w-full h-full object-contain" />
                                        ) : (
                                          <Package className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                        )}
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
                                    <Package className="w-4 h-4" />
                                  </div>
                                )}
                              </div>

                              <div className="min-w-0">
                                <span className="font-bold text-gray-800 dark:text-gray-200">{itemsCount} Items: </span>
                                <span className="text-gray-500 dark:text-gray-400 truncate inline-block max-w-xs align-bottom">
                                  {itemsSummary}
                                </span>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 shrink-0">
                              {isDelivered ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => handleDownloadInvoice(e, ord)}
                                    disabled={downloadingInvoiceId === ord.id}
                                    className="flex items-center gap-1 border border-gray-200 dark:border-[#263241] hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-gray-700 dark:text-gray-300 hover:text-emerald-800 dark:hover:text-emerald-300 font-black text-[11px] px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-2xs"
                                    title="Download Tax Invoice"
                                  >
                                    {downloadingInvoiceId === ord.id ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#006E2F] dark:text-emerald-400" />
                                    ) : (
                                      <Download className="w-3.5 h-3.5 text-[#006E2F] dark:text-emerald-400" />
                                    )}
                                    <span>Invoice</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(e) => handleRepeatOrder(e, ord)}
                                    className="flex items-center gap-1 bg-[#006E2F] hover:bg-emerald-800 active:scale-95 text-white font-black text-[11px] px-3.5 py-1.5 rounded-xl transition-all shadow-2xs cursor-pointer"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>Reorder</span>
                                  </button>

                                  <Link
                                    href={`/orders/${ord.id}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex items-center gap-1 border border-gray-300 dark:border-[#263241] hover:border-[#006E2F] text-gray-700 dark:text-gray-300 hover:text-[#006E2F] dark:hover:text-emerald-400 font-black text-[11px] px-3 py-1.5 rounded-xl transition-all shadow-2xs"
                                  >
                                    <span>View Details</span>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  </Link>
                                </>
                              ) : (
                                <Link
                                  href={`/orders/${ord.id}/track`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-1.5 bg-[#006E2F] hover:bg-emerald-800 text-white font-black text-xs px-4 py-2 rounded-xl transition-all shadow-2xs hover:shadow-md cursor-pointer"
                                >
                                  <Truck className="w-3.5 h-3.5" />
                                  <span>Track Order</span>
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── TAB: NOTIFICATIONS FEED ── */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-[#263241]">
                  <div>
                    <h3 className="text-lg font-black text-gray-900 dark:text-white">Notifications Center</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">All your order milestones, delivery alerts, and offer updates</p>
                  </div>
                  {customerNotifs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => markAllNotificationsRead('customer')}
                      className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                    >
                      <CheckCheck className="w-4 h-4" />
                      <span>Mark all as read</span>
                    </button>
                  )}
                </div>

                {customerNotifs.length === 0 ? (
                  <EmptyState
                    type="notifications"
                    title="No Notifications Yet"
                    description="We will notify you about your order progress, dispatch status, and exclusive discount codes here."
                  />
                ) : (
                  <div className="space-y-3">
                    {customerNotifs.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => {
                          if (!notif.isRead) markNotificationRead(notif.id);
                          if (notif.deepLink) router.push(notif.deepLink);
                        }}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer flex gap-4 items-start ${
                          !notif.isRead
                            ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 ring-2 ring-emerald-500/10'
                            : 'bg-white dark:bg-[#1A2232] border-gray-200 dark:border-[#263241] hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                            notif.category === 'offer'
                              ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                              : notif.category === 'delivery'
                              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                              : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300'
                          }`}
                        >
                          {notif.category === 'offer' ? (
                            <Tag className="w-5 h-5" />
                          ) : notif.category === 'delivery' ? (
                            <Truck className="w-5 h-5" />
                          ) : (
                            <ShoppingBag className="w-5 h-5" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <h4 className={`text-xs ${!notif.isRead ? 'font-black text-gray-900 dark:text-white' : 'font-bold text-gray-800 dark:text-gray-200'}`}>
                              {notif.title}
                            </h4>
                            <span className="text-[11px] text-gray-400 dark:text-gray-500 shrink-0 font-medium">
                              {new Date(notif.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mb-2">{notif.message}</p>

                          {notif.couponCode && (
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg text-xs font-bold text-amber-900 dark:text-amber-300">
                              <span>Promo Code:</span>
                              <span className="font-mono font-black text-amber-800 dark:text-amber-400">{notif.couponCode}</span>
                            </div>
                          )}

                          {notif.imageUrl && (
                            <div className="mt-2 rounded-xl overflow-hidden max-w-sm border border-gray-200 dark:border-[#263241]">
                              <img src={notif.imageUrl} alt="Offer" className="w-full h-32 object-cover" />
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notif.id);
                          }}
                          className="text-gray-400 hover:text-rose-500 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          title="Delete notification"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── TAB: NOTIFICATION SETTINGS (Preferences) ── */}
            {activeTab === 'notification_settings' && (
              <div className="space-y-6">
                <div className="pb-4 border-b border-gray-100 dark:border-[#263241] flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-black text-gray-900 dark:text-white">Notification Settings</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Customize which alerts and channels you want to receive</p>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      const res = await requestFCMNotificationPermission(currentUser?.id || 'usr-cust-1', 'customer');
                      if (res.permission === 'granted') {
                        showToast('Push Notifications enabled successfully on this browser!', 'success');
                      } else {
                        showToast('Push permission not granted: ' + (res.error || 'Blocked'), 'error');
                      }
                    }}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Register Web Push (FCM)</span>
                  </button>
                </div>

                {/* Section A: Event Types */}
                <div className="bg-gray-50/70 dark:bg-[#1A2232]/70 border border-gray-200 dark:border-[#263241] rounded-2xl p-5 space-y-4">
                  <h4 className="font-black text-xs text-gray-900 dark:text-white uppercase tracking-wider">Alert Categories</h4>
                  
                  <div className="space-y-3 divide-y divide-gray-200/60 dark:divide-[#263241] text-xs">
                    {/* Order Updates */}
                    <div className="flex items-center justify-between pt-2">
                      <div>
                        <strong className="font-bold text-gray-900 dark:text-white block">Order Updates (Mandatory)</strong>
                        <span className="text-gray-500 dark:text-gray-400 text-[11px]">Order confirmed, preparing, delivered, cancellations &amp; refunds.</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={notificationPreferences.orderUpdates}
                        disabled
                        className="w-4 h-4 text-emerald-600 rounded-sm cursor-not-allowed opacity-75"
                      />
                    </div>

                    {/* Delivery Updates */}
                    <div className="flex items-center justify-between pt-3">
                      <div>
                        <strong className="font-bold text-gray-900 dark:text-white block">Delivery Updates</strong>
                        <span className="text-gray-500 dark:text-gray-400 text-[11px]">Live driver assignment, out for delivery, and 200m nearby alerts.</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={notificationPreferences.deliveryUpdates}
                        onChange={(e) => updateNotificationPreferences({ deliveryUpdates: e.target.checked })}
                        className="w-4 h-4 text-emerald-600 rounded-sm cursor-pointer accent-[#006E2F]"
                      />
                    </div>

                    {/* Offers & Discounts */}
                    <div className="flex items-center justify-between pt-3">
                      <div>
                        <strong className="font-bold text-gray-900 dark:text-white block">Offers &amp; Discounts</strong>
                        <span className="text-gray-500 dark:text-gray-400 text-[11px]">Exclusive promo coupons, wallet cashback, and flash savings.</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={notificationPreferences.offersDiscounts}
                        onChange={(e) => updateNotificationPreferences({ offersDiscounts: e.target.checked })}
                        className="w-4 h-4 text-emerald-600 rounded-sm cursor-pointer accent-[#006E2F]"
                      />
                    </div>

                    {/* New Products */}
                    <div className="flex items-center justify-between pt-3">
                      <div>
                        <strong className="font-bold text-gray-900 dark:text-white block">New Products &amp; Categories</strong>
                        <span className="text-gray-500 dark:text-gray-400 text-[11px]">Fresh farm arrivals, seasonal fruits, and new brand additions.</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={notificationPreferences.newProducts}
                        onChange={(e) => updateNotificationPreferences({ newProducts: e.target.checked })}
                        className="w-4 h-4 text-emerald-600 rounded-sm cursor-pointer accent-[#006E2F]"
                      />
                    </div>

                    {/* Festival Offers */}
                    <div className="flex items-center justify-between pt-3">
                      <div>
                        <strong className="font-bold text-gray-900 dark:text-white block">Festival &amp; Holiday Specials</strong>
                        <span className="text-gray-500 dark:text-gray-400 text-[11px]">Diwali, Holi, New Year, and seasonal festive discounts.</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={notificationPreferences.festivalOffers}
                        onChange={(e) => updateNotificationPreferences({ festivalOffers: e.target.checked })}
                        className="w-4 h-4 text-emerald-600 rounded-sm cursor-pointer accent-[#006E2F]"
                      />
                    </div>

                    {/* Cart Reminders */}
                    <div className="flex items-center justify-between pt-3">
                      <div>
                        <strong className="font-bold text-gray-900 dark:text-white block">Cart Reminders</strong>
                        <span className="text-gray-500 dark:text-gray-400 text-[11px]">Helpful reminder when items remain in your cart before stock runs out.</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={notificationPreferences.promotionalMessages ?? true}
                        onChange={(e) => updateNotificationPreferences({ promotionalMessages: e.target.checked })}
                        className="w-4 h-4 text-emerald-600 rounded-sm cursor-pointer accent-[#006E2F]"
                      />
                    </div>
                  </div>
                </div>

                {/* Section B: Delivery Channels */}
                <div className="bg-gray-50/70 dark:bg-[#1A2232]/70 border border-gray-200 dark:border-[#263241] rounded-2xl p-5 space-y-4">
                  <h4 className="font-black text-xs text-gray-900 dark:text-white uppercase tracking-wider">Notification Channels &amp; Hardware</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    {/* Web Push */}
                    <div className="flex items-center justify-between p-3 bg-white dark:bg-[#151B23] border border-gray-200 dark:border-[#263241] rounded-xl">
                      <div className="flex items-center gap-2.5">
                        <Smartphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <div>
                          <strong className="font-bold text-gray-900 dark:text-white block">Push Notifications</strong>
                          <span className="text-gray-500 dark:text-gray-400 text-[10px]">Browser &amp; Device popups</span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={notificationPreferences.pushEnabled}
                        onChange={(e) => updateNotificationPreferences({ pushEnabled: e.target.checked })}
                        className="w-4 h-4 accent-[#006E2F] cursor-pointer"
                      />
                    </div>

                    {/* Sound Alert Chimes */}
                    <div className="flex items-center justify-between p-3 bg-white dark:bg-[#151B23] border border-gray-200 dark:border-[#263241] rounded-xl">
                      <div className="flex items-center gap-2.5">
                        <Volume2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <div>
                          <strong className="font-bold text-gray-900 dark:text-white block">Audio Sound</strong>
                          <span className="text-gray-500 dark:text-gray-400 text-[10px]">Order chime sound effects</span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={notificationPreferences.soundEnabled}
                        onChange={(e) => updateNotificationPreferences({ soundEnabled: e.target.checked })}
                        className="w-4 h-4 accent-[#006E2F] cursor-pointer"
                      />
                    </div>

                    {/* Device Vibration */}
                    <div className="flex items-center justify-between p-3 bg-white dark:bg-[#151B23] border border-gray-200 dark:border-[#263241] rounded-xl">
                      <div className="flex items-center gap-2.5">
                        <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <div>
                          <strong className="font-bold text-gray-900 dark:text-white block">Device Vibration</strong>
                          <span className="text-gray-500 dark:text-gray-400 text-[10px]">Haptic feedback on alerts</span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={true}
                        disabled
                        className="w-4 h-4 accent-[#006E2F] cursor-not-allowed opacity-80"
                      />
                    </div>

                    {/* Email Notifications */}
                    <div className="flex items-center justify-between p-3 bg-white dark:bg-[#151B23] border border-gray-200 dark:border-[#263241] rounded-xl">
                      <div className="flex items-center gap-2.5">
                        <Mail className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <div>
                          <strong className="font-bold text-gray-900 dark:text-white block">Email Invoices</strong>
                          <span className="text-gray-500 dark:text-gray-400 text-[10px]">Order PDF &amp; statements</span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={notificationPreferences.emailEnabled}
                        onChange={(e) => updateNotificationPreferences({ emailEnabled: e.target.checked })}
                        className="w-4 h-4 accent-[#006E2F] cursor-pointer"
                      />
                    </div>

                    {/* SMS Notifications */}
                    <div className="flex items-center justify-between p-3 bg-white dark:bg-[#151B23] border border-gray-200 dark:border-[#263241] rounded-xl">
                      <div className="flex items-center gap-2.5">
                        <MessageSquare className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                        <div>
                          <strong className="font-bold text-gray-900 dark:text-white block">SMS Alerts</strong>
                          <span className="text-gray-500 dark:text-gray-400 text-[10px]">OTP &amp; dispatch SMS</span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={notificationPreferences.smsEnabled}
                        onChange={(e) => updateNotificationPreferences({ smsEnabled: e.target.checked })}
                        className="w-4 h-4 accent-[#006E2F] cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 2: MANAGE ADDRESS ── */}
            {activeTab === 'manage_address' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-[#263241]">
                  <div>
                    <h3 className="text-lg font-black text-gray-900 dark:text-white">Saved Addresses ({addresses.length})</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Manage delivery locations for 8-min grocery drop</p>
                  </div>
                  {addresses.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleOpenLocationPicker()}
                      suppressHydrationWarning
                      className="flex items-center gap-1.5 bg-[#006E2F] text-white font-black text-xs px-4 py-2 rounded-xl shadow-md hover:bg-emerald-800 transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add New Address</span>
                    </button>
                  )}
                </div>

                {addresses.length === 0 ? (
                  <EmptyState
                    type="addresses"
                    primaryAction={{
                      label: "Add Delivery Address",
                      onClick: () => handleOpenLocationPicker(),
                    }}
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {addresses.map((addr) => (
                    <div
                      key={addr.id}
                      className={`p-4 rounded-2xl border transition-all space-y-2 relative ${
                        addr.isDefault
                          ? 'border-[#006E2F] dark:border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20'
                          : 'border-gray-200 dark:border-[#263241] bg-white dark:bg-[#1A2232] hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs text-gray-900 dark:text-white uppercase tracking-wider bg-gray-100 dark:bg-[#151B23] border border-gray-200 dark:border-[#263241] px-2 py-0.5 rounded-md">
                          {addr.addressType}
                        </span>
                        {addr.isDefault && (
                          <span className="bg-[#006E2F] text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                            Default
                          </span>
                        )}
                      </div>
                      <h4 className="font-extrabold text-xs text-gray-900 dark:text-white">{addr.fullName}</h4>
                      <p className="text-xs text-gray-600 dark:text-gray-300">{addr.addressLine1}, {addr.addressLine2 ? `${addr.addressLine2}, ` : ''}{addr.city}, {addr.state} - {addr.postalCode}</p>
                      <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400">Phone: {addr.phone}</p>

                      <div className="pt-2 border-t border-gray-100 dark:border-[#263241] flex items-center gap-3 text-xs font-bold text-gray-700 dark:text-gray-300">
                        <button
                          type="button"
                          onClick={() => handleOpenLocationPicker(addr)}
                          className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 font-extrabold cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteAddress(addr.id)}
                          className="hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                        >
                          Delete
                        </button>
                        {!addr.isDefault && (
                          <button
                            type="button"
                            onClick={() => setDefaultAddress(addr.id)}
                            className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 font-extrabold ml-auto cursor-pointer"
                          >
                            Set as Default
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                )}
              </div>
            )}

            {/* ── TAB 3: APPEARANCE (Light, Dark, System) ── */}
            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <div className="pb-4 border-b border-gray-100 dark:border-[#263241]">
                  <h3 className="text-lg font-black text-gray-900 dark:text-white">Theme &amp; Appearance</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Choose your preferred visual theme for PocketKirana</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Light Theme Card */}
                  <button
                    type="button"
                    onClick={() => handleSelectTheme('light')}
                    className={`p-5 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between h-44 ${
                      themeMode === 'light'
                        ? 'border-[#008F5A] ring-2 ring-[#008F5A]/20 bg-emerald-50/40 dark:bg-emerald-950/20'
                        : 'border-gray-200 dark:border-[#263241] bg-white dark:bg-[#1A2232] hover:border-emerald-300 dark:hover:border-emerald-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                        <Sun className="w-5 h-5" />
                      </div>
                      {themeMode === 'light' && (
                        <span className="w-5 h-5 rounded-full bg-[#008F5A] text-white flex items-center justify-center shadow-xs">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-gray-900 dark:text-white">Light Mode</h4>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Clean warm cream &amp; white colors, easy on eyes during daytime</p>
                    </div>
                  </button>

                  {/* Dark Theme Card */}
                  <button
                    type="button"
                    onClick={() => handleSelectTheme('dark')}
                    className={`p-5 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between h-44 ${
                      themeMode === 'dark'
                        ? 'border-[#008F5A] ring-2 ring-[#008F5A]/20 bg-emerald-50/40 dark:bg-emerald-950/20'
                        : 'border-gray-200 dark:border-[#263241] bg-white dark:bg-[#1A2232] hover:border-emerald-300 dark:hover:border-emerald-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                        <Moon className="w-5 h-5" />
                      </div>
                      {themeMode === 'dark' && (
                        <span className="w-5 h-5 rounded-full bg-[#008F5A] text-white flex items-center justify-center shadow-xs">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-gray-900 dark:text-white">Dark Mode</h4>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Sleek charcoal &amp; dark slate palette for low-light environments</p>
                    </div>
                  </button>

                  {/* System Default Theme Card */}
                  <button
                    type="button"
                    onClick={() => handleSelectTheme('system')}
                    className={`p-5 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between h-44 ${
                      themeMode === 'system'
                        ? 'border-[#008F5A] ring-2 ring-[#008F5A]/20 bg-emerald-50/40 dark:bg-emerald-950/20'
                        : 'border-gray-200 dark:border-[#263241] bg-white dark:bg-[#1A2232] hover:border-emerald-300 dark:hover:border-emerald-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
                        <Laptop className="w-5 h-5" />
                      </div>
                      {themeMode === 'system' && (
                        <span className="w-5 h-5 rounded-full bg-[#008F5A] text-white flex items-center justify-center shadow-xs">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-gray-900 dark:text-white">System Default</h4>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Sync automatically with your device OS settings</p>
                    </div>
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-3">
                  <Sparkles className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>Theme preferences are saved automatically and applied across the entire PocketKirana website.</span>
                </div>
              </div>
            )}

            {/* ── TAB 4: MY WISHLIST ── */}
            {activeTab === 'wishlist' && (
              <div className="space-y-6">
                <div className="pb-4 border-b border-gray-100 dark:border-[#263241]">
                  <h3 className="text-lg font-black text-gray-900 dark:text-white">My Wishlist ({wishlistedProducts.length})</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Products you saved for future grocery orders</p>
                </div>

                {wishlistedProducts.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {wishlistedProducts.map((prod) => (
                      <div key={prod.id} className="border border-gray-200 dark:border-[#263241] rounded-2xl p-3 bg-white dark:bg-[#1A2232] space-y-2 relative">
                        <div className="w-full h-24 flex items-center justify-center overflow-hidden rounded-xl bg-gray-50 dark:bg-[#151B23]">
                          <ProductImageWithFallback src={prod.thumbnail || prod.image} alt={prod.name} className="w-full h-full object-contain" />
                        </div>
                        <h4 className="font-bold text-xs text-gray-900 dark:text-white line-clamp-1">{prod.name}</h4>
                        <div className="flex items-center justify-between">
                          <span className="font-black text-xs text-gray-900 dark:text-white">₹{prod.sellingPrice || prod.price}</span>
                          <button
                            type="button"
                            onClick={() => addToCart(prod, 1)}
                            className="bg-[#006E2F] text-white p-1.5 rounded-lg hover:bg-emerald-800 transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    type="wishlist"
                    primaryAction={{
                      label: "Explore Groceries",
                      onClick: () => router.push('/'),
                    }}
                  />
                )}
              </div>
            )}

            {/* ── TAB 5: FAQ & HELP ── */}
            {activeTab === 'faq' && (
              <div className="space-y-6">
                <div className="pb-4 border-b border-gray-100 dark:border-[#263241]">
                  <h3 className="text-lg font-black text-gray-900 dark:text-white">FAQ &amp; Customer Support</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Frequently asked questions and direct resolution desk</p>
                </div>

                {/* FAQ Accordion */}
                <div className="space-y-3">
                  {[
                    {
                      q: 'How fast is PocketKirana express delivery?',
                      a: 'Our dark stores dispatch orders within 2 minutes of checkout, ensuring door delivery within 8-12 minutes in serviceable zones.'
                    },
                    {
                      q: 'How do I return damaged or missing grocery items?',
                      a: 'You can initiate an instant refund or replacement through the My Orders tab within 2 hours of delivery.'
                    },
                    {
                      q: 'Are fresh vegetables sourced daily?',
                      a: 'Yes, all leafy greens and vegetables are directly sourced every morning from certified local farm clusters.'
                    }
                  ].map((faq, idx) => (
                    <div key={idx} className="border border-gray-200 dark:border-[#263241] rounded-2xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setOpenFaqIdx(openFaqIdx === idx ? null : idx)}
                        className="w-full p-4 text-left flex items-center justify-between font-bold text-xs text-gray-900 dark:text-white bg-gray-50/50 dark:bg-[#1A2232] hover:bg-gray-50 dark:hover:bg-[#1B2430] transition-colors cursor-pointer"
                      >
                        <span>{faq.q}</span>
                        {openFaqIdx === idx ? <ChevronUp className="w-4 h-4 text-gray-500 dark:text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />}
                      </button>
                      {openFaqIdx === idx && (
                        <div className="p-4 text-xs text-gray-600 dark:text-gray-300 bg-white dark:bg-[#151B23] border-t border-gray-100 dark:border-[#263241] leading-relaxed">
                          {faq.a}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Support Ticket */}
                <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl p-5 space-y-4 mt-6">
                  <h4 className="font-black text-sm text-gray-900 dark:text-white">Need more help? Raise a Support Ticket</h4>
                  <form onSubmit={handleRaiseTicket} className="space-y-3 text-xs">
                    <div>
                      <label className="font-bold text-gray-700 dark:text-gray-300 mb-1 block">Subject</label>
                      <input
                        type="text"
                        placeholder="e.g., Issue with Order #PK-8921"
                        value={ticketSubject}
                        onChange={(e) => setTicketSubject(e.target.value)}
                        className="w-full bg-white dark:bg-[#1A2232] border border-gray-200 dark:border-[#263241] rounded-xl p-2.5 text-gray-900 dark:text-white font-bold focus:outline-none focus:border-[#006E2F]"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-gray-700 dark:text-gray-300 mb-1 block">Description</label>
                      <textarea
                        rows={3}
                        placeholder="Describe your query or issue in detail..."
                        value={ticketDesc}
                        onChange={(e) => setTicketDesc(e.target.value)}
                        className="w-full bg-white dark:bg-[#1A2232] border border-gray-200 dark:border-[#263241] rounded-xl p-2.5 text-gray-900 dark:text-white font-medium focus:outline-none focus:border-[#006E2F]"
                      />
                    </div>
                    <button
                      type="submit"
                      className="bg-[#006E2F] hover:bg-emerald-800 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
                    >
                      Submit Ticket
                    </button>
                  </form>
                </div>
              </div>
            )}

              </div>
            </div>

          </div>
        </div>

        {/* ── DELIVERY LOCATION PICKER MODAL (Interactive Map & Address Details) ── */}
        <LocationPickerModal
          isOpen={showLocationModal}
          onClose={() => { setShowLocationModal(false); setEditingAddress(null); }}
          editingAddress={editingAddress}
        />
      </CustomerLayout>
    </>
  );
}
