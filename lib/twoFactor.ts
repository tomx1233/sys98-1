import crypto from "crypto";
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";

const ISSUER = "system98";
const RECOVERY_CODE_COUNT = 10;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

authenticator.options = { window: 1 }; // tolerate one 30s step of clock drift

/**
 * The TOTP secret is stored encrypted, so a leaked database alone isn't enough to generate codes.
 * Key comes from TWO_FACTOR_SECRET if set, otherwise from SESSION_SECRET.
 * (Changing that value later makes existing 2FA setups unreadable — an owner can reset them in Team.)
 */
function encryptionKey(): Buffer {
  const base = process.env.TWO_FACTOR_SECRET || process.env.SESSION_SECRET;
  if (!base) throw new Error("SESSION_SECRET is not set");
  return crypto.createHash("sha256").update(`s98-2fa:${base}`).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

export function decryptSecret(stored: string): string {
  const [iv, tag, data] = stored.split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function totpKeyUri(secret: string, accountLabel: string): string {
  return authenticator.keyuri(accountLabel, ISSUER, secret);
}

export function verifyTotpCode(secret: string, code: string): boolean {
  try {
    return authenticator.check(code.replace(/\s+/g, ""), secret);
  } catch {
    return false;
  }
}

// ---------- recovery codes ----------

function randomRecoveryCode(): string {
  const hex = crypto.randomBytes(5).toString("hex").toUpperCase();
  return `${hex.slice(0, 5)}-${hex.slice(5)}`;
}

export async function generateRecoveryCodes() {
  const plaintext = Array.from({ length: RECOVERY_CODE_COUNT }, randomRecoveryCode);
  const hashed = await Promise.all(plaintext.map((c) => bcrypt.hash(c, 10)));
  return { plaintext, hashed };
}

export function isRecoveryCodeFormat(code: string): boolean {
  return /^[A-F0-9]{5}-[A-F0-9]{5}$/i.test(code.trim());
}

async function consumeRecoveryCode(code: string, hashes: string[]): Promise<string[] | null> {
  const normalized = code.trim().toUpperCase();
  for (let i = 0; i < hashes.length; i++) {
    if (await bcrypt.compare(normalized, hashes[i])) return [...hashes.slice(0, i), ...hashes.slice(i + 1)];
  }
  return null;
}

/**
 * Checks a 6-digit app code or a recovery code against a staff member.
 * When a recovery code matches, `remainingHashes` is the list without it (caller must persist that).
 */
export async function checkSecondFactor(
  staff: { twoFactorSecret: string | null; twoFactorRecoveryCodes: string[] },
  code: string
): Promise<{ ok: boolean; usedRecovery: boolean; remainingHashes?: string[] }> {
  if (!staff.twoFactorSecret) return { ok: false, usedRecovery: false };
  if (isRecoveryCodeFormat(code)) {
    const remaining = await consumeRecoveryCode(code, staff.twoFactorRecoveryCodes);
    return remaining ? { ok: true, usedRecovery: true, remainingHashes: remaining } : { ok: false, usedRecovery: true };
  }
  return { ok: verifyTotpCode(decryptSecret(staff.twoFactorSecret), code), usedRecovery: false };
}

// ---------- lockout after repeated wrong codes ----------

export function isLockedOut(until: Date | null): boolean {
  return Boolean(until && until.getTime() > Date.now());
}

export function lockoutMinutes(until: Date | null): number {
  return until ? Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60000)) : 0;
}

export function nextFailedState(current: number) {
  const attempts = current + 1;
  if (attempts >= MAX_FAILED_ATTEMPTS) {
    return { twoFactorFailedAttempts: 0, twoFactorLockedUntil: new Date(Date.now() + LOCKOUT_MS) };
  }
  return { twoFactorFailedAttempts: attempts, twoFactorLockedUntil: null };
}
