import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { fail, limited, parseBody, requireStaffApi } from "@/lib/api";
import { accountSchema } from "@/lib/validations";

export async function PATCH(req: NextRequest) {
  const { staff, error } = await requireStaffApi();
  if (error) return error;
  const blocked = limited(`account:${staff.id}`, 20, 10 * 60 * 1000);
  if (blocked) return blocked;

  const { data, error: bad } = await parseBody(req, accountSchema);
  if (bad) return bad;

  const update: { username?: string; email?: string } = {};
  if (data.username && data.username.toLowerCase() !== staff.username) {
    update.username = data.username.toLowerCase();
  }
  if (data.email && data.email !== staff.email) {
    // changing the address you log in with needs the password again
    if (!data.currentPassword || !(await bcrypt.compare(data.currentPassword, staff.passwordHash))) {
      return fail("Enter your current password to change your email", 403);
    }
    update.email = data.email;
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ ok: true });

  try {
    await prisma.staff.update({ where: { id: staff.id }, data: update });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail("That username or email is already in use", 409);
    }
    throw e;
  }
  return NextResponse.json({ ok: true });
}
