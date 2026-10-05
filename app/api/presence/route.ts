import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rateLimit";

const ONLINE_WINDOW_MS = 70_000; // a page counts as "online" if it pinged in the last 70 s (pings come every 45 s)
const KEEP_MS = 10 * 60_000;

// Heartbeat for the "N online" counter in the footer. Stores nothing but a random per-tab id.
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  // generous, so offices / schools sharing one IP still work; stops one client from faking a crowd
  if (!rateLimit(`presence:${ip}`, 30, 60_000).allowed) {
    return NextResponse.json({ online: null }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!/^[A-Za-z0-9-]{12,64}$/.test(id)) {
    return NextResponse.json({ online: null }, { status: 400 });
  }

  try {
    const now = Date.now();
    await prisma.presence.upsert({
      where: { id },
      create: { id, lastSeen: new Date(now) },
      update: { lastSeen: new Date(now) },
    });
    // housekeeping now and then instead of a cron job
    if (Math.random() < 0.05) {
      await prisma.presence.deleteMany({ where: { lastSeen: { lt: new Date(now - KEEP_MS) } } });
    }
    const online = await prisma.presence.count({ where: { lastSeen: { gt: new Date(now - ONLINE_WINDOW_MS) } } });
    return NextResponse.json({ online }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[presence]", err);
    return NextResponse.json({ online: null }, { status: 503 });
  }
}
