import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { limited, parseBody, requireStaffApi } from "@/lib/api";
import { twoFactorGuardSchema } from "@/lib/validations";
import { requirePasswordAndCode } from "@/lib/twoFactorGuard";
import { audit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const { staff, error } = await requireStaffApi();
  if (error) return error;
  const blocked = limited(`2fa-disable:${staff.id}`, 10, 10 * 60 * 1000);
  if (blocked) return blocked;

  const { data, error: bad } = await parseBody(req, twoFactorGuardSchema);
  if (bad) return bad;
  const denied = await requirePasswordAndCode(staff, data);
  if (denied) return denied;

  await prisma.staff.update({
    where: { id: staff.id },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorRecoveryCodes: [],
      twoFactorFailedAttempts: 0,
      twoFactorLockedUntil: null,
    },
  });
  await audit({ staffId: staff.id, action: "staff_2fa_disable", targetType: "staff", targetId: staff.id });
  return NextResponse.json({ ok: true });
}
