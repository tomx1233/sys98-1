/**
 * Extra Roblox lookups for the Discord bot: user id resolution, avatar/bust thumbnails, friends,
 * are-friends, groups a user is in, group info, asset info, game search, gamepass, bundle, and the
 * DevEx (Robux → USD) calculation. All public data, no login.
 *
 * Everything goes through the injected GetJson (from robloxHttp), so it can be tested without the network.
 * Only fixed Roblox hostnames are called and every id is validated as digits, so nothing user-controlled
 * ends up in a URL.
 */
import type { GetJson } from "./robloxAudio";
import { parseUserInput } from "./robloxUser";

const asObj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asStr = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const asNum = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

export type Fail = { ok: false; error: "invalid" | "notfound" | "busy" | "unavailable" };

const settle = <T,>(p: Promise<T>) => p.then((v) => ({ ok: true as const, v }), () => ({ ok: false as const }));

/** Turn a username / id / profile link into a numeric id (and the canonical name), using the public API. */
export async function resolveUserId(input: string, getJson: GetJson): Promise<{ ok: true; id: string; name: string } | Fail> {
  const target = parseUserInput(input);
  if (!target) return { ok: false, error: "invalid" };
  if (target.kind === "id") {
    const r = await settle(getJson(`https://users.roblox.com/v1/users/${target.id}`));
    if (!r.ok) return { ok: false, error: "unavailable" };
    if (r.v.status === 429) return { ok: false, error: "busy" };
    if (r.v.status === 400 || r.v.status === 404) return { ok: false, error: "notfound" };
    if (r.v.status !== 200) return { ok: false, error: "unavailable" };
    const name = asStr(asObj(r.v.json).name);
    return name ? { ok: true, id: target.id, name } : { ok: false, error: "notfound" };
  }
  let r;
  try {
    r = await getJson("https://users.roblox.com/v1/usernames/users", { method: "POST", body: { usernames: [target.name], excludeBannedUsers: false } });
  } catch {
    return { ok: false, error: "unavailable" };
  }
  if (r.status === 429) return { ok: false, error: "busy" };
  if (r.status !== 200) return { ok: false, error: "unavailable" };
  const first = asObj(asArr(asObj(r.json).data)[0]);
  const id = asNum(first.id);
  return id !== undefined ? { ok: true, id: String(id), name: asStr(first.name) ?? target.name } : { ok: false, error: "notfound" };
}

function rbxCdn(json: unknown): string | undefined {
  const item = asObj(asArr(asObj(json).data)[0]);
  const url = asStr(item.imageUrl);
  if (!url || item.state !== "Completed") return undefined;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".rbxcdn.com") ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

// ---------- avatar / bust / headshot ----------

export type AvatarKind = "full" | "bust" | "headshot";
const AVATAR_ENDPOINT: Record<AvatarKind, (id: string) => string> = {
  full: (id) => `https://thumbnails.roblox.com/v1/users/avatar?userIds=${id}&size=420x420&format=Png&isCircular=false`,
  bust: (id) => `https://thumbnails.roblox.com/v1/users/avatar-bust?userIds=${id}&size=420x420&format=Png&isCircular=false`,
  headshot: (id) => `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=420x420&format=Png&isCircular=false`,
};

export async function getAvatar(input: string, kind: AvatarKind, getJson: GetJson): Promise<{ ok: true; name: string; id: string; image: string; url: string } | Fail> {
  const u = await resolveUserId(input, getJson);
  if (!u.ok) return u;
  const r = await settle(getJson(AVATAR_ENDPOINT[kind](u.id)));
  const image = r.ok && r.v.status === 200 ? rbxCdn(r.v.json) : undefined;
  if (!image) return { ok: false, error: "unavailable" };
  return { ok: true, name: u.name, id: u.id, image, url: `https://www.roblox.com/users/${u.id}/profile` };
}

// ---------- account age ----------

export async function getAccountAge(input: string, getJson: GetJson): Promise<{ ok: true; name: string; id: string; created: string; days: number; url: string } | Fail> {
  const target = parseUserInput(input);
  if (!target) return { ok: false, error: "invalid" };
  const u = await resolveUserId(input, getJson);
  if (!u.ok) return u;
  const r = await settle(getJson(`https://users.roblox.com/v1/users/${u.id}`));
  if (!r.ok || r.v.status !== 200) return { ok: false, error: "unavailable" };
  const created = asStr(asObj(r.v.json).created);
  if (!created) return { ok: false, error: "unavailable" };
  const days = Math.max(0, Math.floor((Date.now() - new Date(created).getTime()) / 86_400_000));
  return { ok: true, name: u.name, id: u.id, created, days, url: `https://www.roblox.com/users/${u.id}/profile` };
}

// ---------- friends ----------

