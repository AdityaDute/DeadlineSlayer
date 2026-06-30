import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  images: {
    unoptimized: true
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  serverExternalPackages: ["firebase-admin"]
};

export default nextConfig;
