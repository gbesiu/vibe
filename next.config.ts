import type { NextConfig } from "next";

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
};

export default nextConfig;
