import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, requireOwnerApi } from "@/lib/api";
import { audit } from "@/lib/audit";

// Owners can delete an incident (typo, test post …).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { staff, error } = await requireOwnerApi();
  if (error) return error;

  const incident = await prisma.incident.findUnique({ where: { id } });
  if (!incident) return fail("Not found", 404);
  await prisma.incident.delete({ where: { id } });
  await audit({ staffId: staff.id, action: "incident_delete", targetType: "incident", targetId: id, metadata: { title: incident.title } });
  return NextResponse.json({ ok: true });
}
