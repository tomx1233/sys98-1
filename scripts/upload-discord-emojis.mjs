// Uploads custom icons as Discord "application emojis" so the bot can show them instead of
// plain unicode emoji / text, then writes the resulting ids into lib/discordEmojis.json.
//
// Three sources of icons, all handled by this one script:
//  1. The 9 dropdown-view icons in public/discord-emojis/*.svg (always re-checked).
//  2. Any badge images YOU drop into public/discord-emojis/badges/, named after the badge
//     (e.g. "Administrator.png"). Simplest option if you already have the images.
//  3. Real Roblox account-badge icons fetched live from Roblox accounts you point the script
//     at, since Roblox doesn't publish a fixed badge list anywhere. Pass one or more Roblox
//     user ids as arguments; a few accounts with old/varied badges covers most of them.
//
// Usage (needs DISCORD_APP_ID + DISCORD_BOT_TOKEN in .env.local, see .env.example):
//   npm run discord:emojis                 -> view icons + anything dropped in badges/
//   npm run discord:emojis 1 156 261       -> same, plus badges pulled from these Roblox ids
//
// Safe to re-run: anything already present in lib/discordEmojis.json is skipped.
import { config } from "dotenv";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const { DISCORD_APP_ID, DISCORD_BOT_TOKEN } = process.env;
if (!DISCORD_APP_ID || !DISCORD_BOT_TOKEN) {
  console.error("Missing DISCORD_APP_ID or DISCORD_BOT_TOKEN (see .env.example).");
  process.exit(1);
}

const root = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const configPath = path.join(root, "lib/discordEmojis.json");
const iconsDir = path.join(root, "public/discord-emojis");

/** @type {{ views: Record<string,string>, badges: Record<string,string> }} */
const state = JSON.parse(readFileSync(configPath, "utf8"));
state.views ??= {};
state.badges ??= {};

const API = `https://discord.com/api/v10/applications/${DISCORD_APP_ID}/emojis`;
const HEADERS = { "Content-Type": "application/json", Authorization: `Bot ${DISCORD_BOT_TOKEN}` };

// Discord app-emoji names: 2-32 chars, letters/numbers/underscore only.
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 32) || "icon";

async function uploadEmoji(name, dataUri) {
  const res = await fetch(API, { method: "POST", headers: HEADERS, body: JSON.stringify({ name, image: dataUri }) });
  if (res.status === 429) {
    const body = await res.json().catch(() => ({}));
    const wait = Math.ceil((body.retry_after ?? 2) * 1000);
    console.log(`  rate limited, waiting ${wait}ms…`);
    await new Promise((r) => setTimeout(r, wait));
    return uploadEmoji(name, dataUri);
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`Discord said ${res.status}: ${text}`);
  return JSON.parse(text).id;
}

async function sleep(ms) { await new Promise((r) => setTimeout(r, ms)); }

async function uploadImageFile(name, filePath) {
  const buf = readFileSync(filePath);
  const png = await sharp(buf).resize(128, 128, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return uploadEmoji(name, `data:image/png;base64,${png.toString("base64")}`);
}

// ---------- 1. the 9 dropdown-view icons ----------

console.log("Uploading view icons…");
const svgFiles = readdirSync(iconsDir).filter((f) => f.endsWith(".svg"));
for (const file of svgFiles) {
  const view = path.basename(file, ".svg").replace(/^view_/, "");
  const emojiName = `view_${slug(view)}`;
  if (state.views[view]) {
    console.log(`  view_${view}: already uploaded, skipping`);
    continue;
  }
  const svg = readFileSync(path.join(iconsDir, file));
  const png = await sharp(svg).resize(128, 128).png().toBuffer();
  const dataUri = `data:image/png;base64,${png.toString("base64")}`;
  try {
    const id = await uploadEmoji(emojiName, dataUri);
    state.views[view] = id;
    console.log(`  view_${view}: uploaded (${id})`);
  } catch (err) {
    console.error(`  view_${view}: FAILED — ${err.message}`);
  }
  writeFileSync(configPath, JSON.stringify(state, null, 2));
  await sleep(400);
}

// ---------- 2. badge images dropped locally into public/discord-emojis/badges/ ----------

const badgesDir = path.join(iconsDir, "badges");
const localBadgeFiles = readdirSync(badgesDir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
if (localBadgeFiles.length) {
  console.log(`\nFound ${localBadgeFiles.length} local badge image(s) in public/discord-emojis/badges/`);
  for (const file of localBadgeFiles) {
    const name = path.basename(file).replace(/\.(png|jpe?g|webp)$/i, "");
    if (state.badges[name]) {
      console.log(`  ${name}: already uploaded, skipping`);
      continue;
    }
    try {
      const id = await uploadImageFile(`badge_${slug(name)}`, path.join(badgesDir, file));
      state.badges[name] = id;
      console.log(`  ${name}: uploaded (${id})`);
    } catch (err) {
      console.error(`  ${name}: FAILED — ${err.message}`);
    }
    writeFileSync(configPath, JSON.stringify(state, null, 2));
    await sleep(400);
  }
} else {
  console.log("\nNo local badge images in public/discord-emojis/badges/ — drop PNGs named after the badge there, or use Roblox ids below.");
}

// ---------- 3. Roblox account-badge icons, discovered from the Roblox ids passed as arguments ----------

const robloxIds = process.argv.slice(2).filter((a) => /^\d{1,19}$/.test(a));
if (!robloxIds.length) {
  console.log("\nNo Roblox ids given, so badge icons weren't touched.");
  console.log("Run e.g. `npm run discord:emojis 1 156 261` with a few Roblox ids to pull badge icons from those accounts.");
} else {
  console.log(`\nLooking up Roblox badges for: ${robloxIds.join(", ")}`);
  const seen = new Map(); // name -> imageUrl
  for (const id of robloxIds) {
    try {
      const res = await fetch(`https://accountinformation.roblox.com/v1/users/${id}/roblox-badges`);
      if (!res.ok) { console.log(`  ${id}: Roblox said ${res.status}, skipping`); continue; }
      const badges = await res.json();
      for (const b of badges) {
        if (b?.name && b?.imageUrl && !seen.has(b.name)) seen.set(b.name, b.imageUrl);
      }
      console.log(`  ${id}: ${badges.length} badge(s)`);
    } catch (err) {
      console.error(`  ${id}: FAILED — ${err.message}`);
    }
  }

  console.log(`\nFound ${seen.size} distinct badge type(s) across those accounts. Uploading new ones…`);
  for (const [name, imageUrl] of seen) {
    if (state.badges[name]) {
      console.log(`  ${name}: already uploaded, skipping`);
      continue;
    }
    try {
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) throw new Error(`couldn't download icon (${imgRes.status})`);
      const buf = Buffer.from(await imgRes.arrayBuffer());
      const png = await sharp(buf).resize(128, 128, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
      const dataUri = `data:image/png;base64,${png.toString("base64")}`;
      const id = await uploadEmoji(`badge_${slug(name)}`, dataUri);
      state.badges[name] = id;
      console.log(`  ${name}: uploaded (${id})`);
    } catch (err) {
      console.error(`  ${name}: FAILED — ${err.message}`);
    }
    writeFileSync(configPath, JSON.stringify(state, null, 2));
    await sleep(400);
  }
}

console.log(`\nSaved to ${path.relative(root, configPath)}. Redeploy for the bot to pick up the new icons.`);
