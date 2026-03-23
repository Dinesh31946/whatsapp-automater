import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This silences the Turbopack warning by acknowledging we want Webpack
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