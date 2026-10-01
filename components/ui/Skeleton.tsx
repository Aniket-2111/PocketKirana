'use client';

import React from 'react';
import { Skeleton } from '@/components/states/LoadingState';

export {
  Skeleton,
  ButtonLoader,
  ProgressBar,
  PageLoadingState,
  ProductCardSkeleton,
  ProductGridSkeleton,
  OrderCardSkeleton,
  TableSkeleton,
  KPICardSkeleton,
  CartItemSkeleton,
} from '@/components/states/LoadingState';

export const CategoryCardSkeleton: React.FC = () => (
  <div className="flex flex-col items-center gap-1.5">
    <Skeleton className="w-14 h-14" rounded="xl" />
    <Skeleton className="h-3 w-12" rounded="md" />
  </div>
);

export const BannerSkeleton: React.FC = () => (
  <Skeleton className="w-full h-52 md:h-72" rounded="2xl" />
);
