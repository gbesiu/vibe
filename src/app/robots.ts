import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://przekod.pl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // user-specific and API routes shouldn't be indexed
      disallow: ["/projects/", "/api/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
