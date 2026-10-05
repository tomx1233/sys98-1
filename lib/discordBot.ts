/**
 * The Discord bot: slash commands /audio, /user and /help, answered over Discord's HTTP "interactions"
 * (no always-on bot process, so it runs as a normal Vercel route).
 *
 * This file has no framework imports on purpose, everything it needs comes in through `deps`, which keeps it easy to test.
 */
import crypto from "node:crypto";
import type { RobloxAudio } from "./robloxAudio";
import type { RobloxUser } from "./robloxUser";
import type { Analysis } from "./audioAnalysis";
import type { RecognizedSong } from "./songRecognition";
import type {
  AvatarKind, GroupInfo, AssetInfo, GameInfo, GroupDetail, AvatarDetail, UserGame,
} from "./robloxExtra";
import { toNato, reverseText, toZalgo } from "./textTools";
import discordEmojis from "./discordEmojis.json";

// ---------- custom Discord emojis (uploaded once via `npm run discord:emojis`) ----------
// Falls back to a plain unicode emoji (or nothing) until the matching id has been uploaded,
// so the bot keeps working on a fresh checkout before that script has been run.
const EMOJI_IDS = discordEmojis as { views: Record<string, string>; badges: Record<string, string> };

/** For use inside embed text, e.g. "friends" or a badge name → "<:view_friends:123...>" or "" */
function customEmojiTag(kind: "views" | "badges", key: string): string {
  const id = EMOJI_IDS[kind]?.[key];
  return id ? `<:${kind === "views" ? "view" : "badge"}_${key.toLowerCase().replace(/[^a-z0-9]+/g, "_")}:${id}>` : "";
}

/** For use in a select-menu option's `emoji` field: a custom emoji object if uploaded, else a unicode fallback. */
function customEmojiOption(view: string, unicodeFallback: string): { id: string; name: string } | { name: string } {
  const id = EMOJI_IDS.views?.[view];
  return id ? { id, name: `view_${view}` } : { name: unicodeFallback };
}

// ---------- verifying that a request really comes from Discord ----------

const SPKI_ED25519_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export function verifyDiscordSignature(rawBody: string, signatureHex: string, timestamp: string, publicKeyHex: string): boolean {
  try {
    if (!/^[0-9a-f]{64}$/i.test(publicKeyHex) || !/^[0-9a-f]{128}$/i.test(signatureHex)) return false;
    const key = crypto.createPublicKey({ key: Buffer.concat([SPKI_ED25519_PREFIX, Buffer.from(publicKeyHex, "hex")]), format: "der", type: "spki" });
    return crypto.verify(null, Buffer.from(timestamp + rawBody), key, Buffer.from(signatureHex, "hex"));
  } catch {
    return false;
  }
}

// ---------- text helpers ----------

const TEAL = 0x1d8f9e;
const RED = 0xc4432f;

