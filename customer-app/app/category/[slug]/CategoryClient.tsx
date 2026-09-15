'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import CategorySplitCatalog from '../../../components/CategorySplitCatalog';

export default function CategoryClient() {
  const params = useParams();
  const slug = (params?.slug as string) || 'all';

  return <CategorySplitCatalog initialCategorySlug={slug} />;
}
