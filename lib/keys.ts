import crypto from "crypto";

// No 0/O/1/I/L/U — keys get read out loud and typed from screenshots.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const GROUPS = 3;
const GROUP_LEN = 5;

/** e.g. S98-K7M2Q-XW4HD-9TNRB */
export function generateStaffKey(): string {
  const groups: string[] = [];
  for (let g = 0; g < GROUPS; g++) {
    let group = "";
    for (let i = 0; i < GROUP_LEN; i++) group += ALPHABET[crypto.randomInt(ALPHABET.length)];
    groups.push(group);
  }
  return `S98-${groups.join("-")}`;
}

/** Uppercase, letters and digits only — so "s98 k7m2q xw4hd…" and "S98-K7M2Q-…" are the same key. */
export function canonicalKey(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashKey(canonical: string): string {
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

export function prettyKey(canonical: string): string {
  const body = canonical.replace(/^S98/, "");
  const groups = body.match(new RegExp(`.{1,${GROUP_LEN}}`, "g")) ?? [];
  return ["S98", ...groups].join("-");
}

/** First segment shown in the key list so you can tell keys apart after the plaintext is gone. */
export function keyPrefixOf(canonical: string): string {
  return prettyKey(canonical).slice(0, 9);
}

export function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export type KeyStatus = "active" | "used up" | "expired" | "disabled";

export function keyStatus(k: {
  disabled: boolean;
  expiresAt: Date | null;
  usedCount: number;
  maxUses: number;
}): KeyStatus {
  if (k.disabled) return "disabled";
  if (k.expiresAt && k.expiresAt.getTime() < Date.now()) return "expired";
  if (k.usedCount >= k.maxUses) return "used up";
  return "active";
}

export function randomPassword(length = 14): string {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return out;
}
