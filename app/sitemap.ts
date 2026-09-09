import type { MetadataRoute } from 'next';

const BASE_URL = 'https://pocketkirana.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const categoryRoutes = [
    'dairy-bread-eggs', 'fruits-vegetables', 'cold-drinks-juices', 'snacks-munchies',
    'breakfast-instant-food', 'sweet-tooth-bakery', 'tea-coffee-health', 'atta-rice-dal',
    'masala-oil-more', 'paan-corner', 'chicken-meat-fish', 'baby-care',
    'pharma-wellness', 'cleaning-essentials', 'home-office', 'personal-care',
    'pet-care', 'organic-healthy',
  ];

  const brandRoutes = [
    'amul', 'aashirvaad', 'britannia', 'coca-cola', 'lays', 'haldiram', 'tropicana', 'cadbury',
  ];

  return [
    { url: `${BASE_URL}/`, lastModified: now },
    { url: `${BASE_URL}/search`, lastModified: now },
    { url: `${BASE_URL}/brands`, lastModified: now },
    { url: `${BASE_URL}/faq`, lastModified: now },
    { url: `${BASE_URL}/contact`, lastModified: now },
    { url: `${BASE_URL}/partner`, lastModified: now },
    { url: `${BASE_URL}/seller`, lastModified: now },
    { url: `${BASE_URL}/privacy`, lastModified: now },
    { url: `${BASE_URL}/terms`, lastModified: now },
    { url: `${BASE_URL}/security`, lastModified: now },
    { url: `${BASE_URL}/refund-policy`, lastModified: now },
    { url: `${BASE_URL}/cancellation-policy`, lastModified: now },
    ...categoryRoutes.map((slug) => ({
      url: `${BASE_URL}/category/${slug}`,
      lastModified: now,
    })),
    ...brandRoutes.map((slug) => ({
      url: `${BASE_URL}/brand/${slug}`,
      lastModified: now,
    })),
  ];
}
