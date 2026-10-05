import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fail, parseBody, requireOwnerApi } from "@/lib/api";
import { audit } from "@/lib/audit";

const schema = z
  .object({ disabled: z.boolean().optional(), role: z.enum(["owner", "staff"]).optional() })
  .refine((v) => v.disabled !== undefined || v.role !== undefined, "Nothing to change");

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { staff: me, error } = await requireOwnerApi();
  if (error) return error;

  const { data, error: bad } = await parseBody(req, schema);
  if (bad) return bad;

  const target = await prisma.staff.findUnique({ where: { id } });
  if (!target) return fail("Not found", 404);

  // Don't let the last owner lock everybody out (or lock themselves out by accident).
  const losesOwner = target.role === "owner" && (data.role === "staff" || data.disabled === true);
  if (losesOwner) {
    if (target.id === me.id) return fail("You can't demote or disable yourself.", 400);
    const otherOwners = await prisma.staff.count({ where: { role: "owner", disabled: false, id: { not: id } } });
    if (otherOwners === 0) return fail("There has to be at least one active owner.", 400);
  }
  if (target.id === me.id && data.disabled === true) return fail("You can't disable yourself.", 400);

  await prisma.staff.update({ where: { id }, data });

  if (data.disabled !== undefined) {
    await audit({
      staffId: me.id,
      action: data.disabled ? "staff_disable" : "staff_enable",
      targetType: "staff",
      targetId: id,
      metadata: { username: target.username },
    });
  }
  if (data.role !== undefined && data.role !== target.role) {
    await audit({
      staffId: me.id,
      action: "staff_role",
      targetType: "staff",
      targetId: id,
      metadata: { username: target.username, role: data.role },
    });
  }
  return NextResponse.json({ ok: true });
}