/** Roblox names/bios are user text: neutralise Discord markdown and mentions. */
export function escapeMd(s: string): string {
  return s.replace(/[\\*_~`|>[\]()]/g, "\\$&").replace(/@/g, "@\u200b");
}
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const unix = (iso?: string) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(t) ? null : Math.floor(t / 1000);
};
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const num = (n: number) => n.toLocaleString("en-US");
const num1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

interface Field { name: string; value: string; inline?: boolean }
export interface Embed {
  title?: string;
  url?: string;
  description?: string;
  color?: number;
  author?: { name: string; url?: string; icon_url?: string };
  thumbnail?: { url: string };
  image?: { url: string };
  fields?: Field[];
  footer?: { text: string };
}

function field(fields: Field[], name: string, value: string | undefined | null, inline = true) {
  if (value) fields.push({ name, value: clip(value, 1000), inline });
}

// ---------- embeds ----------

export function audioEmbed(a: RobloxAudio): Embed {
  const fields: Field[] = [];
  field(fields, "ID", `\`${a.id}\``);
  const cUrl = a.creator.id ? (a.creator.type === "Group" ? `https://www.roblox.com/communities/${a.creator.id}` : `https://www.roblox.com/users/${a.creator.id}/profile`) : null;
  field(fields, "Creator", (cUrl ? `[${escapeMd(a.creator.name)}](${cUrl})` : escapeMd(a.creator.name)) + (a.creator.type === "Group" ? " (group)" : a.creator.verified ? " ✔" : ""));
  field(fields, "Artist", a.artist && escapeMd(a.artist));
  const availLabel: Record<string, string> = { available: "Available", unavailable: "Unavailable", moderated: "In moderation", unknown: "Unknown" };
  field(fields, "Status", availLabel[a.availability] ?? "Unknown");
  field(fields, "Favorites", a.favorites !== undefined ? num(a.favorites) : null);
  field(fields, "Duration", a.durationSeconds ? mmss(a.durationSeconds) : null);
  field(fields, "Genre", a.genre && escapeMd(a.genre));
  field(fields, "Album", a.album && escapeMd(a.album));
  const up = unix(a.created);
  field(fields, "Uploaded", up ? `<t:${up}:D>` : null);
  return {
    title: clip(a.name, 250),
    url: a.url,
    description: a.removed ? "⚠️ Roblox removed this audio." : a.description ? `*${clip(escapeMd(a.description), 400)}*` : "*no description*",
    color: a.removed ? RED : TEAL,
    thumbnail: a.thumbnail ? { url: a.thumbnail } : undefined,
    fields,
    footer: { text: "system98 · roblox audio info" },
  };
}

export function userEmbed(u: RobloxUser): Embed {
  const friendsBase = `https://www.roblox.com/users/${u.id}/friends`;
  const counts = [
    u.friends !== undefined ? `[**${num(u.friends)}** Friends](${friendsBase})` : null,
    u.followers !== undefined ? `[**${num(u.followers)}** Followers](${friendsBase}#!/followers)` : null,
    u.following !== undefined ? `[**${num(u.following)}** Following](${friendsBase}#!/following)` : null,
  ].filter(Boolean).join(" | ");
  const roliUrl = `https://www.rolimons.com/player/${u.id}`;
  const fields: Field[] = [];
  // row 1: ID / Verified / Inventory
  field(fields, "ID", `\`${u.id}\``);
  // Roblox only lets us read the verified badge reliably while the inventory is public; with it private
  // "False" would look like a fact when it's really just unknown, so we show N/A there instead.
  field(fields, "Verified", u.inventoryPublic ? (u.verified ? "True" : "False") : "N/A");
  field(fields, "Inventory", u.inventoryPublic === undefined ? "N/A" : u.inventoryPublic ? "Public" : "Private");
  // row 2: RAP / Value / Groups
  field(fields, "RAP", u.rap !== undefined ? `[${num(u.rap)}](${roliUrl})` : "N/A");
  field(fields, "Value", u.value !== undefined ? `[${num(u.value)}](${roliUrl})` : "N/A");
  field(fields, "Groups", u.groups !== undefined ? String(u.groups) : "N/A");
  // row 3: Created / Last Cached Online / Badges
  const cr = unix(u.created);
  field(fields, "Created", cr ? `<t:${cr}:D>` : "N/A");
  const lo = unix(u.lastOnline);
  field(fields, "Last Cached Online", lo ? `<t:${lo}:D>` : "N/A");
  const badgeIcons = u.badges.map((b) => customEmojiTag("badges", b.name)).filter(Boolean).join(" ");
  const badgeText = badgeIcons || (u.badges.length ? u.badges.map((b) => `\`${escapeMd(b.name)}\``).join(" ") : "None");
  field(fields, "Badges", badgeText);
  if (u.description) field(fields, "Description", clip(escapeMd(u.description), 900), false);
  // presence at the bottom, only when Roblox actually returned it (opt-in on Roblox's side)
  const PRESENCE: Record<number, string> = { 0: "⚫ Offline", 1: "🟢 Online", 2: "🎮 In-game", 3: "🔧 In Studio" };
  const presenceLine = u.presenceType !== undefined ? PRESENCE[u.presenceType] ?? null : null;
  return {
    // titles are not rendered as markdown, so no escaping here (it would show as visible backslashes)
    title: clip(u.displayName + (u.name !== u.displayName ? ` (@${u.name})` : ""), 240) + (u.banned ? " · banned" : ""),
    url: u.url,
    description: [counts, presenceLine].filter(Boolean).join("\n\n") || undefined,
    color: u.banned ? RED : TEAL,
    thumbnail: u.avatar ? { url: u.avatar } : undefined,
    fields,
    footer: { text: "system98 · roblox user lookup" },
  };
}

export function analyzeEmbed(name: string, a: Analysis): Embed {
  const fields: Field[] = [];
  field(fields, "Format", `${a.format} · ${Math.round(a.sampleRate / 100) / 10} kHz`);
  field(fields, "Channels", a.channels === 1 ? "Mono" : a.channels === 2 ? "Stereo" : `${a.channels} channels`);
  field(fields, "Duration", mmss(a.durationSeconds));
  field(fields, "Size", `${(a.sizeBytes / 1048576).toFixed(2)} MB`);
  field(fields, "Bitrate", `${a.bitrateKbps} kbps`);
  field(fields, "Loudness", a.lufs !== null ? `${num1(a.lufs)} LUFS` : "silent");
  field(fields, "Peak", a.peakDb !== null ? `${num1(a.peakDb)} dBFS` : "-∞ dBFS");
  return { title: clip(escapeMd(name), 250), color: TEAL, fields, footer: { text: "system98 · audio analysis" } };
}

export function songEmbed(s: RecognizedSong): Embed {
  const fields: Field[] = [];
  field(fields, "Artist", escapeMd(s.artist));
  field(fields, "Album", s.album && escapeMd(s.album));
  field(fields, "Released", s.releaseDate);
  field(fields, "Label", s.label && escapeMd(s.label));
  const links = s.links.map((l) => `[${l.name}](${l.url})`).join(" · ");
  return {
    title: clip("🎵 " + escapeMd(s.title), 250),
    url: s.songUrl,
    description: links || undefined,
    color: TEAL,
    thumbnail: s.artwork ? { url: s.artwork } : undefined,
    fields,
    footer: { text: "system98 · song id via AudD" },
  };
}

function imageEmbed(title: string, url: string, image: string): Embed {
  return { title: clip(escapeMd(title), 240), url, color: TEAL, image: { url: image }, footer: { text: "system98 · roblox" } };
}

export function accountAgeEmbed(a: { name: string; id: string; created: string; days: number; url: string }): Embed {
  const years = Math.floor(a.days / 365), rem = a.days % 365, months = Math.floor(rem / 30);
  const parts = [years ? `${years}y` : "", months ? `${months}mo` : "", `${rem % 30}d`].filter(Boolean).join(" ");
  const cr = Math.floor(new Date(a.created).getTime() / 1000);
  return {
    title: clip(escapeMd(a.name), 240),
    url: a.url,
    color: TEAL,
    fields: [
      { name: "Account age", value: `${num(a.days)} days (${parts})`, inline: true },
      { name: "Created", value: Number.isNaN(cr) ? a.created : `<t:${cr}:D>`, inline: true },
      { name: "ID", value: `\`${a.id}\``, inline: true },
    ],
    footer: { text: "system98 · roblox" },
  };
}

const nameLink = (p: { id: string; name: string }) => `[${escapeMd(p.name)}](https://www.roblox.com/users/${p.id}/profile)`;

export function friendsEmbed(f: { name: string; id: string; count: number; sample: { id: string; name: string }[]; url: string }): Embed {
  return {
    title: clip(escapeMd(f.name), 240),
    url: f.url,
    description: f.sample.length ? "A few: " + f.sample.map(nameLink).join(", ") : undefined,
    color: TEAL,
    fields: [{ name: "Friends", value: num(f.count), inline: true }, { name: "ID", value: `\`${f.id}\``, inline: true }],
    footer: { text: "system98 · roblox" },
  };
}

export function userGroupsEmbed(g: { name: string; id: string; groups: { name: string; role: string; members?: number }[]; url: string }): Embed {
  const lines = g.groups.slice(0, 15).map((x) => `**${escapeMd(x.name)}** — ${escapeMd(x.role)}${x.members !== undefined ? ` (${num(x.members)})` : ""}`);
  const more = g.groups.length > 15 ? `\n…and ${g.groups.length - 15} more` : "";
  return {
    title: clip(escapeMd(g.name) + " · groups", 240),
    url: g.url,
    description: g.groups.length ? clip(lines.join("\n") + more, 3800) : "Not in any groups.",
    color: TEAL,
    footer: { text: `system98 · ${g.groups.length} groups` },
  };
}

export function groupEmbed(g: GroupInfo): Embed {
  const fields: Field[] = [];
  field(fields, "ID", `\`${g.id}\``);
  field(fields, "Members", num(g.members));
  field(fields, "Owner", g.owner ? escapeMd(g.owner) : "none");
  return {
    title: clip(escapeMd(g.name), 240) + (g.verified ? " ✔" : ""),
    url: g.url,
    description: g.description ? `*${clip(escapeMd(g.description), 400)}*` : undefined,
    color: TEAL,
    thumbnail: g.icon ? { url: g.icon } : undefined,
    fields,
    footer: { text: "system98 · roblox group" },
  };
}

export function assetEmbed(a: AssetInfo): Embed {
  const fields: Field[] = [];
  field(fields, "ID", `\`${a.id}\``);
  field(fields, "Type", a.type);
  field(fields, "Creator", escapeMd(a.creator));
  field(fields, "Price", a.priceRobux != null ? `${num(a.priceRobux)} R$` : a.forSale ? "free" : "not for sale");
  const cr = a.created ? Math.floor(new Date(a.created).getTime() / 1000) : NaN;
  field(fields, "Created", Number.isNaN(cr) ? null : `<t:${cr}:D>`);
  return {
    title: clip(escapeMd(a.name), 240),
    url: a.url,
    description: a.description ? `*${clip(escapeMd(a.description), 300)}*` : undefined,
    color: TEAL,
    thumbnail: a.icon ? { url: a.icon } : undefined,
    fields,
    footer: { text: "system98 · roblox asset" },
  };
}

export function gameEmbed(g: GameInfo): Embed {
  const fields: Field[] = [];
  field(fields, "Creator", escapeMd(g.creator));
  field(fields, "Playing", g.playing !== undefined ? num(g.playing) : null);
  field(fields, "Visits", g.visits !== undefined ? num(g.visits) : null);
  return { title: clip(escapeMd(g.name), 240), url: g.url, color: TEAL, fields, footer: { text: "system98 · roblox game" } };
}

export function gamepassEmbed(g: { id: string; name: string; priceRobux: number | null; icon?: string; url: string }): Embed {
  return {
    title: clip(escapeMd(g.name), 240),
    url: g.url,
    color: TEAL,
    thumbnail: g.icon ? { url: g.icon } : undefined,
    fields: [{ name: "ID", value: `\`${g.id}\``, inline: true }, { name: "Price", value: g.priceRobux != null ? `${num(g.priceRobux)} R$` : "off sale", inline: true }],
    footer: { text: "system98 · roblox gamepass" },
  };
}

export function bundleEmbed(b: { id: string; name: string; description: string; type: string; items: number; icon?: string; url: string }): Embed {
  const fields: Field[] = [];
  field(fields, "ID", `\`${b.id}\``);
  field(fields, "Type", b.type);
  field(fields, "Items", String(b.items));
  return {
    title: clip(escapeMd(b.name), 240),
    url: b.url,
    description: b.description ? `*${clip(escapeMd(b.description), 300)}*` : undefined,
    color: TEAL,
    thumbnail: b.icon ? { url: b.icon } : undefined,
    fields,
    footer: { text: "system98 · roblox bundle" },
  };
}

export function devexEmbed(d: { robux: number; usd: number; meetsMinimum: boolean }): Embed {
  return {
    title: `${num(d.robux)} Robux → $${d.usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    description: d.meetsMinimum
      ? "At Roblox's DevEx rate of $0.0035 per Robux."
      : `At $0.0035 per Robux. Note: DevEx needs at least ${num(30000)} Robux to cash out.`,
    color: TEAL,
    footer: { text: "system98 · devex estimate" },
  };
}

export function usernameEmbed(r: { username: string; validFormat: boolean; taken: boolean }): Embed {
  if (!r.validFormat) {
    return { description: `❌ \`${escapeMd(r.username)}\` isn't a valid Roblox username shape (3-20 chars, letters/numbers/one underscore, no leading/trailing/double underscore).`, color: RED };
  }
  return {
    description: r.taken
      ? `❌ \`${escapeMd(r.username)}\` is already taken.`
      : `✅ \`${escapeMd(r.username)}\` looks available (nobody currently owns it — Roblox may still reject it at signup for other reasons).`,
    color: r.taken ? RED : TEAL,
  };
}