export async function getFriends(input: string, getJson: GetJson): Promise<{ ok: true; name: string; id: string; count: number; sample: { id: string; name: string }[]; all: { id: string; name: string; displayName: string; banned?: boolean }[]; url: string } | Fail> {
  const u = await resolveUserId(input, getJson);
  if (!u.ok) return u;
  const [count, list] = await Promise.all([
    settle(getJson(`https://friends.roblox.com/v1/users/${u.id}/friends/count`)),
    settle(getJson(`https://friends.roblox.com/v1/users/${u.id}/friends`)),
  ]);
  const c = count.ok && count.v.status === 200 ? asNum(asObj(count.v.json).count) : undefined;
  const all = list.ok && list.v.status === 200
    ? asArr(asObj(list.v.json).data)
      .map((f) => {
        const o = asObj(f); const name = asStr(o.name); const id = asNum(o.id);
        return name && id !== undefined ? { id: String(id), name, displayName: asStr(o.displayName) ?? name, banned: o.isBanned === true } : null;
      })
      .filter((f): f is { id: string; name: string; displayName: string; banned: boolean } => f !== null)
    : [];
  if (c === undefined && !all.length) return { ok: false, error: "unavailable" };
  return { ok: true, name: u.name, id: u.id, count: c ?? all.length, sample: all.slice(0, 15), all, url: `https://www.roblox.com/users/${u.id}/friends` };
}

export async function areFriends(a: string, b: string, getJson: GetJson): Promise<{ ok: true; a: string; b: string; friends: boolean } | Fail> {
  const [ua, ub] = await Promise.all([resolveUserId(a, getJson), resolveUserId(b, getJson)]);
  if (!ua.ok) return ua;
  if (!ub.ok) return ub;
  if (ua.id === ub.id) return { ok: false, error: "invalid" };
  const r = await settle(getJson(`https://friends.roblox.com/v1/users/${ua.id}/friends`));
  if (!r.ok || r.v.status !== 200) return { ok: false, error: "unavailable" };
  const friends = asArr(asObj(r.v.json).data).some((f) => String(asNum(asObj(f).id)) === ub.id);
  return { ok: true, a: ua.name, b: ub.name, friends };
}

// ---------- groups a user is in ----------

export interface UserGroupEntry { id: string; name: string; role: string; roleId: string; members: number | undefined }

export async function getUserGroups(input: string, getJson: GetJson): Promise<{ ok: true; name: string; id: string; groups: UserGroupEntry[]; url: string } | Fail> {
  const u = await resolveUserId(input, getJson);
  if (!u.ok) return u;
  const r = await settle(getJson(`https://groups.roblox.com/v2/users/${u.id}/groups/roles`));
  if (!r.ok || r.v.status !== 200) return { ok: false, error: "unavailable" };
  const groups = asArr(asObj(r.v.json).data)
    .map((g) => {
      const group = asObj(asObj(g).group), role = asObj(asObj(g).role);
      const name = asStr(group.name);
      const id = asNum(group.id);
      const roleId = asNum(role.id);
      return name && id !== undefined ? { id: String(id), name, role: asStr(role.name) ?? "Member", roleId: roleId !== undefined ? String(roleId) : "", members: asNum(group.memberCount) } : null;
    })
    .filter((g): g is UserGroupEntry => Boolean(g));
  return { ok: true, name: u.name, id: u.id, groups, url: `https://www.roblox.com/users/${u.id}/profile` };
}

/**
 * Full "one group, two columns" detail for a single membership, used by the /user "Groups" page view
 * (one group per page, like Group Information + Role Information side by side).
 * Extra fields Roblox doesn't reliably expose (like a group's creation date) are simply left out
 * rather than guessed at, matching the rest of this file's approach.
 */
export interface GroupDetail {
  id: string; name: string; description: string; icon?: string; verified: boolean;
  owner?: string; ownerId?: string; members: number; publicEntry?: boolean; created?: string;
  role: string; roleId: string; roleMembers?: number; rolePosition?: number; totalRoles?: number;
  url: string;
}

