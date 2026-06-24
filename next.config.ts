import type { NextConfig } from "next";
import path from "path";

const rateLimiterStub = path.resolve(__dirname, "src/lib/stubs/RateLimiterDrizzle.js");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "oaidalleapiprodscus.blob.core.windows.net" },
      { protocol: "https", hostname: "**.higgsfield.ai" },
      { protocol: "https", hostname: "storage.googleapis.com" },
      { protocol: "https", hostname: "**.basecrmimages.com" },
      { protocol: "https", hostname: "**.baselinker.com" },
      { protocol: "https", hostname: "**.baselinkercdn.com" },
      { protocol: "https", hostname: "**.cdn.pl" },
      { protocol: "https", hostname: "**.cloudinary.com" },
      { protocol: "https", hostname: "**.imgix.net" },
      { protocol: "https", hostname: "**.amazonaws.com" },
      { protocol: "https", hostname: "**" },
    ],
  },

  // Turbopack alias (stable in Next.js 15 — replaces experimental.turbo)
  turbopack: {
    resolveAlias: {
      "rate-limiter-flexible/lib/RateLimiterDrizzle.js": rateLimiterStub,
    },
  },

  // Webpack alias (for production builds without --turbopack)
  webpack(config) {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias as Record<string, string> ?? {}),
      "rate-limiter-flexible/lib/RateLimiterDrizzle.js": rateLimiterStub,
    };
    return config;
  },
};

export default nextConfig;
