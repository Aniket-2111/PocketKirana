'use client';

import React from 'react';
import { ShoppingBag, Loader2 } from 'lucide-react';

export interface SkeletonProps {
  className?: string;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full';
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', rounded = 'md' }) => {
  const radiusMap = {
    none: 'rounded-none',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    '2xl': 'rounded-2xl',
    '3xl': 'rounded-3xl',
    full: 'rounded-full',
  };

  return (
    <div
      role="progressbar"
      aria-busy="true"
      aria-label="Loading content..."
      className={`bg-slate-200 dark:bg-slate-800/80 animate-pulse ${radiusMap[rounded]} ${className}`}
    />
  );
};

export const ButtonLoader: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}> = ({ size = 'md', label = 'Processing...', className = '' }) => {
  const sizeMap = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <span className={`inline-flex items-center gap-2 font-medium justify-center ${className}`}>
      <Loader2 className={`${sizeMap[size]} animate-spin`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
};

export const ProgressBar: React.FC<{
  progress: number; // 0 to 100
  label?: string;
  showPercent?: boolean;
  className?: string;
}> = ({ progress, label, showPercent = true, className = '' }) => {
  const clamped = Math.min(100, Math.max(0, progress));

  return (
    <div className={`w-full space-y-1.5 ${className}`}>
      {(label || showPercent) && (
        <div className="flex justify-between items-center text-xs font-semibold text-slate-700 dark:text-slate-300">
          <span>{label}</span>
          {showPercent && <span>{Math.round(clamped)}%</span>}
        </div>
      )}
      <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
        <div
          className="bg-emerald-600 h-full rounded-full transition-all duration-300 ease-out"
          style={{ width: `${clamped}%` }}
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
};

export const PageLoadingState: React.FC<{
  message?: string;
  subtitle?: string;
  fullScreen?: boolean;
}> = ({
  message = 'Loading PocketKirana...',
  subtitle = 'Fetching fresh groceries from Maule Kirana store',
  fullScreen = false,
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center p-6 text-center ${
        fullScreen ? 'fixed inset-0 z-50 bg-background/95 backdrop-blur-sm' : 'min-h-[50vh]'
      }`}
    >
      {/* Animated Brand Pulse */}
      <div className="relative w-20 h-20 mb-6 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-emerald-500/20 dark:bg-emerald-500/10 animate-ping" />
        <div className="relative w-16 h-16 rounded-2xl bg-[#006E2F] flex items-center justify-center shadow-lg shadow-emerald-700/20 text-white">
          <ShoppingBag className="w-8 h-8 animate-bounce" />
        </div>
      </div>

      <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 mb-1.5">{message}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">{subtitle}</p>

      {/* Subtle loader bar */}
      <div className="w-36 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-6">
        <div className="w-full h-full bg-emerald-600 origin-left animate-[fillProgress_1.5s_ease-in-out_infinite]" />
      </div>
    </div>
  );
};

export const ProductCardSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 flex flex-col gap-2.5 shadow-sm">
    <Skeleton className="w-full aspect-square" rounded="xl" />
    <Skeleton className="h-3 w-16" rounded="sm" />
    <Skeleton className="h-4 w-full" rounded="md" />
    <Skeleton className="h-3 w-24" rounded="sm" />
    <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100 dark:border-slate-800">
      <div className="space-y-1">
        <Skeleton className="h-5 w-14" rounded="md" />
        <Skeleton className="h-3 w-10" rounded="sm" />
      </div>
      <Skeleton className="h-8 w-20" rounded="xl" />
    </div>
  </div>
);

export const ProductGridSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
    {Array.from({ length: count }).map((_, idx) => (
      <ProductCardSkeleton key={idx} />
    ))}
  </div>
);

export const OrderCardSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-sm">
    <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
      <div className="space-y-1">
        <Skeleton className="h-4 w-28" rounded="md" />
        <Skeleton className="h-3 w-20" rounded="sm" />
      </div>
      <Skeleton className="h-6 w-24" rounded="full" />
    </div>
    <div className="flex items-center gap-3">
      <Skeleton className="w-12 h-12 flex-shrink-0" rounded="xl" />
      <div className="space-y-1 flex-1">
        <Skeleton className="h-3.5 w-3/4" rounded="md" />
        <Skeleton className="h-3 w-1/2" rounded="sm" />
      </div>
      <Skeleton className="h-5 w-14" rounded="md" />
    </div>
    <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
      <Skeleton className="h-8 w-28" rounded="xl" />
      <Skeleton className="h-8 w-24" rounded="xl" />
    </div>
  </div>
);

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 4,
}) => (
  <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
    <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex gap-4">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-4 flex-1" rounded="md" />
      ))}
    </div>
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="p-4 flex gap-4 items-center">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-4 flex-1" rounded="md" />
          ))}
        </div>
      ))}
    </div>
  </div>
);

export const KPICardSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm">
    <div className="flex justify-between items-center">
      <Skeleton className="h-3.5 w-24" rounded="md" />
      <Skeleton className="w-8 h-8" rounded="xl" />
    </div>
    <Skeleton className="h-7 w-28" rounded="lg" />
    <Skeleton className="h-3 w-36" rounded="sm" />
  </div>
);

export const CartItemSkeleton: React.FC = () => (
  <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
    <Skeleton className="w-14 h-14 flex-shrink-0" rounded="lg" />
    <div className="flex-1 space-y-1.5">
      <Skeleton className="h-3.5 w-3/4" rounded="md" />
      <Skeleton className="h-3 w-1/3" rounded="sm" />
      <Skeleton className="h-4 w-16" rounded="md" />
    </div>
    <Skeleton className="h-7 w-20" rounded="lg" />
  </div>
);
