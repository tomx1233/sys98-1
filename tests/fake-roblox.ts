/**
 * Fake Roblox / Rolimons / CoinGecko APIs for the offline command tests.
 * Every endpoint the libs call is answered with realistic fixture data, so the
 * whole bot can be exercised without a network connection.
 */

export interface CapturedEdit {
  applicationId: string;
  token: string;
  body: unknown;
  files?: { name: string; contentType: string }[];
}

export const capturedEdits: CapturedEdit[] = [];

const U = {
  id: 261,
  name: "Shedletsky",
  displayName: "Shedletsky",
  description: "Fried chicken.",
  created: "2006-03-23T01:03:36.123Z",
  isBanned: false,
};

function thumbPayload(seed: string) {
  return { data: [{ targetId: 1, state: "Completed", imageUrl: `https://tr.rbxcdn.com/${seed}/150/150/Image/Png`, name: "x" }] };
}

export const fakeGetJson = async (
  url: string,
  init?: { method?: "GET" | "POST"; body?: unknown }
): Promise<{ status: number; json: unknown }> => {
  const u = new URL(url);
  const host = u.hostname;
  const path = u.pathname;
  const q = u.searchParams;
  const body = init?.body as Record<string, unknown> | undefined;

  // ---------- users ----------
  if (host === "users.roblox.com") {
    if (init?.method === "POST" && path === "/v1/usernames/users") {
      const names = (body?.usernames as string[]) ?? [];
      const data = names
        .filter((n) => n.toLowerCase() === "shedletsky" || n.toLowerCase() === "fosenti")
        .map((n) => ({ id: n.toLowerCase() === "shedletsky" ? 261 : 262, name: n, displayName: n, banned: false }));
      return { status: 200, json: { data } };
    }
    const m = path.match(/^\/v1\/users\/(\d+)$/);
    if (m) {
      if (m[1] === "1") return { status: 404, json: { errors: [{ code: 3, message: "The user id is invalid." }] } };
      return { status: 200, json: { ...U, id: Number(m[1]) } };
    }
    if (/^\/v1\/users\/\d+\/username-history$/.test(path)) {
      return { status: 200, json: { data: [{ name: "ShedLetzky" }, { name: "Telamon" }] } };
    }
    return { status: 404, json: {} };
  }

  // ---------- friends / followers ----------
  if (host === "friends.roblox.com") {
    if (/\/friends\/count$/.test(path)) return { status: 200, json: { count: 12 } };
    if (/\/followers\/count$/.test(path)) return { status: 200, json: { count: 50000 } };
    if (/\/followings\/count$/.test(path)) return { status: 200, json: { count: 3 } };
    if (/\/friends$/.test(path)) {
      return {
        status: 200,
        json: {
          data: Array.from({ length: 25 }, (_, i) => ({
            id: 1000 + i,
            name: `Friend${i}`,
            displayName: `Friend ${i}`,
            isBanned: i === 3,
          })),
        },
      };
    }
    if (/\/followers$/.test(path)) {
      return {
        status: 200,
        json: { data: Array.from({ length: 30 }, (_, i) => ({ id: 2000 + i, name: `Follower${i}`, displayName: `Follower ${i}` })) },
      };
    }
    return { status: 404, json: {} };
  }

  // ---------- groups ----------
  if (host === "groups.roblox.com") {
    if (/^\/v2\/users\/\d+\/groups\/roles$/.test(path)) {
      return {
        status: 200,
        json: {
          data: [
            { group: { id: 1200769, name: "Roblox Admins", memberCount: 100, hasVerifiedBadge: true, description: "Admins" }, role: { id: 555, name: "Member", rank: 1 } },
            { group: { id: 7, name: " ROBLOX Staff", memberCount: 2000, hasVerifiedBadge: true, description: "Staff" }, role: { id: 777, name: "Staff", rank: 5 } },
          ],
        },
      };
    }
    const gm = path.match(/^\/v1\/groups\/(\d+)$/);
    if (gm) {
      if (gm[1] === "999999999") return { status: 404, json: { errors: [] } };
      return {
        status: 200,
        json: {
          id: Number(gm[1]),
          name: "Roblox Admins",
          description: "The admin group.",
          owner: { userId: 261, username: "Shedletsky" },
          memberCount: 100,
          hasVerifiedBadge: true,
          publicEntryAllowed: true,
          created: "2007-01-01T00:00:00Z",
        },
      };
    }
    if (/^\/v1\/groups\/\d+\/roles$/.test(path)) {
      return {
        status: 200,
        json: {
          roles: [
            { id: 555, name: "Member", rank: 1, memberCount: 90 },
            { id: 777, name: "Staff", rank: 5, memberCount: 10 },
          ],
        },
      };
    }
    if (path === "/v1/groups/search") {
      const kw = q.get("keyword") ?? "";
      if (!kw) return { status: 200, json: { data: [] } };
      return { status: 200, json: { data: [{ id: 1200769, name: "Roblox Admins", memberCount: 100 }] } };
    }
    return { status: 404, json: {} };
  }

  // ---------- thumbnails ----------
  if (host === "thumbnails.roblox.com") {
    if (path === "/v1/users/avatar") return { status: 200, json: thumbPayload("avatar") };
    if (path === "/v1/users/avatar-bust") return { status: 200, json: thumbPayload("bust") };
    if (path === "/v1/users/avatar-headshot") return { status: 200, json: thumbPayload("headshot") };
    if (path === "/v1/groups/icons") return { status: 200, json: thumbPayload("groupicon") };
    if (path === "/v1/assets") return { status: 200, json: thumbPayload("asset") };
    if (path === "/v1/games/icons") return { status: 200, json: thumbPayload("gameicon") };
    if (path === "/v1/bundles/thumbnails") return { status: 200, json: thumbPayload("bundle") };
    if (path === "/v1/game-passes") return { status: 200, json: thumbPayload("gamepass") };
    return { status: 404, json: {} };
  }

  // ---------- economy (asset details) ----------
  if (host === "economy.roblox.com") {
    const m = path.match(/^\/v2\/assets\/(\d+)\/details$/);
    if (!m) return { status: 404, json: {} };
    const id = m[1];
    if (id === "100131") return { status: 200, json: { AssetId: 100131, Name: "Blue Baseball Cap", AssetTypeId: 8, Description: "A cap.", Creator: { Id: 1, CreatorType: "User", CreatorTargetId: 1, Name: "ROBLOX", HasVerifiedBadge: true }, PriceInRobux: 5, IsForSale: true, Created: "2007-01-01T00:00:00Z", Updated: "2020-01-01T00:00:00Z" } };
    if (id === "1846633959") return { status: 200, json: { AssetId: Number(id), Name: "Vibe Check", AssetTypeId: 3, Description: "nice audio", Creator: { Id: 5, CreatorType: "User", CreatorTargetId: 5, Name: "SomeUser", HasVerifiedBadge: false }, PriceInRobux: null, IsForSale: false, Created: "2019-04-01T00:00:00Z", Updated: "2019-05-01T00:00:00Z" } };
    if (id === "99999999999") return { status: 404, json: { errors: [] } };
    return { status: 200, json: { AssetId: Number(id), Name: "Some Audio", AssetTypeId: 3, Description: "", Creator: { Id: 5, CreatorType: "User", CreatorTargetId: 5, Name: "SomeUser", HasVerifiedBadge: false }, PriceInRobux: null, IsForSale: false, Created: "2020-01-01T00:00:00Z", Updated: "2020-01-01T00:00:00Z" } };
  }

  // ---------- apis.roblox.com ----------
  if (host === "apis.roblox.com") {
    if (path === "/toolbox-service/v1/items/details") {
      return { status: 200, json: { data: [{ asset: { id: 1846633959, createdUtc: "2019-04-01", updatedUtc: "2019-05-01", moderationStatus: "Approved", audioDetails: { artist: "Artist X", title: "Vibe Check", album: "Vibes", genre: "Dance", durationSeconds: 15 } } }] } };
    }
    const gp = path.match(/^\/game-passes\/v1\/game-passes\/(\d+)\/product-info$/);
    if (gp) {
      if (gp[1] === "1") return { status: 404, json: {} };
      return { status: 200, json: { Name: "VIP Pass", PriceInRobux: 100 } };
    }
    return { status: 404, json: {} };
  }

  // ---------- catalog ----------
  if (host === "catalog.roblox.com") {
    if (/^\/v1\/favorites\/assets\/\d+\/count$/.test(path)) return { status: 200, json: 42137 };
    const bm = path.match(/^\/v1\/bundles\/(\d+)\/details$/);
    if (bm) {
      if (bm[1] === "1") return { status: 404, json: {} };
      return { status: 200, json: { name: "Man", description: "A bundle", bundleType: "AvatarAccessories", items: [{ id: 1 }, { id: 2 }, { id: 3 }] } };
    }
    if (path === "/v1/catalog/items/details" && init?.method === "POST") {
      const items = (body?.items as { id: number }[]) ?? [];
      return { status: 200, json: { data: items.map((i) => ({ id: i.id, name: i.id === 131 ? "Blue Baseball Cap" : "Verified Sign", itemType: "Asset" })) } };
    }
    return { status: 404, json: {} };
  }

  // ---------- inventory ----------
  if (host === "inventory.roblox.com") {
    if (/\/can-view-inventory$/.test(path)) return { status: 200, json: { canView: true } };
    if (/\/items\/Asset\/102611803$/.test(path)) return { status: 200, json: { data: [{ id: 999 }] } };
    return { status: 200, json: { data: [] } };
  }

  // ---------- accountinformation / presence ----------
  if (host === "accountinformation.roblox.com") {
    return { status: 200, json: [{ name: "Administrator", imageUrl: "https://tr.rbxcdn.com/badge/150/150/Image/Png" }, { name: "Bloxxer" }] };
  }
  if (host === "presence.roblox.com") {
    return { status: 200, json: { userPresences: [{ userId: 261, userPresenceType: 1, lastOnline: "2026-10-04T12:00:00Z" }] } };
  }

  // ---------- games ----------
  if (host === "games.roblox.com") {
    if (/^\/v2\/users\/\d+\/games$/.test(path)) {
      return {
        status: 200,
        json: {
          data: [
            { id: 92058721, name: "Crossroads", rootPlace: { id: 1818 }, created: "2006-01-01T00:00:00Z", description: "Sword fight." },
            { id: 278939, name: "Doomspire", rootPlace: { id: 2 } },
          ],
        },
      };
    }
    if (path === "/v1/games" && q.has("universeIds")) {
      const ids = q.get("universeIds")!.split(",").map(Number);
      return { status: 200, json: { data: ids.map((id) => ({ id, rootPlaceId: 1818, name: id === 92058721 ? "Crossroads" : "Doomspire", creator: { name: "Shedletsky" }, playing: 123, visits: 999999, isPlayable: true, favoritedCount: 55, maxPlayers: 12, created: "2006-01-01T00:00:00Z", updated: "2020-01-01T00:00:00Z", description: "Sword fight." })) } };
    }
    if (path === "/v1/games/votes") {
      const ids = q.get("universeIds")!.split(",").map(Number);
      return { status: 200, json: { data: ids.map((id) => ({ id, upVotes: 100, downVotes: 10 })) } };
    }
    if (path === "/v1/games/list") {
      const kw = q.get("model.keyword") ?? "";
      if (!kw.trim()) return { status: 200, json: { games: [] } };
      return { status: 200, json: { games: [{ name: "Crossroads", creatorName: "Shedletsky", rootPlaceId: 1818, universeId: 92058721, playerCount: 123 }] } };
    }
    return { status: 404, json: {} };
  }

  // ---------- avatar ----------
  if (host === "avatar.roblox.com") {
    if (/\/currently-wearing$/.test(path)) return { status: 200, json: { assetIds: [131, 102611803] } };
    if (/\/avatar$/.test(path)) {
      return {
        status: 200,
        json: {
          playerAvatarType: "R15",
          scales: { height: 1.05, width: 1, head: 1 },
          assets: [
            { id: 1, name: "Head", assetType: { name: "Head" } },
            { id: 131, name: "Blue Baseball Cap", assetType: { name: "Hat" } },
            { id: 5, name: "Walk", assetType: { name: "WalkAnimation" } },
          ],
          bodyColor3s: { headColor3: "#C8A97E", torsoColor3: "#0025FF" },
          headColorId: 1,
          torsoColorId: 23,
          emotes: [{ assetName: "Wave" }, { assetName: "Shrug" }],
        },
      };
    }
    return { status: 404, json: {} };
  }

  // ---------- rolimons / coingecko ----------
  if (host === "api.rolimons.com") {
    return { status: 200, json: { rap: 123456, value: 234567, premium: true, last_scan: Math.floor(Date.now() / 1000) } };
  }
  if (host === "api.coingecko.com") {
    return { status: 200, json: { ripple: { usd: 2.87, usd_24h_change: 1.23 } } };
  }

  return { status: 404, json: { unhandled: url } };
};
