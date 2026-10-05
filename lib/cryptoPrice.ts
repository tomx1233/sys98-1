import type { GetJson } from "./robloxAudio";

const asObj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const asNum = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/** CoinGecko's free "simple price" endpoint. No API key, generous enough rate limit for a Discord command. */
export async function getCryptoPrice(coingeckoId: string, getJson: GetJson): Promise<{ ok: true; usd: number; change24h?: number } | { ok: false; error: "unavailable" }> {
  let r;
  try {
    r = await getJson(`https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd&include_24hr_change=true`);
  } catch {
    return { ok: false, error: "unavailable" };
  }
  if (r.status !== 200) return { ok: false, error: "unavailable" };
  const d = asObj(asObj(r.json)[coingeckoId]);
  const usd = asNum(d.usd);
  if (usd === undefined) return { ok: false, error: "unavailable" };
  return { ok: true, usd, change24h: asNum(d.usd_24h_change) };
}
