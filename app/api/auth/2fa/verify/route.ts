import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { clientIp } from "@/lib/rateLimit";
import { fail, limited, parseBody } from "@/lib/api";
import { twoFactorCodeSchema } from "@/lib/validations";
import { z } from "zod";
import { checkSecondFactor, isLockedOut, lockoutMinutes, nextFailedState } from "@/lib/twoFactor";

const PENDING_MAX_AGE_MS = 5 * 60 * 1000;

// Step 2 of logging in for accounts with 2FA.
export async function POST(req: NextRequest) {
  const blocked = limited(`2fa-verify:${clientIp(req)}`, 15, 10 * 60 * 1000);
  if (blocked) return blocked;

  const session = await getSession();
  const id = session.pendingTwoFactorStaffId;
  const fresh = session.pendingTwoFactorAt && Date.now() - session.pendingTwoFactorAt < PENDING_MAX_AGE_MS;
  if (!id || !fresh) {
    session.pendingTwoFactorStaffId = undefined;
    session.pendingTwoFactorAt = undefined;
    await session.save();
    return fail("Your login expired. Start again with your password.", 401);
  }

  const { data, error } = await parseBody(req, z.object({ code: twoFactorCodeSchema }));
  if (error) return error;

  const staff = await prisma.staff.findUnique({ where: { id } });
  if (!staff || staff.disabled || !staff.twoFactorEnabled) return fail("Your login expired. Start again.", 401);

  if (isLockedOut(staff.twoFactorLockedUntil)) {
    return fail(`Too many wrong codes. Try again in ${lockoutMinutes(staff.twoFactorLockedUntil)} min.`, 429);
  }

  const result = await checkSecondFactor(staff, data.code);
  if (!result.ok) {
    const next = nextFailedState(staff.twoFactorFailedAttempts);
    await prisma.staff.update({ where: { id: staff.id }, data: next });
    const locked = isLockedOut(next.twoFactorLockedUntil);
    return fail(locked ? "Too many wrong codes. Try again in 15 min." : "That code isn't right.", locked ? 429 : 401);
  }

  await prisma.staff.update({
    where: { id: staff.id },
    data: {
      twoFactorFailedAttempts: 0,
      twoFactorLockedUntil: null,
      lastLoginAt: new Date(),
      ...(result.remainingHashes ? { twoFactorRecoveryCodes: result.remainingHashes } : {}),
    },
  });

  session.pendingTwoFactorStaffId = undefined;
  session.pendingTwoFactorAt = undefined;
  session.staffId = staff.id;
  await session.save();

  return NextResponse.json({
    ok: true,
    recoveryCodesLeft: result.usedRecovery ? result.remainingHashes?.length : undefined,
  });
}
