import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { limited, parseBody, requireStaffApi } from "@/lib/api";
import { incidentCreateSchema } from "@/lib/validations";
import { audit } from "@/lib/audit";

// Any staff member can post an incident to the public status page.
export async function POST(req: NextRequest) {
  const { staff, error } = await requireStaffApi();
  if (error) return error;
  const blocked = limited(`incident:${staff.id}`, 20, 10 * 60 * 1000);
  if (blocked) return blocked;

  const { data, error: bad } = await parseBody(req, incidentCreateSchema);
  if (bad) return bad;

  const incident = await prisma.incident.create({
    data: {
      title: data.title,
      severity: data.severity,
      status: "investigating",
      createdById: staff.id,
      updates: { create: { status: "investigating", body: data.body, staffId: staff.id } },
    },
  });
  await audit({ staffId: staff.id, action: "incident_create", targetType: "incident", targetId: incident.id, metadata: { title: data.title, severity: data.severity } });
  return NextResponse.json({ id: incident.id });
}
