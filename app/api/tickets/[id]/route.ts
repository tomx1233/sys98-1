import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, parseBody, requireStaffApi } from "@/lib/api";
import { statusSchema } from "@/lib/validations";
import { audit } from "@/lib/audit";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { staff, error } = await requireStaffApi();
  if (error) return error;

  const { data, error: bad } = await parseBody(req, statusSchema);
  if (bad) return bad;

  const existing = await prisma.supportTicket.findUnique({ where: { id }, select: { status: true } });
  if (!existing) return fail("Not found", 404);

  await prisma.supportTicket.update({ where: { id }, data: { status: data.status } });
  await audit({
    staffId: staff.id,
    action: "ticket_status",
    targetType: "ticket",
    targetId: id,
    metadata: { from: existing.status, to: data.status },
  });
  return NextResponse.json({ ok: true });
}
