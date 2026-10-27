import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import zlib from "node:zlib";
import { performance } from "node:perf_hooks";
import type { Readable } from "node:stream";
import type { Finding, Level, Report, TlsInfo } from "./types";

const UA = "Pingdoc/1.0 (API health checker)";
const TIMEOUT = 8000;
const MAX_RAW = 2_000_000;
const MAX_TEXT = 1_000_000;
const PORTS = new Set([80, 443, 3000, 5000, 8000, 8080, 8443]);
const SECURITY = ["strict-transport-security", "content-security-policy", "x-content-type-options", "x-frame-options", "referrer-policy", "permissions-policy"];
const BLOCK = "That address points to a private or internal network. Pingdoc only checks public endpoints.";

export class UserError extends Error {}
type Addr = { address: string; family: number };
type Hop = {
  status: number; statusText: string; headers: Record<string, string>; bytes: number; truncated: boolean; text: string;
  t: { connect: number; tls: number; wait: number; download: number; total: number };
};

const bare = (h: string) => h.replace(/^\[|\]$/g, "");
const r1 = (n: number) => Math.round(n * 10) / 10;

export function parseTarget(input: string): URL {
  let s = input.trim();
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  let u: URL;
  try { u = new URL(s); } catch { throw new UserError("That doesn't look like a valid URL."); }
  if (u.username || u.password) throw new UserError("Remove credentials from the URL.");
  const port = Number(u.port || (u.protocol === "https:" ? 443 : 80));
  if (!PORTS.has(port)) throw new UserError("Only common web ports are allowed: 80, 443, 3000, 5000, 8000, 8080, 8443.");
  return u;
}

// Blocks loopback, private, link-local (cloud metadata), CGNAT and other non-public ranges.
function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
  }
  const v = ip.toLowerCase();
  if (v === "::" || v === "::1") return true;
  if (v.startsWith("::ffff:")) { const r = v.slice(7); return net.isIPv4(r) ? isPrivateIp(r) : true; }
  return /^(fc|fd|fe[89ab])/.test(v);
}

async function resolveSafe(host: string): Promise<{ addr: Addr; ms: number }> {
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new UserError(BLOCK);
    return { addr: { address: host, family: net.isIPv6(host) ? 6 : 4 }, ms: 0 };
  }
  const t = performance.now();
  const addrs = await dns.lookup(host, { all: true });
  const ms = performance.now() - t;
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new UserError(BLOCK);
  return { addr: addrs[0], ms };
}

// One request, connected to an already-validated IP (prevents DNS rebinding).
function fetchOnce(u: URL, method: string, addr: Addr, keepBody: boolean): Promise<Hop> {
  return new Promise((resolve, reject) => {
    const host = bare(u.hostname);
    const secure = u.protocol === "https:";
    const request = (secure ? https.request : http.request) as typeof https.request;
    const lookup: net.LookupFunction = (_h, o, cb) => cb(null, o.all ? [{ address: addr.address, family: addr.family }] : addr.address, addr.family);
    const t0 = performance.now();
    let tConn = 0, tSec = 0;

    const req = request({
      hostname: host, port: u.port || (secure ? 443 : 80), path: u.pathname + u.search, method, agent: false, lookup,
      timeout: TIMEOUT, servername: net.isIP(host) ? undefined : host, rejectUnauthorized: false,
      headers: { "user-agent": UA, accept: "application/json, text/plain, */*", "accept-encoding": "gzip, deflate, br" },
    }, (res) => {
      const tHead = performance.now();
      let tEnd = 0, bytes = 0, size = 0, truncated = false, finished = false;
      const chunks: Buffer[] = [];
      const enc = String(res.headers["content-encoding"] ?? "").toLowerCase();
      const body: Readable = enc.includes("br") ? res.pipe(zlib.createBrotliDecompress())
        : /gzip|deflate/.test(enc) ? res.pipe(zlib.createUnzip()) : res;

      const done = () => {
        if (finished) return;
        finished = true;
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.headers)) headers[k] = Array.isArray(v) ? v.join(", ") : String(v ?? "");
        const end = tEnd || performance.now();
        resolve({
          status: res.statusCode ?? 0, statusText: res.statusMessage ?? "", headers, bytes, truncated,
          text: Buffer.concat(chunks).toString("utf8"),
          t: {
            connect: tConn ? tConn - t0 : 0, tls: tSec && tConn ? tSec - tConn : 0,
            wait: Math.max(0, tHead - (tSec || tConn || t0)), download: Math.max(0, end - tHead), total: end - t0,
          },
        });
      };
      res.on("data", (c: Buffer) => { bytes += c.length; if (bytes > MAX_RAW) { truncated = true; res.destroy(); } });
      res.on("end", () => { tEnd = performance.now(); });
      res.on("close", () => { tEnd = tEnd || performance.now(); setTimeout(done, 30); });
      body.on("data", (c: Buffer) => { if (keepBody && size < MAX_TEXT) { chunks.push(c); size += c.length; } });
      body.on("end", done);
      body.on("error", done);
    });
    req.on("socket", (s) => {
      s.on("connect", () => { tConn = performance.now(); });
      s.on("secureConnect", () => { tSec = performance.now(); });
    });
    req.on("timeout", () => req.destroy(new Error("Request timed out after 8 seconds")));
    req.on("error", reject);
    req.end();
  });
}