export function wearingEmbed(w: { name: string; id: string; items: { id: string; name: string }[]; url: string }): Embed {
  return {
    title: `${escapeMd(w.name)} is currently wearing`,
    url: w.url,
    description: w.items.length ? w.items.map((i) => `• [${escapeMd(i.name)}](https://www.roblox.com/catalog/${i.id})`).join("\n").slice(0, 3900) : "Nothing equipped right now (or their avatar type doesn't use catalog items).",
    color: TEAL,
    footer: { text: `system98 · ${w.items.length} item${w.items.length === 1 ? "" : "s"}` },
  };
}

export function cryptoEmbed(symbol: string, r: { usd: number; change24h?: number }): Embed {
  const change = r.change24h !== undefined ? ` (${r.change24h >= 0 ? "+" : ""}${r.change24h.toFixed(2)}% 24h)` : "";
  return { description: `**${symbol}**: $${r.usd < 1 ? r.usd.toFixed(4) : num(r.usd)}${change}`, color: TEAL, footer: { text: "system98 · via CoinGecko" } };
}

const errorEmbed = (message: string): Embed => ({ description: message, color: RED });

const linkButtons = (buttons: { label: string; url: string }[]) => [
  { type: 1, components: buttons.map((b) => ({ type: 2, style: 5, label: b.label, url: b.url })) },
];

// ---------- handling an interaction ----------

export interface AttachmentInfo { url: string; filename: string; size: number; contentType?: string }
export interface BotFile { name: string; data: Buffer; contentType: string }

export interface BotDeps {
  siteUrl: string;
  lookupAudio: (input: string) => Promise<{ ok: true; audio: RobloxAudio } | { ok: false; error: string }>;
  lookupUser: (input: string) => Promise<{ ok: true; user: RobloxUser } | { ok: false; error: string }>;
  analyzeFile: (att: AttachmentInfo) => Promise<{ ok: true; analysis: Analysis; waveformPng: Buffer } | { ok: false; error: string }>;
  recognizeSong: (att: AttachmentInfo) => Promise<{ ok: true; song: RecognizedSong } | { ok: false; error: string }>;
  // extra Roblox lookups (all return a friendly error string on failure)
  avatar: (input: string, kind: AvatarKind) => Promise<{ ok: true; name: string; id: string; image: string; url: string } | { ok: false; error: string }>;
  accountAge: (input: string) => Promise<{ ok: true; name: string; id: string; created: string; days: number; url: string } | { ok: false; error: string }>;
  friends: (input: string) => Promise<{ ok: true; name: string; id: string; count: number; sample: { id: string; name: string }[]; all: { id: string; name: string; displayName: string; banned?: boolean }[]; url: string } | { ok: false; error: string }>;
  areFriends: (a: string, b: string) => Promise<{ ok: true; a: string; b: string; friends: boolean } | { ok: false; error: string }>;
  userGroups: (input: string) => Promise<{ ok: true; name: string; id: string; groups: { id: string; name: string; role: string; roleId: string; members?: number }[]; url: string } | { ok: false; error: string }>;
  group: (input: string) => Promise<{ ok: true; group: GroupInfo } | { ok: false; error: string }>;
  asset: (input: string) => Promise<{ ok: true; asset: AssetInfo } | { ok: false; error: string }>;
  game: (input: string) => Promise<{ ok: true; game: GameInfo } | { ok: false; error: string }>;
  gamepass: (input: string) => Promise<{ ok: true; id: string; name: string; priceRobux: number | null; icon?: string; url: string } | { ok: false; error: string }>;
  bundle: (input: string) => Promise<{ ok: true; id: string; name: string; description: string; type: string; items: number; icon?: string; url: string } | { ok: false; error: string }>;
  devex: (robux: number) => { ok: true; robux: number; usd: number; meetsMinimum: boolean } | { ok: false; error: string };
  qr: (text: string) => Promise<{ ok: true; png: Buffer } | { ok: false; error: string }>;
  // views for the /user dropdown (Runde 2)
  followers: (input: string) => Promise<{ ok: true; name: string; id: string; count: number; sample: { id: string; name: string }[]; all: { id: string; name: string; displayName: string }[]; url: string } | { ok: false; error: string }>;
  rolimons: (input: string) => Promise<{ ok: true; rap?: number; value?: number; limiteds?: number; premium?: boolean; lastScan?: number } | { ok: false; error: string }>;
  userGames: (input: string) => Promise<{ ok: true; name: string; id: string; games: UserGame[]; url: string } | { ok: false; error: string }>;
  /** one membership's full "Group Information / Role Information" detail, for the Groups page view */
  groupDetail: (groupId: string, roleName: string, roleId: string) => Promise<{ ok: true; detail: GroupDetail } | { ok: false; error: string }>;
  /** full avatar breakdown (body, items, colors, animations), for the Currently Wearing page view */
  avatarDetail: (input: string) => Promise<{ ok: true; detail: AvatarDetail } | { ok: false; error: string }>;
  prevNames: (input: string) => Promise<{ ok: true; name: string; id: string; names: string[]; url: string } | { ok: false; error: string }>;
  username: (input: string) => Promise<{ ok: true; result: { username: string; validFormat: boolean; taken: boolean } } | { ok: false; error: string }>;
  wearing: (input: string) => Promise<{ ok: true; name: string; id: string; items: { id: string; name: string }[]; url: string } | { ok: false; error: string }>;
  universe: (input: string) => Promise<{ ok: true; game: GameInfo } | { ok: false; error: string }>;
  cryptoPrice: (coingeckoId: string) => Promise<{ ok: true; usd: number; change24h?: number } | { ok: false; error: string }>;
  /** false = this Discord user is asking too often (new /commands) */
  allow: (discordUserId: string) => boolean;
  /** false = this Discord user is clicking dropdown/pagination too often (separate, higher limit — just browsing an already-open lookup) */
  allowComponent: (discordUserId: string) => boolean;
  /** edit the "thinking…" message that was sent as the first response, optionally attaching files */
  editOriginal: (applicationId: string, token: string, body: unknown, files?: BotFile[]) => Promise<void>;
}

