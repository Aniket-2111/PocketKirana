import type { NextConfig } from "next";
import path from "path";
import fs from "fs";

const isProd = process.env.NODE_ENV === 'production';
const rootDir = fs.realpathSync.native(path.resolve(__dirname, '..'));
const appDir = fs.realpathSync.native(__dirname);

class NormalizeWindowsPathPlugin {
  apply(compiler: any) {
    compiler.hooks.normalModuleFactory.tap('NormalizeWindowsPathPlugin', (nmf: any) => {
      nmf.hooks.beforeResolve.tap('NormalizeWindowsPathPlugin', (resolveData: any) => {
        if (resolveData?.request && /^[a-zA-Z]:[/\\]/.test(resolveData.request)) {
          resolveData.request = resolveData.request[0].toUpperCase() + resolveData.request.slice(1);
        }
        if (resolveData?.context && /^[a-zA-Z]:[/\\]/.test(resolveData.context)) {
          resolveData.context = resolveData.context[0].toUpperCase() + resolveData.context.slice(1);
        }
      });
      nmf.hooks.afterResolve.tap('NormalizeWindowsPathPlugin', (resolveData: any) => {
        if (resolveData?.createData?.resource && /^[a-zA-Z]:[/\\]/.test(resolveData.createData.resource)) {
          resolveData.createData.resource = resolveData.createData.resource[0].toUpperCase() + resolveData.createData.resource.slice(1);
        }
        if (resolveData?.createData?.userRequest && /^[a-zA-Z]:[/\\]/.test(resolveData.createData.userRequest)) {
          resolveData.createData.userRequest = resolveData.createData.userRequest[0].toUpperCase() + resolveData.createData.userRequest.slice(1);
        }
      });
    });
  }
}

const nextConfig: NextConfig = {
  ...(isProd ? { output: 'export', trailingSlash: true } : {}),
  reactStrictMode: false,
  devIndicators: false,
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
  webpack: (config) => {
    config.context = appDir;
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': rootDir,
      'lucide-react': fs.realpathSync.native(path.dirname(require.resolve('lucide-react/package.json'))),
    };
    config.plugins = config.plugins || [];
    config.plugins.push(new NormalizeWindowsPathPlugin());
    return config;
  },
};

export default nextConfig;
