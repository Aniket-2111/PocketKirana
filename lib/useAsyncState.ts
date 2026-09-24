'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { mapApiError, NormalizedApiError } from './apiErrorMapper';

export type AsyncStateStatus =
  | 'idle'
  | 'loading'
  | 'slow'
  | 'success'
  | 'error'
  | 'offline'
  | 'session_expired';

export interface UseAsyncStateOptions<T> {
  initialData?: T;
  slowThresholdMs?: number; // default 4000ms
  onSuccess?: (data: T) => void;
  onError?: (error: NormalizedApiError) => void;
  context?: string;
  preventDuplicateSubmits?: boolean;
}

export interface UseAsyncStateResult<T> {
  status: AsyncStateStatus;
  data: T | undefined;
  error: NormalizedApiError | null;
  isLoading: boolean;
  isSlow: boolean;
  isSuccess: boolean;
  isError: boolean;
  isOffline: boolean;
  isSessionExpired: boolean;
  execute: (asyncFn: () => Promise<T>) => Promise<T | undefined>;
  retry: () => Promise<T | undefined>;
  cancel: () => void;
  reset: () => void;
  setData: (data: T) => void;
  setError: (error: NormalizedApiError | null) => void;
}

export function useAsyncState<T = any>(options: UseAsyncStateOptions<T> = {}): UseAsyncStateResult<T> {
  const {
    initialData,
    slowThresholdMs = 4000,
    onSuccess,
    onError,
    context,
    preventDuplicateSubmits = true,
  } = options;

  const [status, setStatus] = useState<AsyncStateStatus>('idle');
  const [data, setDataState] = useState<T | undefined>(initialData);
  const [error, setErrorState] = useState<NormalizedApiError | null>(null);

  const slowTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastFnRef = useRef<(() => Promise<T>) | null>(null);
  const isExecutingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const clearSlowTimer = useCallback(() => {
    if (slowTimerRef.current) {
      clearTimeout(slowTimerRef.current);
      slowTimerRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    clearSlowTimer();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    isExecutingRef.current = false;
    setStatus((prev) => (prev === 'loading' || prev === 'slow' ? 'idle' : prev));
  }, [clearSlowTimer]);

  const reset = useCallback(() => {
    cancel();
    setStatus('idle');
    setDataState(initialData);
    setErrorState(null);
  }, [cancel, initialData]);

  const execute = useCallback(
    async (asyncFn: () => Promise<T>): Promise<T | undefined> => {
      // Guard against double submit while executing
      if (preventDuplicateSubmits && isExecutingRef.current) {
        return undefined;
      }

      // Check immediate offline condition
      if (typeof window !== 'undefined' && !navigator.onLine) {
        const offlineErr = mapApiError(new Error('Device is offline'), context);
        setStatus('offline');
        setErrorState(offlineErr);
        onError?.(offlineErr);
        return undefined;
      }

      lastFnRef.current = asyncFn;
      isExecutingRef.current = true;
      setStatus('loading');
      setErrorState(null);

      // Start slow network timer
      clearSlowTimer();
      slowTimerRef.current = setTimeout(() => {
        if (isExecutingRef.current) {
          setStatus('slow');
        }
      }, slowThresholdMs);

      try {
        const result = await asyncFn();
        clearSlowTimer();
        isExecutingRef.current = false;
        setDataState(result);
        setStatus('success');
        onSuccess?.(result);
        return result;
      } catch (err: any) {
        clearSlowTimer();
        isExecutingRef.current = false;

        const normalized = mapApiError(err, context);
        setErrorState(normalized);

        if (normalized.code === 'UNAUTHORIZED') {
          setStatus('session_expired');
        } else if (normalized.code === 'OFFLINE') {
          setStatus('offline');
        } else {
          setStatus('error');
        }

        onError?.(normalized);
        return undefined;
      }
    },
    [clearSlowTimer, context, onError, onSuccess, preventDuplicateSubmits, slowThresholdMs]
  );

  const retry = useCallback(async (): Promise<T | undefined> => {
    if (lastFnRef.current) {
      return execute(lastFnRef.current);
    }
    return undefined;
  }, [execute]);

  useEffect(() => {
    return () => {
      clearSlowTimer();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [clearSlowTimer]);

  return {
    status,
    data,
    error,
    isLoading: status === 'loading',
    isSlow: status === 'slow',
    isSuccess: status === 'success',
    isError: status === 'error',
    isOffline: status === 'offline',
    isSessionExpired: status === 'session_expired',
    execute,
    retry,
    cancel,
    reset,
    setData: (newData: T) => setDataState(newData),
    setError: (newErr: NormalizedApiError | null) => {
      setErrorState(newErr);
      if (newErr) {
        setStatus(newErr.code === 'UNAUTHORIZED' ? 'session_expired' : newErr.code === 'OFFLINE' ? 'offline' : 'error');
      } else {
        setStatus('idle');
      }
    },
  };
}
