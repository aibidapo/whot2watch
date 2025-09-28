import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_DEFAULT_PROFILE_ID: process.env.DEFAULT_PROFILE_ID || process.env.NEXT_PUBLIC_DEFAULT_PROFILE_ID,
  },
  experimental: {
    optimizePackageImports: ['react', 'next'],
  },
};

export default nextConfig;
