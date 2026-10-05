/**
 * Offline sweep of every Discord slash command + the /user dropdown and pagination,
 * run through the real handler (lib/discordBot) and the real lookup libs, with the
 * Roblox/Discord network replaced by tests/fake-roblox.ts.
 *
 * Run with: npm test   (or: npx tsx --tsconfig tsconfig.json tests/bot-commands.test.ts)
 * Exits non-zero on the first failed expectation summary, so it can gate CI.
 */
import crypto from "node:crypto";
import QRCode from "qrcode";
import { handleInteraction, verifyDiscordSignature, parseCid, type BotDeps, type BotFile } from "@/lib/discordBot";
import { extractAssetId, lookupAudio } from "@/lib/robloxAudio";
import { lookupUser } from "@/lib/robloxUser";
import * as RX from "@/lib/robloxExtra";
import { getCryptoPrice } from "@/lib/cryptoPrice";
import { fakeGetJson, capturedEdits } from "./fake-roblox";

let failures = 0;
let checks = 0;
function ok(cond: unknown, label: string, extra?: unknown) {
  checks++;
  if (!cond) {
    failures++;
    console.error(`  FAIL: ${label}`, extra !== undefined ? JSON.stringify(extra)?.slice(0, 300) : "");
  }
}

// deps wired exactly like app/api/discord/interactions/route.ts, but with the fake network
const friendly = <T extends { ok: boolean }>(r: T) => {
  if (r.ok) return r;
  const code = (r as unknown as { error: string }).error;
  const MSG: Record<string, string> = { invalid: "That doesn't look right.", notfound: "Roblox doesn't know that one.", busy: "Roblox is rate limiting us.", unavailable: "Couldn't reach Roblox." };
  return { ok: false as const, error: MSG[code] ?? "Couldn't reach Roblox." };
};

const deps: BotDeps = {
  siteUrl: "https://system98.org",
  lookupAudio: async (input) => {
    const id = extractAssetId(input);
    if (!id) return { ok: false, error: "invalid" };
    return lookupAudio(id, fakeGetJson);
  },
  lookupUser: async (input) => {
    const r = await lookupUser(input, fakeGetJson);
    if (r.ok) {
      const roli = await RX.getRolimons(r.user.id, fakeGetJson);
      r.user.rap = roli.rap;
      r.user.value = roli.value;
    }
    return r;
  },
  analyzeFile: async () => ({ ok: false as const, error: "no files in this test" }),
  recognizeSong: async () => ({ ok: false as const, error: "no files in this test" }),
  crFile: async () => ({ ok: false as const, error: "no files in this test" }),
  avatar: (input, kind) => RX.getAvatar(input, kind, fakeGetJson).then(friendly),
  accountAge: (input) => RX.getAccountAge(input, fakeGetJson).then(friendly),
  friends: (input) => RX.getFriends(input, fakeGetJson).then(friendly),
  areFriends: (a, b) => RX.areFriends(a, b, fakeGetJson).then(friendly),
  userGroups: (input) => RX.getUserGroups(input, fakeGetJson).then(friendly),
  groupDetail: (g, rn, ri) => RX.getGroupDetail(g, rn, ri, fakeGetJson).then(friendly),
  avatarDetail: (input) => RX.getAvatarDetail(input, fakeGetJson).then(friendly),
  group: (input) => RX.getGroup(input, fakeGetJson).then(friendly),
  asset: (input) => RX.getAsset(input, fakeGetJson).then(friendly),
  game: (input) => RX.searchGame(input, fakeGetJson).then(friendly),
  gamepass: (input) => RX.getGamepass(input, fakeGetJson).then(friendly),
  bundle: (input) => RX.getBundle(input, fakeGetJson).then(friendly),
  username: (input) => RX.checkUsername(input, fakeGetJson).then(friendly),
  wearing: (input) => RX.getCurrentlyWearing(input, fakeGetJson).then(friendly),
  followers: (input) => RX.getFollowers(input, fakeGetJson).then(friendly),
  rolimons: (input) => RX.getRolimonsFull(input, fakeGetJson).then(friendly),
  userGames: (input) => RX.getUserGames(input, fakeGetJson).then(friendly),
  prevNames: (input) => RX.getPreviousUsernames(input, fakeGetJson).then(friendly),
  universe: (input) => RX.getUniverse(input, fakeGetJson).then(friendly),
  cryptoPrice: (id) => getCryptoPrice(id, fakeGetJson).then((r) => (r.ok ? r : { ok: false as const, error: "price feed down" })),
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
  allow: () => true,
  allowComponent: () => true,
  editOriginal: async (applicationId, token, body, files) => {
    capturedEdits.push({ applicationId, token, body, files: files?.map((f: BotFile) => ({ name: f.name, contentType: f.contentType })) });
  },
};

