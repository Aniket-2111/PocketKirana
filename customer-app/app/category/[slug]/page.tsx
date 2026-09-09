import React from 'react';
import CategoryClient from './CategoryClient';

import { INITIAL_CATEGORIES } from '@/lib/mockData';

export function generateStaticParams() {
  const slugs = new Set<string>(['default']);
  INITIAL_CATEGORIES.forEach((c) => {
    if (c.slug) slugs.add(c.slug);
    if (c.id) slugs.add(c.id);
  });
  return Array.from(slugs).map((slug) => ({ slug }));
}

export default function CategoryPage() {
  return <CategoryClient />;
}
