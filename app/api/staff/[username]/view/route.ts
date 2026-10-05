import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const name = username.toLowerCase();
  // one count per visitor per profile per hour is plenty
  if (!rateLimit(`view:${clientIp(req)}:${name}`, 1, 60 * 60 * 1000).allowed) {
    return NextResponse.json({ ok: true });
  }
  await prisma.staffProfile.updateMany({
    where: { isPublic: true, staff: { username: name, disabled: false } },
    data: { viewCount: { increment: 1 } },
  });
  return NextResponse.json({ ok: true });
}
