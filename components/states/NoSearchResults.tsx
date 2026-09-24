'use client';

import React from 'react';
import Link from 'next/link';
import { SearchX, Sparkles, X, ArrowRight } from 'lucide-react';

export interface NoSearchResultsProps {
  query?: string;
  onClearSearch?: () => void;
  onSelectSuggestion?: (suggestion: string) => void;
  suggestedKeywords?: string[];
  suggestedCategories?: { id: string; name: string; icon?: string }[];
  className?: string;
}

const DEFAULT_SUGGESTIONS = [
  'Aashirvaad Atta',
  'Amul Taaza Milk',
  'Fortune Oil',
  'Parle-G',
  'Tata Salt',
  'Maggi Noodles',
  'Basmati Rice',
  'Surf Excel',
];

const DEFAULT_CATEGORIES = [
  { id: 'dairy-bread-eggs', name: 'Dairy & Bread' },
  { id: 'atta-rice-dal', name: 'Atta, Rice & Dal' },
  { id: 'fruits-vegetables', name: 'Fruits & Veggies' },
  { id: 'snacks-munchies', name: 'Snacks & Biscuits' },
  { id: 'beverages', name: 'Cold Drinks & Juices' },
  { id: 'personal-care', name: 'Personal Care' },
];

export const NoSearchResults: React.FC<NoSearchResultsProps> = ({
  query,
  onClearSearch,
  onSelectSuggestion,
  suggestedKeywords = DEFAULT_SUGGESTIONS,
  suggestedCategories = DEFAULT_CATEGORIES,
  className = '',
}) => {
  return (
    <div
      role="region"
      aria-label="No search results"
      className={`max-w-lg mx-auto py-12 px-4 text-center space-y-6 animate-fadeSlideUp ${className}`}
    >
      {/* Icon */}
      <div className="w-16 h-16 rounded-3xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-sm">
        <SearchX className="w-8 h-8" aria-hidden="true" />
      </div>

      {/* Query text */}
      <div className="space-y-2">
        <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">
          No items found
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
          {query ? (
            <>
              We couldn't find any groceries matching{' '}
              <span className="font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                "{query}"
              </span>
              . Please check spelling or explore suggestions below.
            </>
          ) : (
            'Try searching by product name, category, or brand name.'
          )}
        </p>
      </div>

      {/* Clear Search Action */}
      {onClearSearch && (
        <div>
          <button
            type="button"
            onClick={onClearSearch}
            className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
          >
            <X className="w-4 h-4" />
            <span>Clear Search</span>
          </button>
        </div>
      )}

      {/* Popular Suggestions Chips */}
      {suggestedKeywords && suggestedKeywords.length > 0 && (
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3 text-left">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Popular Searches:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestedKeywords.map((keyword, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onSelectSuggestion?.(keyword)}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 text-xs font-medium px-3 py-1.5 rounded-lg transition-all shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer"
              >
                {keyword}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Explore Popular Categories */}
      {suggestedCategories && suggestedCategories.length > 0 && (
        <div className="space-y-3 text-left">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
            Or Browse by Category:
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {suggestedCategories.map((cat) => (
              <Link
                key={cat.id}
                href={`/category/${cat.id}`}
                className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-slate-200/80 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors group"
              >
                <span className="truncate">{cat.name}</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
