import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { SITE_URL } from "./lib/site";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage" });
const plex = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex" });

const title = "Pingdoc: Free API Health Checker for Status, Latency & TLS";
const description =
  "Free API health checker: test any endpoint for HTTP status, response time, DNS, TLS certificate, headers and JSON validity. No signup needed.";


// Every icon is listed here once, so the <head> has exactly one link per file.
// favicon.ico is added automatically from src/app; the others are listed below.
// Files: src/app (favicon.ico, icon.png, icon1.png, icon2.png, apple-icon.png)
// and public/ (pingdoc-icon.svg). Do not add manual
// <link rel="icon"> tags in the layout, they would duplicate these.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: title, template: "%s | Pingdoc" },
  description,
  applicationName: "Pingdoc",
  icons: {
    icon: [
      { url: "/pingdoc-icon.svg", type: "image/svg+xml", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "96x96" },
      { url: "/icon1.png", type: "image/png", sizes: "16x16" },
      { url: "/icon2.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
  },
  authors: [{ name: "Pingdoc" }],
  creator: "Pingdoc",
  publisher: "Pingdoc",
  category: "technology",
  keywords: [
    "API health checker",
    "free API health checker",
    "API monitoring",
    "API status checker",
    "HTTP status checker",
    "API response time test",
    "endpoint health check",
    "SSL certificate checker",
    "TLS certificate checker",
    "DNS lookup tool",
    "JSON validator",
    "API uptime check",
    "website headers checker",
    "Pingdoc",
  ],
  alternates: { canonical: "/" },
  formatDetection: { telephone: false, email: false, address: false },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Pingdoc",
    title,
    description,
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title, description },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
    other: { "msvalidate.01": "0ECDDBF89F1D1C2D0BF1C87DF14AA40A" },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${plex.variable}`}>
  
  <script type="text/javascript">
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "z48g3edtv7");
</script>
      <body className="min-h-screen antialiased">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