interface DiscordAttachment { id: string; filename: string; size: number; url: string; content_type?: string }
interface DiscordResolvedUser { id: string; username: string; global_name?: string | null; discriminator?: string; avatar?: string | null; bot?: boolean }
interface DiscordResolvedMember { nick?: string | null; joined_at?: string }
interface Interaction {
  type: number;
  token?: string;
  application_id?: string;
  data?: {
    name?: string;
    options?: { name: string; value?: unknown }[];
    resolved?: { attachments?: Record<string, DiscordAttachment>; users?: Record<string, DiscordResolvedUser>; members?: Record<string, DiscordResolvedMember> };
    custom_id?: string;
    values?: string[];
  };
  member?: { user?: { id?: string } };
  user?: { id?: string };
}

// ---------- Discord user info (from the interaction's own resolved data, no extra API call) ----------

const DISCORD_EPOCH = 1_420_070_400_000n;

/** Discord user IDs are snowflakes: the first 42 bits are ms since Discord's epoch. */
function snowflakeCreatedAt(id: string): Date | null {
  try {
    const ms = (BigInt(id) >> 22n) + DISCORD_EPOCH;
    return new Date(Number(ms));
  } catch {
    return null;
  }
}

export function userInfoEmbed(u: DiscordResolvedUser, member?: DiscordResolvedMember): Embed {
  const fields: Field[] = [];
  field(fields, "ID", `\`${u.id}\``);
  field(fields, "Username", escapeMd(u.username) + (u.discriminator && u.discriminator !== "0" ? `#${u.discriminator}` : ""));
  if (member?.nick) field(fields, "Nickname", escapeMd(member.nick));
  field(fields, "Bot account", u.bot ? "Yes" : "No");
  const created = snowflakeCreatedAt(u.id);
  if (created) field(fields, "Account created", `<t:${Math.floor(created.getTime() / 1000)}:D>`);
  if (member?.joined_at) {
    const t = Date.parse(member.joined_at);
    if (!Number.isNaN(t)) field(fields, "Joined this server", `<t:${Math.floor(t / 1000)}:D>`);
  }
  const avatarUrl = u.avatar
    ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.${u.avatar.startsWith("a_") ? "gif" : "png"}?size=256`
    : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(u.id) % 5n)}.png`;
  return {
    title: u.global_name || u.username,
    description: u.global_name && u.global_name !== u.username ? `@${escapeMd(u.username)}` : undefined,
    color: TEAL,
    thumbnail: { url: avatarUrl },
    fields,
    footer: { text: "system98 · discord user lookup" },
  };
}

const NO_PINGS = { parse: [] as string[] };
const MESSAGES: Record<string, string> = {
  invalid: "That doesn't look right. Send an audio ID or link, or a Roblox username, ID or profile link.",
  notfound: "Roblox doesn't know that one.",
  notaudio: "That ID exists, but it isn't an audio.",
  busy: "Roblox is rate limiting me right now, try again in a minute.",
  unavailable: "Couldn't reach Roblox just now, try again in a moment.",
};

const ephemeral = (content: string) => ({ type: 4, data: { content, flags: 64, allowed_mentions: NO_PINGS } });

export interface Handled {
  /** what to answer within Discord's 3 second limit */
  response: unknown;
  /** work to finish afterwards (edits the deferred message) */
  after?: () => Promise<void>;
}

// ======================================================================
//  /user dropdown + pagination (Runde 2)
//  A click sends a type-3 interaction whose custom_id carries everything needed to re-render,
//  so no state has to be stored: "v2|<view>|<robloxUserId>|<page>".
// ======================================================================

type UserView = "profile" | "avatar" | "groups" | "games" | "wearing" | "prevnames" | "friends" | "followers" | "rolimons";
const USER_VIEWS: { id: UserView; label: string; emoji: string }[] = [
  { id: "profile", label: "User Profile", emoji: "👤" },
  { id: "avatar", label: "Avatar", emoji: "🧍" },
  { id: "groups", label: "Groups", emoji: "👥" },
  { id: "games", label: "Games", emoji: "🎮" },
  { id: "wearing", label: "Currently Wearing", emoji: "🧢" },
  { id: "prevnames", label: "Previous Usernames", emoji: "🕘" },
  { id: "friends", label: "Friends", emoji: "🫂" },
  { id: "followers", label: "Followers", emoji: "📣" },
  { id: "rolimons", label: "Rolimons", emoji: "💎" },
];
const PAGE_SIZE = 10;

function cid(view: UserView, robloxId: string, page: number): string {
  return ["v2", view, robloxId, String(page)].join("|");
}

/** Parse a component custom_id back into its parts. Returns null for anything that isn't ours. */
export function parseCid(raw: string): { view: UserView; robloxId: string; page: number } | null {
  const parts = raw.split("|");
  if (parts[0] !== "v2" || parts.length !== 4) return null;
  const view = parts[1] as UserView;
  if (!USER_VIEWS.some((v) => v.id === view)) return null;
  if (!/^\d{1,19}$/.test(parts[2])) return null;
  const page = Number(parts[3]);
  if (!Number.isInteger(page) || page < 0) return null;
  return { view, robloxId: parts[2], page };
}

