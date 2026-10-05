import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail } from "@/lib/api";
import { checkSecondFactor, isLockedOut, lockoutMinutes, nextFailedState } from "@/lib/twoFactor";
import type { CurrentStaff } from "@/lib/auth";

/**
 * For sensitive 2FA changes (turn off, new recovery codes): needs the password AND a valid code.
 * Returns an error response, or null when everything checked out. A used recovery code is burned.
 */
export async function requirePasswordAndCode(
  staff: CurrentStaff,
  input: { password: string; code: string }
): Promise<NextResponse | null> {
  if (!staff.twoFactorEnabled) return fail("Two-factor isn't on.", 400);
  if (isLockedOut(staff.twoFactorLockedUntil)) {
    return fail(`Too many wrong codes. Try again in ${lockoutMinutes(staff.twoFactorLockedUntil)} min.`, 429);
  }

  const pwOk = await bcrypt.compare(input.password, staff.passwordHash);
  const result = pwOk ? await checkSecondFactor(staff, input.code) : { ok: false, usedRecovery: false };

  if (!pwOk || !result.ok) {
    await prisma.staff.update({ where: { id: staff.id }, data: nextFailedState(staff.twoFactorFailedAttempts) });
    return fail("Password or code is wrong.", 401);
  }
  if ("remainingHashes" in result && result.remainingHashes) {
    await prisma.staff.update({ where: { id: staff.id }, data: { twoFactorRecoveryCodes: result.remainingHashes } });
  }
  return null;
}
