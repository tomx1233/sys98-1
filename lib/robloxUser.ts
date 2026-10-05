import type { GetJson } from "@/lib/robloxAudio";

/**
 * Public profile info about a Roblox account (what anybody can see on roblox.com/users/<id>/profile):
 * names, created date, whether the account owns one of the email-verification hats (only knowable while
 * the inventory is public), friend/follower counts, inventory visibility, groups, Roblox badges, avatar.
 *
 * On purpose NOT included: online status, last-online, what game somebody is in right now. Those need a login on
 * Roblox's side, and a tool that tracks when (often young) players are online is not something this site should be.
 */

export interface RobloxUser {
  id: string;
  name: string;
  displayName: string;
  description: string;
  created?: string;
  banned: boolean;
  verified: boolean;
  friends?: number;
  followers?: number;
  following?: number;
  inventoryPublic?: boolean;
  groups?: number;
  badges: { name: string; imageUrl?: string }[];
  avatar?: string;
  /** Roblox presence — only present when the user's own privacy allows it. 0 offline,1 online,2 in-game,3 studio */
  presenceType?: number;
  lastOnline?: string;
  /** from Rolimons (unofficial, may be missing) */
  rap?: number;
  value?: number;
  url: string;
}

export type UserLookupError = "invalid" | "notfound" | "busy" | "unavailable";

/** "fosenti", "@fosenti", "2899991570", "https://www.roblox.com/users/2899991570/profile" */
export function parseUserInput(input: string): { kind: "id"; id: string } | { kind: "name"; name: string } | null {
  const s = input.trim().replace(/^@/, "");
  if (!s) return null;
  const fromUrl = s.match(/roblox\.com\/(?:[a-z-]{2,5}\/)?users\/(\d{1,19})/i);
  if (fromUrl) return { kind: "id", id: fromUrl[1] };
  if (/^\d{1,19}$/.test(s)) return { kind: "id", id: s };
  if (/^[A-Za-z0-9_]{3,20}$/.test(s)) return { kind: "name", name: s };
  return null;
}

const asObj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asStr = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const asNum = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

function rbxImage(json: unknown): string | undefined {
  const item = asObj((Array.isArray(asObj(json).data) ? (asObj(json).data as unknown[]) : [])[0]);
  const url = asStr(item.imageUrl);
  if (!url || item.state !== "Completed") return undefined;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".rbxcdn.com") ? u.toString() : undefined; // only Roblox's own CDN
  } catch {
    return undefined;
  }
}

// The two hats Roblox has handed out for verifying an account's email address: the current
// "Verified, Bonafide, Plaidafied" (since Feb 2013) and the original "Verified Sign" it replaced
// (2008–2013). Owning either one is what "Verified" means here — this has nothing to do with the
// separate blue-checkmark Verified Badge for notable creators, which is a different Roblox concept.
const VERIFIED_EMAIL_ITEM_IDS = [102611803, 1567446] as const;

/** Whether the user owns at least one of the verified-email items. Only meaningful (and only called) when the inventory is public. */
async function ownsVerifiedItem(userId: string, getJson: GetJson): Promise<boolean> {
  const checks = await Promise.all(
    VERIFIED_EMAIL_ITEM_IDS.map((itemId) =>
      getJson(`https://inventory.roblox.com/v1/users/${userId}/items/Asset/${itemId}`)
        .then((r) => r.status === 200 && Array.isArray(asObj(r.json).data) && (asObj(r.json).data as unknown[]).length > 0)
        .catch(() => false)
    )
  );
  return checks.some(Boolean);
}

