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
  Clock
} from 'lucide-react';
import { requestFCMNotificationPermission } from '@/lib/fcmClient';

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
    deleteNotification
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
    'my_orders' | 'notifications' | 'notification_settings' | 'manage_address' | 'payment_method' | 'wishlist' | 'faq'
  >(initialTab);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlTab = new URLSearchParams(window.location.search).get('tab');
      if (urlTab) {
        setActiveTab(urlTab as any);
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
    { id: 'payment_method', label: 'Payment Method', icon: CreditCard },
    { id: 'wishlist', label: 'My Wishlist', icon: Heart, count: wishlistedProducts.length },
    { id: 'faq', label: 'FAQ & Help', icon: HelpCircle },
  ];

  const userMobile = currentUser?.mobile || '+91 8698893348';

  return (
    <>
      <RoleSwitcher />
      <CustomerLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 font-sans">
          
          {/* Breadcrumb Path */}
          <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
            <Link href="/" className="hover:text-gray-900">Home</Link>
            <span>/</span>
            <span className="text-gray-900 font-extrabold">My Account</span>
          </div>

          {/* Page Title */}
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">My Account</h1>

          {/* User Profile Header Card */}
          <div className="bg-gradient-to-r from-[#006E2F] via-emerald-800 to-teal-950 rounded-3xl p-6 text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl border-2 border-white/40 bg-white/20 flex items-center justify-center font-black text-white shadow-md">
                <Phone className="w-7 h-7" />
              </div>

              <div>
                <h2 className="text-2xl font-black">{userMobile}</h2>
                <p className="text-xs text-emerald-100 mt-1">Verified PocketKirana Account</p>
              </div>
            </div>

            {/* Logout CTA */}
            <button
              type="button"
              onClick={handleLogout}
              suppressHydrationWarning
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl border border-white/20 backdrop-blur-xs transition-all active:scale-95 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>

          {/* Main 2-Column Grid: Left Sidebar Navigation + Right Content Area */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* ══ LEFT SIDEBAR: Navigation Tabs ══ */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white border border-gray-200 rounded-3xl p-3 shadow-2xs space-y-1.5">
                <p className="text-[11px] font-black uppercase tracking-wider text-gray-400 px-3 pt-2 pb-1">
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
                          : 'text-gray-700 hover:bg-emerald-50/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                        <span>{tab.label}</span>
                      </div>
                      {tab.count !== undefined && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                          isActive ? 'bg-white text-[#006E2F]' : 'bg-gray-100 text-gray-600'
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
              <div className="bg-white border border-gray-200 rounded-3xl p-6 md:p-8 shadow-2xs">
            
            {/* ── TAB 1: MY ORDERS ── */}
            {activeTab === 'my_orders' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                  <div>
                    <h3 className="text-lg font-black text-gray-900">Order History ({orders.length})</h3>
                    <p className="text-xs text-gray-500">Track current express deliveries or reorder past items</p>
                  </div>
                </div>

                {orders.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto" />
                    <p className="text-sm font-bold text-gray-700">No orders placed yet</p>
                    <Link
                      href="/"
                      className="inline-block bg-[#006E2F] text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md hover:bg-emerald-800 transition-colors"
                    >
                      Start Shopping
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((ord, idx) => (
                      <div
                        key={`${ord.id}-${idx}`}
                        className="border border-gray-200 rounded-2xl p-5 hover:border-emerald-400 transition-all space-y-3 bg-gray-50/50"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200/60 pb-3">
                          <div>
                            <span className="font-black text-gray-900 text-xs block">Order #{ord.orderNumber}</span>
                            <span className="text-[11px] text-gray-500">{new Date(ord.placedAt).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-1 rounded-full uppercase">
                              {ord.orderStatus.replace('_', ' ')}
                            </span>
                            <span className="text-xs font-black text-gray-900">₹{ord.total}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-4 text-xs">
                          <div className="text-gray-600 font-medium">
                            <span>{ord.items.length} Items: </span>
                            <span className="font-bold text-gray-800">
                              {ord.items.map((i) => i.product?.name || 'Item').join(', ').slice(0, 45)}...
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Link
                              href={`/orders/${ord.id}/track`}
                              className="bg-[#006E2F] text-white font-extrabold text-[11px] px-3.5 py-1.5 rounded-lg hover:bg-emerald-800 transition-colors shadow-2xs"
                            >
                              Track Order
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── TAB: NOTIFICATIONS FEED ── */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                  <div>
                    <h3 className="text-lg font-black text-gray-900">Notifications Center</h3>
                    <p className="text-xs text-gray-500">All your order milestones, delivery alerts, and offer updates</p>
                  </div>
                  {customerNotifs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => markAllNotificationsRead('customer')}
                      className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition-colors"
                    >
                      <CheckCheck className="w-4 h-4" />
                      <span>Mark all as read</span>
                    </button>
                  )}
                </div>

                {customerNotifs.length === 0 ? (
                  <div className="text-center py-16 space-y-3">
                    <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                      <Bell className="w-7 h-7" />
                    </div>
                    <p className="text-sm font-bold text-gray-700">No notifications yet</p>
                    <p className="text-xs text-gray-400 max-w-sm mx-auto">
                      We will notify you about your order progress, dispatch status, and exclusive discount codes here.
                    </p>
                  </div>
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
                            ? 'bg-emerald-50/40 border-emerald-300 ring-2 ring-emerald-500/10'
                            : 'bg-white border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                            notif.category === 'offer'
                              ? 'bg-amber-100 text-amber-700'
                              : notif.category === 'delivery'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-emerald-100 text-emerald-800'
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
                            <h4 className={`text-xs ${!notif.isRead ? 'font-black text-gray-900' : 'font-bold text-gray-800'}`}>
                              {notif.title}
                            </h4>
                            <span className="text-[11px] text-gray-400 shrink-0 font-medium">
                              {new Date(notif.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          <p className="text-xs text-gray-600 leading-relaxed mb-2">{notif.message}</p>

                          {notif.couponCode && (
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200 rounded-lg text-xs font-bold text-amber-900">
                              <span>Promo Code:</span>
                              <span className="font-mono font-black text-amber-800">{notif.couponCode}</span>
                            </div>
                          )}

                          {notif.imageUrl && (
                            <div className="mt-2 rounded-xl overflow-hidden max-w-sm border border-gray-200">
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
                          className="text-gray-400 hover:text-rose-500 p-1 rounded-lg hover:bg-gray-100 transition-colors"
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
                <div className="pb-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-black text-gray-900">Notification Settings</h3>
                    <p className="text-xs text-gray-500">Customize which alerts and channels you want to receive</p>
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
                <div className="bg-gray-50/70 border border-gray-200 rounded-2xl p-5 space-y-4">
                  <h4 className="font-black text-xs text-gray-900 uppercase tracking-wider">Alert Categories</h4>
                  
                  <div className="space-y-3 divide-y divide-gray-200/60 text-xs">
                    {/* Order Updates */}
                    <div className="flex items-center justify-between pt-2">
                      <div>
                        <strong className="font-bold text-gray-900 block">Order Updates (Mandatory)</strong>
                        <span className="text-gray-500 text-[11px]">Order confirmed, preparing, delivered, cancellations &amp; refunds.</span>
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
                        <strong className="font-bold text-gray-900 block">Delivery Updates</strong>
                        <span className="text-gray-500 text-[11px]">Live driver assignment, out for delivery, and 200m nearby alerts.</span>
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
                        <strong className="font-bold text-gray-900 block">Offers &amp; Discounts</strong>
                        <span className="text-gray-500 text-[11px]">Exclusive promo coupons, wallet cashback, and flash savings.</span>
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
                        <strong className="font-bold text-gray-900 block">New Products &amp; Categories</strong>
                        <span className="text-gray-500 text-[11px]">Fresh farm arrivals, seasonal fruits, and new brand additions.</span>
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
                        <strong className="font-bold text-gray-900 block">Festival &amp; Holiday Specials</strong>
                        <span className="text-gray-500 text-[11px]">Diwali, Holi, New Year, and seasonal festive discounts.</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={notificationPreferences.festivalOffers}
                        onChange={(e) => updateNotificationPreferences({ festivalOffers: e.target.checked })}
                        className="w-4 h-4 text-emerald-600 rounded-sm cursor-pointer accent-[#006E2F]"
                      />
                    </div>
                  </div>
                </div>

                {/* Section B: Delivery Channels */}
                <div className="bg-gray-50/70 border border-gray-200 rounded-2xl p-5 space-y-4">
                  <h4 className="font-black text-xs text-gray-900 uppercase tracking-wider">Notification Channels</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    {/* Web Push */}
                    <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl">
                      <div className="flex items-center gap-2.5">
                        <Smartphone className="w-4 h-4 text-emerald-600" />
                        <div>
                          <strong className="font-bold text-gray-900 block">Push Notifications</strong>
                          <span className="text-gray-500 text-[10px]">Browser &amp; Device popups</span>
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
                    <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl">
                      <div className="flex items-center gap-2.5">
                        <Volume2 className="w-4 h-4 text-amber-600" />
                        <div>
                          <strong className="font-bold text-gray-900 block">Audio Chimes</strong>
                          <span className="text-gray-500 text-[10px]">In-app sound effects</span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={notificationPreferences.soundEnabled}
                        onChange={(e) => updateNotificationPreferences({ soundEnabled: e.target.checked })}
                        className="w-4 h-4 accent-[#006E2F] cursor-pointer"
                      />
                    </div>

                    {/* Email Notifications */}
                    <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl">
                      <div className="flex items-center gap-2.5">
                        <Mail className="w-4 h-4 text-indigo-600" />
                        <div>
                          <strong className="font-bold text-gray-900 block">Email Invoices</strong>
                          <span className="text-gray-500 text-[10px]">Order PDF &amp; statements</span>
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
                    <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl">
                      <div className="flex items-center gap-2.5">
                        <MessageSquare className="w-4 h-4 text-slate-600" />
                        <div>
                          <strong className="font-bold text-gray-900 block">SMS Alerts</strong>
                          <span className="text-gray-500 text-[10px]">OTP &amp; dispatch SMS</span>
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
                <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                  <div>
                    <h3 className="text-lg font-black text-gray-900">Saved Addresses ({addresses.length})</h3>
                    <p className="text-xs text-gray-500">Manage delivery locations for 8-min grocery drop</p>
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
                  <div className="text-center py-12 space-y-3">
                    <MapPin className="w-12 h-12 text-gray-300 mx-auto" />
                    <p className="text-sm font-bold text-gray-700">No saved addresses yet</p>
                    <button
                      type="button"
                      onClick={() => handleOpenLocationPicker()}
                      className="inline-flex items-center gap-1.5 bg-[#006E2F] text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md hover:bg-emerald-800 transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Delivery Address</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {addresses.map((addr) => (
                    <div
                      key={addr.id}
                      className={`p-4 rounded-2xl border transition-all space-y-2 relative ${
                        addr.isDefault
                          ? 'border-[#006E2F] bg-emerald-50/40 ring-2 ring-emerald-500/20'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs text-gray-900 uppercase tracking-wider bg-gray-100 px-2 py-0.5 rounded-md">
                          {addr.addressType}
                        </span>
                        {addr.isDefault && (
                          <span className="bg-[#006E2F] text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                            Default
                          </span>
                        )}
                      </div>
                      <h4 className="font-extrabold text-xs text-gray-900">{addr.fullName}</h4>
                      <p className="text-xs text-gray-600">{addr.addressLine1}, {addr.addressLine2 ? `${addr.addressLine2}, ` : ''}{addr.city}, {addr.state} - {addr.postalCode}</p>
                      <p className="text-[11px] font-bold text-gray-500">Phone: {addr.phone}</p>

                      <div className="pt-2 border-t border-gray-100 flex items-center gap-3 text-xs font-bold text-gray-700">
                        <button
                          type="button"
                          onClick={() => handleOpenLocationPicker(addr)}
                          className="text-emerald-700 hover:text-emerald-900 font-extrabold cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteAddress(addr.id)}
                          className="hover:text-red-600 cursor-pointer"
                        >
                          Delete
                        </button>
                        {!addr.isDefault && (
                          <button
                            type="button"
                            onClick={() => setDefaultAddress(addr.id)}
                            className="text-emerald-700 hover:text-emerald-900 font-extrabold ml-auto cursor-pointer"
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

            {/* ── TAB 3: PAYMENT METHOD ── */}
            {activeTab === 'payment_method' && (
              <div className="space-y-6">
                <div className="pb-4 border-b border-gray-100">
                  <h3 className="text-lg font-black text-gray-900">Payment Methods</h3>
                  <p className="text-xs text-gray-500">Saved UPI IDs, Wallets &amp; Cards for 1-click checkout</p>
                </div>

                <div className="space-y-3">
                  <div className="p-4 rounded-2xl border border-gray-200 flex items-center justify-between bg-gray-50/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
                        UPI
                      </div>
                      <div>
                        <h4 className="font-extrabold text-xs text-gray-900">Google Pay / PhonePe</h4>
                        <span className="text-[11px] text-gray-500">{userMobile}@upi (Primary)</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">Verified</span>
                  </div>

                  <div className="p-4 rounded-2xl border border-gray-200 flex items-center justify-between bg-gray-50/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black">
                        💳
                      </div>
                      <div>
                        <h4 className="font-extrabold text-xs text-gray-900">HDFC Bank Credit Card</h4>
                        <span className="text-[11px] text-gray-500">•••• •••• •••• 4829</span>
                      </div>
                    </div>
                    <button type="button" className="text-xs font-bold text-red-600 hover:underline cursor-pointer">Remove</button>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 4: MY WISHLIST ── */}
            {activeTab === 'wishlist' && (
              <div className="space-y-6">
                <div className="pb-4 border-b border-gray-100">
                  <h3 className="text-lg font-black text-gray-900">My Wishlist ({wishlistedProducts.length})</h3>
                  <p className="text-xs text-gray-500">Products you saved for future grocery orders</p>
                </div>

                {wishlistedProducts.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {wishlistedProducts.map((prod) => (
                      <div key={prod.id} className="border border-gray-200 rounded-2xl p-3 bg-white space-y-2 relative">
                        <img src={prod.thumbnail} alt={prod.name} className="w-full h-24 object-contain" />
                        <h4 className="font-bold text-xs text-gray-900 line-clamp-1">{prod.name}</h4>
                        <div className="flex items-center justify-between">
                          <span className="font-black text-xs text-gray-900">₹{prod.price}</span>
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
                  <div className="text-center py-12 space-y-2">
                    <Heart className="w-10 h-10 text-gray-300 mx-auto" />
                    <p className="text-xs font-bold text-gray-500">Your wishlist is currently empty</p>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB 5: FAQ & HELP ── */}
            {activeTab === 'faq' && (
              <div className="space-y-6">
                <div className="pb-4 border-b border-gray-100">
                  <h3 className="text-lg font-black text-gray-900">FAQ &amp; Customer Support</h3>
                  <p className="text-xs text-gray-500">Frequently asked questions and direct resolution desk</p>
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
                    <div key={idx} className="border border-gray-200 rounded-2xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setOpenFaqIdx(openFaqIdx === idx ? null : idx)}
                        className="w-full p-4 text-left flex items-center justify-between font-bold text-xs text-gray-900 bg-gray-50/50 hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        <span>{faq.q}</span>
                        {openFaqIdx === idx ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                      </button>
                      {openFaqIdx === idx && (
                        <div className="p-4 text-xs text-gray-600 bg-white border-t border-gray-100 leading-relaxed">
                          {faq.a}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Support Ticket */}
                <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-5 space-y-4 mt-6">
                  <h4 className="font-black text-sm text-gray-900">Need more help? Raise a Support Ticket</h4>
                  <form onSubmit={handleRaiseTicket} className="space-y-3 text-xs">
                    <div>
                      <label className="font-bold text-gray-700 mb-1 block">Subject</label>
                      <input
                        type="text"
                        placeholder="e.g., Issue with Order #PK-8921"
                        value={ticketSubject}
                        onChange={(e) => setTicketSubject(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-gray-900 font-bold focus:outline-none focus:border-[#006E2F]"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-gray-700 mb-1 block">Description</label>
                      <textarea
                        rows={3}
                        placeholder="Describe your query or issue in detail..."
                        value={ticketDesc}
                        onChange={(e) => setTicketDesc(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-gray-900 font-medium focus:outline-none focus:border-[#006E2F]"
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
