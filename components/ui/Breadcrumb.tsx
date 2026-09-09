import React from 'react';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items }) => {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-gray-500 flex-wrap">
      <Link href="/" className="flex items-center gap-0.5 hover:text-emerald-600 transition-colors">
        <Home className="w-3.5 h-3.5" />
      </Link>
      {items.map((item, idx) => (
        <React.Fragment key={idx}>
          <ChevronRight className="w-3 h-3 text-gray-300 shrink-0" />
          {item.href && idx < items.length - 1 ? (
            <Link
              href={item.href}
              className="hover:text-emerald-600 transition-colors truncate max-w-[120px]"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-gray-700 font-medium truncate max-w-[160px]">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};
