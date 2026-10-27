import type { MetadataRoute } from "next";
import { SITE_URL } from "./lib/site";

// Update this date whenever the homepage content changes (YYYY-MM-DD).
const LAST_MODIFIED = new Date("2026-10-27");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: LAST_MODIFIED,
      changeFrequency: "weekly",
      priority: 1,
    },
    // Add future public pages here, e.g. { url: `${SITE_URL}/about`, ... }
  ];
}
