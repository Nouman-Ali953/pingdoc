import type { MetadataRoute } from "next";
import { BRAND_COLOR, SITE_NAME } from "./lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: `${SITE_NAME}: Free API Health Checker`,
    short_name: SITE_NAME,
    description: "Free API health checker for status, latency, DNS, TLS and headers.",
    lang: "en",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: BRAND_COLOR,
    categories: ["developer tools", "utilities", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
