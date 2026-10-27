// Single source of truth for the public site URL and brand.
// Set NEXT_PUBLIC_SITE_URL in your hosting environment. The fallback is the
// production domain so canonicals, the sitemap and structured data never point at localhost.
export const SITE_NAME = "Pingdoc";
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://apichecker.app"
).replace(/\/+$/, "");
export const BRAND_COLOR = "#3347ff";
