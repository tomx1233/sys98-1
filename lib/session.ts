import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "s98_staff";

export interface SessionData {
  staffId?: string;
  /** password was right, second factor still outstanding (expires after a few minutes) */
  pendingTwoFactorStaffId?: string;
  pendingTwoFactorAt?: number;
  /** secret generated during 2FA setup, not active until the first code is confirmed */
  pendingTwoFactorSecret?: string;
}

function options(): SessionOptions {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error("SESSION_SECRET is missing or shorter than 32 characters — see .env.example");
  }
  return {
    password,
    cookieName: SESSION_COOKIE,
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 14,
    },
  };
}

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), options());
}
