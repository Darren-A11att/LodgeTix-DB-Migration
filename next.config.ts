import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable file watching polling which can cause constant recompilation
  webpack: (config, { dev }) => {
    if (dev && config.watchOptions) {
      // Disable file system polling
      config.watchOptions = {
        poll: false,
        ignored: [
          '**/node_modules',
          '**/.git',
          '**/.next',
          '**/sync-logs',
          '**/scripts',
          '**/*.log'
        ],
        // Increase aggregation timeout to batch changes
        aggregateTimeout: 300,
      };
    }
    return config;
  },
  
  // Disable React strict mode which can cause double renders
  reactStrictMode: false,
  
  // Temporarily ignore ESLint errors during build
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
