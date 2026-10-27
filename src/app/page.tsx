import Checker from "@/components/Checker";
import Link from "next/link";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const CHECKS = [
  [
    "Availability and status",
    "Follows up to five redirects and shows every hop, so a quiet 301 chain can't hide behind a 200.",
    "200 OK",
  ],
  [
    "Response time waterfall",
    "DNS, connect, TLS, wait and download are split apart so you see where the time goes.",
    "First byte 184 ms",
  ],
  [
    "DNS lookup",
    "A, AAAA and CNAME records with TTLs, lookup time and IPv6 readiness.",
    "3 A records",
  ],
  [
    "TLS and certificate",
    "Protocol version, cipher, issuer, days until expiry and HTTP/2 support.",
    "TLS 1.3, 71 days",
  ],
  [
    "Response size and compression",
    "Transferred bytes, content encoding, and a warning when large text goes uncompressed.",
    "18.4 KB, br",
  ],
  [
    "Server and security headers",
    "Every response header, an audit of the security ones, and a flag when the server leaks its version.",
    "5 of 6 present",
  ],
  [
    "JSON validity",
    "Parses the body and tells you whether it is valid JSON and what shape it has.",
    "Object, 12 keys",
  ],
  [
    "Burst test",
    "Five quick requests in a row: success rate, p95 and jitter.",
    "p95 212 ms",
  ],
  [
    "Live watch",
    "Leave the tab open and Pingdoc re-checks every 30 seconds, building an uptime strip as it goes.",
    "99.8% this session",
  ],
] as const;

const FAQ = [
  [
    "What is an API health check?",
    "An API health check sends a request to an endpoint and measures whether it answers correctly and quickly. Pingdoc reports the HTTP status, response time, DNS lookup, TLS certificate, response size, headers and JSON validity in one report.",
  ],
  [
    "Is Pingdoc free?",
    "Yes. Pingdoc is free during early access, with no signup and no credit card.",
  ],
  [
    "Does Pingdoc store the URLs I check?",
    "No. Each check runs on request and the result is shown to you. Nothing is saved on our side.",
  ],
  [
    "Can I check localhost or a private API?",
    "No. For security, Pingdoc only checks public endpoints. Requests to private networks, loopback addresses and cloud metadata addresses are blocked.",
  ],
  [
    "How is uptime measured?",
    "Live watch re-checks your endpoint every 30 seconds while the tab is open and shows an uptime percentage for that session. Continuous background monitoring and alerts are not available yet.",
  ],
  [
    "How is the health score calculated?",
    "Every check adds findings marked pass, warning or fail. The score starts at 100 and loses points for each warning and failure. A server error caps the score and marks the endpoint as down.",
  ],
] as const;

const site = SITE_URL;
const orgId = `${site}/#organization`;
const logoUrl = `${site}/icon-512.png`;
const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Pingdoc",
    url: site,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Any",
    description:
      "Free API health checker for HTTP status, response time, DNS, TLS, headers and JSON validity.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    isAccessibleForFree: true,
    provider: { "@id": orgId },
    featureList: [
      "HTTP status and redirect chain",
      "Response time breakdown (DNS, connect, TLS, first byte)",
      "DNS A, AAAA and CNAME records",
      "TLS version and certificate expiry",
      "Response size and compression",
      "Security header audit",
      "JSON validity check",
      "Burst test with p95 and jitter",
      "Live uptime watch",
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map(([q, a]) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Pingdoc",
    alternateName: ["Pingdoc API Health Checker"],
    url: new URL("/", site).href,
    publisher: { "@id": orgId },
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": orgId,
    name: SITE_NAME,
    url: site,
    logo: {
      "@type": "ImageObject",
      url: logoUrl,
      width: 512,
      height: 512,
    },
  },
];

function Logo() {
  return (
    <span className="flex items-center gap-2 text-xl font-extrabold">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
        <rect width="28" height="28" rx="7" fill="#3347ff" />
        <path
          d="M3 15 h6 l3 -7 l4 13 l3 -9 l1 3 h5"
          fill="none"
          stroke="#fff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Pingdoc
    </span>
  );
}

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
        <Link href="/" aria-label="Pingdoc home">
          <Logo />
        </Link>
        <nav
          aria-label="Main"
          className="flex items-center gap-6 text-sm font-medium text-slate-600"
        >
          <Link href="#checks" className="hidden md:inline hover:text-cobalt">
            What it checks
          </Link>
          <Link href="#faq" className="hidden md:inline hover:text-cobalt">
            FAQ
          </Link>
          <span className="rounded-full bg-pass/10 px-3 py-1 text-pass">
            Free for now
          </span>
        </nav>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div aria-hidden className="chart-paper absolute inset-0 -z-10" />
          <svg
            aria-hidden
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
            className="absolute inset-x-0 top-24 -z-10 h-28 w-full opacity-30"
          >
            <path
              pathLength={1}
              className="beat"
              d="M0 60 H380 l20 -8 l20 8 H500 l14 -52 l22 100 l16 -70 l10 22 H700 l20 -10 l20 10 H1200"
              fill="none"
              stroke="#3347ff"
              strokeWidth="3"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div className="mx-auto max-w-5xl px-5 pt-16 pb-20 sm:pt-24">
            <p className="font-mono text-sm font-medium uppercase tracking-widest text-cobalt">
              Free API health checker
            </p>
            <h1 className="mt-4 max-w-3xl text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-7xl">
              Give your API a checkup.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-slate-600">
              Paste any endpoint. See its status, a timing breakdown, DNS, TLS,
              headers and JSON validity in one readable report. No signup.
            </p>
            <div id="checker" className="mt-10">
              <Checker />
            </div>
          </div>
        </section>

        <section id="checks" className="mx-auto max-w-5xl px-5 py-20">
          <h2 className="max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">
            Everything a checkup looks at
          </h2>
          <p className="mt-3 max-w-xl text-slate-600">
            Nine checks run on every endpoint, each one explained in plain
            language with the fix next to the problem.
          </p>
          <ul className="mt-10 divide-y divide-rule border-y border-rule">
            {CHECKS.map(([name, text, sample]) => (
              <li
                key={name}
                className="grid gap-1 py-5 sm:grid-cols-[16rem_1fr_9rem] sm:gap-8"
              >
                <h3 className="font-bold">{name}</h3>
                <p className="text-slate-600">{text}</p>
                <p className="font-mono text-sm text-cobalt sm:text-right">
                  {sample}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section id="faq" className="mx-auto max-w-3xl px-5 pb-24">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Questions
          </h2>
          <div className="mt-8 divide-y divide-rule border-y border-rule">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group py-4">
                <summary className="flex cursor-pointer items-center justify-between gap-4 font-semibold marker:content-none">
                  {q}
                  <span
                    aria-hidden
                    className="text-cobalt transition group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-slate-600">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-sm text-slate-500">
          <Logo />
          <p>Free during early access. Only public endpoints can be checked.</p>
        </div>
      </footer>
    </>
  );
}
