import type { Metadata } from "next";
import "./globals.css";
import { ToastContainer } from "@/components/ui/Toast";
import { RealtimeNotificationToast } from "@/components/customer/RealtimeNotificationToast";
import { PostHogProvider } from "@/lib/analytics";

export const metadata: Metadata = {
  title: "Pocket Kirana – 30-Min Grocery Delivery",
  description: "Order fresh groceries and get them delivered in 30 minutes to your doorstep.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
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
      <body className="min-h-screen bg-background text-foreground font-sans antialiased selection:bg-emerald-600 selection:text-white" suppressHydrationWarning>
        <RealtimeNotificationToast />
        <PostHogProvider>
          <main className="flex-1 flex flex-col min-h-screen">
            {children}
          </main>
        </PostHogProvider>
        <ToastContainer />
      </body>
    </html>
  );
}
