import { NextRequest, NextResponse, after } from "next/server";
import { handleInteraction, verifyDiscordSignature, type BotDeps, type BotFile } from "@/lib/discordBot";
import { extractAssetId, lookupAudio } from "@/lib/robloxAudio";
import { lookupUser } from "@/lib/robloxUser";
import { makeCache, robloxGetJson } from "@/lib/robloxHttp";
import * as RX from "@/lib/robloxExtra";
import QRCode from "qrcode";
import { analyzeAudio, renderWaveformPng, AnalysisError } from "@/lib/audioAnalysis";
import { recognizeSong } from "@/lib/songRecognition";
import { rateLimit } from "@/lib/rateLimit";
import { siteUrl } from "@/lib/support";
import { getCryptoPrice } from "@/lib/cryptoPrice";

export const maxDuration = 60;

// Discord's own CDN only. The attachment URL comes from Discord's signed payload, so this is really just
// belt-and-braces against a future bug, not a trust boundary we rely on.
const DISCORD_CDN_HOSTS = new Set(["cdn.discordapp.com", "media.discordapp.net"]);
const ANALYZE_MAX_BYTES = 20 * 1024 * 1024;

// Downloads the attachment Discord referenced. The URL comes from Discord's signed payload, so the
// host check is belt-and-braces, not a trust boundary. Streams it in and bails if it exceeds the size cap.
async function downloadAttachment(att: { url: string; filename: string; size: number }): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; error: string }> {
  let parsed: URL;
  try {
    parsed = new URL(att.url);
  } catch {
    return { ok: false, error: "That attachment doesn't have a usable link." };
  }
  if (parsed.protocol !== "https:" || !DISCORD_CDN_HOSTS.has(parsed.hostname)) {
    return { ok: false, error: "That attachment isn't hosted on Discord, so I won't fetch it." };
  }
  if (att.size > ANALYZE_MAX_BYTES) {
    return { ok: false, error: `That file is too big (${(att.size / 1048576).toFixed(1)} MB, max 20 MB).` };
  }
  let res: Response;
  try {
    res = await fetch(parsed, { signal: AbortSignal.timeout(20000) });
  } catch {
    return { ok: false, error: "Couldn't download that attachment from Discord, try again." };
  }
  if (!res.ok || !res.body) return { ok: false, error: "Couldn't download that attachment from Discord, try again." };

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > ANALYZE_MAX_BYTES) {
      reader.cancel().catch(() => {});
      return { ok: false, error: "That file is too big (max 20 MB)." };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { bytes.set(c, off); off += c.length; }
  return { ok: true, bytes };
}

async function analyzeFile(att: { url: string; filename: string; size: number; contentType?: string }) {
  const dl = await downloadAttachment(att);
  if (!dl.ok) return { ok: false as const, error: dl.error };
  try {
    const analysis = await analyzeAudio(dl.bytes, { maxSeconds: 20 * 60 });
    const waveformPng = renderWaveformPng(analysis);
    return { ok: true as const, analysis, waveformPng };
  } catch (err) {
    if (err instanceof AnalysisError) return { ok: false as const, error: err.message };
    console.error("[discord] analyzeAudio threw:", err);
    return { ok: false as const, error: "Couldn't read that file." };
  }
}

const AUDD_ERROR: Record<string, string> = {
  notoken: "Song recognition isn't set up (no AudD token). An owner needs to set AUDD_API_TOKEN.",
  nomatch: "Couldn't identify a song in that clip. It needs a clear stretch of music to match.",
  toobig: "That file is too big for recognition (max 20 MB).",
  badfile: "Couldn't read that file. Send a normal audio file with music in it.",
  quota: "The song-recognition quota is used up for now, try again later.",
  unavailable: "The song-recognition service didn't answer, try again in a moment.",
};

