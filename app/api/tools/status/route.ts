import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { probe } from "@/lib/siteCheck";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export const maxDuration = 20;

// Public tool: "is this website up?" (see lib/siteCheck.ts for the safety rules)
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limit = rateLimit(`status:${ip}`, 20, 60 * 1000); // 20 checks/min per visitor
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Slow down a little, try again in a moment." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = z.object({ url: z.string().max(300) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Enter a website first." }, { status: 400 });

  // don't let the tool be used to hammer somebody else's site
  let hostKey = parsed.data.url.toLowerCase().replace(/^[a-z]+:\/\//, "").split(/[/?#]/)[0];
  hostKey = hostKey.slice(0, 120);
  if (!rateLimit(`status-host:${hostKey}`, 15, 60 * 1000).allowed) {
    return NextResponse.json({ ok: false, error: "That site was checked a lot in the last minute, wait a bit." }, { status: 429 });
  }

  const result = await probe(parsed.data.url);
  return NextResponse.json(result, {
    status: result.ok ? 200 : 400,
    headers: { "Cache-Control": "no-store" },
  });
}
