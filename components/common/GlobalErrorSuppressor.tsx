'use client';

import { useEffect } from 'react';

export function GlobalErrorSuppressor() {
  useEffect(() => {
    const isFirebaseAbortError = (err: any) => {
      if (!err) return false;
      const msg = String(err.message || err.reason?.message || err || '').toLowerCase();
      const name = String(err.name || err.reason?.name || '').toLowerCase();
      
      return (
        name === 'aborterror' ||
        msg.includes('signal is aborted') ||
        msg.includes('aborted without reason') ||
        msg.includes('aborted') ||
        msg.includes('failed to fetch') ||
        msg.includes('firestore.googleapis.com') ||
        msg.includes('webchannel') ||
        msg.includes('networkerror') ||
        (name === 'typeerror' && msg.includes('fetch'))
      );
    };

    const handleRejection = (e: PromiseRejectionEvent) => {
      if (isFirebaseAbortError(e.reason) || isFirebaseAbortError(e)) {
        e.preventDefault();
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      }
    };

    const handleError = (e: ErrorEvent) => {
      if (isFirebaseAbortError(e.error) || isFirebaseAbortError(e.message) || isFirebaseAbortError(e)) {
        e.preventDefault();
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      }
    };

    window.addEventListener('unhandledrejection', handleRejection, true);
    window.addEventListener('error', handleError, true);

    return () => {
      window.removeEventListener('unhandledrejection', handleRejection, true);
      window.removeEventListener('error', handleError, true);
    };
  }, []);

  return null;
}