async function recognizeFile(att: { url: string; filename: string; size: number; contentType?: string }) {
  const dl = await downloadAttachment(att);
  if (!dl.ok) return { ok: false as const, error: dl.error };
  const r = await recognizeSong({ data: dl.bytes, filename: att.filename }, process.env.AUDD_API_TOKEN, async (form) => {
    const res = await fetch("https://api.audd.io/", { method: "POST", body: form, signal: AbortSignal.timeout(25000) });
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  });
  return r.ok ? r : { ok: false as const, error: AUDD_ERROR[r.error] ?? AUDD_ERROR.unavailable };
}

const audioCache = makeCache<Awaited<ReturnType<typeof lookupAudio>>>(10 * 60 * 1000);
const userCache = makeCache<Awaited<ReturnType<typeof lookupUser>>>(5 * 60 * 1000);
// The dropdown views (friends, followers, groups, games …) hit Roblox's most rate-limited list
// endpoints, and every click otherwise re-fetches. Caching each successful fetch per user for a few
// minutes is the actual fix for the "rate limited" on those pages: once a list loads, clicking around
// and paginating reuses it instead of hammering Roblox again.
const viewCache = makeCache<unknown>(3 * 60 * 1000);
function cachedView<T>(key: string, run: () => Promise<T>): Promise<T> {
  const hit = viewCache.get(key) as T | undefined;
  if (hit !== undefined) return Promise.resolve(hit);
  return run().then((r) => {
    if ((r as { ok?: boolean })?.ok) viewCache.set(key, r); // only cache successes
    return r;
  });
}
const vkey = (v: string, input: string) => `${v}:${input.trim().toLowerCase()}`;

const RX_ERROR: Record<string, string> = {
  invalid: "That doesn't look right — check the username, ID or link.",
  notfound: "Roblox doesn't know that one.",
  busy: "Roblox is rate limiting us right now, try again in a minute.",
  unavailable: "Couldn't reach Roblox just now, try again in a moment.",
};
// turn the library's { ok:false, error:"code" } into { ok:false, error:"friendly message" }.
// The generic keeps the success shape; only the error branch is rewritten.
function friendly<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> | { ok: false; error: string } {
  if (r.ok) return r as Extract<T, { ok: true }>;
  const code = (r as unknown as { error: string }).error;
  return { ok: false, error: RX_ERROR[code] ?? RX_ERROR.unavailable };
}

