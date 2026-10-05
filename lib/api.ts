import { NextRequest, NextResponse } from "next/server";
import type { z } from "zod";
import { getCurrentStaff, type CurrentStaff } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";

export function fail(message: string, status = 400, headers?: Record<string, string>) {
  return NextResponse.json({ error: message }, { status, headers });
}

export async function requireStaffApi(): Promise<
  { staff: CurrentStaff; error: null } | { staff: null; error: NextResponse }
> {
  const staff = await getCurrentStaff();
  if (!staff) return { staff: null, error: fail("Not signed in", 401) };
  return { staff, error: null };
}

export async function requireOwnerApi(): Promise<
  { staff: CurrentStaff; error: null } | { staff: null; error: NextResponse }
> {
  const res = await requireStaffApi();
  if (res.error) return res;
  if (res.staff.role !== "owner") return { staff: null, error: fail("Owners only", 403) };
  return res;
}

/** Parses the JSON body with a zod schema. Returns either the data or a ready-made 400 response. */
export async function parseBody<S extends z.ZodType>(
  req: NextRequest,
  schema: S
): Promise<{ data: z.infer<S>; error: null } | { data: null; error: NextResponse }> {
  const raw = await req.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { data: null, error: fail(parsed.error.issues[0]?.message ?? "Invalid input", 400) };
  }
  return { data: parsed.data, error: null };
}

/** Returns a 429 response when the bucket is used up, otherwise null. */
export function limited(key: string, limit: number, windowMs: number): NextResponse | null {
  const r = rateLimit(key, limit, windowMs);
  if (r.allowed) return null;
  return fail("Too many attempts — try again in a bit.", 429, {
    "Retry-After": String(r.retryAfterSeconds),
  });
}
