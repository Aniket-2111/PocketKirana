import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { GlobalErrorSuppressor } from '@/components/common/GlobalErrorSuppressor';
import { PWARegister } from '@/components/common/PWARegister';
import { NotificationWrapper } from '@/components/common/NotificationWrapper';
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
    default: 'PocketKirana – Fast 30-Min Local Grocery Delivery',
    template: '%s | PocketKirana',
  },
  description:
    'PocketKirana connects customers with neighborhood grocery stores for fresh fruits, vegetables, dairy, atta, rice, and snacks delivered in 30 minutes.',
  keywords: [
    'grocery delivery',
    'kirana delivery',
    'online grocery',
    'fresh vegetables',
    'express delivery',
    'PocketKirana',
    '30 minute delivery',
    'grocery darkstore',
  ],
  metadataBase: new URL('https://pocketkirana.com'),
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://pocketkirana.com',
    siteName: 'PocketKirana',
    title: 'PocketKirana – Fast 30-Min Local Grocery Delivery',
    description:
      'Get fresh groceries, dairy, snacks, and daily essentials delivered to your door in 30 minutes.',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@PocketKirana',
    title: 'PocketKirana – Fast 30-Min Grocery Delivery',
    description: 'Order groceries online. Delivered in 30 minutes.',
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/svg+xml" href="/logo.svg" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var t = localStorage.getItem('pk_theme') || 'system';
                  var isDark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-background flex flex-col font-sans antialiased text-foreground" suppressHydrationWarning>
        <PWARegister />
        <GlobalErrorSuppressor />
        <NotificationWrapper />
        {children}
      </body>
    </html>
  );
}
