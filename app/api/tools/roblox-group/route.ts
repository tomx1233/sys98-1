import { NextRequest, NextResponse } from "next/server";
import * as RX from "@/lib/robloxExtra";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { robloxGetJson as getJson } from "@/lib/robloxHttp";

export const maxDuration = 20;

const MESSAGES: Record<string, string> = {
  invalid: "Enter a group name, a group ID or a group link.",
  notfound: "Roblox doesn't know a group like that.",
  busy: "Roblox is rate limiting us right now, try again in a minute.",
  unavailable: "Couldn't reach Roblox just now, try again in a moment.",
};
const STATUS: Record<string, number> = { invalid: 400, notfound: 404, busy: 429, unavailable: 502 };

const CACHE_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; group: unknown }>();

export async function GET(req: NextRequest) {
  const limit = rateLimit(`roblox-group:${clientIp(req)}`, 15, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Slow down a little, try again in a moment." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 300);
  if (!q) return NextResponse.json({ ok: false, error: MESSAGES.invalid }, { status: 400 });

  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return NextResponse.json({ ok: true, group: hit.group });

  const result = await RX.getGroup(q, getJson);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: MESSAGES[result.error] ?? MESSAGES.unavailable }, { status: STATUS[result.error] ?? 502 });
  }
  if (cache.size > 500) cache.clear();
  cache.set(key, { at: Date.now(), group: result.group });
  return NextResponse.json({ ok: true, group: result.group });
}
