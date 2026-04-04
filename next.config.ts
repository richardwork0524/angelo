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
    // Tree-shake + bundle-optimize heavy packages
    optimizePackageImports: ["@supabase/supabase-js"],
  },

  // Cache headers for API routes and static assets
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
      {
        source: "/api/projects/:path*",
        headers: [
          { key: "Cache-Control", value: "private, s-maxage=20, stale-while-revalidate=40" },
        ],
      },
      {
        source: "/api/sessions",
        headers: [
          { key: "Cache-Control", value: "private, s-maxage=60, stale-while-revalidate=120" },
        ],
      },
      // Long-cache static assets (fonts, icons)
      {
        source: "/:path*.(woff2|ico|png|svg)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
