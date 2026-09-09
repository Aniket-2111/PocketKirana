import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: process.env.NODE_ENV === 'production' ? 'export' : undefined,
  // Fix: Tell Next.js this sub-project's tracing root is the customer-app folder
  // This prevents the "multiple lockfiles" confusion with the parent workspace
  outputFileTracingRoot: path.join(__dirname),
  // Required for Capacitor file:// URL routing — without this, routes like
  // /home resolve to /home.html which the Android WebView can't find
  trailingSlash: true,
  reactStrictMode: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "cdn.pixabay.com" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "storage.googleapis.com" },
    ],
  },
};

export default nextConfig;