interface Opt { name: string; value?: unknown }
function interaction(name: string, options?: Opt[], extra?: Record<string, unknown>) {
  return {
    type: 2,
    application_id: "123456789012345678",
    token: "tokentokentokentoken-abc",
    data: { name, options },
    member: { user: { id: "99" } },
    ...extra,
  };
}

async function run(name: string, options?: Opt[], extra?: Record<string, unknown>) {
  capturedEdits.length = 0;
  const handled = handleInteraction(interaction(name, options, extra) as never, deps);
  const response = handled.response as {
    type: number;
    data?: { content?: string; embeds?: Record<string, unknown>[]; components?: unknown[]; flags?: number };
  };
  if (handled.after) await handled.after();
  return { response, edited: capturedEdits[capturedEdits.length - 1] };
}

const embedOf = (payload: unknown) => (payload as { embeds?: unknown[] })?.embeds?.[0] as Record<string, unknown> | undefined;
const json = (v: unknown) => JSON.stringify(v);

async function main() {
  // ---------- ping / help / unknown ----------
  ok((handleInteraction({ type: 1 } as never, deps).response as { type: number }).type === 1, "ping responds type 1");
  {
    const { response } = await run("help");
    ok(response.type === 4 && !!response.data?.content && response.data.flags === 64, "help is an ephemeral message", response);
  }
  {
    const { response } = await run("doesnotexist");
    ok(response.type === 4 && response.data?.content === "Unknown command.", "unknown command rejected", response);
  }

  // ---------- /audio ----------
  {
    const { response, edited } = await run("audio", [{ name: "id", value: "1846633959" }]);
    ok(response.type === 5, "/audio defers");
    const body = json(edited?.body);
    ok(/Vibe Check/.test(body) && body.includes("Open on Roblox"), "/audio embed + buttons", embedOf(edited?.body));
    ok(body.includes(`${deps.siteUrl}/roblox-audio?id=1846633959`), "/audio links to the website tool");
  }
  {
    const { edited } = await run("audio", [{ name: "id", value: "https://www.roblox.com/library/1846633959/Vibe-Check" }]);
    ok(/Vibe Check/.test(json(embedOf(edited?.body))), "/audio accepts links");
  }
  {
    const { edited } = await run("audio", [{ name: "id", value: "100131" }]);
    ok(/isn't an audio/.test(json(embedOf(edited?.body))), "/audio rejects non-audio assets", embedOf(edited?.body));
  }
  {
    const { edited } = await run("audio", [{ name: "id", value: "99999999999" }]);
    ok(/doesn't know/.test(json(embedOf(edited?.body))), "/audio 404 → friendly error", embedOf(edited?.body));
  }
  {
    const { response, edited } = await run("audio", [{ name: "id", value: "abc" }]);
    const msg = response.type === 4 ? response.data?.content : json(edited?.body);
    ok(/doesn't look right/.test(msg ?? ""), "/audio invalid id → friendly error", msg);
  }

  // ---------- /user ----------
  {
    const { response, edited } = await run("user", [{ name: "user", value: "Shedletsky" }]);
    ok(response.type === 5, "/user defers");
    const body = json(edited?.body);
    ok(/Shedletsky/.test(body) && /Friends/.test(body) && /Followers/.test(body), "/user embed shows name + counts");
    ok((edited?.body as { components?: unknown[] }).components?.length === 1, "/user has the dropdown row", edited?.body);
    ok(/"type":3/.test(body), "/user contains a select menu");
  }
  {
    const { edited } = await run("user", [{ name: "user", value: "261" }]);
    ok(/Shedletsky/.test(json(edited?.body)), "/user accepts plain ids");
  }
  {
    const { edited } = await run("user", [{ name: "user", value: "https://www.roblox.com/users/261/profile" }]);
    ok(/Shedletsky/.test(json(edited?.body)), "/user accepts profile links");
  }
  {
    const { edited } = await run("user", [{ name: "user", value: "nosuchuserzzz" }]);
    ok(/doesn't know/.test(json(embedOf(edited?.body))), "/user unknown name → friendly error", embedOf(edited?.body));
  }

  // ---------- /avatar /bust /headshot ----------
  for (const cmd of ["avatar", "bust", "headshot"] as const) {
    const { edited } = await run(cmd, [{ name: "user", value: "Shedletsky" }]);
    const e = embedOf(edited?.body);
    ok(e?.image && /rbxcdn/.test(json(e.image)), `/${cmd} shows an image`, e);
  }

  // ---------- /accountage /friends /arefriends /usergroups ----------
  {
    const { edited } = await run("accountage", [{ name: "user", value: "Shedletsky" }]);
    ok(/days/.test(json(edited?.body)), "/accountage shows days", embedOf(edited?.body));
  }
  {
    const { edited } = await run("friends", [{ name: "user", value: "Shedletsky" }]);
    ok(/\b12\b/.test(json(embedOf(edited?.body))), "/friends shows the count", embedOf(edited?.body));
  }
  {
    const { edited } = await run("arefriends", [{ name: "user1", value: "Shedletsky" }, { name: "user2", value: "Shedletsky" }]);
    ok(/doesn't look right/.test(json(edited?.body)), "/arefriends rejects comparing a user with themselves", embedOf(edited?.body));
  }
  {
    const { edited } = await run("arefriends", [{ name: "user1", value: "Shedletsky" }, { name: "user2", value: "fosenti" }]);
    ok(/friends/i.test(json(edited?.body)), "/arefriends answers", embedOf(edited?.body));
  }
  {
    const { edited } = await run("usergroups", [{ name: "user", value: "Shedletsky" }]);
    ok(/Roblox Admins/.test(json(edited?.body)), "/usergroups lists groups", embedOf(edited?.body));
  }

  // ---------- /group /assetid /asseticon /game /gamepass /bundle ----------
  {
    const { edited } = await run("group", [{ name: "group", value: "Roblox Admins" }]);
    ok(/Roblox Admins/.test(json(edited?.body)), "/group by name", embedOf(edited?.body));
  }
  {
    const { edited } = await run("group", [{ name: "group", value: "1200769" }]);
    ok(/Roblox Admins/.test(json(edited?.body)), "/group by id");
  }
  {
    const { edited } = await run("group", [{ name: "group", value: "999999999" }]);
    ok(/doesn't know/.test(json(edited?.body)), "/group unknown id → friendly error", embedOf(edited?.body));
  }
  {
    const { edited } = await run("assetid", [{ name: "asset", value: "100131" }]);
    ok(/Blue Baseball Cap/.test(json(edited?.body)), "/assetid", embedOf(edited?.body));
  }
  {
    const { edited } = await run("asseticon", [{ name: "asset", value: "100131" }]);
    const e = embedOf(edited?.body);
    ok(e?.image && /rbxcdn/.test(json(e.image)), "/asseticon shows an image", e);
  }
  {
    const { edited } = await run("game", [{ name: "name", value: "Crossroads" }]);
    ok(/Crossroads/.test(json(edited?.body)), "/game search", embedOf(edited?.body));
  }
  {
    const { edited } = await run("gamepass", [{ name: "id", value: "12345" }]);
    ok(/VIP Pass/.test(json(edited?.body)), "/gamepass", embedOf(edited?.body));
  }
  {
    const { edited } = await run("bundle", [{ name: "id", value: "19" }]);
    ok(/Man/.test(json(edited?.body)), "/bundle", embedOf(edited?.body));
  }

  // ---------- /devex /qr /username /wearing /universe ----------
  {
    const { response } = await run("devex", [{ name: "robux", value: 100000 }]);
    ok(response.type === 4 && /\$350/.test(json(response.data)), "/devex instant answer", response.data);
    const below = await run("devex", [{ name: "robux", value: 100 }]);
    ok(json(below.response.data).includes("30,000"), "/devex mentions the minimum");
  }
  {
    const { response, edited } = await run("qr", [{ name: "text", value: "https://system98.org" }]);
    ok(response.type === 5 && edited?.files?.some((f) => f.name === "qr.png"), "/qr defers and attaches qr.png", edited);
  }
  {
    const { edited } = await run("username", [{ name: "username", value: "Shedletsky" }]);
    ok(/taken/i.test(json(edited?.body)), "/username taken", embedOf(edited?.body));
    const free = await run("username", [{ name: "username", value: "zzqqxx_free_99" }]);
    ok(/available/i.test(json(free.edited?.body)), "/username available", embedOf(free.edited?.body));
    const badShape = await run("username", [{ name: "username", value: "_bad_" }]);
    ok(/valid Roblox username shape/i.test(json(badShape.edited?.body)), "/username invalid shape", embedOf(badShape.edited?.body));
  }
  {
    const { edited } = await run("wearing", [{ name: "user", value: "Shedletsky" }]);
    ok(/Blue Baseball Cap/.test(json(edited?.body)), "/wearing lists items", embedOf(edited?.body));
  }
  {
    const { edited } = await run("universe", [{ name: "id", value: "92058721" }]);
    ok(/Crossroads/.test(json(edited?.body)), "/universe", embedOf(edited?.body));
  }

  // ---------- /userinfo /xrp /text* ----------
  {
    const uid = "80351110224678912";
    const { response } = await run("userinfo", [{ name: "user", value: uid }], {
      data: {
        name: "userinfo",
        options: [{ name: "user", value: uid }],
        resolved: {
          users: { [uid]: { id: uid, username: "Nelly", global_name: "Nelly", discriminator: "0", avatar: null, bot: false } },
          members: { [uid]: { nick: "nelli", joined_at: "2015-01-01T00:00:00Z" } },
        },
      },
    });
    ok(response.type === 4 && /Nelly/.test(json(response.data)), "/userinfo", response.data);
  }
  {
    const { edited } = await run("xrp");
    ok(/XRP/.test(json(edited?.body)) && /2\.87/.test(json(edited?.body)), "/xrp price", embedOf(edited?.body));
  }
  {
    const nato = await run("textnato", [{ name: "text", value: "hi 9" }]);
    ok(nato.response.data?.content === "Hotel India / 9", "/textnato", nato.response.data?.content);
    const rev = await run("textreverse", [{ name: "text", value: "abc" }]);
    ok(rev.response.data?.content === "cba", "/textreverse", rev.response.data?.content);
    const zal = await run("textzalgo", [{ name: "text", value: "boo" }, { name: "intensity", value: 2 }]);
    ok((zal.response.data?.content ?? "").length >= 3, "/textzalgo", zal.response.data?.content);
  }

  // ---------- /analyze /shazam: attachment missing ----------
  {
    const a = await run("analyze", [{ name: "file", value: "att-1" }]);
    ok(a.response.type === 4 && /Couldn't find that attachment/.test(a.response.data?.content ?? ""), "/analyze missing attachment", a.response.data);
    const s = await run("shazam", [{ name: "file", value: "att-1" }]);
    ok(s.response.type === 4 && /Couldn't find that attachment/.test(s.response.data?.content ?? ""), "/shazam missing attachment", s.response.data);
    const c = await run("cr", [{ name: "file", value: "att-1" }, { name: "preset", value: "balanced" }]);
    ok(c.response.type === 4 && /Couldn't find that attachment/.test(c.response.data?.content ?? ""), "/cr missing attachment", c.response.data);
  }

  // ---------- component interactions (dropdown + pagination) ----------
  const click = async (custom_id: string, values?: string[]) => {
    capturedEdits.length = 0;
    const handled = handleInteraction({
      type: 3,
      application_id: "123456789012345678",
      token: "tokentokentokentoken-abc",
      data: { custom_id, values },
      member: { user: { id: "99" } },
    } as never, deps);
    ok((handled.response as { type: number }).type === 6, `component ${custom_id} → deferred update`);
    await handled.after?.();
    return json(capturedEdits[0]?.body);
  };

  {
    const body = await click("v2|profile|261|0", ["friends"]);
    ok(/Friends \(12\)/.test(body) && body.includes("Page: 1/3"), "dropdown → friends view, paginated", capturedEdits[0]?.body);
  }
  {
    const body = await click("v2|friends|261|1");
    ok(body.includes("Page: 2/3") && body.includes("Friend10"), "friends pagination page 2", capturedEdits[0]?.body);
  }
  {
    const body = await click("v2|groups|261|1");
    ok(/Group Information/.test(body) && /Role Information/.test(body) && body.includes("Page 2/2"), "groups detail view", capturedEdits[0]?.body);
  }
  {
    const body = await click("v2|games|261|0");
    ok(/Crossroads/.test(body) && /Visits/.test(body), "games detail view", capturedEdits[0]?.body);
  }
  for (const [view, expect] of [
    ["wearing", /Currently Wearing/],
    ["prevnames", /Telamon/],
    ["rolimons", /123,456/],
    ["followers", /Followers \(50,000\)/],
    ["avatar", /rbxcdn/],
  ] as const) {
    const body = await click("v2|profile|261|0", [view]);
    ok(expect.test(body), `dropdown view "${view}" renders`, capturedEdits[0]?.body);
  }
  {
    capturedEdits.length = 0;
    const handled = handleInteraction({ type: 3, data: { custom_id: "someoneelse|thing" }, member: { user: { id: "99" } } } as never, deps);
    ok((handled.response as { type: number }).type === 6 && !handled.after, "foreign component ids are ignored");
  }

  // ---------- parseCid ----------
  ok(parseCid("v2|profile|261|0")?.view === "profile", "parseCid accepts ours");
  ok(parseCid("v2|bogus|261|0") === null, "parseCid rejects unknown views");
  ok(parseCid("v2|profile|abc|0") === null, "parseCid rejects non-numeric ids");
  ok(parseCid("v1|profile|261|0") === null, "parseCid rejects other versions");

  // ---------- interaction signature verification ----------
  {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
    const pubHex = publicKey.export({ format: "der", type: "spki" }).subarray(-32).toString("hex");
    const ts = String(Math.floor(Date.now() / 1000));
    const body = '{"type":1}';
    const sig = crypto.sign(null, Buffer.from(ts + body), privateKey).toString("hex");
    ok(verifyDiscordSignature(body, sig, ts, pubHex), "valid signature accepted");
    ok(!verifyDiscordSignature(body + "x", sig, ts, pubHex), "tampered body rejected");
    ok(!verifyDiscordSignature(body, sig, ts, "0".repeat(64)), "wrong key rejected");
  }

  console.log(`\nbot-commands: ${checks} checks, ${failures} failure(s)`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error("HARNESS CRASH:", e);
  process.exit(2);
});
