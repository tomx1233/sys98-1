import { NextRequest, NextResponse } from "next/server";
import { lookupUser, parseUserInput, type RobloxUser, type UserLookupError } from "@/lib/robloxUser";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { robloxGetJson as getJson } from "@/lib/robloxHttp";

export const maxDuration = 20;

const MESSAGES: Record<UserLookupError, string> = {
  invalid: "Enter a Roblox username, a user ID or a profile link.",
  notfound: "Roblox doesn't know an account like that.",
  busy: "Roblox is rate limiting us right now, try again in a minute.",
  unavailable: "Couldn't reach Roblox just now, try again in a moment.",
};

const CACHE_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; user: RobloxUser }>();

export async function GET(req: NextRequest) {
  const limit = rateLimit(`roblox-user:${clientIp(req)}`, 15, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Slow down a little, try again in a moment." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  }

  const q = req.nextUrl.searchParams.get("q") ?? "";
  const target = parseUserInput(q);
  if (!target) return NextResponse.json({ ok: false, error: MESSAGES.invalid }, { status: 400 });

  const key = target.kind === "id" ? `id:${target.id}` : `name:${target.name.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return NextResponse.json({ ok: true, user: hit.user });

  const result = await lookupUser(q, getJson);
  if (!result.ok) {
    const status = result.error === "notfound" ? 404 : result.error === "busy" ? 429 : result.error === "invalid" ? 400 : 502;
    return NextResponse.json({ ok: false, error: MESSAGES[result.error] }, { status });
  }
  if (cache.size > 500) cache.clear();
  cache.set(key, { at: Date.now(), user: result.user });
  return NextResponse.json({ ok: true, user: result.user });
}
