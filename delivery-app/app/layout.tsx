import type { Metadata } from "next";
import "./globals.css";
import { ToastContainer } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "Pocket Kirana Delivery Partner",
  description: "Driver application for Pocket Kirana grocery order deliveries.",
};

import { DeliveryNotificationListener } from "../components/DeliveryNotificationListener";

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
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased selection:bg-emerald-600 selection:text-white" suppressHydrationWarning>
        <DeliveryNotificationListener />
        <main className="flex-1 flex flex-col min-h-screen">
          {children}
        </main>
        <ToastContainer />
      </body>
    </html>
  );
}
