import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Empty turbopack config to silence the webpack-config warning
  turbopack: {},
};

export default nextConfig;
