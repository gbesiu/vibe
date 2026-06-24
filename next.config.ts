import type { NextConfig } from "next";
import path from "path";

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

  webpack(config) {
    // Replace RateLimiterDrizzle with an empty stub so webpack doesn't
    // follow its require() chain into .d.ts files (which cause parse errors).
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias as Record<string, string> ?? {}),
      "rate-limiter-flexible/lib/RateLimiterDrizzle.js": path.resolve(
        __dirname,
        "src/lib/stubs/RateLimiterDrizzle.js"
      ),
    };
    return config;
  },
};

export default nextConfig;
