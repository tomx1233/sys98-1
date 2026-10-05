import type { GetJson } from "./robloxAudio";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitter = (ms: number) => ms + Math.floor(Math.random() * ms * 0.3);

// A handful of Roblox calls almost always fire together (Promise.all in lookupUser, getGroupDetail, …).
// Firing them all in the same instant is exactly what trips Roblox's burst limiter, so every outbound
// call is funneled through this tiny queue first: it caps how many are in flight at once and staggers
// their start slightly. This runs per serverless instance, so it only smooths bursts *within* one
// interaction/request — it can't coordinate across separate invocations — but that's most of the burst.
const MAX_CONCURRENT = 2;
const STAGGER_MS = 110;
let inFlight = 0;
const queue: (() => void)[] = [];

async function acquireSlot(): Promise<void> {
  if (inFlight < MAX_CONCURRENT) {
    inFlight++;
    return;
  }
  await new Promise<void>((resolve) => queue.push(resolve));
  inFlight++;
}
function releaseSlot() {
  inFlight--;
  const next = queue.shift();
  if (next) next();
}

/** The one place that talks to Roblox's public web APIs (used by the website tools and the Discord bot). */
export const robloxGetJson: GetJson = async (url, init) => {
  await acquireSlot();
  try {
    // Small stagger even once a slot is free, so a burst of Promise.all calls doesn't all land in
    // the same millisecond.
    await sleep(jitter(STAGGER_MS));
    // 4 attempts, capped backoff: worst case is well under the ~60s budget we have for the
    // deferred Discord edit, even with several of these calls staggered through the queue above.
    const MAX_ATTEMPTS = 6;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const res = await fetch(url, {
        method: init?.method ?? "GET",
        headers: {
          Accept: "application/json",
          ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
          "User-Agent": "system98-roblox/1.0 (+https://system98.org)",
        },
        body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
        signal: AbortSignal.timeout(6000),
        cache: "no-store",
      });
      // Roblox rate-limits bursts of requests (common while browsing several /user pages back to
      // back, or many people using the bot at once); a retry with backoff clears most of these
      // instead of surfacing a false "not found"/empty list.
      if (res.status === 429 && attempt < MAX_ATTEMPTS - 1) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 4000)
          : jitter(500 * (attempt + 1));
        await sleep(wait);
        continue;
      }
      const json = await res.json().catch(() => null);
      return { status: res.status, json };
    }
    return { status: 429, json: null };
  } finally {
    releaseSlot();
  }
};

/** Tiny in-memory cache so popular lookups don't hit Roblox again and again. */
export function makeCache<T>(ttlMs: number, max = 500) {
  const map = new Map<string, { at: number; value: T }>();
  return {
    get(key: string): T | undefined {
      const hit = map.get(key);
      return hit && Date.now() - hit.at < ttlMs ? hit.value : undefined;
    },
    set(key: string, value: T) {
      if (map.size >= max) map.clear();
      map.set(key, { at: Date.now(), value });
    },
  };
}
