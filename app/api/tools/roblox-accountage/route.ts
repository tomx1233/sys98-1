import { NextRequest, NextResponse } from "next/server";
import * as RX from "@/lib/robloxExtra";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { robloxGetJson as getJson } from "@/lib/robloxHttp";

export const maxDuration = 20;

const MESSAGES: Record<string, string> = {
  invalid: "Enter a Roblox username, a user ID or a profile link.",
  notfound: "Roblox doesn't know an account like that.",
  busy: "Roblox is rate limiting us right now, try again in a minute.",
  unavailable: "Couldn't reach Roblox just now, try again in a moment.",
};
const STATUS: Record<string, number> = { invalid: 400, notfound: 404, busy: 429, unavailable: 502 };

const CACHE_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; data: Record<string, unknown> }>();

export async function GET(req: NextRequest) {
  const limit = rateLimit(`roblox-accountage:${clientIp(req)}`, 15, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Slow down a little, try again in a moment." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  }

  const user = (req.nextUrl.searchParams.get("user") ?? "").trim().slice(0, 300);
  if (!user) return NextResponse.json({ ok: false, error: MESSAGES.invalid }, { status: 400 });

  const key = user.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return NextResponse.json({ ok: true, ...hit.data });

  const result = await RX.getAccountAge(user, getJson);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: MESSAGES[result.error] ?? MESSAGES.unavailable }, { status: STATUS[result.error] ?? 502 });
  }
  const data = { name: result.name, id: result.id, created: result.created, days: result.days, url: result.url };
  if (cache.size > 500) cache.clear();
  cache.set(key, { at: Date.now(), data });
  return NextResponse.json({ ok: true, ...data });
}
