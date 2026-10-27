import { NextResponse } from "next/server";
import { checkUrl, UserError } from "@/lib/check";

export const runtime = "nodejs";
export const maxDuration = 30;

// Simple per-IP limiter (per server instance). Use Redis or Upstash for real multi-instance limits.
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 15;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (limited(ip)) return NextResponse.json({ error: "Too many checks. Wait a minute and try again." }, { status: 429 });

  let body: { url?: unknown; method?: unknown; samples?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  try {
    const report = await checkUrl(String(body.url ?? ""), { method: String(body.method ?? "GET"), samples: Number(body.samples) || 1 });
    return NextResponse.json(report);
  } catch (e) {
    if (e instanceof UserError) return NextResponse.json({ error: e.message }, { status: 422 });
    return NextResponse.json({ error: "Something went wrong while running the check." }, { status: 500 });
  }
}
