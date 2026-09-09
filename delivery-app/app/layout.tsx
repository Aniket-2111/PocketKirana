import type { Metadata } from "next";
import "./globals.css";
import { ToastContainer } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "Pocket Kirana Delivery Partner",
  description: "Driver application for Pocket Kirana grocery order deliveries.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased selection:bg-emerald-600 selection:text-white" suppressHydrationWarning>
        <main className="flex-1 flex flex-col min-h-screen">
          {children}
        </main>
        <ToastContainer />
      </body>
    </html>
  );
}
