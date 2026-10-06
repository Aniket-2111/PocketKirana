'use client';

import React from 'react';
import Link from 'next/link';
import {
  Check,
  CheckCircle2,
  ShoppingBag,
  CreditCard,
  MapPin,
  UserCheck,
  PackageCheck,
  Boxes,
  ArrowRight,
  LucideIcon,
} from 'lucide-react';

export type SuccessVariant =
  | 'order-placed'
  | 'payment-success'
  | 'profile-updated'
  | 'address-saved'
  | 'product-saved'
  | 'handover-done'
  | 'generic';

export interface SuccessAction {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: 'primary' | 'secondary';
}

export interface SuccessStateProps {
  variant?: SuccessVariant;
  title?: string;
  description?: string;
  icon?: LucideIcon;
  primaryAction?: SuccessAction;
  secondaryAction?: SuccessAction;
  referenceId?: string;
  isModal?: boolean;
  className?: string;
}

const successConfigs: Record<
  SuccessVariant,
  {
    icon: LucideIcon;
    title: string;
    description: string;
    primaryAction: SuccessAction;
    secondaryAction?: SuccessAction;
  }
> = {
  'order-placed': {
    icon: PackageCheck,
    title: 'Order Placed Successfully!',
    description:
      'Your order has been received at Maule Kirana darkstore. Our picker is preparing your fresh grocery pack for 30-min express delivery.',
    primaryAction: { label: 'Track Live Order', href: '/orders' },
    secondaryAction: { label: 'Continue Shopping', href: '/' },
  },
  'payment-success': {
    icon: CreditCard,
    title: 'Payment Successful',
    description: 'Your payment was confirmed and reconciled securely.',
    primaryAction: { label: 'View Receipt', href: '/orders' },
  },
  'profile-updated': {
    icon: UserCheck,
    title: 'Profile Saved',
    description: 'Your account details have been updated successfully.',
    primaryAction: { label: 'Done', href: '/profile' },
  },
  'address-saved': {
    icon: MapPin,
    title: 'Address Saved',
    description: 'Your new delivery address has been stored and set for express checkout.',
    primaryAction: { label: 'Continue', href: '/saved-addresses' },
  },
  'product-saved': {
    icon: Boxes,
    title: 'Product Catalog Updated',
    description: 'Inventory numbers and price points have been synchronized across all channels.',
    primaryAction: { label: 'Back to Inventory', href: '/admin' },
  },
  'handover-done': {
    icon: ShoppingBag,
    title: 'Order Handover Completed',
    description: 'The packed grocery crate has been verified and handed over to the delivery partner.',
    primaryAction: { label: 'Next Order', variant: 'primary' },
  },
  generic: {
    icon: CheckCircle2,
    title: 'Success!',
    description: 'Your action has been processed and saved successfully.',
    primaryAction: { label: 'Continue', href: '/' },
  },
};

export const SuccessState: React.FC<SuccessStateProps> = ({
  variant = 'generic',
  title,
  description,
  icon: CustomIcon,
  primaryAction,
  secondaryAction,
  referenceId,
  isModal = false,
  className = '',
}) => {
  const config = successConfigs[variant] || successConfigs.generic;
  const IconComponent = CustomIcon || config.icon;
  const displayTitle = title || config.title;
  const displayDesc = description || config.description;

  const resolvedPrimaryAction = primaryAction || config.primaryAction;
  const resolvedSecondaryAction = secondaryAction || config.secondaryAction;

  const renderActionButton = (action: SuccessAction, isPrimary = true) => {
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

  const content = (
    <div
      role="region"
      aria-label="Action succeeded"
      className={`max-w-md mx-auto text-center space-y-6 ${
        isModal
          ? 'p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800'
          : 'py-14 px-4'
      } ${className}`}
    >
      {/* Animated Success Ring & Checkmark */}
      <div className="relative w-20 h-20 mx-auto mb-5 flex items-center justify-center animate-pop-success">
        <div className="absolute inset-0 rounded-full bg-emerald-500/20 dark:bg-emerald-500/10 animate-pulse" />
        <div className="relative w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#006E2F] to-[#22c55e] flex items-center justify-center shadow-lg shadow-emerald-700/20 text-white">
          <IconComponent className="w-8 h-8 stroke-[2.5]" aria-hidden="true" />
        </div>
      </div>

      {/* Heading & description */}
      <div className="space-y-2">
        <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 leading-tight">
          {displayTitle}
        </h3>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
          {displayDesc}
        </p>
      </div>

      {/* Reference number badge */}
      {referenceId && (
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-mono text-slate-700 dark:text-slate-300">
          <span>Order Ref:</span>
          <span className="font-bold">{referenceId}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center gap-3 justify-center pt-2">
        {resolvedPrimaryAction && renderActionButton(resolvedPrimaryAction, true)}
        {resolvedSecondaryAction && renderActionButton(resolvedSecondaryAction, false)}
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeSlideUp">
        {content}
      </div>
    );
  }

  return content;
};
