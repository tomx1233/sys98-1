/**
 * Looks up public info about a Roblox audio asset (name, creator, artist, favorites, duration …)
 * from Roblox's public web APIs. No login, no cookies, and it never touches the audio file itself.
 *
 * Only fixed Roblox hostnames are called and the id must be digits, so there is nothing user-controlled in the URL.
 * The functions take a `getJson` so tests can run without the network.
 */

export interface RobloxAudio {
  id: string;
  name: string;
  description: string;
  creator: { id: number | null; name: string; type: "User" | "Group" | string; verified: boolean };
  artist?: string;
  title?: string;
  album?: string;
  genre?: string;
  durationSeconds?: number;
  favorites?: number;
  created?: string;
  updated?: string;
  thumbnail?: string;
  priceRobux?: number | null;
  /** Roblox took it down (its name/description says so) */
  removed?: boolean;
  /** public availability, from what the API exposes without a login */
  availability: "available" | "unavailable" | "moderated" | "unknown";
  url: string;
}

export type LookupError = "notfound" | "notaudio" | "busy" | "unavailable" | "invalid";

export type GetJson = (url: string, init?: { method?: "GET" | "POST"; body?: unknown }) => Promise<{ status: number; json: unknown }>;

const ASSET_TYPES: Record<number, string> = {
  1: "image", 2: "T-shirt", 3: "audio", 4: "mesh", 5: "Lua script", 8: "hat", 9: "place", 10: "model", 11: "shirt", 12: "pants",
  13: "decal", 17: "head", 18: "face", 19: "gear", 21: "badge", 24: "animation", 32: "package", 34: "game pass", 38: "plugin",
  40: "mesh part", 62: "video", 63: "text-to-speech", 64: "T-shirt accessory", 65: "shirt accessory",
};

/** "123", "rbxassetid://123", "https://create.roblox.com/store/asset/123/name", "https://www.roblox.com/library/123" … → "123" */
export function extractAssetId(input: string): string | null {
  const s = input.trim();
  if (/^\d{5,19}$/.test(s)) return s;
  const m = s.match(/(?:rbxassetid:\/\/|\/(?:asset|library|catalog|assets)\/|[?&]id=)(\d{5,19})/i) ?? s.match(/(\d{5,19})/);
  return m ? m[1] : null;
}

const asObj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const asStr = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const asNum = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

export async function lookupAudio(id: string, getJson: GetJson): Promise<{ ok: true; audio: RobloxAudio } | { ok: false; error: LookupError; detail?: string }> {
  if (!/^\d{5,19}$/.test(id)) return { ok: false, error: "invalid" };

  const settle = <T,>(p: Promise<T>) => p.then((v) => ({ ok: true as const, v }), () => ({ ok: false as const }));

  const [details, toolbox, favorites, thumb] = await Promise.all([
    settle(getJson(`https://economy.roblox.com/v2/assets/${id}/details`)),
    settle(getJson(`https://apis.roblox.com/toolbox-service/v1/items/details?assetIds=${id}`)),
    settle(getJson(`https://catalog.roblox.com/v1/favorites/assets/${id}/count`)),
    settle(getJson(`https://thumbnails.roblox.com/v1/assets?assetIds=${id}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`)),
  ]);

  // the main record decides whether there is anything to show
  if (!details.ok) return { ok: false, error: "unavailable" };
  const { status, json } = details.v;
  if (status === 429) return { ok: false, error: "busy" };
  if (status === 400 || status === 404) return { ok: false, error: "notfound" };
  if (status !== 200) return { ok: false, error: "unavailable" };

  const d = asObj(json);
  const typeId = asNum(d.AssetTypeId);
  if (typeId !== 3) {
    return { ok: false, error: "notaudio", detail: typeId !== undefined ? ASSET_TYPES[typeId] ?? `type ${typeId}` : undefined };
  }

  const creator = asObj(d.Creator);
  const audio: RobloxAudio = {
    id,
    name: asStr(d.Name) ?? `Audio ${id}`,
    description: asStr(d.Description) ?? "",
    creator: {
      id: asNum(creator.CreatorTargetId) ?? asNum(creator.Id) ?? null,
      name: asStr(creator.Name) ?? "unknown",
      type: asStr(creator.CreatorType) ?? "User",
      verified: creator.HasVerifiedBadge === true,
    },
    removed: /removed for violations|content deleted/i.test(`${asStr(d.Name) ?? ""} ${asStr(d.Description) ?? ""}`) || undefined,
    availability: "unknown",
    created: asStr(d.Created),
    updated: asStr(d.Updated),
    priceRobux: d.PriceInRobux === null ? null : asNum(d.PriceInRobux),
    url: `https://create.roblox.com/store/asset/${id}`,
  };

  // toolbox knows the audio-specific bits (artist, album, genre, length)
  if (toolbox.ok && toolbox.v.status === 200) {
    const first = asObj(Array.isArray(asObj(toolbox.v.json).data) ? (asObj(toolbox.v.json).data as unknown[])[0] : undefined);
    const asset = asObj(first.asset);
    const a = asObj(asset.audioDetails);
    audio.artist = asStr(a.artist);
    audio.title = asStr(a.title);
    audio.album = asStr(a.album);
    audio.genre = asStr(a.genre);
    audio.durationSeconds = asNum(a.durationSeconds) ?? asNum(a.duration);
    audio.created ??= asStr(asset.createdUtc);
    audio.updated ??= asStr(asset.updatedUtc);
  }

  // availability: the details call already succeeded, so the asset exists. Refine it with the toolbox
  // moderation status when present, and with the "removed for violations" text Roblox puts in the name.
  if (toolbox.ok && toolbox.v.status === 200) {
    const first = asObj(Array.isArray(asObj(toolbox.v.json).data) ? (asObj(toolbox.v.json).data as unknown[])[0] : undefined);
    const asset = asObj(first.asset);
    const mod = (asStr(asset.moderationStatus) ?? asStr(asObj(asset.moderationResult).moderationState) ?? "").toLowerCase();
    if (mod.includes("review") || mod.includes("pending")) audio.availability = "moderated";
    else if (mod.includes("reject") || mod.includes("declin")) audio.availability = "unavailable";
    else if (mod.includes("approve") || mod === "reviewed") audio.availability = "available";
  }
  if (audio.availability === "unknown") audio.availability = "available";
  if (audio.removed) audio.availability = "unavailable";

  if (favorites.ok && favorites.v.status === 200) audio.favorites = asNum(favorites.v.json);

  if (thumb.ok && thumb.v.status === 200) {
    const item = asObj((Array.isArray(asObj(thumb.v.json).data) ? (asObj(thumb.v.json).data as unknown[]) : [])[0]);
    const url = asStr(item.imageUrl);
    // only ever hand out Roblox's own CDN
    if (url && item.state === "Completed") {
      try {
        const u = new URL(url);
        if (u.protocol === "https:" && u.hostname.endsWith(".rbxcdn.com")) audio.thumbnail = u.toString();
      } catch {
        /* ignore */
      }
    }
  }

  return { ok: true, audio };
}
