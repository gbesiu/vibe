import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // OpenAI / DALL-E generated images
      { protocol: "https", hostname: "oaidalleapiprodscus.blob.core.windows.net" },
      // Higgsfield AI
      { protocol: "https", hostname: "**.higgsfield.ai" },
      { protocol: "https", hostname: "storage.googleapis.com" },
      // BaseLinker CDN
      { protocol: "https", hostname: "**.basecrmimages.com" },
      { protocol: "https", hostname: "**.baselinker.com" },
      { protocol: "https", hostname: "**.baselinkercdn.com" },
      // Generic CDN & image hosts common in BL
      { protocol: "https", hostname: "**.cdn.pl" },
      { protocol: "https", hostname: "**.cloudinary.com" },
      { protocol: "https", hostname: "**.imgix.net" },
      { protocol: "https", hostname: "**.amazonaws.com" },
      // Allow all https for flexibility during dev
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
