import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, requireOwnerApi } from "@/lib/api";
import { audit } from "@/lib/audit";

// Lost phone AND recovery codes? An owner switches 2FA off for that account so they can log in and set it up again.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { staff: me, error } = await requireOwnerApi();
  if (error) return error;

  const target = await prisma.staff.findUnique({ where: { id } });
  if (!target) return fail("Not found", 404);
  if (target.id === me.id) return fail("Use the settings page for your own account.", 400);

  await prisma.staff.update({
    where: { id },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorRecoveryCodes: [],
      twoFactorFailedAttempts: 0,
      twoFactorLockedUntil: null,
    },
  });
  await audit({
    staffId: me.id,
    action: "staff_2fa_reset",
    targetType: "staff",
    targetId: id,
    metadata: { username: target.username },
  });
  return NextResponse.json({ ok: true });
}
