import { NextRequest, NextResponse } from "next/server";
import * as RX from "@/lib/robloxExtra";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { robloxGetJson as getJson } from "@/lib/robloxHttp";

export const maxDuration = 20;

const MESSAGES: Record<string, string> = {
  invalid: "Enter two different Roblox users (username, ID or profile link).",
  notfound: "Roblox doesn't know one of those accounts.",
  busy: "Roblox is rate limiting us right now, try again in a minute.",
  unavailable: "Couldn't reach Roblox just now, try again in a moment.",
};
const STATUS: Record<string, number> = { invalid: 400, notfound: 404, busy: 429, unavailable: 502 };

export async function GET(req: NextRequest) {
  const limit = rateLimit(`roblox-arefriends:${clientIp(req)}`, 15, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Slow down a little, try again in a moment." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  }

  const a = (req.nextUrl.searchParams.get("a") ?? "").trim().slice(0, 300);
  const b = (req.nextUrl.searchParams.get("b") ?? "").trim().slice(0, 300);
  if (!a || !b) return NextResponse.json({ ok: false, error: MESSAGES.invalid }, { status: 400 });

  const result = await RX.areFriends(a, b, getJson);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: MESSAGES[result.error] ?? MESSAGES.unavailable }, { status: STATUS[result.error] ?? 502 });
  }
  return NextResponse.json({ ok: true, a: result.a, b: result.b, friends: result.friends });
}