/** The select menu (with the current view marked) plus optional prev/next buttons. */
function userComponents(view: UserView, robloxId: string, page: number, totalPages: number): unknown[] {
  const rows: unknown[] = [
    {
      type: 1,
      components: [
        {
          type: 3, // string select
          custom_id: cid(view, robloxId, 0),
          placeholder: "Pick a view…",
          options: USER_VIEWS.map((v) => ({ label: v.label, value: v.id, emoji: customEmojiOption(v.id, v.emoji), default: v.id === view })),
        },
      ],
    },
  ];
  if (totalPages > 1) {
    rows.push({
      type: 1,
      components: [
        { type: 2, style: 2, custom_id: cid(view, robloxId, page - 1), label: "◀ Prev", disabled: page <= 0 },
        { type: 2, style: 2, custom_id: `v2|noop|${robloxId}|0`, label: `Page ${page + 1}/${totalPages}`, disabled: true },
        { type: 2, style: 2, custom_id: cid(view, robloxId, page + 1), label: "Next ▶", disabled: page >= totalPages - 1 },
      ],
    });
  }
  return rows;
}

function paginate<T>(items: T[], page: number): { slice: T[]; page: number; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const p = Math.min(Math.max(0, page), totalPages - 1);
  return { slice: items.slice(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE), page: p, totalPages };
}

