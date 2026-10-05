import { NextRequest, NextResponse } from "next/server";
import * as RX from "@/lib/robloxExtra";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { robloxGetJson as getJson } from "@/lib/robloxHttp";

export const maxDuration = 20;

// One route for the bot's three ID lookups: /assetid, /gamepass and /bundle.
// ?type=asset|gamepass|bundle&id=<id or link>

const MESSAGES: Record<string, string> = {
  invalid: "Pick what you're looking up and give me its ID or link.",
  notfound: "Roblox doesn't know that one.",
  busy: "Roblox is rate limiting us right now, try again in a minute.",
  unavailable: "Couldn't reach Roblox just now, try again in a moment.",
};
const STATUS: Record<string, number> = { invalid: 400, notfound: 404, busy: 429, unavailable: 502 };

const CACHE_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; data: Record<string, unknown> }>();

export async function GET(req: NextRequest) {
  const limit = rateLimit(`roblox-catalog:${clientIp(req)}`, 15, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Slow down a little, try again in a moment." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  }

  const type = req.nextUrl.searchParams.get("type") ?? "asset";
  const id = (req.nextUrl.searchParams.get("id") ?? "").trim().slice(0, 300);
  if (!["asset", "gamepass", "bundle"].includes(type) || !id) {
    return NextResponse.json({ ok: false, error: MESSAGES.invalid }, { status: 400 });
  }

  const key = `${type}:${id.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return NextResponse.json({ ok: true, ...hit.data });

  let data: { kind: string } & Record<string, unknown>;
  if (type === "gamepass") {
    const r = await RX.getGamepass(id, getJson);
    if (!r.ok) return NextResponse.json({ ok: false, error: MESSAGES[r.error] ?? MESSAGES.unavailable }, { status: STATUS[r.error] ?? 502 });
    data = { kind: "gamepass", id: r.id, name: r.name, priceRobux: r.priceRobux, icon: r.icon, url: r.url };
  } else if (type === "bundle") {
    const r = await RX.getBundle(id, getJson);
    if (!r.ok) return NextResponse.json({ ok: false, error: MESSAGES[r.error] ?? MESSAGES.unavailable }, { status: STATUS[r.error] ?? 502 });
    data = { kind: "bundle", id: r.id, name: r.name, description: r.description, bundleType: r.type, items: r.items, icon: r.icon, url: r.url };
  } else {
    const r = await RX.getAsset(id, getJson);
    if (!r.ok) return NextResponse.json({ ok: false, error: MESSAGES[r.error] ?? MESSAGES.unavailable }, { status: STATUS[r.error] ?? 502 });
    data = { kind: "asset", ...r.asset };
  }

  if (cache.size > 500) cache.clear();
  cache.set(key, { at: Date.now(), data });
  return NextResponse.json({ ok: true, ...data });
}
