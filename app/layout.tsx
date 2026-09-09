import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#059669',
};

export const metadata: Metadata = {
  title: {
    default: 'PocketKirana – Fast 15-Min Local Grocery Delivery',
    template: '%s | PocketKirana',
  },
  description:
    'PocketKirana connects customers with neighborhood grocery stores for fresh fruits, vegetables, dairy, atta, rice, and snacks delivered in 8 minutes.',
  keywords: [
    'grocery delivery',
    'kirana delivery',
    'online grocery',
    'fresh vegetables',
    'express delivery',
    'PocketKirana',
    '8 minute delivery',
    'Bengaluru grocery',
  ],
  metadataBase: new URL('https://pocketkirana.com'),
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://pocketkirana.com',
    siteName: 'PocketKirana',
    title: 'PocketKirana – Fast 15-Min Local Grocery Delivery',
    description:
      'Get fresh groceries, dairy, snacks, and daily essentials delivered to your door in just 8 minutes.',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@PocketKirana',
    title: 'PocketKirana – Fast Grocery Delivery',
    description: 'Order groceries online. Delivered in 8 minutes.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

import { GlobalErrorSuppressor } from '@/components/common/GlobalErrorSuppressor';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="PocketKirana" />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          crossOrigin=""
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
      </head>
      <body className="min-h-screen bg-gray-50 flex flex-col font-sans antialiased text-gray-900" suppressHydrationWarning>
        <GlobalErrorSuppressor />
        {children}
      </body>
    </html>
  );
}