function probeTls(host: string, port: number, addr: Addr): Promise<TlsInfo> {
  return new Promise((resolve) => {
    const s = tls.connect({
      host: addr.address, port, servername: net.isIP(host) ? undefined : host,
      ALPNProtocols: ["h2", "http/1.1"], rejectUnauthorized: false, timeout: 6000,
    }, () => {
      const c = s.getPeerCertificate();
      const validTo = c && c.valid_to ? new Date(c.valid_to) : null;
      resolve({
        ok: true, protocol: s.getProtocol(), cipher: s.getCipher()?.name ?? null, alpn: s.alpnProtocol || null,
        authorized: s.authorized, authError: s.authorizationError ? String(s.authorizationError) : null,
        issuer: c?.issuer?.O || c?.issuer?.CN || null, subject: c?.subject?.CN || null,
        validTo: validTo ? validTo.toISOString() : "", daysLeft: validTo ? Math.floor((+validTo - Date.now()) / 86_400_000) : 0,
      });
      s.end();
    });
    s.on("error", (e) => resolve({ ok: false, error: e.message }));
    s.on("timeout", () => { s.destroy(); resolve({ ok: false, error: "TLS handshake timed out" }); });
  });
}

async function dnsRecords(host: string) {
  if (net.isIP(host)) return { a: [] as { address: string; ttl: number }[], aaaa: 0, cname: [] as string[] };
  const [a, aaaa, c] = await Promise.allSettled([dns.resolve4(host, { ttl: true }), dns.resolve6(host), dns.resolveCname(host)]);
  return {
    a: a.status === "fulfilled" ? a.value.map((r) => ({ address: r.address, ttl: r.ttl })) : [],
    aaaa: aaaa.status === "fulfilled" ? aaaa.value.length : 0,
    cname: c.status === "fulfilled" ? c.value : [],
  };
}

const pct = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)]; };

function blank(url: string, finalUrl: string): Report {
  return {
    url, finalUrl, checkedAt: new Date().toISOString(), score: 0, grade: "F", verdict: "Down",
    http: { status: 0, statusText: "", method: "GET", redirects: [] },
    timing: { dns: 0, connect: 0, tls: 0, wait: 0, download: 0, total: 0 },
    dns: { ip: "", a: [], aaaa: 0, cname: [] }, tls: null,
    body: { bytes: 0, truncated: false, contentType: null, encoding: null, json: null },
    headers: {}, security: SECURITY.map((name) => ({ name, present: false })), samples: null, findings: [],
  };
}

