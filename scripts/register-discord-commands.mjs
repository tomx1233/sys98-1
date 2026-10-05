// Registers the slash commands (/audio, /user, /help) with Discord. Run it once, and again whenever lib/discordCommands.json changes:
//   npm run discord:register
// Needs DISCORD_APP_ID and DISCORD_BOT_TOKEN in .env.local. Set DISCORD_GUILD_ID as well to register for one server only (shows up instantly, good for testing).
import { config } from "dotenv";
import { readFileSync } from "node:fs";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const { DISCORD_APP_ID, DISCORD_BOT_TOKEN, DISCORD_GUILD_ID } = process.env;
if (!DISCORD_APP_ID || !DISCORD_BOT_TOKEN) {
  console.error("Missing DISCORD_APP_ID or DISCORD_BOT_TOKEN (see .env.example).");
  process.exit(1);
}

const commands = JSON.parse(readFileSync(new URL("../lib/discordCommands.json", import.meta.url), "utf8"));
const base = `https://discord.com/api/v10/applications/${DISCORD_APP_ID}`;
const url = DISCORD_GUILD_ID ? `${base}/guilds/${DISCORD_GUILD_ID}/commands` : `${base}/commands`;

const res = await fetch(url, {
  method: "PUT", // replaces the whole list, so removed commands disappear too
  headers: { "Content-Type": "application/json", Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
  body: JSON.stringify(commands),
});
const text = await res.text();
if (!res.ok) {
  console.error(`Discord said ${res.status}:`, text);
  process.exit(1);
}
console.log(`Registered ${JSON.parse(text).length} commands ${DISCORD_GUILD_ID ? `for server ${DISCORD_GUILD_ID}` : "globally (can take a few minutes to show up)"}: ${commands.map((c) => "/" + c.name).join(", ")}`);
