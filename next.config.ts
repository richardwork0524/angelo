import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for smaller deployment bundle
  output: "standalone",

  // Compiler optimizations
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },

  // Experimental performance features
  experimental: {
    // Enable React compiler optimizations (auto-memoization)
    optimizePackageImports: ["@supabase/supabase-js"],
  },

  // Cache headers for API routes
  async headers() {
    return [
      {
        source: "/api/projects",
        headers: [
          { key: "Cache-Control", value: "private, s-maxage=30, stale-while-revalidate=60" },
        ],
      },
      {
        source: "/api/dashboard",
        headers: [
          { key: "Cache-Control", value: "private, s-maxage=15, stale-while-revalidate=30" },
        ],
      },
    ];
  },
};

export default nextConfig;