export async function lookupUser(input: string, getJson: GetJson): Promise<{ ok: true; user: RobloxUser } | { ok: false; error: UserLookupError }> {
  const target = parseUserInput(input);
  if (!target) return { ok: false, error: "invalid" };

  let id: string;
  if (target.kind === "id") id = target.id;
  else {
    let res;
    try {
      res = await getJson("https://users.roblox.com/v1/usernames/users", {
        method: "POST",
        body: { usernames: [target.name], excludeBannedUsers: false },
      });
    } catch {
      return { ok: false, error: "unavailable" };
    }
    if (res.status === 429) return { ok: false, error: "busy" };
    if (res.status !== 200) return { ok: false, error: "unavailable" };
    const first = asObj((Array.isArray(asObj(res.json).data) ? (asObj(res.json).data as unknown[]) : [])[0]);
    const found = asNum(first.id);
    if (found === undefined) return { ok: false, error: "notfound" };
    id = String(found);
  }

  const settle = <T,>(p: Promise<T>) => p.then((v) => ({ ok: true as const, v }), () => ({ ok: false as const }));
  const [main, friends, followers, following, inventory, groups, badges, avatar, presence] = await Promise.all([
    settle(getJson(`https://users.roblox.com/v1/users/${id}`)),
    settle(getJson(`https://friends.roblox.com/v1/users/${id}/friends/count`)),
    settle(getJson(`https://friends.roblox.com/v1/users/${id}/followers/count`)),
    settle(getJson(`https://friends.roblox.com/v1/users/${id}/followings/count`)),
    settle(getJson(`https://inventory.roblox.com/v1/users/${id}/can-view-inventory`)),
    settle(getJson(`https://groups.roblox.com/v2/users/${id}/groups/roles`)),
    settle(getJson(`https://accountinformation.roblox.com/v1/users/${id}/roblox-badges`)),
    settle(getJson(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${id}&size=250x250&format=Png&isCircular=false`)),
    // presence is a POST; Roblox only fills it in when the user's own privacy settings allow it
    settle(getJson(`https://presence.roblox.com/v1/presence/users`, { method: "POST", body: { userIds: [Number(id)] } })),
  ]);

  if (!main.ok) return { ok: false, error: "unavailable" };
  if (main.v.status === 429) return { ok: false, error: "busy" };
  if (main.v.status === 400 || main.v.status === 404) return { ok: false, error: "notfound" };
  if (main.v.status !== 200) return { ok: false, error: "unavailable" };

  const d = asObj(main.v.json);
  const name = asStr(d.name);
  if (!name) return { ok: false, error: "notfound" };

  const count = (r: typeof friends) => (r.ok && r.v.status === 200 ? asNum(asObj(r.v.json).count) : undefined);
  const user: RobloxUser = {
    id,
    name,
    displayName: asStr(d.displayName) ?? name,
    description: asStr(d.description) ?? "",
    created: asStr(d.created),
    banned: d.isBanned === true,
    // Set below once we know the inventory is public — email-verified status can't be read otherwise.
    verified: false,
    friends: count(friends),
    followers: count(followers),
    following: count(following),
    badges: [],
    url: `https://www.roblox.com/users/${id}/profile`,
  };
  if (inventory.ok && inventory.v.status === 200 && typeof asObj(inventory.v.json).canView === "boolean") {
    user.inventoryPublic = asObj(inventory.v.json).canView as boolean;
    if (user.inventoryPublic) user.verified = await ownsVerifiedItem(id, getJson);
  }
  if (groups.ok && groups.v.status === 200 && Array.isArray(asObj(groups.v.json).data)) {
    user.groups = (asObj(groups.v.json).data as unknown[]).length;
  }
  if (badges.ok && badges.v.status === 200 && Array.isArray(badges.v.json)) {
    const parsedBadges: { name: string; imageUrl?: string }[] = [];
    for (const b of badges.v.json as unknown[]) {
      const o = asObj(b);
      const name = asStr(o.name);
      if (name) parsedBadges.push({ name, imageUrl: asStr(o.imageUrl) });
    }
    user.badges = parsedBadges.slice(0, 12);
  }
  if (avatar.ok && avatar.v.status === 200) user.avatar = rbxImage(avatar.v.json);

  // presence: only set when Roblox actually returned it (i.e. the user's privacy allows it)
  if (presence.ok && presence.v.status === 200) {
    const first = asObj(asArr(asObj(presence.v.json).userPresences)[0]);
    const pt = asNum(first.userPresenceType);
    if (pt !== undefined) user.presenceType = pt;
    const last = asStr(first.lastOnline);
    if (last) user.lastOnline = last;
  }

  return { ok: true, user };
}
