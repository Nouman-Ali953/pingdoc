import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-start justify-center gap-4 px-5">
      <p className="font-mono text-sm text-cobalt">404</p>
      <h1 className="text-4xl font-extrabold tracking-tight">This page doesn&apos;t exist.</h1>
      <p className="text-slate-600">
        The link may be broken or the page may have moved. You can still check an API from the homepage.
      </p>
      <Link href="/" className="font-semibold text-cobalt underline underline-offset-4">
        Go to the Pingdoc API health checker
      </Link>
    </main>
  );
}
