'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Product } from '@/types';
import { ProductCard } from '@/components/customer/ProductCard';
import { useAppStore } from '@/lib/store';
import { filterPurchasableProducts } from '@/lib/recommendationsEngine';
import { Sparkles, CheckCircle2, RotateCcw, Loader2, Compass } from 'lucide-react';

interface ExploreMoreProductsProps {
  excludedProductIds?: string[];
  onOpenDetail?: (product: Product) => void;
  title?: string;
  subtitle?: string;
  badge?: string;
}

// ── Skeleton Card Component for Instant Layout Stability ───────────────────
function ProductSkeletonCard() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-3 sm:p-4 flex flex-col justify-between h-[330px] sm:h-[350px] animate-pulse">
      <div className="bg-slate-100 dark:bg-slate-800 rounded-xl sm:rounded-2xl h-36 sm:h-44 w-full mb-3" />
      <div className="space-y-2">
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-4/5" />
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
        <div className="flex items-center justify-between pt-2">
          <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
          <div className="h-8 w-16 bg-slate-200 dark:bg-slate-700 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export const ExploreMoreProducts: React.FC<ExploreMoreProductsProps> = ({
  excludedProductIds = [],
  onOpenDetail,
  title = 'Explore More Products',
  subtitle = 'Discover our full catalog of fresh fruits, vegetables, dairy & daily groceries',
  badge,
}) => {
  const { products: storeProducts } = useAppStore();

  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const [isError, setIsError] = useState(false);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadedIdsRef = useRef<Set<string>>(new Set());

  // Exclusion set including curated sections above
  const initialExcludeList = useMemo(() => {
    return Array.from(new Set(excludedProductIds.filter(Boolean)));
  }, [excludedProductIds]);

  // Initial products computation for 0ms initial load
  useEffect(() => {
    const excludeSet = new Set(initialExcludeList);
    const validStore = filterPurchasableProducts(storeProducts || []).filter(
      (p) => !excludeSet.has(p.id) && (!p.slug || !excludeSet.has(p.slug))
    );

    const initialSlice = validStore.slice(0, 12);
    initialSlice.forEach((p) => {
      loadedIdsRef.current.add(p.id);
      if (p.slug) loadedIdsRef.current.add(p.slug);
    });

    setProducts(initialSlice);
    setPage(initialSlice.length >= 12 ? 2 : 1);
    setHasMore(validStore.length > initialSlice.length);
    setIsLoading(false);
  }, [initialExcludeList, storeProducts]);

  // Fetch next page function
  const fetchPage = useCallback(
    async (pageToFetch: number) => {
      if (isFetchingNextPage || !hasMore) return;

      setIsFetchingNextPage(true);
      setIsError(false);

      try {
        const excludeQuery = Array.from(loadedIdsRef.current).slice(0, 50).join(',');
        const res = await fetch(
          `/api/products/discover?page=${pageToFetch}&limit=12&exclude=${encodeURIComponent(excludeQuery)}`
        );
        const data = await res.json();

        if (data.success && Array.isArray(data.products)) {
          const newItems: Product[] = [];
          for (const item of data.products) {
            if (!loadedIdsRef.current.has(item.id)) {
              loadedIdsRef.current.add(item.id);
              if (item.slug) loadedIdsRef.current.add(item.slug);
              newItems.push(item);
            }
          }

          if (newItems.length > 0) {
            setProducts((prev) => [...prev, ...newItems]);
            setPage(pageToFetch + 1);
          }

          setHasMore(Boolean(data.hasMore && newItems.length > 0));
        } else {
          setHasMore(false);
        }
      } catch (err) {
        console.warn('Discovery fetch error:', err);
        setIsError(true);
      } finally {
        setIsFetchingNextPage(false);
      }
    },
    [isFetchingNextPage, hasMore]
  );

  // Setup IntersectionObserver on sentinel
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || isFetchingNextPage || isError) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !isFetchingNextPage && hasMore) {
          fetchPage(page);
        }
      },
      {
        root: null,
        rootMargin: '400px', // Pre-fetch before user reaches the very bottom
        threshold: 0.1,
      }
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [fetchPage, page, hasMore, isFetchingNextPage, isError]);

  if (isLoading && products.length === 0) {
    return (
      <section className="space-y-4 my-8" aria-label="Explore More Products">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#0B8F5A]" />
          <h2 className="text-xl sm:text-2xl font-black text-[#111827] dark:text-[#F9FAFB] tracking-tight">
            {title}
          </h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          {Array.from({ length: 10 }).map((_, idx) => (
            <ProductSkeletonCard key={idx} />
          ))}
        </div>
      </section>
    );
  }

  if (!isLoading && products.length === 0) {
    return null; // Gracefully hide if catalog is exhausted or empty
  }

  return (
    <section className="space-y-4 my-8" aria-label="Explore More Products">
      {/* ── SECTION HEADER ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-1 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0B8F5A] animate-pulse" />
            <h2 className="text-xl sm:text-2xl font-black text-[#111827] dark:text-[#F9FAFB] tracking-tight">
              {title}
            </h2>
            <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-extrabold text-[10px] uppercase px-2 py-0.5 rounded-md">
              {badge || 'CONTINUOUS DISCOVERY'}
            </span>
          </div>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* ── RESPONSIVE VERTICAL PRODUCT GRID ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onOpenDetail={onOpenDetail}
          />
        ))}

        {/* Append Skeletons when fetching next batch */}
        {isFetchingNextPage &&
          Array.from({ length: 4 }).map((_, idx) => (
            <ProductSkeletonCard key={`more-skel-${idx}`} />
          ))}
      </div>

      {/* ── INFINITE SCROLL SENTINEL ── */}
      {hasMore && !isError && (
        <div
          ref={sentinelRef}
          className="h-12 w-full flex items-center justify-center text-slate-400 text-xs font-semibold gap-2 py-4"
        >
          {isFetchingNextPage && (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              <span>Loading more products...</span>
            </>
          )}
        </div>
      )}

      {/* ── ERROR / RETRY STATE ── */}
      {isError && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl text-center space-y-2 my-4">
          <p className="text-xs font-bold text-amber-800 dark:text-amber-200">
            Couldn&apos;t load more products right now
          </p>
          <button
            type="button"
            onClick={() => fetchPage(page)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      )}

      {/* ── END OF CATALOG TERMINAL STATE ── */}
      {!hasMore && products.length > 0 && (
        <div className="py-8 text-center flex flex-col items-center justify-center gap-2 border-t border-slate-100 dark:border-slate-800/80 mt-6">
          <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <p className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
            You&apos;re all caught up ✨
          </p>
          <p className="text-[11px] text-slate-400 font-medium">
            You have explored all items currently available in your delivery area.
          </p>
        </div>
      )}
    </section>
  );
};
