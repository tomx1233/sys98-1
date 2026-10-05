// One-off: deletes EVERY application emoji on your Discord app, then clears lib/discordEmojis.json
// so `npm run discord:emojis` uploads them all fresh. Needs DISCORD_APP_ID + DISCORD_BOT_TOKEN in .env.local.
// Run:  node wipe.mjs      (from your project folder, where package.json is)
import { config } from "dotenv";
import { writeFileSync, existsSync } from "node:fs";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const { DISCORD_APP_ID, DISCORD_BOT_TOKEN } = process.env;
if (!DISCORD_APP_ID || !DISCORD_BOT_TOKEN) {
  console.error("Missing DISCORD_APP_ID or DISCORD_BOT_TOKEN in .env.local");
  process.exit(1);
}

const API = `https://discord.com/api/v10/applications/${DISCORD_APP_ID}/emojis`;
const H = { "Content-Type": "application/json", Authorization: `Bot ${DISCORD_BOT_TOKEN}` };

const res = await fetch(API, { headers: H });
if (!res.ok) {
  console.error(`Couldn't list emojis (Discord said ${res.status}). Check your app id / token.`);
  process.exit(1);
}
const body = await res.json();
const items = Array.isArray(body.items) ? body.items : Array.isArray(body) ? body : [];
console.log(`Deleting ${items.length} emoji(s)…`);

for (const e of items) {
  let r = await fetch(`${API}/${e.id}`, { method: "DELETE", headers: H });
  while (r.status === 429) {
    const b = await r.json().catch(() => ({}));
    const wait = Math.ceil((b.retry_after ?? 2) * 1000);
    console.log(`  rate limited, waiting ${wait}ms…`);
    await new Promise((s) => setTimeout(s, wait));
    r = await fetch(`${API}/${e.id}`, { method: "DELETE", headers: H });
  }
  console.log(r.ok ? `  deleted ${e.name}` : `  FAILED ${e.name} (${r.status})`);
  await new Promise((s) => setTimeout(s, 300));
}

// clear the id file so everything re-uploads on the next `npm run discord:emojis`
if (existsSync("lib/discordEmojis.json")) {
  writeFileSync("lib/discordEmojis.json", JSON.stringify({ views: {}, badges: {} }, null, 2) + "\n");
  console.log("Cleared lib/discordEmojis.json.");
}
console.log("Done. Now run:  npm run discord:emojis");
