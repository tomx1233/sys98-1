import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Custom install link for the bot, served from our own domain so the portal never has to change.
 * Point the Developer Portal's "Install Link > Custom URL" (General Information) at
 * https://system98.org/discord/invite
 *
 * Discord has two separate install flows and they need different OAuth URLs:
 *   - Guild install  (add to a server)      → scope "bot applications.commands" + permissions
 *   - User install   (add to your account)  → scope "applications.commands", integration_type=1, NO permissions/guild fields
 * The old link only built the guild version, which is why "add to your account" was missing.
 *
 * /discord/invite            → a tiny page letting the person pick server or account
 * /discord/invite?type=guild → straight to the server-install OAuth URL
 * /discord/invite?type=user  → straight to the user-install OAuth URL
 */

function guildUrl(clientId: string): string {
  // Send Messages, Embed Links, Attach Files, Read Message History. Change via DISCORD_INVITE_PERMISSIONS.
  const permissions = process.env.DISCORD_INVITE_PERMISSIONS || "117760";
  const params = new URLSearchParams({ client_id: clientId, permissions, scope: "bot applications.commands", integration_type: "0" });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

function userUrl(clientId: string): string {
  // User install: no permissions, no bot scope — just the slash commands on the person's account.
  const params = new URLSearchParams({ client_id: clientId, scope: "applications.commands", integration_type: "1" });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

function chooserPage(clientId: string): string {
  const guild = guildUrl(clientId).replace(/&/g, "&amp;");
  const user = userUrl(clientId).replace(/&/g, "&amp;");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Add the system98 bot</title>
<link rel="stylesheet" href="/system98.css">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fira+Sans:wght@400;500;700&family=Fira+Mono:wght@400;500&display=swap" rel="stylesheet">
<script>try{var t=localStorage.getItem('s98-theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
</head><body class="booted">
<main class="wrap stack" style="max-width:560px;margin:0 auto;padding-top:12vh;">
<section class="win boot"><div class="titlebar"><span class="dots"><i></i><i></i><i></i></span><span class="title">add-bot.sh</span></div>
<div class="win-body-wrap"><div class="win-body-inner">
<div class="page-hero" style="padding:28px 32px 8px;">
  <span class="eyebrow">discord</span>
  <h1>Add the system98 bot</h1>
  <p class="lead-sm">Pick where you want the commands. On your account they work everywhere, even in DMs; on a server everyone there can use them.</p>
</div>
<div class="sec" style="display:flex;flex-direction:column;gap:12px;">
  <a class="btn btn-fill" href="${user}">Add to my account</a>
  <a class="btn btn-line" href="${guild}">Add to a server</a>
</div>
</div></div></section></main></body></html>`;
}

export async function GET(req: NextRequest) {
  const clientId = process.env.DISCORD_APP_ID;
  if (!clientId) return NextResponse.json({ error: "DISCORD_APP_ID is not set" }, { status: 500 });

  const type = req.nextUrl.searchParams.get("type");
  if (type === "user") return NextResponse.redirect(userUrl(clientId), 302);
  if (type === "guild" || type === "server") return NextResponse.redirect(guildUrl(clientId), 302);

  // no type given → show the little chooser (so the one custom link offers both installs)
  return new NextResponse(chooserPage(clientId), { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
