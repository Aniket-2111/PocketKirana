import React from 'react';

interface SkeletonProps {
  className?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', rounded = 'md' }) => {
  const radius = {
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    '2xl': 'rounded-2xl',
    full: 'rounded-full',
  }[rounded];

  return (
    <div
      className={`bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:400%_100%] animate-pulse ${radius} ${className}`}
    />
  );
};

export const ProductCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-2xl border border-gray-200 p-3 flex flex-col gap-2">
    <Skeleton className="w-full h-32" rounded="xl" />
    <Skeleton className="h-3 w-16" rounded="md" />
    <Skeleton className="h-4 w-full" rounded="md" />
    <Skeleton className="h-3 w-24" rounded="md" />
    <div className="flex items-center justify-between mt-1">
      <Skeleton className="h-5 w-12" rounded="md" />
      <Skeleton className="h-8 w-16" rounded="lg" />
    </div>
  </div>
);

export const CategoryCardSkeleton: React.FC = () => (
  <div className="flex flex-col items-center gap-1.5">
    <Skeleton className="w-14 h-14" rounded="xl" />
    <Skeleton className="h-3 w-12" rounded="md" />
  </div>
);

export const BannerSkeleton: React.FC = () => (
  <Skeleton className="w-full h-52 md:h-72" rounded="2xl" />
);
