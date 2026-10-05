import { z } from "zod";
import { ACCENTS, CATEGORIES, INCIDENT_SEVERITIES, INCIDENT_STATUSES, STATUSES } from "@/lib/constants";

const RESERVED = new Set([
  "admin", "administrator", "api", "staff", "team", "owner", "support", "help", "root",
  "system", "system98", "dashboard", "login", "logout", "join", "null", "undefined", "me",
]);

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(24, "Username must be at most 24 characters")
  .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers and underscores in usernames")
  .refine((v) => !RESERVED.has(v.toLowerCase()), "That username is reserved");

export const emailSchema = z.string().trim().toLowerCase().max(200).pipe(z.email("Enter a valid email address"));

export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(72, "Password is too long (max 72)");

const noLineBreaks = (v: string) => !/[\r\n\u2028\u2029]/.test(v);

export function isHttpUrl(v: string, httpsOnly = false): boolean {
  try {
    const u = new URL(v);
    return httpsOnly ? u.protocol === "https:" : u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export const httpUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => isHttpUrl(v), "Links must start with http:// or https://");

// ---------- accounts ----------

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your email or username").max(200),
  password: z.string().min(1, "Enter your password").max(200),
});

export const joinSchema = z.object({
  key: z.string().trim().min(6, "Enter your key").max(80),
  email: emailSchema,
  username: usernameSchema,
  password: passwordSchema,
});

export const accountSchema = z.object({
  username: usernameSchema.optional(),
  email: emailSchema.optional(),
  currentPassword: z.string().max(200).optional(),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password").max(200),
  newPassword: passwordSchema,
});

// ---------- profile ----------

export const profileSchema = z.object({
  displayName: z.string().trim().min(1, "Give yourself a display name").max(40),
  title: z.string().trim().max(40),
  bio: z.string().trim().max(500),
  languages: z.string().trim().max(40),
  avatarUrl: z
    .string()
    .trim()
    .max(300)
    .refine((v) => v === "" || isHttpUrl(v, true), "Avatar must be an https:// image link"),
  accent: z.enum(ACCENTS),
  isPublic: z.boolean(),
  links: z
    .array(z.object({ label: z.string().trim().min(1, "Every link needs a label").max(32), url: httpUrl }))
    .max(8, "Max. 8 links"),
});

// ---------- support ----------

export const ticketCreateSchema = z.object({
  name: z.string().trim().min(1, "Tell us what to call you").max(60).refine(noLineBreaks),
  email: emailSchema,
  category: z.enum(CATEGORIES),
  subject: z.string().trim().min(3, "The subject is a bit short").max(120).refine(noLineBreaks),
  message: z.string().trim().min(10, "Add a few more details (10+ characters)").max(4000),
  lang: z.string().trim().max(5).optional(),
  website: z.string().max(200).optional(), // honeypot
});

export const ticketTrackSchema = z.object({
  code: z.string().trim().min(3).max(20),
  email: emailSchema,
});

export const messageSchema = z.object({
  body: z.string().trim().min(1, "Write something first").max(4000),
});

export const statusSchema = z.object({ status: z.enum(STATUSES) });

// ---------- owner tools ----------

export const keyCreateSchema = z.object({
  label: z.string().trim().max(60).default(""),
  maxUses: z.number().int().min(1).max(100),
  expiresInDays: z.number().int().min(1).max(365).nullable(),
  count: z.number().int().min(1).max(20).default(1),
});

// ---------- two-factor ----------

/** 6-digit app code, or a recovery code like A1B2C-3D4E5 */
export const twoFactorCodeSchema = z
  .string()
  .trim()
  .min(1, "Enter your code")
  .refine(
    (v) => /^\d{6}$/.test(v.replace(/\s+/g, "")) || /^[A-F0-9]{5}-[A-F0-9]{5}$/i.test(v),
    "Enter the 6-digit code from your app, or a recovery code"
  );

export const twoFactorSetupSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export const twoFactorGuardSchema = z.object({
  password: z.string().min(1, "Enter your password").max(200),
  code: twoFactorCodeSchema,
});

// ---------- incidents ----------

export const incidentCreateSchema = z.object({
  title: z.string().trim().min(3, "Give the incident a short title").max(120).refine((v) => !/[\r\n]/.test(v)),
  severity: z.enum(INCIDENT_SEVERITIES),
  body: z.string().trim().min(3, "Say what's going on").max(2000),
});

export const incidentUpdateSchema = z.object({
  status: z.enum(INCIDENT_STATUSES),
  body: z.string().trim().min(3, "Write a short update").max(2000),
});
