import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function POST() {
  const session = await getSession();
  session.pendingTwoFactorStaffId = undefined;
  session.pendingTwoFactorAt = undefined;
  await session.save();
  return NextResponse.json({ ok: true });
}
