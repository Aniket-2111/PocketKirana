'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ErrorState } from './ErrorState';
import { mapApiError, NormalizedApiError } from '@/lib/apiErrorMapper';

interface Props {
  children: ReactNode;
  fallback?: ReactNode | ((error: NormalizedApiError, reset: () => void) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: NormalizedApiError | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    const normalized = mapApiError(error, 'Application Render Boundary');
    return {
      hasError: true,
      error: normalized,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[GlobalErrorBoundary caught render exception]', error, errorInfo);
    }
    this.props.onError?.(error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError && this.state.error) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.state.error, this.handleReset);
      }
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-4">
          <ErrorState
            error={this.state.error}
            onRetry={this.handleReset}
            showHomeButton
            showSupportButton
          />
        </div>
      );
    }

    return this.props.children;
  }
}
