import { NextRequest, NextResponse } from "next/server";
import * as RX from "@/lib/robloxExtra";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { robloxGetJson as getJson } from "@/lib/robloxHttp";

export const maxDuration = 20;

const MESSAGES: Record<string, string> = {
  invalid: "Enter a game name or a universe ID.",
  notfound: "Roblox doesn't know a game like that.",
  busy: "Roblox is rate limiting us right now, try again in a minute.",
  unavailable: "Couldn't reach Roblox just now, try again in a moment.",
};
const STATUS: Record<string, number> = { invalid: 400, notfound: 404, busy: 429, unavailable: 502 };

const CACHE_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; game: unknown }>();

export async function GET(req: NextRequest) {
  const limit = rateLimit(`roblox-game:${clientIp(req)}`, 15, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Slow down a little, try again in a moment." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 300);
  if (!q) return NextResponse.json({ ok: false, error: MESSAGES.invalid }, { status: 400 });

  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return NextResponse.json({ ok: true, game: hit.game });

  // pure digits = a universe ID, anything else = a name search (same split the bot's /game + /universe make)
  const result = /^\d{1,19}$/.test(q) ? await RX.getUniverse(q, getJson) : await RX.searchGame(q, getJson);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: MESSAGES[result.error] ?? MESSAGES.unavailable }, { status: STATUS[result.error] ?? 502 });
  }
  if (cache.size > 500) cache.clear();
  cache.set(key, { at: Date.now(), game: result.game });
  return NextResponse.json({ ok: true, game: result.game });
}