function downReport(url: string, finalUrl: string, e: unknown, dnsMs: number): Report {
  const code = (e as NodeJS.ErrnoException).code ?? "";
  const msg = (e as Error).message ?? "Unknown error";
  const why = code === "ENOTFOUND" ? "The domain name does not resolve. Check the spelling, or the DNS records."
    : code === "ECONNREFUSED" ? "The server refused the connection. Nothing is listening on that port."
    : /timed out/i.test(msg) || code === "ETIMEDOUT" ? "The server did not answer within 8 seconds."
    : code === "ECONNRESET" ? "The connection was closed unexpectedly by the server."
    : msg;
  const r = blank(url, finalUrl);
  r.timing.dns = r1(dnsMs);
  r.findings = [{ id: "reach", level: "fail", title: "Could not reach the endpoint", detail: why }];
  return r;
}

export async function checkUrl(input: string, opts: { method?: string; samples?: number } = {}): Promise<Report> {
  const method = opts.method === "HEAD" ? "HEAD" : "GET";
  const samples = Math.min(Math.max(Math.floor(opts.samples ?? 1), 1), 5);
  const first = parseTarget(input);
  let u = first, addr: Addr = { address: "", family: 4 }, dnsMs = 0, hop: Hop | null = null;
  const redirects: { url: string; status: number }[] = [];

  try {
    for (let i = 0; i <= 5; i++) {
      const r = await resolveSafe(bare(u.hostname));
      addr = r.addr; dnsMs = r.ms;
      hop = await fetchOnce(u, method, addr, true);
      const loc = hop.headers.location;
      if (hop.status >= 300 && hop.status < 400 && loc && i < 5) {
        redirects.push({ url: u.href, status: hop.status });
        u = parseTarget(new URL(loc, u).href);
        continue;
      }
      break;
    }
  } catch (e) {
    if (e instanceof UserError) throw e;
    return downReport(first.href, u.href, e, dnsMs);
  }
  if (!hop) return downReport(first.href, u.href, new Error("No response"), dnsMs);

  const host = bare(u.hostname);
  const secure = u.protocol === "https:";
  const [recs, tlsInfo] = await Promise.all([
    dnsRecords(host),
    secure ? probeTls(host, Number(u.port || 443), addr) : Promise.resolve(null),
  ]);

  let samp: Report["samples"] = null;
  if (samples > 1) {
    const ms = [Math.round(hop.t.total + dnsMs)];
    let fail = hop.status >= 500 ? 1 : 0;
    for (let i = 1; i < samples; i++) {
      try {
        const h = await fetchOnce(u, method, addr, false);
        ms.push(Math.round(h.t.total + dnsMs));
        if (h.status >= 500) fail++;
      } catch { fail++; }
    }
    const avg = ms.reduce((a, b) => a + b, 0) / ms.length;
    const jitter = Math.sqrt(ms.reduce((a, b) => a + (b - avg) ** 2, 0) / ms.length);
    samp = { count: samples, ok: samples - fail, min: Math.min(...ms), avg: Math.round(avg), p95: pct(ms, 0.95), max: Math.max(...ms), jitter: Math.round(jitter) };
  }

  const { t, headers: h, status: s } = hop;
  const ttfb = dnsMs + t.connect + t.tls + t.wait;
  const ct = h["content-type"] ?? null;
  const enc = h["content-encoding"] ?? null;
  const f: Finding[] = [];
  const add = (id: string, level: Level, title: string, detail: string) => f.push({ id, level, title, detail });

  // availability
  if (s >= 200 && s < 300) add("status", "pass", "Endpoint is up", `Returned ${s} ${hop.statusText}.`);
  else if (s === 401 || s === 403) add("status", "warn", "Reachable, but access is restricted", `Returned ${s}. The server is alive. Add credentials to test further.`);
  else if (s >= 500) add("status", "fail", "Server error", `Returned ${s} ${hop.statusText}. The server answered but is failing.`);
  else if (s >= 400) add("status", "warn", "Client error", `Returned ${s} ${hop.statusText}. Check the path and method.`);
  else add("status", "warn", "Unexpected status", `Returned ${s} ${hop.statusText}.`);

  // speed
  if (ttfb < 300) add("speed", "pass", "Fast first byte", `The first byte arrived in ${Math.round(ttfb)} ms.`);
  else if (ttfb < 800) add("speed", "warn", "Slowish first byte", `The first byte took ${Math.round(ttfb)} ms. Aim for under 300 ms.`);
  else add("speed", "fail", "Slow first byte", `The first byte took ${Math.round(ttfb)} ms. Users will notice.`);
  if (dnsMs > 200) add("dns-speed", "warn", "Slow DNS lookup", `Resolving the name took ${Math.round(dnsMs)} ms. Check your DNS provider and TTLs.`);
  if (host && !net.isIP(host)) add("ipv6", recs.aaaa ? "pass" : "info", recs.aaaa ? "IPv6 is available" : "No IPv6 address", recs.aaaa ? `${recs.aaaa} AAAA record(s) found.` : "Only IPv4 records were found.");

  // transport security
  if (!secure) add("https", "fail", "Not using HTTPS", "Traffic to this endpoint is unencrypted.");
  if (tlsInfo && !tlsInfo.ok) add("tls", "fail", "TLS handshake failed", tlsInfo.error);
  if (tlsInfo?.ok) {
    if (!tlsInfo.authorized) add("cert", "fail", "Certificate is not trusted", tlsInfo.authError ?? "The certificate could not be verified.");
    else if (tlsInfo.daysLeft < 0) add("cert", "fail", "Certificate has expired", `It expired ${-tlsInfo.daysLeft} days ago.`);
    else if (tlsInfo.daysLeft <= 7) add("cert", "fail", "Certificate expires very soon", `Only ${tlsInfo.daysLeft} days left. Renew now.`);
    else if (tlsInfo.daysLeft <= 30) add("cert", "warn", "Certificate expires soon", `${tlsInfo.daysLeft} days left.`);
    else add("cert", "pass", "Certificate is valid", `Issued by ${tlsInfo.issuer ?? "unknown"}, ${tlsInfo.daysLeft} days left.`);
    add("tls-version", tlsInfo.protocol === "TLSv1.3" ? "pass" : "info", `Negotiated ${tlsInfo.protocol ?? "TLS"}`, tlsInfo.cipher ? `Cipher: ${tlsInfo.cipher}.` : "");
    add("h2", tlsInfo.alpn === "h2" ? "pass" : "info", tlsInfo.alpn === "h2" ? "HTTP/2 is supported" : "HTTP/2 not offered", tlsInfo.alpn === "h2" ? "The server negotiated h2." : "The server negotiated HTTP/1.1.");
  }
  if (secure && !h["strict-transport-security"]) add("hsts", "warn", "No HSTS header", "Add Strict-Transport-Security so browsers always use HTTPS.");
  if (/\d+\.\d+/.test(h.server ?? "")) add("server", "warn", "Server header reveals its version", `"${h.server}" helps attackers pick exploits. Hide the version number.`);
  if (h["x-powered-by"]) add("powered", "info", "X-Powered-By is exposed", `Value: ${h["x-powered-by"]}.`);
  if (!h["x-content-type-options"]) add("nosniff", "info", "No X-Content-Type-Options", "Add nosniff to stop MIME type guessing.");
  const cors = h["access-control-allow-origin"];
  if (cors) add("cors", "info", cors === "*" ? "CORS is open to any origin" : "CORS is restricted", `Access-Control-Allow-Origin: ${cors}.`);
  if (Object.keys(h).some((k) => /^(x-)?ratelimit|^retry-after/.test(k))) add("rate", "info", "Rate limit headers present", "The API publishes its limits.");

  // payload
  const textual = /json|text|xml|javascript/i.test(ct ?? "");
  if (textual && hop.bytes > 1024) add("compress", enc ? "pass" : "warn", enc ? `Compressed with ${enc}` : "Response is not compressed", enc ? "Smaller payloads reach clients faster." : `${(hop.bytes / 1024).toFixed(1)} KB of text could be gzip or brotli compressed.`);
  if (hop.bytes > 1_000_000) add("size", "warn", "Large response", `${(hop.bytes / 1_048_576).toFixed(2)} MB. Consider pagination.`);
  if (!h["cache-control"]) add("cache", "info", "No Cache-Control header", "Clients and CDNs cannot tell how long to cache this.");

  let json: Report["body"]["json"] = null;
  if (method === "GET" && hop.text && (/json/i.test(ct ?? "") || /^\s*[[{]/.test(hop.text))) {
    try {
      const v: unknown = JSON.parse(hop.text);
      json = { valid: true, kind: Array.isArray(v) ? "array" : v === null ? "null" : typeof v, size: Array.isArray(v) ? v.length : v && typeof v === "object" ? Object.keys(v).length : undefined };
      add("json", "pass", "Valid JSON", `A${json.kind === "array" ? "n" : ""} ${json.kind}${json.size !== undefined ? ` with ${json.size} ${json.kind === "array" ? "items" : "keys"}` : ""}.`);
    } catch (e) {
      const big = hop.truncated || hop.text.length >= MAX_TEXT;
      json = { valid: false, error: big ? "Body is larger than the 1 MB inspection limit." : (e as Error).message };
      add("json", big ? "warn" : "fail", big ? "JSON not fully inspected" : "Invalid JSON", json.error!);
    }
  }

  // redirects and bursts
  if (redirects.length >= 3) add("redirects", "warn", `${redirects.length} redirects before the answer`, "Each hop adds latency. Point clients at the final URL.");
  else if (redirects.length && first.protocol === "http:" && secure) add("redirects", "pass", "HTTP redirects to HTTPS", "Plain HTTP requests are upgraded.");
  else if (redirects.length) add("redirects", "info", `${redirects.length} redirect${redirects.length > 1 ? "s" : ""} followed`, "See the final URL above.");
  if (samp) {
    if (samp.ok < samp.count) add("burst", "fail", `${samp.count - samp.ok} of ${samp.count} burst requests failed`, "The endpoint is flaky under rapid requests.");
    else if (samp.jitter > samp.avg * 0.5 && samp.jitter > 50) add("burst", "warn", "Latency is uneven", `Jitter of ${samp.jitter} ms against an average of ${samp.avg} ms.`);
    else add("burst", "pass", "Stable under a burst", `${samp.count} of ${samp.count} succeeded, p95 ${samp.p95} ms.`);
  }

  const fails = f.filter((x) => x.level === "fail").length;
  const warns = f.filter((x) => x.level === "warn").length;
  let score = Math.max(0, 100 - fails * 18 - warns * 5);
  if (s >= 500) score = Math.min(score, 30);
  const grade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 55 ? "D" : "F";

  return {
    url: first.href, finalUrl: u.href, checkedAt: new Date().toISOString(), score, grade,
    verdict: s >= 500 ? "Down" : fails > 0 || score < 80 ? "Degraded" : "Healthy",
    http: { status: s, statusText: hop.statusText, method, redirects },
    timing: { dns: r1(dnsMs), connect: r1(t.connect), tls: r1(t.tls), wait: r1(t.wait), download: r1(t.download), total: r1(t.total) },
    dns: { ip: addr.address, a: recs.a, aaaa: recs.aaaa, cname: recs.cname },
    tls: tlsInfo, headers: h,
    body: { bytes: hop.bytes, truncated: hop.truncated, contentType: ct, encoding: enc, json },
    security: SECURITY.map((name) => ({ name, present: !!h[name] })),
    samples: samp, findings: f,
  };
}