/** Renders one view of a Roblox user: returns the embed + how many pages that view has. */
async function renderUserView(deps: BotDeps, view: UserView, id: string, page: number): Promise<{ embed: Embed; totalPages: number; image?: string }> {
  switch (view) {
    case "avatar": {
      const r = await deps.avatar(id, "full");
      if (!r.ok) return { embed: errorEmbed(r.error), totalPages: 1 };
      return { embed: imageEmbed(`${r.name}'s avatar`, r.url, r.image), totalPages: 1 };
    }
    case "groups": {
      const r = await deps.userGroups(id);
      if (!r.ok) return { embed: errorEmbed(r.error), totalPages: 1 };
      if (!r.groups.length) {
        return { embed: { title: clip(escapeMd(r.name) + "'s Joined Groups (0)", 240), url: r.url, color: TEAL, description: "Not in any groups.", footer: { text: "system98" } }, totalPages: 1 };
      }
      // one group per page, like the "Group Information / Role Information" two-column card
      const totalPages = r.groups.length;
      const p = Math.min(Math.max(0, page), totalPages - 1);
      const g = r.groups[p];
      const d = await deps.groupDetail(g.id, g.role, g.roleId);
      if (!d.ok) {
        return { embed: { title: clip(escapeMd(r.name) + `'s Joined Groups (${r.groups.length})`, 240), color: RED, description: `Couldn't load **${escapeMd(g.name)}**: ${d.error}`, footer: { text: `system98 | Page ${p + 1}/${totalPages}` } }, totalPages };
      }
      const gd = d.detail;
      const groupInfoLines = [
        gd.owner ? `> **Owner**: [${escapeMd(gd.owner)}](https://www.roblox.com/users/${gd.ownerId ?? ""}/profile)` : `> **Owner**: none`,
        `> **Members**: ${num(gd.members)}`,
        gd.publicEntry !== undefined ? `> **Public**: ${gd.publicEntry ? "True" : "False"}` : null,
        `> **Group ID**: ${gd.id}`,
        gd.created ? `> **Created**: ${new Date(gd.created).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}` : null,
      ].filter(Boolean).join("\n");
      const roleInfoLines = [
        `> **Role**: ${escapeMd(gd.role)}`,
        gd.roleMembers !== undefined ? `> **Role Members**: ${num(gd.roleMembers)}` : null,
        gd.rolePosition !== undefined ? `> **Role Position**: ${gd.rolePosition}` : null,
        `> **Role ID**: ${gd.roleId}`,
        gd.totalRoles !== undefined ? `> **Roles**: ${gd.totalRoles}` : null,
      ].filter(Boolean).join("\n");
      const fields: Field[] = [
        { name: "Group Information", value: groupInfoLines, inline: true },
        { name: "Role Information", value: roleInfoLines, inline: true },
      ];
      return {
        embed: {
          title: clip(escapeMd(r.name) + `'s Joined Groups (${r.groups.length})`, 240) + (gd.verified ? " ✔" : ""),
          url: gd.url,
          color: TEAL,
          thumbnail: gd.icon ? { url: gd.icon } : undefined,
          fields,
          description: gd.description ? `**Description**\n${clip(escapeMd(gd.description), 900)}` : undefined,
          footer: { text: `system98 | Page ${p + 1}/${totalPages}` },
        },
        totalPages,
      };
    }
    case "games": {
      const r = await deps.userGames(id);
      if (!r.ok) return { embed: errorEmbed(r.error), totalPages: 1 };
      if (!r.games.length) {
        return { embed: { title: clip(escapeMd(r.name) + "'s Created Games (0)", 240), url: r.url, color: TEAL, description: "No public games.", footer: { text: "system98" } }, totalPages: 1 };
      }
      // one game per page, like the Avis layout: Game Information + Player Information side by side
      const totalPages = r.games.length;
      const p = Math.min(Math.max(0, page), totalPages - 1);
      const g = r.games[p];
      const created = unix(g.created);
      const updated = unix(g.updated);
      const gameInfo = [
        g.universeId ? `**Universe ID**: ${g.universeId}` : null,
        g.placeId ? `**Place ID**: ${g.placeId}` : null,
        created ? `**Created**: <t:${created}:d>` : null,
        updated ? `**Updated**: <t:${updated}:d>` : null,
        g.playable !== undefined ? `**Playable**: ${g.playable ? "True" : "False"}` : null,
      ].filter(Boolean).join("\n");
      const playerInfo = [
        g.active !== undefined ? `**Active**: ${num(g.active)}` : null,
        g.favorites !== undefined ? `**Favorites**: ${num(g.favorites)}` : null,
        g.visits !== undefined ? `**Visits**: ${num(g.visits)}` : null,
        g.likes !== undefined || g.dislikes !== undefined ? `**Likes/Dislikes**: ${num(g.likes ?? 0)}/${num(g.dislikes ?? 0)}` : null,
        g.maxPlayers !== undefined ? `**Server Size**: ${num(g.maxPlayers)}` : null,
      ].filter(Boolean).join("\n");
      const fields: Field[] = [];
      if (gameInfo) fields.push({ name: "Game Information", value: gameInfo, inline: true });
      if (playerInfo) fields.push({ name: "Player Information", value: playerInfo, inline: true });
      if (g.description) fields.push({ name: "Description", value: clip(escapeMd(g.description), 500), inline: false });
      return {
        embed: {
          author: { name: `${r.name}'s Created Games (${r.games.length})` },
          title: clip(escapeMd(g.name), 240),
          url: g.url,
          color: TEAL,
          thumbnail: g.thumbnail ? { url: g.thumbnail } : undefined,
          fields,
          footer: { text: `system98 | Page ${p + 1}/${totalPages}` },
        },
        totalPages,
      };
    }
    case "wearing": {
      const [r, profile] = await Promise.all([deps.avatarDetail(id), deps.lookupUser(id)]);
      if (!r.ok) return { embed: errorEmbed(r.error), totalPages: 1 };
      const d = r.detail;
      const fields: Field[] = [];
      const catalogUrl = (it: { id: string; name: string }) => `[${escapeMd(it.name)}](https://www.roblox.com/catalog/${it.id})`;
      const bodyLines = [
        d.bodyParts.length ? `**Body Parts**: ${d.bodyParts.map(catalogUrl).join(", ")}` : null,
        Object.keys(d.scales).length
          ? `**Scales**: ${Object.entries(d.scales).map(([k, v]) => `${k}: ${v}`).join(", ")}`
          : null,
      ].filter(Boolean).join("\n");
      if (bodyLines) fields.push({ name: "Body", value: clip(bodyLines, 1000), inline: false });
      if (d.items.length) fields.push({ name: "Items", value: clip(d.items.map(catalogUrl).join(", "), 1000), inline: false });
      if (d.colors.length) {
        for (const c of d.colors) {
          field(fields, c.part, [c.hex ? c.hex.toUpperCase() : null, c.brickColorId !== undefined ? `(${c.brickColorId})` : null].filter(Boolean).join(" "));
        }
      }
      const animLines = [
        `**Animation Type**: ${escapeMd(d.playerType)}`,
        d.emoteCount ? `**Emotes**: ${d.topEmote ? clip(escapeMd(d.topEmote), 40) : "—"} (${d.emoteCount})` : null,
        d.animations.length ? `**Animations**: ${d.animations.map(escapeMd).join(", ")}` : null,
      ].filter(Boolean).join("\n");
      fields.push({ name: "Animations", value: clip(animLines, 1000), inline: false });
      return {
        embed: {
          title: clip(escapeMd(d.name) + "'s Currently Wearing", 240),
          url: d.url,
          color: TEAL,
          thumbnail: profile.ok && profile.user.avatar ? { url: profile.user.avatar } : undefined,
          fields,
          footer: { text: "system98 · currently wearing" },
        },
        totalPages: 1,
      };
    }
    case "prevnames": {
      const r = await deps.prevNames(id);
      if (!r.ok) return { embed: errorEmbed(r.error), totalPages: 1 };
      const { slice, page: p, totalPages } = paginate(r.names, page);
      return { embed: { title: clip(escapeMd(r.name) + " · previous usernames", 240), url: r.url, color: TEAL, description: r.names.length ? slice.map((n) => `• ${escapeMd(n)}`).join("\n") : "No past usernames.", footer: { text: `system98 · ${r.names.length} names` } }, totalPages };
    }
    case "friends": {
      const [r, profile] = await Promise.all([deps.friends(id), deps.lookupUser(id)]);
      if (!r.ok) return { embed: errorEmbed(r.error), totalPages: 1 };
      const { slice, totalPages, page: p } = paginate(r.all, page);
      const lines = slice.map((f) => `${escapeMd(f.displayName)} (@${escapeMd(f.name)})` + (f.banned ? " **(BANNED)**" : ""));
      // count comes from a separate endpoint than the list; if it's >0 but the list came back empty,
      // that's Roblox briefly rate-limiting the list call, not an actually-empty list.
      const description = r.all.length ? lines.join("\n") : r.count > 0 ? "Couldn't load the list right now (Roblox is rate-limiting us) — try again in a moment." : "No friends found.";
      return {
        embed: {
          title: clip(`${escapeMd(r.name)}'s Friends (${num(r.count)})`, 240),
          url: r.url,
          color: TEAL,
          thumbnail: profile.ok && profile.user.avatar ? { url: profile.user.avatar } : undefined,
          description,
          footer: { text: `system98 | Page: ${p + 1}/${totalPages}` },
        },
        totalPages,
      };
    }
    case "followers": {
      const [r, profile] = await Promise.all([deps.followers(id), deps.lookupUser(id)]);
      if (!r.ok) return { embed: errorEmbed(r.error), totalPages: 1 };
      const { slice, totalPages, page: p } = paginate(r.all, page);
      const lines = slice.map((f) => escapeMd(f.name));
      const description = r.all.length ? lines.join("\n") : r.count > 0 ? "Couldn't load the list right now (Roblox is rate-limiting us) — try again in a moment." : "No followers found.";
      return {
        embed: {
          title: clip(`${escapeMd(r.name)}'s Followers (${num(r.count)})`, 240),
          url: r.url,
          color: TEAL,
          thumbnail: profile.ok && profile.user.avatar ? { url: profile.user.avatar } : undefined,
          description,
          footer: { text: `system98 | Page: ${p + 1}/${totalPages}` },
        },
        totalPages,
      };
    }
    case "rolimons": {
      const [profile, roli] = await Promise.all([deps.lookupUser(id), deps.rolimons(id)]);
      if (!profile.ok) return { embed: errorEmbed(profile.error), totalPages: 1 };
      if (!roli.ok) return { embed: errorEmbed(roli.error), totalPages: 1 };
      const u = profile.user;
      const roliUrl = `https://www.rolimons.com/player/${id}`;
      const fields: Field[] = [];
      field(fields, "RAP", roli.rap !== undefined ? `[${num(roli.rap)}](${roliUrl})` : "unknown");
      field(fields, "Value", roli.value !== undefined ? `[${num(roli.value)}](${roliUrl})` : "unknown");
      field(fields, "Limiteds", roli.limiteds !== undefined ? num(roli.limiteds) : "unknown");
      field(fields, "Private", u.inventoryPublic === undefined ? "unknown" : u.inventoryPublic ? "False" : "True");
      field(fields, "Last Scanned", roli.lastScan !== undefined ? `<t:${roli.lastScan}:D>` : "unknown");
      field(fields, "Premium", roli.premium === undefined ? "unknown" : roli.premium ? "True" : "False");
      return {
        embed: {
          title: clip(escapeMd(u.displayName), 240),
          url: roliUrl,
          color: TEAL,
          thumbnail: u.avatar ? { url: u.avatar } : undefined,
          fields,
          footer: { text: "system98 | Cached by rolimons.com" },
        },
        totalPages: 1,
      };
    }
    case "profile":
    default: {
      const r = await deps.lookupUser(id);
      if (!r.ok) return { embed: errorEmbed(r.error), totalPages: 1 };
      return { embed: userEmbed(r.user), totalPages: 1 };
    }
  }
}

