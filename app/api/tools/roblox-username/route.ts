import { NextRequest, NextResponse } from "next/server";
import * as RX from "@/lib/robloxExtra";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { robloxGetJson as getJson } from "@/lib/robloxHttp";

export const maxDuration = 20;

const MESSAGES: Record<string, string> = {
  invalid: "Enter a username to check.",
  busy: "Roblox is rate limiting us right now, try again in a minute.",
  unavailable: "Couldn't reach Roblox just now, try again in a moment.",
};

const CACHE_MS = 2 * 60 * 1000;
const cache = new Map<string, { at: number; result: unknown }>();

export async function GET(req: NextRequest) {
  const limit = rateLimit(`roblox-username:${clientIp(req)}`, 15, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Slow down a little, try again in a moment." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  }

  const username = (req.nextUrl.searchParams.get("username") ?? "").trim().slice(0, 20);
  if (!username) return NextResponse.json({ ok: false, error: MESSAGES.invalid }, { status: 400 });

  const key = username.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return NextResponse.json({ ok: true, result: hit.result });

  const result = await RX.checkUsername(username, getJson);
  if (!result.ok) {
    const status = result.error === "busy" ? 429 : 502;
    return NextResponse.json({ ok: false, error: MESSAGES[result.error] ?? MESSAGES.unavailable }, { status });
  }
  if (cache.size > 500) cache.clear();
  cache.set(key, { at: Date.now(), result: result.result });
  return NextResponse.json({ ok: true, result: result.result });
}
