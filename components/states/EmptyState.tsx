'use client';

import React from 'react';
import Link from 'next/link';
import {
  ShoppingBag,
  SearchX,
  PackageX,
  HeartOff,
  MapPinOff,
  BellOff,
  Tag,
  Clock,
  ClipboardList,
  Truck,
  Users,
  Boxes,
  FileSpreadsheet,
  AlertCircle,
  LucideIcon,
} from 'lucide-react';

export type EmptyStateVariant =
  | 'cart'
  | 'search'
  | 'orders'
  | 'wishlist'
  | 'addresses'
  | 'notifications'
  | 'coupons'
  | 'history'
  | 'picker-tasks'
  | 'picker-batches'
  | 'delivery-active'
  | 'delivery-history'
  | 'admin-products'
  | 'admin-categories'
  | 'admin-orders'
  | 'admin-customers'
  | 'admin-partners'
  | 'admin-inventory'
  | 'admin-reports'
  | 'generic';

export interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: 'primary' | 'secondary' | 'outline';
}

export interface EmptyStateProps {
  variant?: EmptyStateVariant | string;
  type?: string;
  context?: string;
  title?: string;
  description?: string;
  icon?: LucideIcon;
  primaryAction?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  ctaLabel?: string;
  ctaHref?: string;
  onCtaClick?: () => void;
  compact?: boolean;
  className?: string;
}

const variantConfigs: Record<
  EmptyStateVariant,
  {
    icon: LucideIcon;
    title: string;
    description: string;
    primaryAction?: EmptyStateAction;
    secondaryAction?: EmptyStateAction;
    iconBg: string;
    iconColor: string;
  }
