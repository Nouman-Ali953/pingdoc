export type Level = "pass" | "warn" | "fail" | "info";
export type Finding = { id: string; level: Level; title: string; detail: string };

export type TlsInfo =
  | { ok: true; protocol: string | null; cipher: string | null; alpn: string | null; authorized: boolean; authError: string | null; issuer: string | null; subject: string | null; validTo: string; daysLeft: number }
  | { ok: false; error: string };

export type Report = {
  url: string; finalUrl: string; checkedAt: string;
  score: number; grade: "A" | "B" | "C" | "D" | "F"; verdict: "Healthy" | "Degraded" | "Down";
  http: { status: number; statusText: string; method: string; redirects: { url: string; status: number }[] };
  timing: { dns: number; connect: number; tls: number; wait: number; download: number; total: number };
  dns: { ip: string; a: { address: string; ttl: number }[]; aaaa: number; cname: string[] };
  tls: TlsInfo | null;
  body: { bytes: number; truncated: boolean; contentType: string | null; encoding: string | null; json: { valid: boolean; kind?: string; size?: number; error?: string } | null };
  headers: Record<string, string>;
  security: { name: string; present: boolean }[];
  samples: { count: number; ok: number; min: number; avg: number; p95: number; max: number; jitter: number } | null;
  findings: Finding[];
};