export async function getGroupDetail(groupId: string, roleName: string, roleId: string, getJson: GetJson): Promise<{ ok: true; detail: GroupDetail } | Fail> {
  if (!/^\d{1,19}$/.test(groupId)) return { ok: false, error: "invalid" };
  const [infoR, rolesR, iconR] = await Promise.all([
    settle(getJson(`https://groups.roblox.com/v1/groups/${groupId}`)),
    settle(getJson(`https://groups.roblox.com/v1/groups/${groupId}/roles`)),
    settle(getJson(`https://thumbnails.roblox.com/v1/groups/icons?groupIds=${groupId}&size=150x150&format=Png&isCircular=false`)),
  ]);
  if (!infoR.ok) return { ok: false, error: "unavailable" };
  if (infoR.v.status === 400 || infoR.v.status === 404) return { ok: false, error: "notfound" };
  if (infoR.v.status !== 200) return { ok: false, error: "unavailable" };
  const d = asObj(infoR.v.json);
  const name = asStr(d.name);
  if (!name) return { ok: false, error: "notfound" };

  let roleMembers: number | undefined, rolePosition: number | undefined, totalRoles: number | undefined;
  if (rolesR.ok && rolesR.v.status === 200) {
    const roles = asArr(asObj(rolesR.v.json).roles)
      .map((rr) => { const o = asObj(rr); return { id: asNum(o.id), rank: asNum(o.rank) ?? 0, members: asNum(o.memberCount) }; })
      .filter((rr): rr is { id: number; rank: number; members: number | undefined } => rr.id !== undefined)
      .sort((a, b) => a.rank - b.rank);
    totalRoles = roles.length || undefined;
    const idx = roles.findIndex((rr) => String(rr.id) === roleId);
    if (idx >= 0) { rolePosition = idx + 1; roleMembers = roles[idx].members; }
  }

  const owner = asObj(d.owner);
  const ownerId = asNum(owner.userId);
  return {
    ok: true,
    detail: {
      id: groupId,
      name,
      description: asStr(d.description) ?? "",
      icon: iconR.ok && iconR.v.status === 200 ? rbxCdn(iconR.v.json) : undefined,
      verified: d.hasVerifiedBadge === true,
      owner: asStr(owner.username),
      ownerId: ownerId !== undefined ? String(ownerId) : undefined,
      members: asNum(d.memberCount) ?? 0,
      publicEntry: typeof d.publicEntryAllowed === "boolean" ? d.publicEntryAllowed : undefined,
      created: asStr(d.created),
      role: roleName,
      roleId,
      roleMembers,
      rolePosition,
      totalRoles,
      url: `https://www.roblox.com/communities/${groupId}`,
    },
  };
}

// ---------- followers list ----------

export async function getFollowers(input: string, getJson: GetJson): Promise<{ ok: true; name: string; id: string; count: number; sample: { id: string; name: string }[]; all: { id: string; name: string; displayName: string }[]; url: string } | Fail> {
  const u = await resolveUserId(input, getJson);
  if (!u.ok) return u;
  const [count, list] = await Promise.all([
    settle(getJson(`https://friends.roblox.com/v1/users/${u.id}/followers/count`)),
    settle(getJson(`https://friends.roblox.com/v1/users/${u.id}/followers?limit=100&sortOrder=Desc`)),
  ]);
  const c = count.ok && count.v.status === 200 ? asNum(asObj(count.v.json).count) : undefined;
  const all = list.ok && list.v.status === 200
    ? asArr(asObj(list.v.json).data)
      .map((f) => {
        const o = asObj(f); const name = asStr(o.name); const id = asNum(o.id);
        return name && id !== undefined ? { id: String(id), name, displayName: asStr(o.displayName) ?? name } : null;
      })
      .filter((f): f is { id: string; name: string; displayName: string } => f !== null)
    : [];
  if (c === undefined && !all.length) return { ok: false, error: "unavailable" };
  return { ok: true, name: u.name, id: u.id, count: c ?? all.length, sample: all.slice(0, 15), all, url: `https://www.roblox.com/users/${u.id}/profile` };
}

// ---------- games / experiences a user created ----------

export interface UserGame {
  name: string;
  description?: string;
  universeId?: string;
  placeId?: string;
  created?: string;
  updated?: string;
  playable?: boolean;
  active?: number;
  favorites?: number;
  visits?: number;
  likes?: number;
  dislikes?: number;
  maxPlayers?: number;
  thumbnail?: string;
  url: string;
}

