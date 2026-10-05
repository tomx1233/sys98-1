import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { limited, parseBody, requireStaffApi } from "@/lib/api";
import { twoFactorGuardSchema } from "@/lib/validations";
import { requirePasswordAndCode } from "@/lib/twoFactorGuard";
import { generateRecoveryCodes } from "@/lib/twoFactor";

// Replaces all recovery codes with a fresh set (old ones stop working).
export async function POST(req: NextRequest) {
  const { staff, error } = await requireStaffApi();
  if (error) return error;
  const blocked = limited(`2fa-codes:${staff.id}`, 10, 10 * 60 * 1000);
  if (blocked) return blocked;

  const { data, error: bad } = await parseBody(req, twoFactorGuardSchema);
  if (bad) return bad;
  const denied = await requirePasswordAndCode(staff, data);
  if (denied) return denied;

  const { plaintext, hashed } = await generateRecoveryCodes();
  await prisma.staff.update({ where: { id: staff.id }, data: { twoFactorRecoveryCodes: hashed } });
  return NextResponse.json({ recoveryCodes: plaintext });
}
