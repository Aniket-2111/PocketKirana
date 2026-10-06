'use client';

import React from 'react';
import { AsyncStateStatus } from '@/lib/useAsyncState';
import { NormalizedApiError } from '@/lib/apiErrorMapper';
import { PageLoadingState, Skeleton } from './LoadingState';
import { ErrorState } from './ErrorState';
import { OfflineState } from './OfflineState';
import { SlowNetworkState } from './SlowNetworkState';
import { EmptyState, EmptyStateVariant, EmptyStateProps } from './EmptyState';
import { NoSearchResults, NoSearchResultsProps } from './NoSearchResults';
import { PermissionDeniedState, PermissionDeniedStateProps } from './PermissionDeniedState';
import { SessionExpiredState } from './SessionExpiredState';

export type UnifiedState =
  | AsyncStateStatus
  | 'empty'
  | 'no_results'
  | 'permission_denied';

export interface StateContainerProps {
  state: UnifiedState;
  children: React.ReactNode;
  loadingFallback?: React.ReactNode;
  error?: NormalizedApiError | Error | string | null;
  onRetry?: () => void | Promise<void>;
  onBack?: () => void;
  emptyProps?: EmptyStateProps;
  searchEmptyProps?: NoSearchResultsProps;
  permissionProps?: PermissionDeniedStateProps;
  showSlowNotice?: boolean;
  className?: string;
}

export const StateContainer: React.FC<StateContainerProps> = ({
  state,
  children,
  loadingFallback,
  error,
  onRetry,
  onBack,
  emptyProps,
  searchEmptyProps,
  permissionProps,
  showSlowNotice = true,
  className = '',
}) => {
  switch (state) {
    case 'loading':
      return (
        <div className={className}>
          {loadingFallback || <PageLoadingState />}
        </div>
      );

    case 'slow':
      return (
        <div className={`space-y-4 ${className}`}>
          {showSlowNotice && <SlowNetworkState onRetry={onRetry} inline />}
          {loadingFallback || <PageLoadingState subtitle="Your network connection seems slow..." />}
        </div>
      );

    case 'offline':
      return (
        <div className={className}>
          <OfflineState onRetry={onRetry} />
        </div>
      );

    case 'session_expired':
      return (
        <div className={className}>
          <SessionExpiredState />
        </div>
      );

    case 'error':
      return (
        <div className={className}>
          <ErrorState error={error} onRetry={onRetry} onBack={onBack} />
        </div>
      );

    case 'empty':
      return (
        <div className={className}>
          <EmptyState {...emptyProps} />
        </div>
      );

    case 'no_results':
      return (
        <div className={className}>
          <NoSearchResults {...searchEmptyProps} />
        </div>
      );

    case 'permission_denied':
      if (permissionProps) {
        return (
          <div className={className}>
            <PermissionDeniedState {...permissionProps} />
          </div>
        );
      }
      return (
        <div className={className}>
          <ErrorState title="Permission Required" message="Access was denied for this feature." onRetry={onRetry} />
        </div>
      );

    case 'idle':
    case 'success':
    default:
      return <>{children}</>;
  }
};
