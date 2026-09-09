import React from 'react';
import ProductDetailClient from './ProductDetailClient';

import { INITIAL_PRODUCTS } from '@/lib/mockData';

export function generateStaticParams() {
  const ids = new Set<string>(['default']);
  INITIAL_PRODUCTS.forEach((p) => {
    if (p.id) ids.add(p.id);
    if (p.slug) ids.add(p.slug);
  });
  return Array.from(ids).map((id) => ({ id }));
}

export default function ProductDetailPage() {
  return <ProductDetailClient />;
}
