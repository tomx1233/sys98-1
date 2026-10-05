import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, limited, parseBody, requireStaffApi } from "@/lib/api";
import { getSession } from "@/lib/session";
import { twoFactorSetupSchema } from "@/lib/validations";
import { encryptSecret, generateRecoveryCodes, verifyTotpCode } from "@/lib/twoFactor";
import { audit } from "@/lib/audit";

// Step 2: prove the authenticator app works, then switch 2FA on and show recovery codes (once).
export async function POST(req: NextRequest) {
  const { staff, error } = await requireStaffApi();
  if (error) return error;
  const blocked = limited(`2fa-confirm:${staff.id}`, 10, 10 * 60 * 1000);
  if (blocked) return blocked;

  const session = await getSession();
  const secret = session.pendingTwoFactorSecret;
  if (!secret) return fail("No setup in progress. Start again.", 400);

  const { data, error: bad } = await parseBody(req, twoFactorSetupSchema);
  if (bad) return bad;
  if (!verifyTotpCode(secret, data.code)) return fail("That code doesn't match. Try the next one.", 400);

  const { plaintext, hashed } = await generateRecoveryCodes();
  await prisma.staff.update({
    where: { id: staff.id },
    data: {
      twoFactorEnabled: true,
      twoFactorSecret: encryptSecret(secret),
      twoFactorRecoveryCodes: hashed,
      twoFactorFailedAttempts: 0,
      twoFactorLockedUntil: null,
    },
  });
  session.pendingTwoFactorSecret = undefined;
  await session.save();
  await audit({ staffId: staff.id, action: "staff_2fa_enable", targetType: "staff", targetId: staff.id });

  return NextResponse.json({ ok: true, recoveryCodes: plaintext });
}
