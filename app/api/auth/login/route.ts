import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { clientIp } from "@/lib/rateLimit";
import { fail, limited, parseBody } from "@/lib/api";
import { loginSchema } from "@/lib/validations";

// Compared against when the account doesn't exist, so "no such user" takes as long as "wrong password".
let dummyHash: string | null = null;

export async function POST(req: NextRequest) {
  const blocked = limited(`login:${clientIp(req)}`, 10, 5 * 60 * 1000);
  if (blocked) return blocked;

  const { data, error } = await parseBody(req, loginSchema);
  if (error) return error;

  const identifier = data.identifier.toLowerCase();
  const blockedId = limited(`login-id:${identifier}`, 8, 15 * 60 * 1000);
  if (blockedId) return blockedId;

  const staff = await prisma.staff.findFirst({
    where: { OR: [{ email: identifier }, { username: identifier }] },
  });

  if (!staff) {
    dummyHash ??= bcrypt.hashSync("not-a-real-password", 12);
    await bcrypt.compare(data.password, dummyHash);
    return fail("Wrong email/username or password", 401);
  }

  const valid = await bcrypt.compare(data.password, staff.passwordHash);
  if (!valid) return fail("Wrong email/username or password", 401);
  if (staff.disabled) return fail("This account has been disabled. Ask an owner.", 403);

  const session = await getSession();

  if (staff.twoFactorEnabled) {
    // password is right, but we don't hand out a real session until the code checks out
    session.staffId = undefined;
    session.pendingTwoFactorStaffId = staff.id;
    session.pendingTwoFactorAt = Date.now();
    await session.save();
    return NextResponse.json({ requiresTwoFactor: true });
  }

  session.staffId = staff.id;
  await session.save();
  await prisma.staff.update({ where: { id: staff.id }, data: { lastLoginAt: new Date() } });

  return NextResponse.json({ ok: true });
}
