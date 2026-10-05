import crypto from "crypto";

const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Short, readable ticket number, e.g. T-K7M2QX */
export function newTicketCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return `T-${s}`;
}

/** Accepts "k7m2qx", "T-K7M2QX", "t k7m2qx" … */
export function normalizeTicketCode(raw: string): string {
  const body = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^T/, "");
  return `T-${body}`;
}

/** The link that gets you into a ticket without an account. Long on purpose. */
export function newAccessToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export function siteUrl(): string {
  return (process.env.SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
}

export function ticketUrl(token: string): string {
  return `${siteUrl()}/support/ticket/${token}`;
}
