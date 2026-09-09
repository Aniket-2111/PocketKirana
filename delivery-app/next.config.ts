import type { NextConfig } from "next";
import path from "path";

const rootNodeModules = path.resolve(__dirname, '../node_modules');

const nextConfig: NextConfig = {
  output: 'export',
  reactStrictMode: false,
  compress: true,
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
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      react: path.resolve(rootNodeModules, 'react'),
      'react-dom': path.resolve(rootNodeModules, 'react-dom'),
    };
    return config;
  },
};

export default nextConfig;
