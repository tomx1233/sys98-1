import { NextRequest, NextResponse } from "next/server";
import { getCryptoPrice } from "@/lib/cryptoPrice";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { robloxGetJson as getJson } from "@/lib/robloxHttp";

export const maxDuration = 20;

// The bot's /xrp command as a website tool. CoinGecko's free endpoint, so the
// coin list is intentionally short — a fixed menu instead of arbitrary ids.
export const COINS: Record<string, string> = {
  ripple: "XRP",
  bitcoin: "Bitcoin",
  ethereum: "Ethereum",
  solana: "Solana",
};

const CACHE_MS = 60 * 1000;
const cache = new Map<string, { at: number; data: Record<string, unknown> }>();

export async function GET(req: NextRequest) {
  const limit = rateLimit(`crypto:${clientIp(req)}`, 20, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Slow down a little, try again in a moment." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  }

  const id = req.nextUrl.searchParams.get("id") ?? "ripple";
  if (!COINS[id]) return NextResponse.json({ ok: false, error: "That coin isn't on the menu." }, { status: 400 });

  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < CACHE_MS) return NextResponse.json({ ok: true, symbol: COINS[id], ...hit.data });

  const result = await getCryptoPrice(id, getJson);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: "Couldn't reach the price feed just now, try again in a moment." }, { status: 502 });
  }
  const data = { usd: result.usd, change24h: result.change24h ?? null };
  if (cache.size > 100) cache.clear();
  cache.set(id, { at: Date.now(), data });
  return NextResponse.json({ ok: true, symbol: COINS[id], ...data });
}