const deps: BotDeps = {
  siteUrl: siteUrl(),
  lookupAudio: async (input) => {
    const id = extractAssetId(input);
    if (!id) return { ok: false, error: "invalid" };
    const hit = audioCache.get(id);
    if (hit) return hit;
    const r = await lookupAudio(id, robloxGetJson);
    if (r.ok) audioCache.set(id, r);
    return r;
  },
  lookupUser: async (input) => {
    const key = input.trim().toLowerCase();
    const hit = userCache.get(key);
    if (hit) return hit;
    const r = await lookupUser(input, robloxGetJson);
    if (r.ok) {
      // Rolimons RAP/Value is a nice-to-have: if it's down we still return the user.
      const roli = await RX.getRolimons(r.user.id, robloxGetJson);
      r.user.rap = roli.rap;
      r.user.value = roli.value;
      userCache.set(key, r);
    }
    return r;
  },
  analyzeFile,
  recognizeSong: recognizeFile,
  avatar: (input, kind) => RX.getAvatar(input, kind, robloxGetJson).then(friendly),
  accountAge: (input) => RX.getAccountAge(input, robloxGetJson).then(friendly),
  friends: (input) => cachedView(vkey("friends", input), () => RX.getFriends(input, robloxGetJson).then(friendly)),
  areFriends: (a, b) => RX.areFriends(a, b, robloxGetJson).then(friendly),
  userGroups: (input) => cachedView(vkey("groups", input), () => RX.getUserGroups(input, robloxGetJson).then(friendly)),
  groupDetail: (groupId, roleName, roleId) => cachedView(`groupdetail:${groupId}:${roleId}`, () => RX.getGroupDetail(groupId, roleName, roleId, robloxGetJson).then(friendly)),
  avatarDetail: (input) => RX.getAvatarDetail(input, robloxGetJson).then(friendly),
  group: (input) => RX.getGroup(input, robloxGetJson).then(friendly),
  asset: (input) => RX.getAsset(input, robloxGetJson).then(friendly),
  game: (input) => RX.searchGame(input, robloxGetJson).then(friendly),
  gamepass: (input) => RX.getGamepass(input, robloxGetJson).then(friendly),
  bundle: (input) => RX.getBundle(input, robloxGetJson).then(friendly),
  username: (input) => RX.checkUsername(input, robloxGetJson).then(friendly),
  wearing: (input) => cachedView(vkey("wearing", input), () => RX.getCurrentlyWearing(input, robloxGetJson).then(friendly)),
  followers: (input) => cachedView(vkey("followers", input), () => RX.getFollowers(input, robloxGetJson).then(friendly)),
  rolimons: (input) => RX.getRolimonsFull(input, robloxGetJson).then(friendly),
  userGames: (input) => cachedView(vkey("games", input), () => RX.getUserGames(input, robloxGetJson).then(friendly)),
  prevNames: (input) => cachedView(vkey("prevnames", input), () => RX.getPreviousUsernames(input, robloxGetJson).then(friendly)),
  universe: (input) => RX.getUniverse(input, robloxGetJson).then(friendly),
  cryptoPrice: (coingeckoId) => getCryptoPrice(coingeckoId, robloxGetJson).then((r) => (r.ok ? r : { ok: false as const, error: "Couldn't reach the price feed just now." })),
  devex: (robux) => {
    const r = RX.devex(robux);
    return r.ok ? r : { ok: false as const, error: "Enter a valid Robux amount." };
  },
  qr: async (text) => {
    try {
      const png = await QRCode.toBuffer(text, { type: "png", margin: 2, width: 512, errorCorrectionLevel: "M" });
      return { ok: true as const, png };
    } catch {
      return { ok: false as const, error: "Couldn't build a QR code from that." };
    }
  },
  allow: (discordUserId) => rateLimit(`discord:${discordUserId}`, 10, 60_000).allowed,
  allowComponent: (discordUserId) => rateLimit(`discord-nav:${discordUserId}`, 40, 60_000).allowed,
  editOriginal: async (applicationId, token, body, files) => {
    // the interaction token is the credential here, no bot token needed
    if (!/^\d{5,25}$/.test(applicationId) || !/^[\w-]{20,}$/.test(token)) return;
    const url = `https://discord.com/api/v10/webhooks/${applicationId}/${token}/messages/@original`;
    let res: Response;
    if (files?.length) {
      const form = new FormData();
      form.append("payload_json", JSON.stringify(body));
      files.forEach((f: BotFile, i: number) => form.append(`files[${i}]`, new Blob([new Uint8Array(f.data)], { type: f.contentType }), f.name));
      res = await fetch(url, { method: "PATCH", body: form, signal: AbortSignal.timeout(20000) });
    } else {
      res = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
    }
    if (!res.ok) console.error("[discord] editing the reply failed:", res.status, await res.text().catch(() => ""));
  },
};

export async function POST(req: NextRequest) {
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey) return NextResponse.json({ error: "DISCORD_PUBLIC_KEY is not set" }, { status: 500 });

  const raw = await req.text();
  const signature = req.headers.get("x-signature-ed25519") ?? "";
  const timestamp = req.headers.get("x-signature-timestamp") ?? "";
  // Discord tests this on purpose: anything not signed by Discord has to be turned away with a 401
  if (!signature || !timestamp || !verifyDiscordSignature(raw, signature, timestamp, publicKey)) {
    return new NextResponse("invalid request signature", { status: 401 });
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const handled = handleInteraction(body, { ...deps, siteUrl: siteUrl() });
  if (handled.after) after(handled.after);
  return NextResponse.json(handled.response);
}
