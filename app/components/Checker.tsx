"use client";
import { Fragment, useCallback, useEffect, useState } from "react";
import type { Finding, Report } from "../lib/types";
import { track } from "@vercel/analytics";

type Tick = { ms: number; ok: boolean };
const EXAMPLES = ["api.github.com", "jsonplaceholder.typicode.com/posts/1", "httpbin.org/status/503"];
const dot: Record<Finding["level"], string> = { pass: "bg-pass", warn: "bg-warn", fail: "bg-fail", info: "bg-cobalt" };
const rank: Record<Finding["level"], number> = { fail: 0, warn: 1, info: 2, pass: 3 };
const tone = { Healthy: "text-pass", Degraded: "text-warn", Down: "text-fail" };
const stroke = { Healthy: "stroke-pass", Degraded: "stroke-warn", Down: "stroke-fail" };
const ms = (n: number) => `${n < 10 ? n.toFixed(1) : Math.round(n)} ms`;
const kb = (b: number) => (b < 1024 ? `${b} B` : b < 1_048_576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1_048_576).toFixed(2)} MB`);

function Ring({ r }: { r: Report }) {
  const C = 2 * Math.PI * 44;
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 100 100" className="-rotate-90" aria-hidden>
        <circle cx="50" cy="50" r="44" fill="none" strokeWidth="8" className="stroke-rule" />
        <circle cx="50" cy="50" r="44" fill="none" strokeWidth="8" strokeLinecap="round" className={`ring-fill ${stroke[r.verdict]}`}
          strokeDasharray={C} strokeDashoffset={C * (1 - r.score / 100)} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-3xl font-extrabold leading-none">{r.grade}</p>
          <p className="mt-1 font-mono text-xs text-slate-500">{r.score}/100</p>
        </div>
      </div>
    </div>
  );
}

function Waterfall({ r }: { r: Report }) {
  const t = r.timing;
  const segs = [["DNS lookup", t.dns, "#8aa0ff"], ["Connect", t.connect, "#5f78ff"], ["TLS handshake", t.tls, "#3347ff"], ["Server wait", t.wait, "#1f2fb3"], ["Download", t.download, "#0b1220"]] as const;
  const sum = segs.reduce((a, s) => a + s[1], 0) || 1;
  let cum = 0;
  return (
    <div className="space-y-2.5">
      {segs.map(([name, v, color], i) => {
        const left = (cum / sum) * 100;
        cum += v;
        return (
          <div key={name} className="grid grid-cols-[7.5rem_1fr] md:grid-cols-[7.5rem_1fr_5rem] items-center gap-3 text-sm">
            <span className="text-slate-600">{name}</span>
            <div className="hidden md:inline relative h-3 rounded-full bg-rule/60">
              <div className="grow absolute inset-y-0 rounded-full" style={{ left: `${left}%`, width: `${Math.max((v / sum) * 100, 1.2)}%`, background: color, animationDelay: `${i * 110}ms` }} />
            </div>
            <span className="text-right font-mono text-[13px]">{ms(v)}</span>
          </div>
        );
      })}
    </div>
  );
}

function Dl({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-sm">
      {rows.map(([k, v]) => (
        <Fragment key={k}>
          <dt className="text-slate-500">{k}</dt>
          <dd className="min-w-0 break-words font-mono text-[13px]">{v}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

export default function Checker() {
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState<"GET" | "HEAD">("GET");
  const [burst, setBurst] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [runId, setRunId] = useState(0);
  const [watch, setWatch] = useState(false);
  const [ticks, setTicks] = useState<Tick[]>([]);
  const [copied, setCopied] = useState("");

  const run = useCallback(async (target: string, quiet = false) => {
    if (!quiet) { setBusy(true); setError(""); }
    try {
      const res = await fetch("/api/check", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target, method, samples: burst && !quiet ? 5 : 1 }),
      });
      const data = await res.json();
      if (!res.ok) { if (!quiet) setError(data.error ?? "The check failed. Try again."); return; }
      const r = data as Report;
      const tick = { ms: Math.round(r.timing.total + r.timing.dns), ok: r.http.status > 0 && r.http.status < 500 };
      setReport(r);
      setTicks((t) => (quiet ? [...t, tick].slice(-60) : [tick]));
      if (!quiet) setRunId((n) => n + 1);
    } catch {
      if (!quiet) setError("Could not reach Pingdoc. Check your connection.");
    } finally {
      if (!quiet) setBusy(false);
    }
  }, [method, burst]);

  const target = report?.url;
  useEffect(() => {
    if (!watch || !target) return;
    const id = setInterval(() => run(target, true), 30_000);
    return () => clearInterval(id);
  }, [watch, target, run]);

  const copy = (label: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(label); setTimeout(() => setCopied(""), 1500); });
  };
  const curl = (r: Report) =>
    `curl -sS -o /dev/null -w "dns %{time_namelookup}s  connect %{time_connect}s  tls %{time_appconnect}s  ttfb %{time_starttransfer}s  total %{time_total}s  status %{http_code}\\n" '${r.finalUrl}'`;

  const btn = "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:border-cobalt hover:text-cobalt";
  const uptime = ticks.length ? (ticks.filter((t) => t.ok).length / ticks.length) * 100 : 100;
  const maxMs = Math.max(...ticks.map((t) => t.ms), 1);

  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); if (url.trim()) {track("run_checkup_clicked"); setWatch(false); run(url.trim()); } }}
        className="rounded-xl border border-ink/15 bg-white p-2 shadow-[0_8px_30px_-12px_rgba(51,71,255,.25)]">
        <div className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="url" className="sr-only">API endpoint URL</label>
          <input id="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.yourapp.com/health"
            inputMode="url" autoComplete="off" spellCheck={false}
            className="min-w-0 flex-1 rounded-lg bg-transparent px-4 py-3.5 font-mono text-[15px] outline-none placeholder:text-slate-400" />
          <button disabled={busy || !url.trim()} className="rounded-lg bg-cobalt px-6 py-3.5 font-semibold text-white transition hover:bg-cobalt-dark disabled:opacity-50">
            {busy ? "Checking..." : "Run checkup"}
          </button>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-rule px-3 pt-2.5 pb-1 text-sm text-slate-600">
          <label className="flex items-center gap-2">Method
            <select value={method} onChange={(e) => setMethod(e.target.value as "GET" | "HEAD")} className="rounded border border-slate-300 bg-white px-1.5 py-0.5">
              <option>GET</option><option>HEAD</option>
            </select>
          </label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={burst} onChange={(e) => setBurst(e.target.checked)} /> Burst test, 5 requests</label>
          <span className="flex flex-wrap items-center gap-2 sm:ml-auto">Try
            {EXAMPLES.map((x) => <button type="button" key={x} onClick={() => setUrl(x)} className="rounded-full bg-paper px-2.5 py-0.5 font-mono text-xs hover:text-cobalt">{x}</button>)}
          </span>
        </div>
      </form>
      <p className="mt-2 text-sm text-slate-500">Pingdoc sends the request from its own server. Nothing you check is stored.</p>

      {error && <p role="alert" className="mt-5 rounded-lg border border-fail/30 bg-fail/5 px-4 py-3 text-fail">{error}</p>}

      {report && (
        <section key={runId} aria-live="polite" className="rise mt-8 divide-y divide-rule rounded-xl border border-ink/15 bg-white">
          <div className="flex flex-wrap items-center gap-6 p-6">
            <Ring r={report} />
            <div className="min-w-0 flex-1 basis-60">
              <p className={`text-3xl font-extrabold ${tone[report.verdict]}`}>{report.verdict}</p>
              <p className="mt-1 break-all font-mono text-sm text-slate-600">{report.finalUrl}</p>
              <p className="mt-2 text-sm text-slate-600">
                {report.http.status ? `${report.http.status} ${report.http.statusText}` : "No response"}, {ms(report.timing.total + report.timing.dns)} total, {kb(report.body.bytes)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className={btn} onClick={() => copy("curl", curl(report))}>{copied === "curl" ? "Copied" : "Copy as cURL"}</button>
              <button className={btn} onClick={() => copy("json", JSON.stringify(report, null, 2))}>{copied === "json" ? "Copied" : "Copy report"}</button>
            </div>
          </div>

          <div className="p-6">
            <h3 className="mb-4 text-lg font-bold">Where the time went</h3>
            <Waterfall r={report} />
            {report.http.redirects.length > 0 && <p className="mt-4 text-sm text-slate-600">Timing shown for the final request, after {report.http.redirects.length} redirect(s).</p>}
          </div>

          <div className="p-6">
            <h3 className="mb-4 text-lg font-bold">Findings</h3>
            <ul className="space-y-3">
              {[...report.findings].sort((a, b) => rank[a.level] - rank[b.level]).map((x) => (
                <li key={x.id} className="flex gap-3">
                  <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${dot[x.level]}`} />
                  <div><p className="font-semibold">{x.title}</p>{x.detail && <p className="text-sm text-slate-600">{x.detail}</p>}</div>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-8 p-6 md:grid-cols-2">
            <div>
              <h3 className="mb-4 text-lg font-bold">Connection</h3>
              <Dl rows={[
                ["IP address", report.dns.ip || "n/a"],
                ["A records", report.dns.a.length ? report.dns.a.map((a) => `${a.address} (ttl ${a.ttl}s)`).join(", ") : "none"],
                ["AAAA records", String(report.dns.aaaa)],
                ["CNAME", report.dns.cname.join(", ") || "none"],
                ["TLS", report.tls?.ok ? `${report.tls.protocol}, ${report.tls.alpn === "h2" ? "HTTP/2" : "HTTP/1.1"}` : report.tls ? "failed" : "not used"],
                ["Certificate", report.tls?.ok ? `${report.tls.subject ?? "n/a"}, by ${report.tls.issuer ?? "unknown"}` : "n/a"],
                ["Expires", report.tls?.ok && report.tls.validTo ? `${new Date(report.tls.validTo).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} (${report.tls.daysLeft} days)` : "n/a"],
              ]} />
            </div>
            <div>
              <h3 className="mb-4 text-lg font-bold">Response</h3>
              <Dl rows={[
                ["Content type", report.body.contentType ?? "none"],
                ["Encoding", report.body.encoding ?? "none"],
                ["Transferred", kb(report.body.bytes) + (report.body.truncated ? " (cut at 2 MB)" : "")],
                ["JSON", report.body.json ? (report.body.json.valid ? `valid ${report.body.json.kind}${report.body.json.size !== undefined ? `, ${report.body.json.size}` : ""}` : `invalid: ${report.body.json.error}`) : "not JSON"],
                ["Server", report.headers.server ?? "not disclosed"],
                ["Redirects", report.http.redirects.length ? report.http.redirects.map((x) => x.status).join(" > ") : "none"],
              ]} />
              <p className="mt-5 mb-2 text-sm font-semibold">Security headers</p>
              <ul className="flex flex-wrap gap-1.5">
                {report.security.map((s) => (
                  <li key={s.name} className={`rounded-full px-2.5 py-0.5 font-mono text-xs ring-1 ${s.present ? "bg-pass/10 text-pass ring-pass/30" : "bg-slate-50 text-slate-400 ring-slate-200 line-through"}`}>{s.name}</li>
                ))}
              </ul>
            </div>
          </div>

          {report.samples && (
            <div className="p-6">
              <h3 className="mb-4 text-lg font-bold">Burst test</h3>
              <Dl rows={[
                ["Succeeded", `${report.samples.ok} of ${report.samples.count}`],
                ["Latency", `min ${report.samples.min}, avg ${report.samples.avg}, p95 ${report.samples.p95}, max ${report.samples.max} ms`],
                ["Jitter", `${report.samples.jitter} ms`],
              ]} />
            </div>
          )}

          <div className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">Live watch</h3>
                <p className="text-sm text-slate-600">Re-checks every 30 seconds while this tab stays open.</p>
              </div>
              <button className={btn} onClick={() => setWatch((w) => !w)} aria-pressed={watch}>{watch ? "Stop watching" : "Start watching"}</button>
            </div>
            <div className="mt-5 flex h-14 items-end gap-1" role="img" aria-label={`Uptime strip, ${uptime.toFixed(1)} percent`}>
              {ticks.map((t, i) => (
                <div key={i} title={t.ok ? ms(t.ms) : "Down"} className={`w-2 rounded-sm ${t.ok ? (t.ms < 800 ? "bg-pass" : "bg-warn") : "bg-fail"}`} style={{ height: `${Math.max(14, (t.ms / maxMs) * 100)}%` }} />
              ))}
            </div>
            <p className="mt-2 font-mono text-sm text-slate-600">{uptime.toFixed(1)}% up over {ticks.length} {ticks.length === 1 ? "check" : "checks"} this session</p>
          </div>
        </section>
      )}
    </div>
  );
}
