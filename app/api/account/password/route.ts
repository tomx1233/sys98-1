import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { fail, limited, parseBody, requireStaffApi } from "@/lib/api";
import { passwordChangeSchema } from "@/lib/validations";

export async function POST(req: NextRequest) {
  const { staff, error } = await requireStaffApi();
  if (error) return error;
  const blocked = limited(`password:${staff.id}`, 8, 15 * 60 * 1000);
  if (blocked) return blocked;

  const { data, error: bad } = await parseBody(req, passwordChangeSchema);
  if (bad) return bad;

  if (!(await bcrypt.compare(data.currentPassword, staff.passwordHash))) {
    return fail("Your current password is wrong", 403);
  }
  const passwordHash = await bcrypt.hash(data.newPassword, 12);
  await prisma.staff.update({ where: { id: staff.id }, data: { passwordHash } });
  return NextResponse.json({ ok: true });
}
