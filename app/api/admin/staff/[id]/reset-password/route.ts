import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { fail, requireOwnerApi } from "@/lib/api";
import { randomPassword } from "@/lib/keys";
import { audit } from "@/lib/audit";

// No "forgot password" e-mail flow for staff: an owner hands out a temporary password instead.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { staff: me, error } = await requireOwnerApi();
  if (error) return error;

  const target = await prisma.staff.findUnique({ where: { id } });
  if (!target) return fail("Not found", 404);

  const temp = randomPassword(14);
  await prisma.staff.update({ where: { id }, data: { passwordHash: await bcrypt.hash(temp, 12) } });
  await audit({
    staffId: me.id,
    action: "staff_reset_password",
    targetType: "staff",
    targetId: id,
    metadata: { username: target.username },
  });
  return NextResponse.json({ password: temp });
}