> = {
  cart: {
    icon: ShoppingBag,
    title: 'Your cart is empty',
    description: 'Add fresh groceries from Maule Kirana to start your 30-min express delivery order.',
    primaryAction: { label: 'Start Shopping', href: '/' },
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  search: {
    icon: SearchX,
    title: 'No results found',
    description: 'We couldn’t find matching groceries. Try searching for atta, milk, biscuits, or fruits.',
    primaryAction: { label: 'Explore Categories', href: '/categories' },
    iconBg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  orders: {
    icon: PackageX,
    title: 'No orders placed yet',
    description: 'When you place orders for daily essentials, they will appear here with live tracking.',
    primaryAction: { label: 'Browse Products', href: '/' },
    iconBg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  wishlist: {
    icon: HeartOff,
    title: 'Your wishlist is empty',
    description: 'Save favorite items to easily order them anytime with one tap.',
    primaryAction: { label: 'Explore Store', href: '/' },
    iconBg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60',
    iconColor: 'text-rose-600 dark:text-rose-400',
  },
  addresses: {
    icon: MapPinOff,
    title: 'No saved addresses',
    description: 'Add your home or office address for fast, accurate 30-min delivery.',
    primaryAction: { label: 'Add New Address', href: '/saved-addresses?action=new' },
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  notifications: {
    icon: BellOff,
    title: 'No notifications',
    description: 'You are all caught up! Order status and exclusive offers will show up here.',
    iconBg: 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700',
    iconColor: 'text-slate-500 dark:text-slate-400',
  },
  coupons: {
    icon: Tag,
    title: 'No active coupons',
    description: 'Check back soon for festive discounts, cashbacks, and special promo codes.',
    primaryAction: { label: 'View Offers', href: '/offers' },
    iconBg: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800/60',
    iconColor: 'text-purple-600 dark:text-purple-400',
  },
  history: {
    icon: Clock,
    title: 'No recent searches',
    description: 'Your recent product searches will appear here for fast re-access.',
    iconBg: 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700',
    iconColor: 'text-slate-500 dark:text-slate-400',
  },
  'picker-tasks': {
    icon: ClipboardList,
    title: 'No picking tasks assigned',
    description: 'All current customer orders have been picked and packed. Enjoy the breather!',
    primaryAction: { label: 'Refresh Queue', variant: 'primary' },
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  'picker-batches': {
    icon: Boxes,
    title: 'No active batch queues',
    description: 'No pending orders waiting for batch routing right now.',
    iconBg: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/60',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
  },
  'delivery-active': {
    icon: Truck,
    title: 'No active deliveries',
    description: 'Stay online to receive instant delivery assignments from nearby stores.',
    primaryAction: { label: 'Go Online', variant: 'primary' },
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  'delivery-history': {
    icon: Clock,
    title: 'No past deliveries recorded',
    description: 'Completed deliveries and daily earnings will appear here.',
    iconBg: 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700',
    iconColor: 'text-slate-500 dark:text-slate-400',
  },
  'admin-products': {
    icon: Boxes,
    title: 'No products in catalog',
    description: 'Add your first product or import inventory via bulk CSV to start selling.',
    primaryAction: { label: 'Add Product', variant: 'primary' },
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  'admin-categories': {
    icon: Tag,
    title: 'No categories created',
    description: 'Create store categories to organize items for shoppers and pickers.',
    primaryAction: { label: 'Create Category', variant: 'primary' },
    iconBg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  'admin-orders': {
    icon: PackageX,
    title: 'No store orders found',
    description: 'No orders have been received for the selected filters or date range.',
    iconBg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  'admin-customers': {
    icon: Users,
    title: 'No customers found',
    description: 'Registered customers and their order histories will appear here.',
    iconBg: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800/60',
    iconColor: 'text-purple-600 dark:text-purple-400',
  },
  'admin-partners': {
    icon: Truck,
    title: 'No delivery partners registered',
    description: 'Onboard and manage delivery drivers and assign delivery zones.',
    primaryAction: { label: 'Add Delivery Partner', variant: 'primary' },
    iconBg: 'bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800/60',
    iconColor: 'text-teal-600 dark:text-teal-400',
  },
  'admin-inventory': {
    icon: Boxes,
    title: 'No inventory movements recorded',
    description: 'All stock adjustments, returns, and FEFO reconciliations are logged here.',
    iconBg: 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700',
    iconColor: 'text-slate-500 dark:text-slate-400',
  },
  'admin-reports': {
    icon: FileSpreadsheet,
    title: 'No analytical reports generated',
    description: 'Select a date range and metrics to compile sales and fulfillment reports.',
    primaryAction: { label: 'Generate Report', variant: 'primary' },
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  generic: {
    icon: AlertCircle,
    title: 'No items to display',
    description: 'There are currently no items available in this section.',
    primaryAction: { label: 'Go Home', href: '/' },
    iconBg: 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700',
    iconColor: 'text-slate-500 dark:text-slate-400',
  },
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  variant = 'generic',
  type,
  context,
  title,
  description,
  icon: CustomIcon,
  primaryAction,
  secondaryAction,
  ctaLabel,
  ctaHref,
  onCtaClick,
  compact = false,
  className = '',
}) => {
  const rawVariant = (variant || type || context || 'generic') as string;
  const mappedVariantKey = rawVariant === 'products' ? 'admin-products' : (rawVariant === 'categories' ? 'admin-categories' : rawVariant);
  const config = (variantConfigs as Record<string, any>)[mappedVariantKey] || variantConfigs.generic;
  const IconComponent = CustomIcon || config.icon;
  const displayTitle = title || config.title;
  const displayDesc = description || config.description;

  const resolvedPrimaryAction =
    primaryAction ||
    (ctaLabel
      ? {
          label: ctaLabel,
          href: ctaHref,
          onClick: onCtaClick,
        }
      : config.primaryAction);
  const resolvedSecondaryAction = secondaryAction || config.secondaryAction;

  const renderActionButton = (action: EmptyStateAction, isPrimary = true) => {
    const baseClass = isPrimary
      ? 'bg-[#006E2F] hover:bg-[#004B1E] text-white shadow-md hover:shadow-lg focus:ring-4 focus:ring-emerald-500/20'
      : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700';

    const btnClass = `inline-flex items-center justify-center font-bold px-6 py-3 rounded-xl text-sm transition-all active:scale-95 cursor-pointer ${baseClass}`;

    if (action.href) {
      return (
        <Link href={action.href} className={btnClass}>
          {action.label}
        </Link>
      );
    }

    return (
      <button type="button" onClick={action.onClick} className={btnClass}>
        {action.label}
      </button>
    );
  };

  return (
    <div
      role="status"
      aria-label={displayTitle}
      className={`flex flex-col items-center justify-center text-center mx-auto ${
        compact ? 'py-8 px-4 max-w-sm' : 'py-16 px-4 max-w-md'
      } ${className}`}
    >
      {/* Icon Illustration with glow */}
      <div
        className={`relative ${
          compact ? 'w-14 h-14 mb-3' : 'w-20 h-20 mb-5'
        } rounded-3xl border flex items-center justify-center shadow-sm transition-transform duration-300 hover:scale-105 ${
          config.iconBg
        }`}
      >
        <IconComponent className={`${compact ? 'w-7 h-7' : 'w-9 h-9'} ${config.iconColor}`} aria-hidden="true" />
      </div>

      {/* Title */}
      <h3
        className={`font-black text-slate-900 dark:text-slate-100 mb-2 leading-tight ${
          compact ? 'text-base' : 'text-xl'
        }`}
      >
        {displayTitle}
      </h3>

      {/* Description */}
      <p
        className={`text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed ${
          compact ? 'text-xs mb-4' : 'text-sm mb-6'
        }`}
      >
        {displayDesc}
      </p>

      {/* Action Buttons */}
      {(resolvedPrimaryAction || resolvedSecondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto justify-center">
          {resolvedPrimaryAction && renderActionButton(resolvedPrimaryAction, true)}
          {resolvedSecondaryAction && renderActionButton(resolvedSecondaryAction, false)}
        </div>
      )}
    </div>
  );
};