/** Handle a click on the dropdown or a pagination button (interaction type 3). */
function handleComponent(body: Interaction, deps: BotDeps): Handled {
  const custom = body.data?.custom_id ?? "";
  const userId = body.member?.user?.id ?? body.user?.id ?? "unknown";
  // the picked value (for a select) overrides the view in the custom_id
  const picked = body.data?.values?.[0] as UserView | undefined;
  const parsed = parseCid(custom);
  if (!parsed) return { response: { type: 6 } }; // ignore anything not ours (deferred update, no change)
  if (!deps.allowComponent(userId)) return { response: { type: 6 } };

  const view = picked && USER_VIEWS.some((v) => v.id === picked) ? picked : parsed.view;
  const appId = body.application_id ?? "";
  const token = body.token ?? "";

  const finish = async () => {
    let payload: unknown;
    try {
      const { embed, totalPages } = await renderUserView(deps, view, parsed.robloxId, parsed.page);
      payload = { embeds: [embed], components: userComponents(view, parsed.robloxId, parsed.page, totalPages), allowed_mentions: NO_PINGS };
    } catch (err) {
      console.error("[discord] component render failed:", err);
      payload = { embeds: [errorEmbed(MESSAGES.unavailable)], allowed_mentions: NO_PINGS };
    }
    await deps.editOriginal(appId, token, payload);
  };
  // type 6 = "deferred update message": keep the existing message, then edit it in place
  return { response: { type: 6 }, after: finish };
}

