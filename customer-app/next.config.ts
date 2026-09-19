import type { NextConfig } from "next";
import path from "path";

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  ...(isProd ? { output: 'export', trailingSlash: true } : {}),
  outputFileTracingRoot: path.join(__dirname),
  transpilePackages: ['@msg91comm/sendotp-sdk'],
  reactStrictMode: false,
  devIndicators: false,
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
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        react: path.resolve(__dirname, 'node_modules/react'),
        'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      };
    }
    return config;
  },
};

export default nextConfig;
