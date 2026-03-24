import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  // This is the secret: It forces Next.js to use paths that Electron can resolve
  trailingSlash: true, 
  images: {
    unoptimized: true,
  },
  // DO NOT use assetPrefix: './' here, it breaks Next 16 fonts.
  // We handle the pathing in the Main process instead.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        v8: false,
      };
      config.externals.push('electron');
    }
    return config;
  },
};

export default nextConfig;