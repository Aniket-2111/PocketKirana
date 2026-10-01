'use client';

import React, { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import CustomerShell from '../../components/CustomerShell';
import { ProductCard } from '../../components/customer/ProductCard';
import { ArrowUpRight, Clock3, Search as SearchIcon, ShoppingBag, Trash2, X } from 'lucide-react';
import type { Product } from '@/types';
import { trackEvent, PostHogEvents } from '@/lib/analytics';

const RECENT_SEARCHES_KEY = 'pk_customer_recent_searches';
const POPULAR_SEARCHES = ['Milk', 'Aashirvaad Atta', 'Paneer', 'Fortune Oil', 'Eggs', 'Amul Butter', 'Biscuits', 'Maggi'];

function normalizeSearchText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function editDistance(left: string, right: string) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1)
      );
    }
    previous = current;
  }
  return previous[right.length];
}

function matchesSearchText(values: Array<string | undefined>, query: string) {
  const terms = normalizeSearchText(query).split(' ').filter(Boolean);
  if (!terms.length) return false;

  const candidates = values
    .filter((value): value is string => Boolean(value))
    .map(normalizeSearchText);

  return terms.every((term) => candidates.some((candidate) => {
    if (candidate.includes(term)) return true;
    if (term.length < 4) return false;

    const maxDistance = term.length >= 8 ? 2 : 1;
    return candidate.split(' ').some((word) =>
      Math.abs(word.length - term.length) <= maxDistance && editDistance(word, term) <= maxDistance
    );
  }));
}