export function handleInteraction(body: Interaction, deps: BotDeps): Handled {
  if (body.type === 1) return { response: { type: 1 } };            // Discord's "are you alive?" ping
  if (body.type === 3) return handleComponent(body, deps);           // dropdown / button click
  if (body.type !== 2 || !body.data?.name) return { response: ephemeral("I don't know what to do with that.") };

  const name = body.data.name;
  const userId = body.member?.user?.id ?? body.user?.id ?? "unknown";

  if (name === "help") {
    return {
      response: ephemeral(
        [
          "**system98 bot**",
          "`/audio id:<id or link>` creator, artist, favorites, length and upload date of a Roblox audio",
          "`/user user:<name, id or link>` public profile info of a Roblox account",
          "`/analyze file:` loudness, peak, duration, bitrate and a waveform",
          "`/shazam file:` identify the song (title, artist, album, links)",
          "**Roblox:** `/user` `/avatar` `/bust` `/headshot` `/accountage` `/friends` `/arefriends` `/usergroups` `/group` `/audio` `/assetid` `/asseticon` `/game` `/gamepass` `/bundle` `/devex` `/username` `/wearing` `/universe`",
          "`/qr text:` make a QR code",
          "`/userinfo user:` Discord account info",
          "`/xrp` current XRP price",
          "**Text:** `/textnato` `/textreverse` `/textzalgo`",
          `More tools (converters, status page …): ${deps.siteUrl}`,
        ].join("\n")
      ),
    };
  }
  const LOOKUP = new Set(["audio", "user", "avatar", "bust", "headshot", "accountage", "friends", "arefriends", "usergroups", "group", "assetid", "asseticon", "game", "gamepass", "bundle", "devex", "qr", "username", "wearing", "universe", "userinfo", "xrp", "textnato", "textreverse", "textzalgo"]);
  if (name !== "analyze" && name !== "shazam" && !LOOKUP.has(name)) return { response: ephemeral("Unknown command.") };
  if (!deps.allow(userId)) return { response: ephemeral("Easy, that's a lot of lookups in a minute. Try again shortly.") };

  const appId = body.application_id ?? "";
  const token = body.token ?? "";

  if (name === "analyze") {
    const attId = body.data.options?.[0]?.value;
    const att = typeof attId === "string" ? body.data.resolved?.attachments?.[attId] : undefined;
    if (!att) return { response: ephemeral("Couldn't find that attachment, try again.") };
    const finishAnalyze = async () => {
      let payload: unknown;
      let files: import("./discordBot").BotFile[] | undefined;
      try {
        const r = await deps.analyzeFile({ url: att.url, filename: att.filename, size: att.size, contentType: att.content_type });
        if (r.ok) {
          payload = { embeds: [{ ...analyzeEmbed(att.filename, r.analysis), image: { url: "attachment://waveform.png" } }] };
          files = [{ name: "waveform.png", data: r.waveformPng, contentType: "image/png" }];
        } else {
          payload = { embeds: [errorEmbed(r.error)] };
        }
      } catch (err) {
        console.error("[discord] analyze failed:", err);
        payload = { embeds: [errorEmbed("Something went wrong reading that file.")] };
      }
      await deps.editOriginal(appId, token, { ...(payload as object), allowed_mentions: NO_PINGS }, files);
    };
    return { response: { type: 5 }, after: finishAnalyze };
  }

  if (name === "shazam") {
    const attId = body.data.options?.[0]?.value;
    const att = typeof attId === "string" ? body.data.resolved?.attachments?.[attId] : undefined;
    if (!att) return { response: ephemeral("Couldn't find that attachment, try again.") };
    const finishShazam = async () => {
      let payload: unknown;
      try {
        const r = await deps.recognizeSong({ url: att.url, filename: att.filename, size: att.size, contentType: att.content_type });
        payload = r.ok
          ? { embeds: [songEmbed(r.song)], components: r.song.links.length ? linkButtons(r.song.links.slice(0, 5).map((l) => ({ label: l.name, url: l.url }))) : undefined }
          : { embeds: [errorEmbed(r.error)] };
      } catch (err) {
        console.error("[discord] shazam failed:", err);
        payload = { embeds: [errorEmbed("Something went wrong identifying that file.")] };
      }
      await deps.editOriginal(appId, token, { ...(payload as object), allowed_mentions: NO_PINGS });
    };
    return { response: { type: 5 }, after: finishShazam };
  }

  const optOf = (n: string) => body.data?.options?.find((o) => o.name === n)?.value;
  const str = (n: string) => String(optOf(n) ?? "").slice(0, 300).trim();

  // /devex and /qr don't hit Roblox and answer instantly
  if (name === "devex") {
    const r = deps.devex(Number(optOf("robux")));
    return { response: { type: 4, data: { embeds: [r.ok ? devexEmbed(r) : errorEmbed("Enter a Robux amount between 1 and 1,000,000,000.")], allowed_mentions: NO_PINGS } } };
  }
  if (name === "qr") {
    const text = str("text");
    if (!text) return { response: ephemeral("Give me some text or a link to turn into a QR code.") };
    const finishQr = async () => {
      const r = await deps.qr(text);
      const payload = r.ok
        ? { embeds: [{ title: "QR code", description: clip(escapeMd(text), 300), color: TEAL, image: { url: "attachment://qr.png" } }] }
        : { embeds: [errorEmbed(r.error)] };
      await deps.editOriginal(appId, token, { ...payload, allowed_mentions: NO_PINGS }, r.ok ? [{ name: "qr.png", data: r.png, contentType: "image/png" }] : undefined);
    };
    return { response: { type: 5 }, after: finishQr };
  }
  if (name === "arefriends") {
    const a = str("user1"), b = str("user2");
    if (!a || !b) return { response: ephemeral("Give me two users to compare.") };
    const finishAf = async () => {
      const r = await deps.areFriends(a, b);
      const payload = r.ok
        ? { embeds: [{ description: r.friends ? `✅ **${escapeMd(r.a)}** and **${escapeMd(r.b)}** are friends.` : `❌ **${escapeMd(r.a)}** and **${escapeMd(r.b)}** are not friends.`, color: r.friends ? TEAL : RED }] }
        : { embeds: [errorEmbed(r.error)] };
      await deps.editOriginal(appId, token, { ...payload, allowed_mentions: NO_PINGS });
    };
    return { response: { type: 5 }, after: finishAf };
  }

  if (name === "userinfo") {
    const uid = optOf("user");
    const resolved = typeof uid === "string" ? body.data.resolved?.users?.[uid] : undefined;
    if (!resolved) return { response: ephemeral("Couldn't find that user, try mentioning them again.") };
    const member = typeof uid === "string" ? body.data.resolved?.members?.[uid] : undefined;
    return { response: { type: 4, data: { embeds: [userInfoEmbed(resolved, member)], allowed_mentions: NO_PINGS } } };
  }
  if (name === "textnato" || name === "textreverse" || name === "textzalgo") {
    const text = str("text");
    if (!text) return { response: ephemeral("Give me some text.") };
    const out = name === "textnato" ? toNato(text) : name === "textreverse" ? reverseText(text) : toZalgo(text, Number(optOf("intensity")) || 4);
    return { response: { type: 4, data: { content: clip(out, 1900), allowed_mentions: NO_PINGS } } };
  }
  if (name === "xrp") {
    const finishXrp = async () => {
      const r = await deps.cryptoPrice("ripple");
      const payload = r.ok ? { embeds: [cryptoEmbed("XRP", r)] } : { embeds: [errorEmbed(MESSAGES.unavailable)] };
      await deps.editOriginal(appId, token, { ...payload, allowed_mentions: NO_PINGS });
    };
    return { response: { type: 5 }, after: finishXrp };
  }

  // everything else takes a single argument
  const ARG: Record<string, string> = { audio: "id", user: "user", avatar: "user", bust: "user", headshot: "user", accountage: "user", friends: "user", usergroups: "user", group: "group", assetid: "asset", asseticon: "asset", game: "name", gamepass: "id", bundle: "id", username: "username", wearing: "user", universe: "id" };
  const value = str(ARG[name] ?? "");
  if (!value) return { response: ephemeral(MESSAGES.invalid) };

  const finish = async () => {
    let payload: unknown;
    try {
      switch (name) {
        case "audio": {
          const r = await deps.lookupAudio(value);
          payload = r.ok
            ? { embeds: [audioEmbed(r.audio)], components: linkButtons([{ label: "Open on Roblox", url: r.audio.url }, { label: "Analyze on system98", url: `${deps.siteUrl}/roblox-audio?id=${r.audio.id}` }]) }
            : { embeds: [errorEmbed(MESSAGES[r.error] ?? MESSAGES.unavailable)] };
          break;
        }
        case "user": {
          const r = await deps.lookupUser(value);
          payload = r.ok
            ? { embeds: [userEmbed(r.user)], components: userComponents("profile", r.user.id, 0, 1) }
            : { embeds: [errorEmbed(MESSAGES[r.error] ?? MESSAGES.unavailable)] };
          break;
        }
        case "avatar":
        case "bust":
        case "headshot": {
          const kind = name === "avatar" ? "full" : name === "bust" ? "bust" : "headshot";
          const r = await deps.avatar(value, kind);
          payload = r.ok
            ? { embeds: [imageEmbed(`${r.name}'s ${name}`, r.url, r.image)] }
            : { embeds: [errorEmbed(r.error)] };
          break;
        }
        case "accountage": {
          const r = await deps.accountAge(value);
          payload = { embeds: [r.ok ? accountAgeEmbed(r) : errorEmbed(r.error)] };
          break;
        }
        case "friends": {
          const r = await deps.friends(value);
          payload = { embeds: [r.ok ? friendsEmbed(r) : errorEmbed(r.error)] };
          break;
        }
        case "usergroups": {
          const r = await deps.userGroups(value);
          payload = { embeds: [r.ok ? userGroupsEmbed(r) : errorEmbed(r.error)] };
          break;
        }
        case "group": {
          const r = await deps.group(value);
          payload = r.ok ? { embeds: [groupEmbed(r.group)], components: linkButtons([{ label: "Open group", url: r.group.url }]) } : { embeds: [errorEmbed(r.error)] };
          break;
        }
        case "assetid": {
          const r = await deps.asset(value);
          payload = r.ok ? { embeds: [assetEmbed(r.asset)], components: linkButtons([{ label: "Open on Roblox", url: r.asset.url }]) } : { embeds: [errorEmbed(r.error)] };
          break;
        }
        case "asseticon": {
          const r = await deps.asset(value);
          payload = r.ok
            ? r.asset.icon
              ? { embeds: [imageEmbed(r.asset.name, r.asset.url, r.asset.icon)] }
              : { embeds: [errorEmbed("That asset has no icon.")] }
            : { embeds: [errorEmbed(r.error)] };
          break;
        }
        case "game": {
          const r = await deps.game(value);
          payload = r.ok ? { embeds: [gameEmbed(r.game)], components: linkButtons([{ label: "Open game", url: r.game.url }]) } : { embeds: [errorEmbed(r.error)] };
          break;
        }
        case "gamepass": {
          const r = await deps.gamepass(value);
          payload = r.ok ? { embeds: [gamepassEmbed(r)], components: linkButtons([{ label: "Open gamepass", url: r.url }]) } : { embeds: [errorEmbed(r.error)] };
          break;
        }
        case "bundle": {
          const r = await deps.bundle(value);
          payload = r.ok ? { embeds: [bundleEmbed(r)], components: linkButtons([{ label: "Open bundle", url: r.url }]) } : { embeds: [errorEmbed(r.error)] };
          break;
        }
        case "username": {
          const r = await deps.username(value);
          payload = r.ok ? { embeds: [usernameEmbed(r.result)] } : { embeds: [errorEmbed(MESSAGES[r.error] ?? MESSAGES.unavailable)] };
          break;
        }
        case "wearing": {
          const r = await deps.wearing(value);
          payload = r.ok ? { embeds: [wearingEmbed(r)], components: linkButtons([{ label: "Open profile", url: r.url }]) } : { embeds: [errorEmbed(MESSAGES[r.error] ?? MESSAGES.unavailable)] };
          break;
        }
        case "universe": {
          const r = await deps.universe(value);
          payload = r.ok ? { embeds: [gameEmbed(r.game)], components: linkButtons([{ label: "Open game", url: r.game.url }]) } : { embeds: [errorEmbed(MESSAGES[r.error] ?? MESSAGES.unavailable)] };
          break;
        }
        default:
          payload = { embeds: [errorEmbed("Unknown command.")] };
      }
    } catch (err) {
      console.error("[discord] lookup failed:", err);
      payload = { embeds: [errorEmbed(MESSAGES.unavailable)] };
    }
    await deps.editOriginal(appId, token, { ...(payload as object), allowed_mentions: NO_PINGS });
  };

  // "thinking…" now, the real answer follows as an edit (Roblox can take a moment)
  return { response: { type: 5 }, after: finish };
}