export async function getUserGames(input: string, getJson: GetJson): Promise<{ ok: true; name: string; id: string; games: UserGame[]; url: string } | Fail> {
  const u = await resolveUserId(input, getJson);
  if (!u.ok) return u;
  const r = await settle(getJson(`https://games.roblox.com/v2/users/${u.id}/games?accessFilter=Public&sortOrder=Desc&limit=50`));
  if (!r.ok || r.v.status !== 200) return { ok: false, error: "unavailable" };
  const rows = asArr(asObj(r.v.json).data);

  // universe ids let us pull full details + votes + thumbnails in three batched calls
  const universeIds = rows.map((g) => asNum(asObj(g).id)).filter((n): n is number => n !== undefined);
  const idParam = universeIds.slice(0, 50).join(",");
  const [details, votes, thumbs] = idParam
    ? await Promise.all([
        settle(getJson(`https://games.roblox.com/v1/games?universeIds=${idParam}`)),
        settle(getJson(`https://games.roblox.com/v1/games/votes?universeIds=${idParam}`)),
        settle(getJson(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${idParam}&size=256x256&format=Png&isCircular=false`)),
      ])
    : [{ ok: false as const }, { ok: false as const }, { ok: false as const }];

  const byId = <T,>(res: { ok: true; v: { status: number; json: unknown } } | { ok: false }, pick: (o: Record<string, unknown>) => T): Map<number, T> => {
    const m = new Map<number, T>();
    if (res.ok && res.v.status === 200) {
      for (const item of asArr(asObj(res.v.json).data)) {
        const o = asObj(item);
        const uid = asNum(o.id) ?? asNum(o.universeId) ?? asNum(o.targetId);
        if (uid !== undefined) m.set(uid, pick(o));
      }
    }
    return m;
  };
  const detailMap = byId(details, (o) => o);
  const voteMap = byId(votes, (o) => ({ up: asNum(o.upVotes), down: asNum(o.downVotes) }));
  const thumbMap = byId(thumbs, (o) => (o.state === "Completed" ? asStr(o.imageUrl) : undefined));

  const games: UserGame[] = rows
    .map((g): UserGame | null => {
      const gg = asObj(g);
      const uid = asNum(gg.id);
      const name = asStr(gg.name);
      if (!name) return null;
      const d = uid !== undefined ? asObj(detailMap.get(uid)) : {};
      const rootPlaceId = asNum(asObj(gg.rootPlace).id) ?? asNum(d.rootPlaceId);
      const v = uid !== undefined ? voteMap.get(uid) : undefined;
      let thumb = uid !== undefined ? thumbMap.get(uid) : undefined;
      if (thumb) {
        try {
          const uu = new URL(thumb);
          if (!(uu.protocol === "https:" && uu.hostname.endsWith(".rbxcdn.com"))) thumb = undefined;
        } catch {
          thumb = undefined;
        }
      }
      return {
        name,
        description: asStr(d.description) ?? asStr(gg.description),
        universeId: uid !== undefined ? String(uid) : undefined,
        placeId: rootPlaceId !== undefined ? String(rootPlaceId) : undefined,
        created: asStr(d.created) ?? asStr(gg.created),
        updated: asStr(d.updated) ?? asStr(gg.updated),
        playable: typeof d.isPlayable === "boolean" ? (d.isPlayable as boolean) : undefined,
        active: asNum(d.playing) ?? asNum(gg.playerCount),
        favorites: asNum(d.favoritedCount),
        visits: asNum(d.visits) ?? asNum(gg.placeVisits),
        likes: v?.up,
        dislikes: v?.down,
        maxPlayers: asNum(d.maxPlayers),
        thumbnail: thumb,
        url: rootPlaceId !== undefined ? `https://www.roblox.com/games/${rootPlaceId}` : `https://www.roblox.com/users/${u.id}/profile`,
      };
    })
    .filter((g): g is UserGame => g !== null);
  return { ok: true, name: u.name, id: u.id, games, url: `https://www.roblox.com/users/${u.id}/profile` };
}

// ---------- previous usernames ----------

export async function getPreviousUsernames(input: string, getJson: GetJson): Promise<{ ok: true; name: string; id: string; names: string[]; url: string } | Fail> {
  const u = await resolveUserId(input, getJson);
  if (!u.ok) return u;
  const r = await settle(getJson(`https://users.roblox.com/v1/users/${u.id}/username-history?limit=50&sortOrder=Desc`));
  if (!r.ok || r.v.status !== 200) return { ok: false, error: "unavailable" };
  const names = asArr(asObj(r.v.json).data).map((n) => asStr(asObj(n).name)).filter((n): n is string => Boolean(n));
  return { ok: true, name: u.name, id: u.id, names, url: `https://www.roblox.com/users/${u.id}/profile` };
}

// ---------- group info + icon ----------

export interface GroupInfo { id: string; name: string; description: string; owner?: string; members: number; verified: boolean; icon?: string; url: string }

export async function getGroup(idOrName: string, getJson: GetJson): Promise<{ ok: true; group: GroupInfo } | Fail> {
  const raw = idOrName.trim().replace(/^.*\/(?:groups|communities)\/(\d+).*$/i, "$1");
  let id: string | null = /^\d{1,19}$/.test(raw) ? raw : null;
  if (!id) {
    // search by name and take the closest match
    const s = await settle(getJson(`https://groups.roblox.com/v1/groups/search?keyword=${encodeURIComponent(idOrName.trim().slice(0, 50))}&prioritizeExactMatch=true&limit=10`));
    if (!s.ok || s.v.status !== 200) return { ok: false, error: "unavailable" };
    const first = asObj(asArr(asObj(s.v.json).data)[0]);
    const found = asNum(first.id);
    if (found === undefined) return { ok: false, error: "notfound" };
    id = String(found);
  }
  const [info, icon] = await Promise.all([
    settle(getJson(`https://groups.roblox.com/v1/groups/${id}`)),
    settle(getJson(`https://thumbnails.roblox.com/v1/groups/icons?groupIds=${id}&size=150x150&format=Png&isCircular=false`)),
  ]);
  if (!info.ok) return { ok: false, error: "unavailable" };
  if (info.v.status === 400 || info.v.status === 404) return { ok: false, error: "notfound" };
  if (info.v.status !== 200) return { ok: false, error: "unavailable" };
  const d = asObj(info.v.json);
  const name = asStr(d.name);
  if (!name) return { ok: false, error: "notfound" };
  return {
    ok: true,
    group: {
      id: id!,
      name,
      description: asStr(d.description) ?? "",
      owner: asStr(asObj(d.owner).username),
      members: asNum(d.memberCount) ?? 0,
      verified: d.hasVerifiedBadge === true,
      icon: icon.ok && icon.v.status === 200 ? rbxCdn(icon.v.json) : undefined,
      url: `https://www.roblox.com/communities/${id}`,
    },
  };
}

// ---------- asset info + icon ----------

export const ASSET_TYPES: Record<number, string> = {
  1: "Image", 2: "T-Shirt", 3: "Audio", 4: "Mesh", 5: "Lua", 8: "Hat", 9: "Place", 10: "Model", 11: "Shirt", 12: "Pants",
  13: "Decal", 17: "Head", 18: "Face", 19: "Gear", 21: "Badge", 24: "Animation", 32: "Package", 34: "GamePass", 38: "Plugin",
  40: "MeshPart", 41: "HairAccessory", 42: "FaceAccessory", 43: "NeckAccessory", 44: "ShoulderAccessory", 45: "FrontAccessory",
  46: "BackAccessory", 47: "WaistAccessory", 62: "Video", 64: "TShirtAccessory", 65: "ShirtAccessory", 66: "PantsAccessory",
};

export interface AssetInfo { id: string; name: string; description: string; type: string; creator: string; created?: string; updated?: string; priceRobux?: number | null; forSale: boolean; icon?: string; url: string }

const assetIdOf = (raw: string) => raw.trim().match(/(\d{2,19})/)?.[1] ?? null;

export async function getAsset(input: string, getJson: GetJson): Promise<{ ok: true; asset: AssetInfo } | Fail> {
  const id = assetIdOf(input);
  if (!id) return { ok: false, error: "invalid" };
  const [details, icon] = await Promise.all([
    settle(getJson(`https://economy.roblox.com/v2/assets/${id}/details`)),
    settle(getJson(`https://thumbnails.roblox.com/v1/assets?assetIds=${id}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`)),
  ]);
  if (!details.ok) return { ok: false, error: "unavailable" };
  if (details.v.status === 429) return { ok: false, error: "busy" };
  if (details.v.status === 400 || details.v.status === 404) return { ok: false, error: "notfound" };
  if (details.v.status !== 200) return { ok: false, error: "unavailable" };
  const d = asObj(details.v.json);
  const name = asStr(d.Name);
  if (!name) return { ok: false, error: "notfound" };
  const typeId = asNum(d.AssetTypeId);
  return {
    ok: true,
    asset: {
      id,
      name,
      description: asStr(d.Description) ?? "",
      type: typeId !== undefined ? ASSET_TYPES[typeId] ?? `Type ${typeId}` : "Unknown",
      creator: asStr(asObj(d.Creator).Name) ?? "unknown",
      created: asStr(d.Created),
      updated: asStr(d.Updated),
      priceRobux: d.PriceInRobux === null ? null : asNum(d.PriceInRobux),
      forSale: d.IsForSale === true,
      icon: icon.ok && icon.v.status === 200 ? rbxCdn(icon.v.json) : undefined,
      url: `https://www.roblox.com/catalog/${id}`,
    },
  };
}

// ---------- game search ----------

export interface GameInfo { name: string; creator: string; playing?: number; visits?: number; url: string }

export async function searchGame(keyword: string, getJson: GetJson): Promise<{ ok: true; game: GameInfo } | Fail> {
  const kw = keyword.trim().slice(0, 60);
  if (!kw) return { ok: false, error: "invalid" };
  const s = await settle(getJson(`https://games.roblox.com/v1/games/list?model.keyword=${encodeURIComponent(kw)}&model.maxRows=1`));
  if (!s.ok || s.v.status !== 200) return { ok: false, error: "unavailable" };
  const first = asObj(asArr(asObj(s.v.json).games)[0]);
  const name = asStr(first.name);
  const rootPlaceId = asNum(first.rootPlaceId);
  const universeId = asNum(first.universeId);
  if (!name) return { ok: false, error: "notfound" };
  let playing = asNum(first.playerCount), visits: number | undefined;
  if (universeId !== undefined) {
    const det = await settle(getJson(`https://games.roblox.com/v1/games?universeIds=${universeId}`));
    if (det.ok && det.v.status === 200) {
      const g = asObj(asArr(asObj(det.v.json).data)[0]);
      playing = asNum(g.playing) ?? playing;
      visits = asNum(g.visits);
    }
  }
  return { ok: true, game: { name, creator: asStr(first.creatorName) ?? "unknown", playing, visits, url: rootPlaceId !== undefined ? `https://www.roblox.com/games/${rootPlaceId}` : "https://www.roblox.com/games" } };
}

// ---------- gamepass ----------

export async function getGamepass(input: string, getJson: GetJson): Promise<{ ok: true; id: string; name: string; priceRobux: number | null; icon?: string; url: string } | Fail> {
  const id = assetIdOf(input);
  if (!id) return { ok: false, error: "invalid" };
  const [info, icon] = await Promise.all([
    settle(getJson(`https://apis.roblox.com/game-passes/v1/game-passes/${id}/product-info`)),
    settle(getJson(`https://thumbnails.roblox.com/v1/game-passes?gamePassIds=${id}&size=150x150&format=Png&isCircular=false`)),
  ]);
  if (!info.ok) return { ok: false, error: "unavailable" };
  if (info.v.status === 400 || info.v.status === 404) return { ok: false, error: "notfound" };
  if (info.v.status !== 200) return { ok: false, error: "unavailable" };
  const d = asObj(info.v.json);
  const name = asStr(d.Name);
  if (!name) return { ok: false, error: "notfound" };
  return { ok: true, id, name, priceRobux: d.PriceInRobux === null || d.PriceInRobux === undefined ? null : asNum(d.PriceInRobux) ?? null, icon: icon.ok && icon.v.status === 200 ? rbxCdn(icon.v.json) : undefined, url: `https://www.roblox.com/game-pass/${id}` };
}

// ---------- bundle ----------

export async function getBundle(input: string, getJson: GetJson): Promise<{ ok: true; id: string; name: string; description: string; type: string; items: number; icon?: string; url: string } | Fail> {
  const id = assetIdOf(input);
  if (!id) return { ok: false, error: "invalid" };
  const [info, icon] = await Promise.all([
    settle(getJson(`https://catalog.roblox.com/v1/bundles/${id}/details`)),
    settle(getJson(`https://thumbnails.roblox.com/v1/bundles/thumbnails?bundleIds=${id}&size=150x150&format=Png&isCircular=false`)),
  ]);
  if (!info.ok) return { ok: false, error: "unavailable" };
  if (info.v.status === 400 || info.v.status === 404) return { ok: false, error: "notfound" };
  if (info.v.status !== 200) return { ok: false, error: "unavailable" };
  const d = asObj(info.v.json);
  const name = asStr(d.name);
  if (!name) return { ok: false, error: "notfound" };
  return { ok: true, id, name, description: asStr(d.description) ?? "", type: asStr(d.bundleType) ?? "Bundle", items: asArr(d.items).length, icon: icon.ok && icon.v.status === 200 ? rbxCdn(icon.v.json) : undefined, url: `https://www.roblox.com/bundles/${id}` };
}

// ---------- DevEx (Robux -> USD) ----------

// Roblox's published DevEx rate: $0.0035 per Robux (i.e. 100,000 Robux = $350). Minimum cash-out is 30,000 Robux.
export const DEVEX_USD_PER_ROBUX = 0.0035;
export const DEVEX_MINIMUM_ROBUX = 30_000;

export function devex(robux: number): { ok: true; robux: number; usd: number; meetsMinimum: boolean } | { ok: false; error: "invalid" } {
  if (!Number.isFinite(robux) || robux <= 0 || robux > 1_000_000_000) return { ok: false, error: "invalid" };
  const r = Math.floor(robux);
  return { ok: true, robux: r, usd: Math.round(r * DEVEX_USD_PER_ROBUX * 100) / 100, meetsMinimum: r >= DEVEX_MINIMUM_ROBUX };
}

// ---------- username availability ----------

export interface UsernameCheck { username: string; validFormat: boolean; taken: boolean }

/** Roblox has no direct "is this free" endpoint anymore, so this infers it: valid shape + nobody owns it = free. */
export async function checkUsername(input: string, getJson: GetJson): Promise<{ ok: true; result: UsernameCheck } | Fail> {
  const username = input.trim().replace(/^@/, "");
  const validFormat = /^[A-Za-z0-9_]{3,20}$/.test(username) && !username.startsWith("_") && !username.endsWith("_") && !username.includes("__");
  if (!validFormat) return { ok: true, result: { username, validFormat: false, taken: false } };
  let r;
  try {
    r = await getJson("https://users.roblox.com/v1/usernames/users", { method: "POST", body: { usernames: [username], excludeBannedUsers: false } });
  } catch {
    return { ok: false, error: "unavailable" };
  }
  if (r.status === 429) return { ok: false, error: "busy" };
  if (r.status !== 200) return { ok: false, error: "unavailable" };
  const taken = asArr(asObj(r.json).data).length > 0;
  return { ok: true, result: { username, validFormat: true, taken } };
}

// ---------- currently wearing ----------

export interface WearingItem { id: string; name: string }

export async function getCurrentlyWearing(input: string, getJson: GetJson): Promise<{ ok: true; name: string; id: string; items: WearingItem[]; url: string } | Fail> {
  const u = await resolveUserId(input, getJson);
  if (!u.ok) return u;
  const r = await settle(getJson(`https://avatar.roblox.com/v1/users/${u.id}/currently-wearing`));
  if (!r.ok || r.v.status !== 200) return { ok: false, error: "unavailable" };
  const ids = asArr(asObj(r.v.json).assetIds).map(asNum).filter((n): n is number => n !== undefined).slice(0, 40);
  if (!ids.length) return { ok: true, name: u.name, id: u.id, items: [], url: `https://www.roblox.com/users/${u.id}/profile` };
  const details = await settle(getJson("https://catalog.roblox.com/v1/catalog/items/details", { method: "POST", body: { items: ids.map((id) => ({ itemType: "Asset", id })) } }));
  const items: WearingItem[] = details.ok && details.v.status === 200
    ? asArr(asObj(details.v.json).data)
        .map((d) => {
          const o = asObj(d);
          const itemName = asStr(o.name);
          const itemId = asNum(o.id);
          return itemName && itemId !== undefined ? { id: String(itemId), name: itemName } : null;
        })
        .filter((x): x is WearingItem => Boolean(x))
    : ids.map((id) => ({ id: String(id), name: `Asset ${id}` }));
  return { ok: true, name: u.name, id: u.id, items, url: `https://www.roblox.com/users/${u.id}/profile` };
}

/**
 * Full avatar breakdown for the /user "Currently Wearing" page view: body scale/type, the custom body
 * parts, worn items, body colors, and the equipped animations/emotes. All from Roblox's public avatar-set
 * endpoint. Field names Roblox doesn't document precisely (e.g. exactly which "…Animation" asset types
 * exist) are handled defensively, so an unexpected shape just yields an empty section, not an error.
 */
export interface AvatarColor { part: string; hex: string | undefined; brickColorId: number | undefined }
export interface AvatarDetail {
  name: string; id: string; url: string;
  playerType: string;
  scales: Record<string, number>;
  bodyParts: { id: string; name: string }[];
  items: { id: string; name: string }[];
  colors: AvatarColor[];
  animations: string[];
  emoteCount: number;
  topEmote?: string;
}

const BODY_PART_TYPES = new Set(["Head", "Torso", "Left Arm", "Right Arm", "Left Leg", "Right Leg", "Package", "DynamicHead"]);
const COLOR_PARTS: { key: string; label: string; idKey: string }[] = [
  { key: "headColor3", label: "Head", idKey: "headColorId" },
  { key: "torsoColor3", label: "Torso", idKey: "torsoColorId" },
  { key: "leftArmColor3", label: "Left Arm", idKey: "leftArmColorId" },
  { key: "rightArmColor3", label: "Right Arm", idKey: "rightArmColorId" },
  { key: "leftLegColor3", label: "Left Leg", idKey: "leftLegColorId" },
  { key: "rightLegColor3", label: "Right Leg", idKey: "rightLegColorId" },
];

export async function getAvatarDetail(input: string, getJson: GetJson): Promise<{ ok: true; detail: AvatarDetail } | Fail> {
  const u = await resolveUserId(input, getJson);
  if (!u.ok) return u;
  const r = await settle(getJson(`https://avatar.roblox.com/v1/users/${u.id}/avatar`));
  if (!r.ok || r.v.status !== 200) return { ok: false, error: "unavailable" };
  const d = asObj(r.v.json);

  const scalesRaw = asObj(d.scales);
  const scales: Record<string, number> = {};
  for (const k of ["height", "width", "head", "depth", "proportion", "bodyType"]) {
    const v = asNum(scalesRaw[k]);
    if (v !== undefined) scales[k] = v;
  }

  const assets = asArr(d.assets).map((a) => {
    const o = asObj(a);
    const name = asStr(o.name);
    const id = asNum(o.id);
    const typeName = asStr(asObj(o.assetType).name);
    return name && id !== undefined ? { id: String(id), name, type: typeName ?? "" } : null;
  }).filter((a): a is { id: string; name: string; type: string } => Boolean(a));

  const bodyParts = assets.filter((a) => BODY_PART_TYPES.has(a.type)).map((a) => ({ id: a.id, name: a.name }));
  const animations = assets.filter((a) => a.type.endsWith("Animation")).map((a) => a.name.replace(/\s*Animation$/i, ""));
  const items = assets.filter((a) => !BODY_PART_TYPES.has(a.type) && !a.type.endsWith("Animation")).map((a) => ({ id: a.id, name: a.name }));

  const bodyColor3s = asObj(d.bodyColor3s);
  const colors: AvatarColor[] = COLOR_PARTS.map(({ key, label, idKey }) => {
    const hex = asStr(bodyColor3s[key]);
    const brickColorId = asNum(d[idKey]);
    return hex || brickColorId !== undefined ? { part: label, hex, brickColorId } : null;
  }).filter((c): c is AvatarColor => Boolean(c));

  const emotes = asArr(d.emotes).map((e) => asStr(asObj(e).assetName)).filter((n): n is string => Boolean(n));

  return {
    ok: true,
    detail: {
      name: u.name,
      id: u.id,
      url: `https://www.roblox.com/users/${u.id}/profile`,
      playerType: asStr(d.playerAvatarType) ?? "R15",
      scales,
      bodyParts,
      items,
      colors,
      animations,
      emoteCount: emotes.length,
      topEmote: emotes[0],
    },
  };
}

// ---------- universe (game) by id ----------

export async function getUniverse(input: string, getJson: GetJson): Promise<{ ok: true; game: GameInfo } | Fail> {
  const id = input.trim().match(/(\d{2,19})/)?.[0];
  if (!id) return { ok: false, error: "invalid" };
  const det = await settle(getJson(`https://games.roblox.com/v1/games?universeIds=${id}`));
  if (!det.ok || det.v.status !== 200) return { ok: false, error: "unavailable" };
  const g = asObj(asArr(asObj(det.v.json).data)[0]);
  const name = asStr(g.name);
  if (!name) return { ok: false, error: "notfound" };
  const rootPlaceId = asNum(g.rootPlaceId);
  return {
    ok: true,
    game: {
      name,
      creator: asStr(asObj(g.creator).name) ?? "unknown",
      playing: asNum(g.playing),
      visits: asNum(g.visits),
      url: rootPlaceId !== undefined ? `https://www.roblox.com/games/${rootPlaceId}` : "https://www.roblox.com/games",
    },
  };
}

// ---------- Rolimons (unofficial; RAP / value) ----------

// Rolimons has no official API. This reads its public player JSON. It can change or block without notice,
// so callers must treat a failure as "just not available" and never break the whole command over it.
export async function getRolimons(userId: string, getJson: GetJson): Promise<{ rap?: number; value?: number }> {
  if (!/^\d{1,19}$/.test(userId)) return {};
  try {
    const r = await getJson(`https://api.rolimons.com/players/v1/playerinfo/${userId}`);
    if (r.status !== 200) return {};
    const d = asObj(r.json);
    // Rolimons uses -1 to mean "no data"
    const rap = asNum(d.rap), value = asNum(d.value);
    return { rap: rap !== undefined && rap >= 0 ? rap : undefined, value: value !== undefined && value >= 0 ? value : undefined };
  } catch {
    return {};
  }
}

/**
 * The full Rolimons player record, for the dedicated "Rolimons" view.
 * Rolimons has no official docs for this endpoint, so field names below are best-effort based on what
 * other unofficial wrappers report; each is read defensively and just omitted if the shape ever changes.
 */
export async function getRolimonsFull(userId: string, getJson: GetJson): Promise<{ ok: true; rap?: number; value?: number; limiteds?: number; premium?: boolean; lastScan?: number } | Fail> {
  if (!/^\d{1,19}$/.test(userId)) return { ok: false, error: "invalid" };
  const r = await settle(getJson(`https://api.rolimons.com/players/v1/playerinfo/${userId}`));
  if (!r.ok) return { ok: false, error: "unavailable" };
  if (r.v.status === 429) return { ok: false, error: "busy" };
  if (r.v.status !== 200) return { ok: false, error: "unavailable" };
  const d = asObj(r.v.json);
  const pick = (...keys: string[]) => { for (const k of keys) { const v = asNum(d[k]); if (v !== undefined) return v; } return undefined; };
  const rap = pick("rap"), value = pick("value");
  const limiteds = pick("limited_count", "limitedcount", "num_limiteds", "numLimiteds");
  const lastScan = pick("last_scan", "last_scan_time", "stats_updated", "statsUpdated");
  const premiumRaw = d.premium;
  return {
    ok: true,
    rap: rap !== undefined && rap >= 0 ? rap : undefined,
    value: value !== undefined && value >= 0 ? value : undefined,
    limiteds: limiteds !== undefined && limiteds >= 0 ? limiteds : undefined,
    premium: typeof premiumRaw === "boolean" ? premiumRaw : undefined,
    lastScan: lastScan !== undefined && lastScan > 0 ? lastScan : undefined,
  };
}
