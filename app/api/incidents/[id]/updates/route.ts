import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, limited, parseBody, requireStaffApi } from "@/lib/api";
import { incidentUpdateSchema } from "@/lib/validations";
import { audit } from "@/lib/audit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { staff, error } = await requireStaffApi();
  if (error) return error;
  const blocked = limited(`incident-update:${staff.id}`, 40, 10 * 60 * 1000);
  if (blocked) return blocked;

  const { data, error: bad } = await parseBody(req, incidentUpdateSchema);
  if (bad) return bad;

  const incident = await prisma.incident.findUnique({ where: { id } });
  if (!incident) return fail("Not found", 404);

  await prisma.$transaction([
    prisma.incidentUpdate.create({ data: { incidentId: id, status: data.status, body: data.body, staffId: staff.id } }),
    prisma.incident.update({
      where: { id },
      data: { status: data.status, resolvedAt: data.status === "resolved" ? new Date() : null },
    }),
  ]);
  await audit({ staffId: staff.id, action: "incident_update", targetType: "incident", targetId: id, metadata: { status: data.status } });
  return NextResponse.json({ ok: true });
}
