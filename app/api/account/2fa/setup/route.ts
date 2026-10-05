import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { fail, requireStaffApi } from "@/lib/api";
import { getSession } from "@/lib/session";
import { generateTotpSecret, totpKeyUri } from "@/lib/twoFactor";

// Step 1: hand out a fresh secret + QR code. Nothing is active until /confirm succeeds.
export async function POST() {
  const { staff, error } = await requireStaffApi();
  if (error) return error;
  if (staff.twoFactorEnabled) return fail("Two-factor is already on.", 400);

  const secret = generateTotpSecret();
  const qrDataUrl = await QRCode.toDataURL(totpKeyUri(secret, staff.email), { margin: 1, width: 220 });

  const session = await getSession();
  session.pendingTwoFactorSecret = secret;
  await session.save();

  return NextResponse.json({ qrDataUrl, secret });
}
