import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
remotePatterns: [
      {
        protocol: 'https',
        // REPLACE THIS WITH YOUR ACTUAL SUPABASE PROJECT REFERENCE DOMAIN
        hostname: 'vzfndlhoouspepyiwkxi.supabase.co', 
      },
    ],

    domains: ["vzfndlhoouspepyiwkxi.supabase.co"],
  },
  eslint: {
    // !! DANGER: This ignores ALL ESLint warnings and errors during the build phase.
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
