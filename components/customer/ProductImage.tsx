'use client';

import React, { useState } from 'react';
import { Package } from 'lucide-react';

interface ProductImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  containerClassName?: string;
  loading?: 'lazy' | 'eager';
}

export const ProductImage: React.FC<ProductImageProps> = ({
  src,
  alt,
  className = 'w-full h-full object-contain',
  containerClassName = 'w-full h-full',
  loading = 'lazy',
}) => {
  const [hasError, setHasError] = useState(false);
  const containerClasses = containerClassName || 'w-full h-full';

  // If no source or failed to load, render accessible fallback placeholder
  if (!src || hasError) {
    return (
      <div
        className={`relative flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-slate-700/60 p-1.5 shrink-0 ${containerClasses}`}
        role="img"
        aria-label={`${alt} - image unavailable`}
      >
        <div className="flex flex-col items-center justify-center gap-0.5 text-slate-400 dark:text-slate-500">
          <Package className="w-5 h-5 opacity-60" aria-hidden="true" />
        </div>
        <span className="sr-only">Product image unavailable for {alt}</span>
      </div>
    );
  }

  return (
    <div className={`relative flex items-center justify-center overflow-hidden shrink-0 ${containerClasses}`}>
      <img
        src={src}
        alt={alt}
        loading={loading}
        decoding="async"
        onError={() => setHasError(true)}
        className={className}
      />
    </div>
  );
};
