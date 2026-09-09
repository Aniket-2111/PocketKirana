import React from 'react';
import Link from 'next/link';
import { ShoppingBag, SearchX, PackageX, HeartOff, FolderOpen } from 'lucide-react';

type EmptyStateVariant = 'cart' | 'search' | 'orders' | 'wishlist' | 'generic';

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title?: string;
  description?: string;
  ctaLabel?: string;
  ctaHref?: string;
  onCtaClick?: () => void;
}

const defaults: Record<EmptyStateVariant, { icon: React.ComponentType<{ className?: string }>; title: string; description: string; cta: string; href: string }> = {
  cart: {
    icon: ShoppingBag,
    title: 'Your cart is empty',
    description: 'Add items from our store to get started.',
    cta: 'Shop Now',
    href: '/',
  },
  search: {
    icon: SearchX,
    title: 'No results found',
    description: 'Try different keywords or browse by category.',
    cta: 'Browse Categories',
    href: '/',
  },
  orders: {
    icon: PackageX,
    title: 'No orders yet',
    description: "Looks like you haven't placed any orders. Start shopping!",
    cta: 'Start Shopping',
    href: '/',
  },
  wishlist: {
    icon: HeartOff,
    title: 'Your wishlist is empty',
    description: 'Save products you love and come back later.',
    cta: 'Explore Products',
    href: '/',
  },
  generic: {
    icon: FolderOpen,
    title: 'Nothing here yet',
    description: 'Check back later for updates.',
    cta: 'Go Home',
    href: '/',
  },
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  variant = 'generic',
  title,
  description,
  ctaLabel,
  ctaHref,
  onCtaClick,
}) => {
  const config = defaults[variant];
  const Icon = config.icon;
  const displayTitle = title || config.title;
  const displayDesc = description || config.description;
  const displayCta = ctaLabel || config.cta;
  const displayHref = ctaHref || config.href;

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-5">
        <Icon className="w-9 h-9 text-gray-400" />
      </div>
      <h3 className="text-lg font-bold text-gray-800 mb-2">{displayTitle}</h3>
      <p className="text-sm text-gray-500 max-w-xs mb-6">{displayDesc}</p>
      {onCtaClick ? (
        <button
          onClick={onCtaClick}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors"
        >
          {displayCta}
        </button>
      ) : (
        <Link
          href={displayHref}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors"
        >
          {displayCta}
        </Link>
      )}
    </div>
  );
};