export default function SearchPage() {
  const router = useRouter();
  const { products, categories } = useAppStore();
  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const allProducts = useMemo(
    () => (products || []).filter((product) => product.status !== 'discontinued'),
    [products]
  );

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(RECENT_SEARCHES_KEY) || '[]');
      if (Array.isArray(saved)) {
        setRecentSearches(saved.filter((item): item is string => typeof item === 'string').slice(0, 6));
      }
    } catch {
      setRecentSearches([]);
    }
  }, []);

  const rememberSearch = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    const next = [trimmed, ...recentSearches.filter((item) => normalizeSearchText(item) !== normalizeSearchText(trimmed))].slice(0, 6);
    setRecentSearches(next);
    try {
      window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
    } catch {
      // Search still works when browser storage is unavailable.
    }
  };

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    return allProducts.filter((product) => matchesSearchText([
      product.name,
      product.brandName,
      product.description,
      (product as any).category,
      (product as any).subcategory,
    ], query));
  }, [allProducts, query]);

  const categorySuggestions = useMemo(() => {
    if (!query.trim()) return [];
    return (categories || [])
      .filter((category) => !category.parentId && category.isActive !== false)
      .filter((category) => matchesSearchText([category.name], query))
      .slice(0, 4);
  }, [categories, query]);

  const brandSuggestions = useMemo(() => {
    if (!query.trim()) return [];
    return Array.from(new Set(
      allProducts
        .map((product) => product.brandName?.trim())
        .filter((brand): brand is string => Boolean(brand))
        .filter((brand) => matchesSearchText([brand], query))
    )).slice(0, 4);
  }, [allProducts, query]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length >= 2) {
      const timer = setTimeout(() => {
        if (searchResults.length === 0) {
          trackEvent(PostHogEvents.SEARCH_NO_RESULTS, {
            query: trimmed,
            result_count: 0,
          }, { dedupKey: `search_no_results:${trimmed}`, dedupWindowMs: 5000 });
        } else {
          trackEvent(PostHogEvents.SEARCH_SUBMITTED, {
            query: trimmed,
            result_count: searchResults.length,
          }, { dedupKey: `search_submitted:${trimmed}`, dedupWindowMs: 5000 });
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [query, searchResults.length]);

  const handleOpenDetail = (product: Product) => {
    rememberSearch(query);
    router.push(`/product/${product.id || product.slug}`);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    rememberSearch(query);
  };

  const handleClearRecentSearches = () => {
    setRecentSearches([]);
    try {
      window.localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      // Ignore storage restrictions; the visible list is already cleared.
    }
  };

  return (
    <CustomerShell title="Search Products" showBack backUrl="/">
      <div className="mx-auto w-full max-w-6xl space-y-6 pb-20 animate-in fade-in duration-standard">
        <form onSubmit={handleSubmit} role="search" className="relative">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" aria-hidden="true" />
          <label htmlFor="customer-product-search" className="sr-only">Search products, brands, or categories</label>
          <input
            id="customer-product-search"
            type="search"
            placeholder="Search groceries, brands, or categories"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-h-12 w-full rounded-2xl border border-input-border bg-input py-3 pl-12 pr-14 text-base font-medium text-foreground shadow-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/20"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-4 focus-visible:ring-primary/20"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </form>

        {!query.trim() ? (
          <div className="space-y-6">
            {recentSearches.length > 0 && (
              <section aria-labelledby="recent-searches-heading" className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 id="recent-searches-heading" className="text-base font-bold text-foreground">Recent searches</h2>
                  <button
                    type="button"
                    onClick={handleClearRecentSearches}
                    className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-secondary-foreground hover:bg-muted focus-visible:ring-4 focus-visible:ring-primary/20"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Clear history
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => setQuery(term)}
                      className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-secondary-foreground shadow-sm transition-colors hover:border-primary hover:text-primary focus-visible:ring-4 focus-visible:ring-primary/20"
                    >
                      <Clock3 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      {term}
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section aria-labelledby="popular-searches-heading" className="space-y-3">
              <h2 id="popular-searches-heading" className="text-base font-bold text-foreground">Popular searches</h2>
              <div className="flex flex-wrap gap-2">
                {POPULAR_SEARCHES.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => {
                      setQuery(term);
                      rememberSearch(term);
                    }}
                    className="min-h-11 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-secondary-foreground shadow-sm transition-colors hover:border-primary hover:text-primary focus-visible:ring-4 focus-visible:ring-primary/20"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <div className="space-y-5">
            {(categorySuggestions.length > 0 || brandSuggestions.length > 0) && (
              <section aria-label="Search suggestions" className="grid gap-4 md:grid-cols-2">
                {categorySuggestions.length > 0 && (
                  <div className="space-y-2">
                    <h2 className="text-sm font-bold text-muted-foreground">Categories</h2>
                    {categorySuggestions.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => {
                          rememberSearch(query);
                          router.push(`/category/${category.slug || category.id}`);
                        }}
                        className="flex min-h-11 w-full items-center justify-between rounded-xl border border-border bg-card px-4 text-left text-sm font-semibold text-card-foreground hover:border-primary hover:bg-primary/5 focus-visible:ring-4 focus-visible:ring-primary/20"
                      >
                        <span>{category.name}</span>
                        <ArrowUpRight className="h-4 w-4 text-primary" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                )}
                {brandSuggestions.length > 0 && (
                  <div className="space-y-2">
                    <h2 className="text-sm font-bold text-muted-foreground">Brands</h2>
                    <div className="flex flex-wrap gap-2">
                      {brandSuggestions.map((brand) => (
                        <button
                          key={brand}
                          type="button"
                          onClick={() => {
                            setQuery(brand);
                            rememberSearch(brand);
                          }}
                          className="min-h-11 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-card-foreground hover:border-primary hover:text-primary focus-visible:ring-4 focus-visible:ring-primary/20"
                        >
                          {brand}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            <section aria-labelledby="search-results-heading" aria-live="polite" className="space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="search-results-heading" className="text-base font-bold text-foreground">
                  {searchResults.length} {searchResults.length === 1 ? 'product' : 'products'} for “{query.trim()}”
                </h2>
              </div>

              {searchResults.length === 0 ? (
                <div className="space-y-3 rounded-2xl border border-border bg-card p-8 text-center shadow-card">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden="true">
                    <ShoppingBag className="h-7 w-7" />
                  </div>
                  <h3 className="text-lg font-bold text-card-foreground">No matching products</h3>
                  <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
                    We couldn’t find “{query.trim()}”. Check the spelling or try a brand or category name.
                  </p>
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="min-h-11 rounded-xl bg-primary-700 px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-800 focus-visible:ring-4 focus-visible:ring-primary/20"
                  >
                    Clear search
                  </button>
                </div>
              ) : (
                <div aria-label="Matching products" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {searchResults.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onOpenDetail={handleOpenDetail}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </CustomerShell>
  );
}
