import { NextRequest, NextResponse } from "next/server";
import { extractAssetId, lookupAudio, type LookupError, type RobloxAudio } from "@/lib/robloxAudio";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { robloxGetJson as getJson } from "@/lib/robloxHttp";

export const maxDuration = 20;

const MESSAGES: Record<LookupError, string> = {
  invalid: "That doesn't look like an audio ID. Paste the number or the link from Roblox.",
  notfound: "Roblox doesn't know an asset with that ID.",
  notaudio: "That ID exists, but it isn't an audio.",
  busy: "Roblox is rate limiting us right now, try again in a minute.",
  unavailable: "Couldn't reach Roblox just now, try again in a moment.",
};

// small in-memory cache so popular ids don't hit Roblox again and again
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; audio: RobloxAudio }>();

export async function GET(req: NextRequest) {
  const limit = rateLimit(`roblox-audio:${clientIp(req)}`, 20, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Slow down a little, try again in a moment." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  }

  const id = extractAssetId(req.nextUrl.searchParams.get("id") ?? "");
  if (!id) return NextResponse.json({ ok: false, error: MESSAGES.invalid }, { status: 400 });

  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < CACHE_MS) return NextResponse.json({ ok: true, audio: hit.audio });

  const result = await lookupAudio(id, getJson);
  if (!result.ok) {
    const status = result.error === "notfound" || result.error === "notaudio" ? 404 : result.error === "busy" ? 429 : result.error === "invalid" ? 400 : 502;
    const extra = result.error === "notaudio" && result.detail ? ` It's a ${result.detail}.` : "";
    return NextResponse.json({ ok: false, error: MESSAGES[result.error] + (result.error === "notaudio" ? extra : "") }, { status });
  }

  if (cache.size > 500) cache.clear();
  cache.set(id, { at: Date.now(), audio: result.audio });
  return NextResponse.json({ ok: true, audio: result.audio });
}
