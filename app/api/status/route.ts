import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSystemStatus } from "@/lib/systemStatus";

export const maxDuration = 20;

/**
 * Machine-readable version of the /status page, for uptime monitors (UptimeRobot, Better Stack …).
 * Answers 503 when something is down, 200 otherwise.
 */
export async function GET() {
  const status = await getSystemStatus();
  let activeIncidents: { title: string; severity: string; status: string }[] = [];
  try {
    activeIncidents = await prisma.incident.findMany({
      where: { status: { not: "resolved" } },
      select: { title: true, severity: true, status: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
  } catch {
    /* the database check already reports that */
  }
  return NextResponse.json(
    { ...status, activeIncidents },
    { status: status.overall === "down" ? 503 : 200, headers: { "Cache-Control": "no-store" } }
  );
}
