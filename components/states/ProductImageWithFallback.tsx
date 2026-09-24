'use client';

import React, { useState } from 'react';
import { ShoppingBag, Apple, Milk } from 'lucide-react';

export interface ProductImageWithFallbackProps
  extends React.ImgHTMLAttributes<HTMLImageElement> {
  category?: string;
  fallbackIcon?: 'bag' | 'fruit' | 'dairy' | 'generic';
  aspectRatio?: 'square' | 'video' | 'portrait' | 'none';
  containerClassName?: string;
}

export const ProductImageWithFallback: React.FC<ProductImageWithFallbackProps> = ({
  src,
  alt = 'Grocery product',
  category,
  fallbackIcon = 'bag',
  aspectRatio = 'square',
  className = '',
  containerClassName = '',
  ...imgProps
}) => {
  const [hasError, setHasError] = useState(!src);
  const [isLoading, setIsLoading] = useState(Boolean(src));

  const aspectClass =
    aspectRatio === 'none'
      ? ''
      : aspectRatio === 'square'
      ? 'aspect-square'
      : aspectRatio === 'video'
      ? 'aspect-video'
      : 'aspect-[3/4]';

  const renderFallbackIcon = () => {
    const catLower = (category || '').toLowerCase();
    if (catLower.includes('fruit') || catLower.includes('veg')) {
      return <Apple className="w-6 h-6 text-emerald-600 dark:text-emerald-400 opacity-60" />;
    }
    if (catLower.includes('milk') || catLower.includes('dairy') || catLower.includes('egg')) {
      return <Milk className="w-6 h-6 text-blue-600 dark:text-blue-400 opacity-60" />;
    }
    return <ShoppingBag className="w-6 h-6 text-emerald-700 dark:text-emerald-400 opacity-50" />;
  };

  const hasExplicitWidth = containerClassName.includes('w-') || containerClassName.includes('h-');

  return (
    <div
      className={`relative ${hasExplicitWidth ? '' : 'w-full'} ${aspectClass} overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 ${containerClassName}`}
    >
      {/* Loading Skeleton */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 bg-slate-200 dark:bg-slate-700/60 animate-pulse" />
      )}

      {/* Fallback Display if broken or missing */}
      {hasError ? (
        <div className="flex items-center justify-center w-full h-full bg-slate-100 dark:bg-slate-800/80 p-2">
          {renderFallbackIcon()}
        </div>
      ) : (
        /* Actual Image */
        <img
          {...imgProps}
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
          }}
          className={`w-full h-full object-contain transition-opacity duration-300 ${
            isLoading ? 'opacity-0' : 'opacity-100'
          } ${className}`}
        />
      )}
    </div>
  );
};
