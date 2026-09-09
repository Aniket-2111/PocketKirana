import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ToastContainer } from '@/components/ui/Toast';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#006E2F',
};

export const metadata: Metadata = {
  title: 'PocketKirana Picker – Fulfilment Workspace',
  description: 'Operations and fulfilment workspace for PocketKirana store pickers.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased overflow-x-hidden" suppressHydrationWarning>
        <main className="flex-1 flex flex-col min-h-screen">
          {children}
        </main>
        <ToastContainer />
      </body>
    </html>
  );
}
